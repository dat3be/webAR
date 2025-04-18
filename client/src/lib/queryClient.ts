import { QueryClient, QueryFunction } from "@tanstack/react-query";

async function throwIfResNotOk(res: Response) {
  if (!res.ok) {
    let text;
    try {
      // Try to get the response text, but it may have been read already
      text = await res.text();
    } catch (e) {
      // If we can't read the text (e.g. it was already read), use the status text
      text = res.statusText;
    }
    
    throw new Error(`${res.status}: ${text || 'Unknown error'}`);
  }
}

export async function apiRequest(
  method: string,
  url: string,
  data?: unknown | undefined,
): Promise<Response> {
  console.log(`API Request: ${method} ${url}`, data);
  
  try {
    const res = await fetch(url, {
      method,
      headers: data ? { "Content-Type": "application/json" } : {},
      body: data ? JSON.stringify(data) : undefined,
      credentials: "include",
    });
    
    console.log(`API Response status: ${res.status}`);
    
    if (!res.ok) {
      try {
        const errorText = await res.text();
        console.error(`API Error ${res.status}: ${errorText}`);
        throw new Error(`${res.status}: ${errorText || 'Unknown error'}`);
      } catch (e) {
        console.error(`Failed to parse error response: ${e}`);
        throw new Error(`Request failed with status ${res.status}`);
      }
    }
    return res;
  } catch (error) {
    console.error(`API Request Error for ${method} ${url}:`, error);
    throw error;
  }
}

type UnauthorizedBehavior = "returnNull" | "throw";
export const getQueryFn: <T>(options: {
  on401: UnauthorizedBehavior;
}) => QueryFunction<T> =
  ({ on401: unauthorizedBehavior }) =>
  async ({ queryKey }) => {
    const res = await fetch(queryKey[0] as string, {
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
