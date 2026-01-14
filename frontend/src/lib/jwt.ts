import { decodeJwt } from "jose";

/**
 * Decodes a JWT token without verification to extract claims
 * @param token The JWT token string
 * @returns Decoded payload or null if invalid
 */
export function decodeToken(token: string): { iat?: number; exp?: number; [key: string]: unknown } | null {
  try {
    const decoded = decodeJwt(token);
    return decoded;
  } catch (error) {
    return null;
  }
}

/**
 * Gets the issued at (iat) timestamp from a JWT token
 * @param token The JWT token string
 * @returns The iat timestamp in seconds, or null if not found/invalid
 */
export function getTokenIssuedAt(token: string): number | null {
  const decoded = decodeToken(token);
  if (!decoded || typeof decoded.iat !== "number") {
    return null;
  }
  return decoded.iat;
}

/**
 * Checks if a token was issued more than the specified hours ago
 * @param token The JWT token string
 * @param hours Number of hours to check against (default: 8)
 * @returns true if token is older than specified hours, false otherwise
 */
export function isTokenOlderThanHours(token: string, hours: number = 8): boolean {
  const iat = getTokenIssuedAt(token);
  if (!iat) {
    // If we can't decode the token, treat it as invalid/old
    return true;
  }
  
  const now = Math.floor(Date.now() / 1000); // Current time in seconds
  const hoursInSeconds = hours * 60 * 60;
  const tokenAge = now - iat;
  
  return tokenAge > hoursInSeconds;
}

