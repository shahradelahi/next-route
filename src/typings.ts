export type MiddlewareResult<TContext> = Response & { ctx?: TContext };

export type NextFunction<TContext> = {
  <NC extends object = Record<string, never>>(opts?: {
    ctx?: NC;
  }): Promise<MiddlewareResult<NC & TContext>>;
};

export type MiddlewareFunction<
  TContext = Record<string, unknown>,
  TNextContext = Record<string, unknown>,
  TMetadata = unknown,
> = (opts: {
  request: any;
  ctx: TContext;
  metadata: TMetadata;
  next: NextFunction<TContext>;
}) => Promise<MiddlewareResult<TNextContext>>;

export type HandlerFunction<
  TParams,
  TQuery,
  TBody,
  TContext,
  TMetadata = unknown,
  TReturn = unknown,
> = (
  request: any,
  context: { params: TParams; query: TQuery; body: TBody; ctx: TContext; metadata: TMetadata }
) => Promise<TReturn> | TReturn;

export type ErrorHandlerFn = (ctx: {
  error: unknown;
  request: Request;
}) => Response | Promise<Response>;

// Inference utilities for the client
export type RouteDefinition<TParams, TQuery, TBody, TReturn, TMethod = 'GET'> = {
  _params: TParams;
  _query: TQuery;
  _body: TBody;
  _return: TReturn;
  _method: TMethod;
};

export type InferRouteBody<T> = T extends RouteDefinition<any, any, infer B, any, any> ? B : any;
export type InferRouteQuery<T> = T extends RouteDefinition<any, infer Q, any, any, any> ? Q : any;
export type InferRouteParams<T> = T extends RouteDefinition<infer P, any, any, any, any> ? P : any;
export type InferRouteReturn<T> = T extends RouteDefinition<any, any, any, infer R, any> ? R : any;
export type InferRouteMethod<T> =
  T extends RouteDefinition<any, any, any, any, infer M> ? M : string;

// JSON Serialization types
export type JsonSerialized<T> = T extends Date
  ? string
  : T extends Map<any, any> | Set<any>
    ? Record<string, never>
    : T extends object
      ? { [K in keyof T]: JsonSerialized<T[K]> }
      : T;

export type InferClientReturn<T> = JsonSerialized<InferRouteReturn<T>>;
