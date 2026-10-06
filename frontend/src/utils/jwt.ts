import { DecodedJwtPayload } from '../types/auth';

export function decodeJwt(token: string): DecodedJwtPayload | null {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) {
      return null;
    }

    // Base64url to base64
    const base64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
    const jsonPayload = decodeURIComponent(
      atob(base64)
        .split('')
        .map((c) => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
        .join('')
    );

    return JSON.parse(jsonPayload) as DecodedJwtPayload;
  } catch (error) {
    console.error('Failed to parse JWT payload', error);
    return null;
  }
}

export function isTokenExpired(token: string): boolean {
  const payload = decodeJwt(token);
  if (!payload || !payload.exp) {
    return true;
  }
  const currentTime = Math.floor(Date.now() / 1000);
  return payload.exp <= currentTime;
}
