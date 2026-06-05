'use client';

import { useAction } from 'react-hook-action';

import type {
  InferClientReturn,
  InferRouteBody,
  InferRouteMethod,
  InferRouteParams,
  InferRouteQuery,
} from './typings';

export interface RouteActionOptions<TRoute> {
  params?: InferRouteParams<TRoute>;
  query?: InferRouteQuery<TRoute>;
  body?: InferRouteBody<TRoute>;
}

export interface CreateRouteClientOptions {
  errorParser?: (res: Response) => Promise<{ message: string; issues?: any }>;
}

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

export const useRouteAction = createRouteClient();
