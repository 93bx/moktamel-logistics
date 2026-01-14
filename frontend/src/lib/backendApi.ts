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
  const cookieStore = await cookies();
  let access = cookieStore.get("moktamel_access")?.value;
  const refresh = cookieStore.get("moktamel_refresh")?.value;
  const companyId = cookieStore.get("moktamel_company")?.value;
  const hasRefreshedOnce = cookieStore.get("moktamel_refreshed_once")?.value;

  // Check 8-hour rule: if token is >8 hours old, throw AuthError (will trigger redirect)
  if (access && isTokenOlderThanHours(access, 8)) {
    throw new AuthError("Session expired");
  }

  let res = await fetch(`${apiBase}${opts.path}`, {
    method: opts.method ?? "GET",
    headers: {
      "content-type": "application/json",
      ...(access ? { authorization: `Bearer ${access}` } : {}),
    },
    body: opts.body ? JSON.stringify(opts.body) : undefined,
    cache: "no-store",
  });

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
      res = await fetch(`${apiBase}${opts.path}`, {
        method: opts.method ?? "GET",
        headers: {
          "content-type": "application/json",
          authorization: `Bearer ${refreshResult.accessToken}`,
        },
        body: opts.body ? JSON.stringify(opts.body) : undefined,
        cache: "no-store",
      });
    }
  }

  const data = (await res.json().catch(() => null)) as any;
  if (!res.ok) {
    // If it's still 401 after refresh attempt, throw AuthError
    if (res.status === 401) {
      throw new AuthError("Unauthorized");
    }
    let message = data?.message ?? "Request failed";
    // Include validation details if available
    if (data?.details && Array.isArray(data.details) && data.details.length > 0) {
      const details = data.details.map((d: any) => `${d.path?.join('.') || 'field'}: ${d.message}`).join(', ');
      message = `${message} (${details})`;
    }
    const error = new Error(message);
    (error as any).status = res.status;
    (error as any).payload = data;
    throw error;
  }
  return data as T;
}


