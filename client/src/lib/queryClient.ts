import { QueryClient, QueryFunction } from "@tanstack/react-query";

async function throwIfResNotOk(res: Response) {
  if (!res.ok) {
    const text = (await res.text()) || res.statusText;
    throw new Error(`${res.status}: ${text}`);
  }
}

export async function apiRequest(
  method: string,
  url: string,
  data?: unknown | undefined,
): Promise<Response> {
  const res = await fetch(url, {
    method,
    headers: data ? { "Content-Type": "application/json" } : {},
    body: data ? JSON.stringify(data) : undefined,
    credentials: "include",
  });

  await throwIfResNotOk(res);
  return res;
}

type UnauthorizedBehavior = "returnNull" | "throw";
export const getQueryFn: <T>(options: {
  on401: UnauthorizedBehavior;
}) => QueryFunction<T> =
  ({ on401: unauthorizedBehavior }) =>
  async ({ queryKey }) => {
    // Handle search endpoints with query parameters
    let url: string;
    if (Array.isArray(queryKey) && queryKey.length === 2) {
      const [baseUrl, query] = queryKey;
      if (typeof baseUrl === 'string' && baseUrl.includes('/search') && query) {
        url = `${baseUrl}?q=${encodeURIComponent(query)}`;
      } else {
        url = queryKey.join("/");
      }
    } else if (Array.isArray(queryKey) && queryKey.length === 4 && queryKey[0] === '/api/commute/departure-options') {
      // Handle departure options: ['/api/commute/departure-options', fromId, toId, baseTime]
      const [baseUrl, fromId, toId, baseTime] = queryKey;
      url = `${baseUrl}/${fromId}/${toId}/${baseTime}`;
    } else {
      url = queryKey.join("/");
    }

    const res = await fetch(url, {
      credentials: "include",
    });

    if (unauthorizedBehavior === "returnNull" && res.status === 401) {
      return null;
    }

    await throwIfResNotOk(res);
    return await res.json();
  };

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      queryFn: getQueryFn({ on401: "throw" }),
      refetchInterval: false,
      refetchOnWindowFocus: false,
      staleTime: Infinity,
      retry: false,
    },
    mutations: {
      retry: false,
    },
  },
});
