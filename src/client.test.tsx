import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { createRouteClient, useRouteAction } from './client';

describe('useRouteAction', () => {
  const fetchMock = vi.fn();
  vi.stubGlobal('fetch', fetchMock);

  beforeEach(() => {
    fetchMock.mockClear();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should handle a successful fetch', async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({ success: true, data: 'hello' }),
    });

    const { result } = renderHook(() => useRouteAction('POST', '/api/test'));

    await act(async () => {
      await result.current.dispatch({ body: { foo: 'bar' } });
    });

    expect(fetchMock).toHaveBeenCalledWith(
      'http://localhost:3000/api/test',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ foo: 'bar' }),
      })
    );
    expect(result.current.result).toEqual({ success: true, data: 'hello' });
  });

  it('should handle custom error parser', async () => {
    fetchMock.mockResolvedValue({
      ok: false,
      status: 400,
      json: async () => ({ code: 'ERR_VALIDATION', msg: 'invalid' }),
    });

    const useApiAction = createRouteClient({
      errorParser: async (res) => {
        const data = await res.json();
        return { message: data.msg, issues: data.code };
      },
    });

    const { result } = renderHook(() => useApiAction('POST', '/api/test'));

    await act(async () => {
      try {
        await result.current.dispatch({});
      } catch {
        // expected
      }
    });

    expect(result.current.error).toEqual({ message: 'invalid', issues: 'ERR_VALIDATION' });
  });

  it('should handle dynamic URLs', async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({ success: true }),
    });

    const { result } = renderHook(() =>
      useRouteAction<{ id: string }>('POST', (params) => `/api/users/${params.id}`)
    );

    await act(async () => {
      await result.current.dispatch({ params: { id: '123' } });
    });

    expect(fetchMock).toHaveBeenCalledWith(
      'http://localhost:3000/api/users/123',
      expect.any(Object)
    );
  });
});
