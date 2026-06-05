<h1 align="center">
  <sup>@se-oss/next-route</sup>
  <br>
  <a href="https://github.com/shahradelahi/next-route/actions/workflows/ci.yml"><img src="https://github.com/shahradelahi/next-route/actions/workflows/ci.yml/badge.svg?branch=main&event=push" alt="CI"></a>
  <a href="https://www.npmjs.com/package/@se-oss/next-route"><img src="https://img.shields.io/npm/v/@se-oss/next-route.svg" alt="NPM Version"></a>
  <a href="/LICENSE"><img src="https://img.shields.io/badge/License-MIT-blue.svg?style=flat" alt="MIT License"></a>
  <a href="https://bundlephobia.com/package/@se-oss/next-route"><img src="https://img.shields.io/bundlephobia/minzip/@se-oss/next-route" alt="npm bundle size"></a>
  <a href="https://packagephobia.com/result?p=@se-oss/next-route"><img src="https://packagephobia.com/badge?p=@se-oss/next-route" alt="Install Size"></a>
</h1>

_@se-oss/next-route_ is a schema-agnostic library for building and consuming Next.js API Routes with end-to-end type safety.

---

- [Installation](#-installation)
- [Usage](#-usage)
  - [Quick Start](#quick-start)
  - [Global Configuration](#global-configuration)
  - [Validation](#validation)
  - [Middleware & Context](#middleware--context)
  - [Metadata](#metadata)
  - [Error Handling](#error-handling)
- [Client-Side Consumption](#-client-side-consumption)
  - [Basic Hook](#basic-hook)
  - [Custom Client](#custom-client)
- [Documentation](#-documentation)
- [Contributing](#-contributing)
- [License](#license)

## 📦 Installation

```bash
npm install @se-oss/next-route
```

<details>
<summary>Install using your favorite package manager</summary>

**pnpm**

```bash
pnpm add @se-oss/next-route
```

**yarn**

```bash
yarn add @se-oss/next-route
```

</details>

## 📖 Usage

### Quick Start

Build a simple POST route with body validation in seconds.

```ts
import { createRoute } from '@se-oss/next-route';
import { z } from 'zod';

export const POST = createRoute()
  .body(z.object({ title: z.string() }))
  .handler(async (_req, { body }) => {
    return { id: 1, ...body };
  });

export type CreateTodo = typeof POST;
```

### Global Configuration

Centralize your error logging (Sentry) and API response formats.

```ts
import {
  createRoute,
  RouteError,
  RouteValidationError,
} from '@se-oss/next-route';

export const publicRoute = createRoute({
  onError: ({ error, request }) => {
    if (error instanceof RouteValidationError) {
      return Response.json(
        { status: 'error', issues: error.issues },
        { status: 400 }
      );
    }
    if (error instanceof RouteError) {
      return Response.json(
        { status: 'error', message: error.message },
        { status: error.statusCode }
      );
    }
    console.error(`Error in ${request.url}:`, error);
    return Response.json(
      { status: 'error', message: 'Internal Server Error' },
      { status: 500 }
    );
  },
});
```

### Validation

Chain multiple validations. Works with Zod, Valibot, Arktype, or any Standard Schema.

```ts
import * as v from 'valibot';

export const PATCH = publicRoute
  .params(v.object({ id: v.string() }))
  .query(v.object({ silent: v.optional(v.boolean()) }))
  .body(v.object({ content: v.string() }))
  .handler(async (req, { params, query, body }) => {
    // All inputs are 100% type-safe
    return { id: params.id, content: body.content };
  });
```

### Middleware & Context

Pass data down the chain using `ctx`. Subsequent middlewares and handlers receive the merged context.

```ts
const authRoute = publicRoute.use(async ({ next }) => {
  const user = await getSession();
  if (!user) throw new RouteError('Unauthorized', 401);
  return next({ ctx: { user } }); // Injects user into context
});

export const GET = authRoute.handler((req, { ctx }) => {
  return { hello: ctx.user.name }; // ctx.user is fully typed
});
```

### Metadata

Attach static data to routes that middlewares can inspect. Great for Permissions or Documentation.

```ts
const protectedRoute = publicRoute
  .defineMetadata(v.object({ role: v.string() }))
  .use(async ({ metadata, next }) => {
    // Access metadata in middleware to enforce RBAC
    console.log(`Checking permission for: ${metadata?.role}`);
    return next();
  });

export const DELETE = protectedRoute
  .metadata({ role: 'admin' })
  .handler(() => ({ deleted: true }));
```

### Error Handling

The library provides a specialized 3-tier error system to distinguish between validation, business logic, and internal crashes.

| Error Type             | Use Case                                   | Default Status |
| :--------------------- | :----------------------------------------- | :------------- |
| `RouteValidationError` | Thrown automatically when schemas fail     | 400            |
| `RouteError`           | Manual; for expected business logic errors | Customizable   |
| `Native Error`         | Uncaught; for unexpected server crashes    | 500            |

```ts
import { RouteError } from '@se-oss/next-route';

throw new RouteError('Slug already exists', 409);
```

## 📡 Client-Side Consumption

### Basic Hook

Consume your routes with zero-effort inference for inputs and outputs.

```tsx
'use client';

import { useRouteAction } from '@se-oss/next-route/client';

import type { CreateTodo } from './api/todo/route';

export function TodoForm() {
  const { dispatch, isLoading, result } = useRouteAction<CreateTodo>(
    'POST',
    '/api/todo'
  );

  return (
    <button
      disabled={isLoading}
      onClick={() => dispatch({ body: { title: 'Buy Milk' } })}
    >
      Add Todo
    </button>
  );
}
```

### Custom Client

Sync your frontend with your custom server-side error format once.

```ts
import { createRouteClient } from '@se-oss/next-route/client';

export const useApiAction = createRouteClient({
  errorParser: async (res) => {
    const data = await res.json();
    return {
      message: data.message || 'Something went wrong',
      issues: data.issues,
    };
  },
});
```

## 📚 Documentation

For detailed configuration and advanced patterns, please see [the API docs](https://www.jsdocs.io/package/@se-oss/next-route).

## 🤝 Contributing

Want to contribute? Awesome! To show your support is to star the project, or to raise issues on [GitHub](https://github.com/shahradelahi/next-route).

Thanks again for your support, it is much appreciated! 🙏

## 🔗 Relevant Projects

#### **[react-hook-action](https://github.com/shahradelahi/react-hook-action)**

The lightweight state-management engine powering `@se-oss/next-route/client`. Use it directly if you need global persistence for other asynchronous tasks in your app.

#### **[next-zod-action](https://github.com/shahradelahi/next-zod-action)**

If you prefer **Server Actions** over API Routes, this is the sister library. It offers the same builder-pattern philosophy but optimized for the `use server` directive.

#### **[next-extra](https://github.com/shahradelahi/next-extra)**

A suite of utilities for Next.js. Use it inside your `.handler()` to easily access `clientIP()`, `cookies()`, or `pathname()` in a type-safe way.

#### **[@se-oss/status-codes](https://github.com/shahradelahi/status-codes)**

Essential for readable error handling. Use it with `RouteError` to replace magic numbers with type-safe constants like `StatusCodes.NOT_FOUND`.

## License

[MIT](/LICENSE) © [Shahrad Elahi](https://github.com/shahradelahi) and [contributors](https://github.com/shahradelahi/next-route/graphs/contributors).
