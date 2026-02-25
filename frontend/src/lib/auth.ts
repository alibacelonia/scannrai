import type { TokenPair } from "@/types/api";

const ACCESS_TOKEN_KEY = "scannrai.access_token";
const REFRESH_TOKEN_KEY = "scannrai.refresh_token";
const AUTH_CHANGED_EVENT = "scannrai:auth-changed";

function emitAuthChanged() {
  if (typeof window === "undefined") {
    return;
  }
  window.dispatchEvent(new Event(AUTH_CHANGED_EVENT));
}

export function saveTokens(tokens: TokenPair) {
  if (typeof window === "undefined") {
    return;
  }
  window.localStorage.setItem(ACCESS_TOKEN_KEY, tokens.access);
  window.localStorage.setItem(REFRESH_TOKEN_KEY, tokens.refresh);
  emitAuthChanged();
}

export function clearTokens() {
  if (typeof window === "undefined") {
    return;
  }
  window.localStorage.removeItem(ACCESS_TOKEN_KEY);
  window.localStorage.removeItem(REFRESH_TOKEN_KEY);
  emitAuthChanged();
}

export function getAccessToken(): string | null {
  if (typeof window === "undefined") {
    return null;
  }
  return window.localStorage.getItem(ACCESS_TOKEN_KEY);
}

export function subscribeToAuthToken(onStoreChange: () => void): () => void {
  if (typeof window === "undefined") {
    return () => {};
  }

  const handler = () => onStoreChange();
  window.addEventListener("storage", handler);
  window.addEventListener(AUTH_CHANGED_EVENT, handler);

  return () => {
    window.removeEventListener("storage", handler);
    window.removeEventListener(AUTH_CHANGED_EVENT, handler);
  };
}
