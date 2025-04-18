import {
  QueryClient,
  QueryFunction
} from "@tanstack/react-query";

// Create a query client instance with default options
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 10 * 60 * 1000, // 10 minutes
      refetchOnWindowFocus: true,
      refetchOnMount: true,
      retry: 1,
    },
  },
});

// Base URL for API
const API_BASE_URL = "";

type ApiRequestMethod = "GET" | "POST" | "PATCH" | "PUT" | "DELETE";

interface GetQueryFnOptions {
  on401?: "throw" | "returnNull";
}

// Default query function for use with react-query
export function getQueryFn({ on401 = "throw" }: GetQueryFnOptions = {}): QueryFunction {
  return async ({ queryKey }) => {
    const [endpoint] = queryKey as string[];
    const response = await fetch(`${API_BASE_URL}${endpoint}`, {
      headers: {
        "Content-Type": "application/json",
      },
      credentials: "include",
    });

    if (!response.ok) {
      if (response.status === 401 && on401 === "returnNull") {
        return null;
      }
      throw new Error(`API error: ${response.status} ${await response.text()}`);
    }

    return await response.json();
  };
}

// Function to make API requests
export async function apiRequest(
  method: ApiRequestMethod,
  endpoint: string,
  data?: any
): Promise<Response> {
  const url = `${API_BASE_URL}${endpoint}`;
  
  const options: RequestInit = {
    method,
    headers: {
      "Content-Type": "application/json",
    },
    credentials: "include",
  };

  if (data && method !== "GET") {
    options.body = JSON.stringify(data);
  }

  const response = await fetch(url, options);
  
  if (!response.ok) {
    const errorText = await response.text();
    let errorMessage;
    
    try {
      const errorJson = JSON.parse(errorText);
      errorMessage = errorJson.message || errorText;
    } catch (e) {
      errorMessage = errorText || `API error: ${response.status}`;
    }
    
    throw new Error(errorMessage);
  }
  
  return response;
}