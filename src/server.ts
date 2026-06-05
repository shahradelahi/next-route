import { RouteError, RouteValidationError } from './errors';
import type { StandardSchemaV1 } from './standard';
import type {
  ErrorHandlerFn,
  HandlerFunction,
  MiddlewareFunction,
  NextFunction,
  RouteDefinition,
} from './typings';

export class RouteBuilder<
  TParamsSchema extends StandardSchemaV1 | undefined = undefined,
  TQuerySchema extends StandardSchemaV1 | undefined = undefined,
  TBodySchema extends StandardSchemaV1 | undefined = undefined,
  // eslint-disable-next-line @typescript-eslint/no-empty-object-type
  TContext = {},
  TMetadataSchema extends StandardSchemaV1 | undefined = undefined,
  TMethod extends string = 'GET',
> {
  // Config & state
  #paramsSchema?: TParamsSchema;
  #querySchema?: TQuerySchema;
  #bodySchema?: TBodySchema;
  #metadataSchema?: TMetadataSchema;
  #metadataValue?: any;
  #middlewares: Array<MiddlewareFunction<any, any, any>> = [];
  #onError?: ErrorHandlerFn;
  #method: TMethod = 'GET' as TMethod;

  constructor(options?: { onError?: ErrorHandlerFn }) {
    this.#onError = options?.onError;
  }

  method<M extends string>(m: M) {
    const clone = this.#clone();
    clone.#method = m as any;
    return clone as unknown as RouteBuilder<
      TParamsSchema,
      TQuerySchema,
      TBodySchema,
      TContext,
      TMetadataSchema,
      M
    >;
  }

  params<T extends StandardSchemaV1>(schema: T) {
    const clone = this.#clone();
    clone.#paramsSchema = schema as any;
    return clone as unknown as RouteBuilder<
      T,
      TQuerySchema,
      TBodySchema,
      TContext,
      TMetadataSchema,
      TMethod
    >;
  }

  query<T extends StandardSchemaV1>(schema: T) {
    const clone = this.#clone();
    clone.#querySchema = schema as any;
    return clone as unknown as RouteBuilder<
      TParamsSchema,
      T,
      TBodySchema,
      TContext,
      TMetadataSchema,
      TMethod
    >;
  }

  body<T extends StandardSchemaV1>(schema: T) {
    const clone = this.#clone();
    clone.#bodySchema = schema as any;
    return clone as unknown as RouteBuilder<
      TParamsSchema,
      TQuerySchema,
      T,
      TContext,
      TMetadataSchema,
      TMethod
    >;
  }

  defineMetadata<T extends StandardSchemaV1>(schema: T) {
    const clone = this.#clone();
    clone.#metadataSchema = schema as any;
    return clone as unknown as RouteBuilder<
      TParamsSchema,
      TQuerySchema,
      TBodySchema,
      TContext,
      T,
      TMethod
    >;
  }

  metadata(
    value: TMetadataSchema extends StandardSchemaV1
      ? StandardSchemaV1.InferInput<TMetadataSchema>
      : never
  ) {
    const clone = this.#clone();
    clone.#metadataValue = value;
    return clone as unknown as RouteBuilder<
      TParamsSchema,
      TQuerySchema,
      TBodySchema,
      TContext,
      TMetadataSchema,
      TMethod
    >;
  }

  use<TNewContext extends Record<string, unknown>>(
    middleware: MiddlewareFunction<
      TContext,
      TNewContext & TContext,
      TMetadataSchema extends StandardSchemaV1
        ? StandardSchemaV1.InferOutput<TMetadataSchema>
        : unknown
    >
  ) {
    const clone = this.#clone();
    clone.#middlewares.push(middleware);
    return clone as unknown as RouteBuilder<
      TParamsSchema,
      TQuerySchema,
      TBodySchema,
      Omit<TContext, keyof TNewContext> & TNewContext,
      TMetadataSchema,
      TMethod
    >;
  }

  handler<TReturn>(
    handlerFn: HandlerFunction<
      TParamsSchema extends StandardSchemaV1
        ? StandardSchemaV1.InferOutput<TParamsSchema>
        : unknown,
      TQuerySchema extends StandardSchemaV1 ? StandardSchemaV1.InferOutput<TQuerySchema> : unknown,
      TBodySchema extends StandardSchemaV1 ? StandardSchemaV1.InferOutput<TBodySchema> : unknown,
      TContext,
      TMetadataSchema extends StandardSchemaV1
        ? StandardSchemaV1.InferOutput<TMetadataSchema>
        : unknown,
      TReturn
    >
  ) {
    const apiHandler = async (
      request: Request,
      context: { params: Promise<Record<string, string>> | Record<string, string> }
    ): Promise<Response> => {
      try {
        const url = new URL(request.url);

        // 1. Resolve Next.js 15+ async params
        const rawParams = context?.params ? await context.params : {};

        // 2. Parse Query
        const rawQuery = Object.fromEntries(
          [...url.searchParams.keys()].map((key) => {
            const values = url.searchParams.getAll(key);
            return values.length === 1 ? [key, values[0]] : [key, values];
          })
        );

        // 3. Parse Body
        let rawBody: unknown = {};
        if (request.method !== 'GET' && request.method !== 'HEAD') {
          const contentType = request.headers.get('content-type') || '';
          if (contentType.includes('application/json')) {
            rawBody = await request.json().catch(() => ({}));
          } else if (
            contentType.includes('multipart/form-data') ||
            contentType.includes('application/x-www-form-urlencoded')
          ) {
            const formData = await request.formData().catch(() => new FormData());
            rawBody = Object.fromEntries(formData.entries());
          }
        }

        // 4. Validate
        const params = await this.#validateSchema(this.#paramsSchema, rawParams);
        const query = await this.#validateSchema(this.#querySchema, rawQuery);
        const body = await this.#validateSchema(this.#bodySchema, rawBody);
        const metadata = await this.#validateSchema(this.#metadataSchema, this.#metadataValue);

        // 5. Run Middlewares
        let currentCtx = {} as TContext;

        const executeMiddleware = async (index: number): Promise<Response> => {
          if (index >= this.#middlewares.length) {
            const result = await handlerFn(request, {
              params,
              query,
              body,
              ctx: currentCtx,
              metadata,
            });
            if (result instanceof Response) return result;
            return Response.json(result);
          }

          const middleware = this.#middlewares[index]!;
          const next: NextFunction<any> = async (opts) => {
            if (opts?.ctx) currentCtx = { ...currentCtx, ...opts.ctx };
            return (await executeMiddleware(index + 1)) as any;
          };

          return await middleware({ request, ctx: currentCtx, metadata, next });
        };

        return await executeMiddleware(0);
      } catch (error) {
        if (this.#onError) {
          return this.#onError({ error, request });
        }

        if (error instanceof RouteValidationError) {
          return Response.json(
            { success: false, error: error.message, issues: error.issues },
            { status: 400 }
          );
        }
        if (error instanceof RouteError) {
          return Response.json(
            { success: false, error: error.message },
            { status: error.statusCode }
          );
        }
        return Response.json({ success: false, error: 'Internal Server Error' }, { status: 500 });
      }
    };

    // Cast the returned function with our special inference type.
    // The client hook will use this to infer inputs/outputs!
    return apiHandler as typeof apiHandler &
      RouteDefinition<
        TParamsSchema extends StandardSchemaV1
          ? StandardSchemaV1.InferInput<TParamsSchema>
          : undefined,
        TQuerySchema extends StandardSchemaV1
          ? StandardSchemaV1.InferInput<TQuerySchema>
          : undefined,
        TBodySchema extends StandardSchemaV1 ? StandardSchemaV1.InferInput<TBodySchema> : undefined,
        TReturn,
        TMethod
      >;
  }

  async #validateSchema(schema: StandardSchemaV1 | undefined, data: unknown) {
    if (!schema) return data as any;
    const result = await schema['~standard'].validate(data);
    if (result.issues) {
      throw new RouteValidationError(result.issues);
    }
    return result.value;
  }

  #clone() {
    const builder = new RouteBuilder<
      TParamsSchema,
      TQuerySchema,
      TBodySchema,
      TContext,
      TMetadataSchema,
      TMethod
    >({
      onError: this.#onError,
    });
    builder.#paramsSchema = this.#paramsSchema;
    builder.#querySchema = this.#querySchema;
    builder.#bodySchema = this.#bodySchema;
    builder.#metadataSchema = this.#metadataSchema;
    builder.#metadataValue = this.#metadataValue;
    builder.#middlewares = [...this.#middlewares];
    builder.#method = this.#method;
    return builder;
  }
}

export function createRoute(options?: { onError?: ErrorHandlerFn }) {
  return new RouteBuilder(options);
}
