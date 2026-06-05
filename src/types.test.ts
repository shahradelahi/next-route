import { describe, expectTypeOf, it } from 'vitest';
import { z } from 'zod';

import { useRouteAction } from './client';
import { createRoute } from './server';
import type {
  InferClientReturn,
  InferRouteBody,
  InferRouteMethod,
  InferRouteParams,
  InferRouteQuery,
  InferRouteReturn,
} from './typings';

describe('Type Safety', () => {
  it('should infer correct types for useRouteAction', () => {
    const route = createRoute()
      .params(z.object({ id: z.string() }))
      .query(z.object({ search: z.string().optional() }))
      .body(z.object({ name: z.string() }))
      .handler(async () => {
        return { id: 1, name: 'test', createdAt: new Date() };
      });

    type TRoute = typeof route;
    type Hook = ReturnType<typeof useRouteAction<TRoute>>;

    // Test dispatch arguments
    expectTypeOf<Hook['dispatch']>().parameter(0).toMatchObjectType<{
      params?: { id: string };
      query?: { search?: string | undefined };
      body?: { name: string };
    }>();

    // Test result type (should be JSON serialized)
    expectTypeOf<Hook['result']>().toEqualTypeOf<
      | {
          id: number;
          name: string;
          createdAt: string;
        }
      | undefined
    >();
  });

  it('should infer correct types for useRouteAction with dynamic URL', () => {
    const route = createRoute()
      .params(z.object({ id: z.string() }))
      .handler(async () => 'ok');

    type TRoute = typeof route;
    type useApiActionType = typeof useRouteAction<TRoute>;

    // The method argument should be 'GET' (default)
    expectTypeOf<Parameters<useApiActionType>[0]>().toEqualTypeOf<'GET'>();

    // The url argument should be string | ((params: { id: string }) => string)
    expectTypeOf<Parameters<useApiActionType>[1]>().toEqualTypeOf<
      string | ((params: { id: string }) => string)
    >();
  });

  it('should enforce correct HTTP method in useRouteAction', () => {
    const route = createRoute()
      .method('PATCH')
      .handler(() => 'ok');

    type TRoute = typeof route;
    type useApiActionType = typeof useRouteAction<TRoute>;

    expectTypeOf<Parameters<useApiActionType>[0]>().toEqualTypeOf<'PATCH'>();
  });

  it('should infer correct types for RouteDefinition', () => {
    const route = createRoute()
      .params(z.object({ id: z.string() }))
      .query(z.object({ search: z.string().optional() }))
      .body(z.object({ name: z.string(), age: z.number() }))
      .handler(async (_req, { params, query, body }) => {
        // Asserting internal handler types
        expectTypeOf(params).toEqualTypeOf<{ id: string }>();
        expectTypeOf(query).toEqualTypeOf<{ search?: string | undefined }>();
        expectTypeOf(body).toEqualTypeOf<{ name: string; age: number }>();

        return { success: true, userId: params.id };
      });

    type TRoute = typeof route;

    // Test external inference utilities
    expectTypeOf<InferRouteParams<TRoute>>().toEqualTypeOf<{ id: string }>();
    expectTypeOf<InferRouteQuery<TRoute>>().toEqualTypeOf<{ search?: string | undefined }>();
    expectTypeOf<InferRouteBody<TRoute>>().toEqualTypeOf<{ name: string; age: number }>();
    expectTypeOf<InferRouteReturn<TRoute>>().toEqualTypeOf<{ success: boolean; userId: string }>();
  });

  it('should infer merged context types from middlewares', () => {
    createRoute()
      .use(async ({ next }) => {
        return next({ ctx: { user: { id: 1, name: 'John' } } });
      })
      .use(async ({ ctx, next }) => {
        expectTypeOf(ctx.user).toEqualTypeOf<{ id: number; name: string }>();
        return next({ ctx: { permissions: ['admin'] } });
      })
      .handler((_req, { ctx }) => {
        expectTypeOf(ctx.user).toEqualTypeOf<{ id: number; name: string }>();
        expectTypeOf(ctx.permissions).toEqualTypeOf<string[]>();
        return { ok: true };
      });
  });

  it('should handle metadata type safety', () => {
    const schema = z.object({ role: z.string() });
    const route = createRoute()
      .defineMetadata(schema)
      .metadata({ role: 'admin' })
      .use(async ({ metadata, next }) => {
        expectTypeOf<typeof metadata>().toEqualTypeOf<{ role: string }>();
        return next();
      })
      .handler((_req, { metadata }) => {
        expectTypeOf<typeof metadata>().toEqualTypeOf<{ role: string }>();
        return 'ok';
      });

    type TRoute = typeof route;
    expectTypeOf<InferRouteReturn<TRoute>>().toEqualTypeOf<string>();
  });

  it('should correctly serialize types for the client', () => {
    const route = createRoute().handler(() => {
      return {
        date: new Date(),
        set: new Set([1]),
        nested: {
          time: new Date(),
        },
      };
    });

    type TRoute = typeof route;

    expectTypeOf<InferClientReturn<TRoute>>().toEqualTypeOf<{
      date: string;
      set: Record<string, never>;
      nested: {
        time: string;
      };
    }>();
  });

  it('should handle optional schemas gracefully', () => {
    const route = createRoute().handler(() => {
      return 'ok';
    });

    type TRoute = typeof route;
    expectTypeOf<InferRouteParams<TRoute>>().toEqualTypeOf<undefined>();
    expectTypeOf<InferRouteQuery<TRoute>>().toEqualTypeOf<undefined>();
    expectTypeOf<InferRouteBody<TRoute>>().toEqualTypeOf<undefined>();
  });

  it('should handle context overwriting in middlewares', () => {
    createRoute()
      .use(async ({ next }) => {
        return next({ ctx: { version: 1 } });
      })
      .use(async ({ next }) => {
        // Overwriting version with a different type
        return next({ ctx: { version: 'v2' } });
      })
      .handler((_req, { ctx }) => {
        expectTypeOf(ctx.version).toEqualTypeOf<string>();
        return { ok: true };
      });
  });

  it('should infer custom HTTP methods', () => {
    const route = createRoute()
      .method('PATCH')
      .handler(() => 'done');
    type TRoute = typeof route;
    expectTypeOf<InferRouteMethod<TRoute>>().toEqualTypeOf<'PATCH'>();
  });

  it('should handle complex JSON serialization edge cases', () => {
    const route = createRoute().handler(() => {
      return {
        map: new Map([['a', 1]]),
        arr: [new Date()],
        union:
          Math.random() > 0.5
            ? { type: 'd' as const, d: new Date() }
            : { type: 's' as const, s: 'str' },
      };
    });

    type TRoute = typeof route;
    type TClientReturn = InferClientReturn<TRoute>;

    expectTypeOf<TClientReturn>().toMatchObjectType<{
      map: Record<string, never>;
      arr: string[];
    }>();

    type TargetUnion = { type: 'd'; d: string } | { type: 's'; s: string };
    expectTypeOf<TClientReturn['union']>().toExtend<TargetUnion>();
    expectTypeOf<TargetUnion>().toExtend<TClientReturn['union']>();
  });
});
