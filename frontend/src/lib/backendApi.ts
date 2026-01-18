import { cookies } from "next/headers";
import { isTokenOlderThanHours } from "./jwt";

export type BackendApiOptions = {
  method?: "GET" | "POST" | "PATCH" | "DELETE";
  path: string;
  body?: unknown;
};

// Custom error class for auth failures
export class AuthError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AuthError";
  }
}

// Custom error class for configuration errors
export class ConfigurationError extends Error {
  constructor(message: string, public readonly details?: Record<string, unknown>) {
    super(message);
    this.name = "ConfigurationError";
  }
}

// Custom error class for network/API errors
export class ApiError extends Error {
  constructor(
    message: string,
    public readonly status?: number,
    public readonly path?: string,
    public readonly payload?: unknown
  ) {
    super(message);
    this.name = "ApiError";
  }
}

// Refresh lock to prevent concurrent refresh attempts
// This ensures that if multiple requests try to refresh simultaneously,
// they all wait for the same refresh operation
let refreshPromise: Promise<{ accessToken: string; refreshToken: string } | null> | null = null;

async function attemptTokenRefresh(refreshToken: string, companyId: string): Promise<{ accessToken: string; refreshToken: string } | null> {
  // If a refresh is already in progress, wait for it
  if (refreshPromise) {
    const result = await refreshPromise;
    return result;
  }

  // Start a new refresh operation
  refreshPromise = (async () => {
    try {
      // Use absolute URL for server-side context
      // Detect port from environment or use common defaults
      const frontendUrl = process.env.NEXT_PUBLIC_FRONTEND_URL || 
                         process.env.NEXT_PUBLIC_APP_URL ||
                         (typeof window !== 'undefined' ? window.location.origin : 'http://localhost:8001');
      
      const refreshUrl = typeof window === 'undefined' 
        ? `${frontendUrl}/api/auth/refresh`
        : '/api/auth/refresh';
      
      // Pass refresh token and company ID in the body since server-side cookies don't forward
      const refreshRes = await fetch(refreshUrl, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          refresh_token: refreshToken,
          company_id: companyId,
        }),
        cache: "no-store",
      });
      
      if (!refreshRes.ok) {
        return null;
      }
      
      // Get the new tokens from the response body (cookies won't be readable server-side)
      const data = await refreshRes.json().catch(() => null);
      const newAccessToken = data?.access_token;
      const newRefreshToken = data?.refresh_token;
      
      if (newAccessToken && newRefreshToken) {
        return { accessToken: newAccessToken, refreshToken: newRefreshToken };
      }
      return null;
    } catch (error) {
      return null;
    } finally {
      // Clear the promise so future refreshes can proceed
      refreshPromise = null;
    }
  })();

  const result = await refreshPromise;
  return result;
}

export async function backendApi<T>(opts: BackendApiOptions): Promise<T> {
  const apiBase = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:3000/api";
  
  // Validate API base URL is set (especially important in production)
  if (!apiBase || apiBase === "http://localhost:3000/api") {
    if (typeof window === 'undefined') {
      // Server-side: throw a clear configuration error with context
      const errorMessage = 
        `NEXT_PUBLIC_API_BASE_URL environment variable is not configured properly. ` +
        `Current value: "${apiBase}". ` +
        `Please set this environment variable in your Vercel deployment settings ` +
        `to point to your backend API (e.g., https://your-backend-domain.com/api).`;
      
      console.error("Backend API Configuration Error:", {
        message: errorMessage,
        currentValue: apiBase,
        isDefault: apiBase === "http://localhost:3000/api",
        path: opts.path,
        environment: process.env.NODE_ENV,
      });
      
      throw new ConfigurationError(errorMessage, {
        currentValue: apiBase,
        isDefault: apiBase === "http://localhost:3000/api",
        path: opts.path,
        environment: process.env.NODE_ENV,
      });
    }
  }
  
  const cookieStore = await cookies();
  let access = cookieStore.get("moktamel_access")?.value;
  const refresh = cookieStore.get("moktamel_refresh")?.value;
  const companyId = cookieStore.get("moktamel_company")?.value;
  const hasRefreshedOnce = cookieStore.get("moktamel_refreshed_once")?.value;

  // Check 8-hour rule: if token is >8 hours old, throw AuthError (will trigger redirect)
  if (access && isTokenOlderThanHours(access, 8)) {
    throw new AuthError("Session expired");
  }

  let res: Response;
  try {
    res = await fetch(`${apiBase}${opts.path}`, {
      method: opts.method ?? "GET",
      headers: {
        "content-type": "application/json",
        ...(access ? { authorization: `Bearer ${access}` } : {}),
      },
      body: opts.body ? JSON.stringify(opts.body) : undefined,
      cache: "no-store",
    });
  } catch (fetchError) {
    // Handle network errors with better context
    const errorMessage = fetchError instanceof Error ? fetchError.message : "Unknown network error";
    const isNetworkError = fetchError instanceof TypeError && fetchError.message.includes("fetch");
    
    if (typeof window === 'undefined') {
      console.error("Backend API Network Error:", {
        message: errorMessage,
        apiBase,
        path: opts.path,
        method: opts.method ?? "GET",
        isNetworkError,
        errorType: fetchError instanceof Error ? fetchError.constructor.name : typeof fetchError,
      });
    }
    
    throw new ApiError(
      `Failed to connect to backend API at ${apiBase}${opts.path}: ${errorMessage}`,
      undefined,
      opts.path,
      { originalError: errorMessage, apiBase }
    );
  }

  // If we get a 401 and have a refresh token, try to refresh
  if (res.status === 401 && refresh && companyId) {
    // If we've already refreshed once in this 8-hour window, don't refresh again
    if (hasRefreshedOnce) {
      throw new AuthError("Unauthorized");
    }

    // Check if the current access token is still within 8-hour window before refreshing
    if (access && isTokenOlderThanHours(access, 8)) {
      throw new AuthError("Session expired");
    }

    const refreshResult = await attemptTokenRefresh(refresh, companyId);
    
    if (refreshResult) {
      // Update cookies with new tokens (for subsequent requests in this render)
      // Note: In server-side Next.js, we can't directly update cookies in the same request,
      // but the refresh route already set them, so they'll be available for the next request.
      // For now, we use the token from the refresh response for the retry.
      
      // Retry the original request with the new token from the refresh response
      try {
        res = await fetch(`${apiBase}${opts.path}`, {
          method: opts.method ?? "GET",
          headers: {
            "content-type": "application/json",
            authorization: `Bearer ${refreshResult.accessToken}`,
          },
          body: opts.body ? JSON.stringify(opts.body) : undefined,
          cache: "no-store",
        });
      } catch (fetchError) {
        // Handle network errors on retry after token refresh
        const errorMessage = fetchError instanceof Error ? fetchError.message : "Unknown network error";
        
        if (typeof window === 'undefined') {
          console.error("Backend API Network Error (after token refresh retry):", {
            message: errorMessage,
            apiBase,
            path: opts.path,
            method: opts.method ?? "GET",
            errorType: fetchError instanceof Error ? fetchError.constructor.name : typeof fetchError,
          });
        }
        
        throw new ApiError(
          `Failed to connect to backend API at ${apiBase}${opts.path} on retry after token refresh: ${errorMessage}`,
          undefined,
          opts.path,
          { originalError: errorMessage, apiBase, retryAfterRefresh: true }
        );
      }
    }
  }

  const data = (await res.json().catch(() => {
    // If JSON parsing fails, return null and handle it below
    return null;
  })) as any;
  
  if (!res.ok) {
    // If it's still 401 after refresh attempt, throw AuthError
    if (res.status === 401) {
      throw new AuthError("Unauthorized - authentication required");
    }
    
    // Build a comprehensive error message
    let message = data?.message ?? `Request failed with status ${res.status}`;
    
    // Include error code if available
    if (data?.error_code) {
      message = `${message} [${data.error_code}]`;
    }
    
    // Include validation details if available
    if (data?.details && Array.isArray(data.details) && data.details.length > 0) {
      const details = data.details
        .map((d: any) => `${d.path?.join('.') || 'field'}: ${d.message}`)
        .join(', ');
      message = `${message} (${details})`;
    }
    
    // Add request context to message
    const fullMessage = `${message} - ${opts.method ?? "GET"} ${opts.path}`;
    
    // Log full error for debugging (server-side only)
    if (typeof window === 'undefined') {
      console.error("Backend API Error Response:", {
        status: res.status,
        statusText: res.statusText,
        path: opts.path,
        method: opts.method ?? "GET",
        apiBase,
        errorCode: data?.error_code,
        message: data?.message,
        details: data?.details,
        requestId: data?.request_id,
        fullPayload: data,
        timestamp: new Date().toISOString(),
      });
    }
    
    // Throw structured API error
    throw new ApiError(fullMessage, res.status, opts.path, data);
  }
  return data as T;
}


