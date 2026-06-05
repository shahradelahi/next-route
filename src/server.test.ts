import { describe, expect, it, vi } from 'vitest';

import { RouteError, RouteValidationError } from './errors';
import { createRoute } from './server';

const mockSchema = (fail = false) =>
  ({
    '~standard': {
      version: 1,
      vendor: 'test',
      validate: (value: any) => {
        if (fail || value?.fail) return { issues: [{ message: 'failed' }] };
        return { value };
      },
    },
  }) as any;

describe('RouteBuilder', () => {
  it('should validate body correctly', async () => {
    const route = createRoute()
      .body(mockSchema())
      .handler(async (_req, { body }) => {
        return { success: true, body };
      });

    const request = new Request('http://localhost', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ foo: 'bar' }),
    });

    const response = await route(request, { params: {} });
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.body).toEqual({ foo: 'bar' });
  });

  it('should return 400 on validation error', async () => {
    const route = createRoute()
      .body(mockSchema())
      .handler(async () => {
        return { success: true };
      });

    const request = new Request('http://localhost', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ fail: true }),
    });

    const response = await route(request, { params: {} });
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toBe('Validation failed');
    expect(data.issues).toBeDefined();
  });

  it('should return custom status code on RouteError', async () => {
    const route = createRoute().handler(async () => {
      throw new RouteError('Unauthorized', 401);
    });

    const request = new Request('http://localhost', { method: 'GET' });
    const response = await route(request, { params: {} });
    const data = await response.json();

    expect(response.status).toBe(401);
    expect(data.error).toBe('Unauthorized');
  });

  it('should use custom onError handler', async () => {
    const route = createRoute({
      onError: ({ error }) => {
        return Response.json({ custom: (error as Error).message }, { status: 418 });
      },
    }).handler(async () => {
      throw new Error('Teapot');
    });

    const request = new Request('http://localhost', { method: 'GET' });
    const response = await route(request, { params: {} });
    const data = await response.json();

    expect(response.status).toBe(418);
    expect(data.custom).toBe('Teapot');
  });

  it('should handle async onError handler', async () => {
    const route = createRoute({
      onError: async ({ error }) => {
        await new Promise((resolve) => setTimeout(resolve, 10));
        return Response.json({ asyncError: (error as Error).message }, { status: 500 });
      },
    }).handler(() => {
      throw new Error('async fail');
    });

    const response = await route(new Request('http://localhost'), { params: {} });
    const data = await response.json();

    expect(response.status).toBe(500);
    expect(data.asyncError).toBe('async fail');
  });

  it('should allow middleware to short-circuit with a Response', async () => {
    const route = createRoute()
      .use(async () => {
        return Response.json({ shortcut: true }, { status: 201 });
      })
      .handler(() => {
        return { success: true };
      });

    const response = await route(new Request('http://localhost'), { params: {} });
    const data = await response.json();

    expect(response.status).toBe(201);
    expect(data.shortcut).toBe(true);
  });

  it('should merge context across multiple middlewares', async () => {
    const route = createRoute()
      .use(async ({ next }) => {
        return next({ ctx: { a: 1 } });
      })
      .use(async ({ ctx, next }) => {
        return next({ ctx: { b: (ctx as any).a + 1 } });
      })
      .handler((_req, { ctx }) => {
        return { ctx };
      });

    const response = await route(new Request('http://localhost'), { params: {} });
    const data = await response.json();

    expect(data.ctx).toEqual({ a: 1, b: 2 });
  });

  it('should handle FormData body correctly', async () => {
    const route = createRoute()
      .body(mockSchema())
      .handler((_req, { body }) => {
        return { body };
      });

    const formData = new FormData();
    formData.append('foo', 'bar');

    const response = await route(
      new Request('http://localhost', {
        method: 'POST',
        body: formData,
      }),
      { params: {} }
    );
    const data = await response.json();

    expect(data.body).toEqual({ foo: 'bar' });
  });

  it('should handle URLSearchParams (x-www-form-urlencoded) body', async () => {
    const route = createRoute()
      .body(mockSchema())
      .handler((_req, { body }) => {
        return { body };
      });

    const body = new URLSearchParams();
    body.append('hello', 'world');

    const response = await route(
      new Request('http://localhost', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: body.toString(),
      }),
      { params: {} }
    );
    const data = await response.json();

    expect(data.body).toEqual({ hello: 'world' });
  });

  it('should handle invalid JSON body gracefully', async () => {
    const route = createRoute().handler(() => ({ ok: true }));

    const response = await route(
      new Request('http://localhost', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: 'invalid-json',
      }),
      { params: {} }
    );

    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.ok).toBe(true);
  });

  it('should validate params (sync and async)', async () => {
    const route = createRoute()
      .params(mockSchema())
      .handler((_req, { params }) => ({ params }));

    // Sync params
    const res1 = await route(new Request('http://localhost'), { params: { id: '1' } });
    expect((await res1.json()).params).toEqual({ id: '1' });

    // Async params (Next.js 15)
    const res2 = await route(new Request('http://localhost'), {
      params: Promise.resolve({ id: '2' }),
    });
    expect((await res2.json()).params).toEqual({ id: '2' });
  });

  it('should trigger onError for validation failures', async () => {
    const onError = vi.fn(({ error: _error }) => Response.json({ handled: true }, { status: 422 }));
    const route = createRoute({ onError })
      .query(mockSchema(true))
      .handler(() => ({}));

    const response = await route(new Request('http://localhost?fail=1'), { params: {} });
    expect(response.status).toBe(422);
    expect(onError).toHaveBeenCalled();
    const error = onError.mock.calls[0]![0]!.error;
    expect(error).toBeInstanceOf(RouteValidationError);
  });

  it('should trigger onError for RouteError', async () => {
    const onError = vi.fn(({ error }) => {
      if (error instanceof RouteError) {
        return Response.json({ custom: error.message }, { status: error.statusCode });
      }
      return Response.json({});
    });

    const route = createRoute({ onError }).handler(() => {
      throw new RouteError('Forbidden', 403);
    });

    const response = await route(new Request('http://localhost'), { params: {} });
    expect(response.status).toBe(403);
    const data = await response.json();
    expect(data.custom).toBe('Forbidden');
  });

  it('should handle metadata correctly', async () => {
    const route = createRoute()
      .defineMetadata(mockSchema())
      .metadata({ role: 'admin' })
      .use(async ({ metadata, next }) => {
        return next({ ctx: { meta: metadata } });
      })
      .handler((_req, { metadata, ctx }) => ({ metadata, ctx }));

    const response = await route(new Request('http://localhost'), { params: {} });
    const data = await response.json();

    expect(data.metadata).toEqual({ role: 'admin' });
    expect(data.ctx.meta).toEqual({ role: 'admin' });
  });

  it('should handle array query parameters', async () => {
    const route = createRoute().handler((_req, { query }) => ({ query }));

    const response = await route(new Request('http://localhost?a=1&a=2&b=3'), { params: {} });
    const data = await response.json();

    expect(data.query.a).toEqual(['1', '2']);
    expect(data.query.b).toBe('3');
  });

  it('should handle POST request with no content-type header', async () => {
    const route = createRoute().handler((_req, { body }) => ({ body }));

    const response = await route(
      new Request('http://localhost', {
        method: 'POST',
        body: JSON.stringify({ foo: 'bar' }),
      }),
      { params: {} }
    );
    const data = await response.json();

    // Default rawBody is {} if no content-type matches
    expect(data.body).toEqual({});
  });
});
