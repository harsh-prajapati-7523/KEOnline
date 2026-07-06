const AUTH_STORAGE_KEYS = ["token", "employeeName", "role", "employeeId", "access"];
const AUTH_EXPIRED_EVENT = "ke:auth-expired";

let fetchInterceptorInstalled = false;

function decodeBase64Url(value) {
  const base64 = value.replace(/-/g, "+").replace(/_/g, "/");
  const padded = base64.padEnd(base64.length + ((4 - (base64.length % 4)) % 4), "=");
  return atob(padded);
}

export function getJwtPayload(token) {
  if (!token) return null;

  try {
    const [, payload] = token.split(".");
    if (!payload) return null;
    return JSON.parse(decodeBase64Url(payload));
  } catch {
    return null;
  }
}

export function getTokenExpiryMs(token) {
  const payload = getJwtPayload(token);
  return typeof payload?.exp === "number" ? payload.exp * 1000 : null;
}

export function isTokenExpired(token, now = Date.now()) {
  const expiryMs = getTokenExpiryMs(token);
  return !expiryMs || expiryMs <= now;
}

export function clearAuthSession() {
  AUTH_STORAGE_KEYS.forEach((key) => localStorage.removeItem(key));
}

export function getValidToken() {
  const token = localStorage.getItem("token");
  if (!token) return null;

  if (isTokenExpired(token)) {
    clearAuthSession();
    return null;
  }

  return token;
}

export function notifyAuthExpired() {
  clearAuthSession();
  window.dispatchEvent(new CustomEvent(AUTH_EXPIRED_EVENT));
}

export function onAuthExpired(callback) {
  window.addEventListener(AUTH_EXPIRED_EVENT, callback);
  return () => window.removeEventListener(AUTH_EXPIRED_EVENT, callback);
}

function isVoltRequest(input) {
  const url = typeof input === "string" ? input : input?.url;
  if (!url) return false;

  try {
    return new URL(url, window.location.origin).pathname.startsWith("/volt/");
  } catch {
    return false;
  }
}

export function installAuthFetchInterceptor() {
  if (fetchInterceptorInstalled) return;

  fetchInterceptorInstalled = true;
  const originalFetch = window.fetch.bind(window);

  window.fetch = async (input, init) => {
    const response = await originalFetch(input, init);
    if (response.status === 401 && isVoltRequest(input)) {
      notifyAuthExpired();
    }
    return response;
  };
}
