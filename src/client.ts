'use client';

import { useAction } from 'react-hook-action';

import type {
  InferClientReturn,
  InferRouteBody,
  InferRouteMethod,
  InferRouteParams,
  InferRouteQuery,
} from './typings';

/**
 * Options passed to the client dispatch function, containing the request parameters, query string, and body.
 */
export interface RouteActionOptions<TRoute> {
  /** Dynamic route parameters. */
  params?: InferRouteParams<TRoute>;
  /** URL query parameters. */
  query?: InferRouteQuery<TRoute>;
  /** JSON or form request body. */
  body?: InferRouteBody<TRoute>;
}

/**
 * Options for configuring the route client instance.
 */
export interface CreateRouteClientOptions {
  /**
   * Custom parser for non-ok API responses to return standardized error messages and issues.
   */
  errorParser?: (res: Response) => Promise<{ message: string; issues?: any }>;
}

/**
 * Creates a route action client hook with customizable error parsing.
 *
 * @param options - Hook configuration options.
 * @returns A useRouteAction hook configured with options.
 *
 * @example
 * const useApiAction = createRouteClient({
 *   errorParser: async (res) => {
 *     const data = await res.json();
 *     return { message: data.message || 'Error occurred', issues: data.issues };
 *   }
 * });
 */
export function createRouteClient(options: CreateRouteClientOptions = {}) {
  const { errorParser } = options;

  return function useRouteAction<TRoute>(
    method: InferRouteMethod<TRoute>,
    url: string | ((params: InferRouteParams<TRoute>) => string)
  ) {
    const actionKey = typeof url === 'string' ? url : 'dynamic-route';

    return useAction(actionKey, async (args: RouteActionOptions<TRoute>) => {
      const resolvedUrl = typeof url === 'function' ? url(args.params as any) : url;
      const target = new URL(resolvedUrl, window.location.origin);

      if (args.query) {
        for (const [key, value] of Object.entries(args.query)) {
          if (Array.isArray(value)) {
            for (const item of value) {
              target.searchParams.append(key, String(item));
            }
          } else {
            target.searchParams.set(key, String(value));
          }
        }
      }

      const response = await fetch(target.toString(), {
        method: String(method),
        headers: {
          'Content-Type': 'application/json',
        },
        body: args.body ? JSON.stringify(args.body) : undefined,
      });

      if (!response.ok) {
        if (errorParser) {
          throw await errorParser(response);
        }

        const data = await response.json().catch(() => ({}));
        // Throwing this object allows react-hook-action to capture it in the `error` state.
        throw {
          message: data.error || 'Failed to execute route action',
          issues: data.issues,
          status: response.status,
        };
      }

      return (await response.json()) as InferClientReturn<TRoute>;
    });
  };
}

/**
 * Default React hook for calling Next.js API Routes.
 * Infers input and output types directly from route definitions.
 *
 * @example
 * const { dispatch, isLoading, result, error } = useRouteAction<typeof POST>('POST', '/api/todos');
 * // trigger with args:
 * dispatch({ body: { title: 'Buy milk' } });
 */
export const useRouteAction = createRouteClient();
