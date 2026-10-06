const TOKEN_KEY = 'eka_auth_token';
const USER_KEY = 'eka_auth_user';
const REMEMBER_KEY = 'eka_remember_me';

export const storage = {
  getToken(): string | null {
    return localStorage.getItem(TOKEN_KEY) || sessionStorage.getItem(TOKEN_KEY);
  },

  setToken(token: string, remember = true): void {
    if (remember) {
      localStorage.setItem(TOKEN_KEY, token);
      localStorage.setItem(REMEMBER_KEY, 'true');
      sessionStorage.removeItem(TOKEN_KEY);
    } else {
      sessionStorage.setItem(TOKEN_KEY, token);
      localStorage.removeItem(TOKEN_KEY);
      localStorage.removeItem(REMEMBER_KEY);
    }
  },

  getUser<T>(): T | null {
    const raw = localStorage.getItem(USER_KEY) || sessionStorage.getItem(USER_KEY);
    if (!raw) return null;
    try {
      return JSON.parse(raw) as T;
    } catch {
      return null;
    }
  },

  setUser<T>(user: T, remember = true): void {
    const serialized = JSON.stringify(user);
    if (remember) {
      localStorage.setItem(USER_KEY, serialized);
      sessionStorage.removeItem(USER_KEY);
    } else {
      sessionStorage.setItem(USER_KEY, serialized);
      localStorage.removeItem(USER_KEY);
    }
  },

  clear(): void {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
    localStorage.removeItem(REMEMBER_KEY);
    sessionStorage.removeItem(TOKEN_KEY);
    sessionStorage.removeItem(USER_KEY);
  },

  isRemembered(): boolean {
    return localStorage.getItem(REMEMBER_KEY) === 'true';
  },
};
