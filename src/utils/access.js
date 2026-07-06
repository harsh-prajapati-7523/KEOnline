import { clearAuthSession, getValidToken } from "./auth";

const ACCESS_STORAGE_KEY = "access";

export async function fetchCurrentAccess() {
  const token = getValidToken();
  if (!token) {
    clearAuthSession();
    throw new Error("Missing token");
  }

  const response = await fetch("/volt/access/me", {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  if (!response.ok) {
    if (response.status === 401) {
      clearAuthSession();
    } else {
      clearAccess();
    }
    throw new Error("Access request failed");
  }

  const access = await response.json();
  localStorage.setItem(ACCESS_STORAGE_KEY, JSON.stringify(access));
  return access;
}

export function getStoredAccess() {
  try {
    const rawAccess = localStorage.getItem(ACCESS_STORAGE_KEY);
    if (!rawAccess) return null;
    const access = JSON.parse(rawAccess);
    return access && typeof access === "object" ? access : null;
  } catch {
    clearAccess();
    return null;
  }
}

export function hasAccess(accessKey) {
  if (!accessKey) return true;
  if (localStorage.getItem("role") === "SUPER_ADMIN") return true;

  const access = getStoredAccess();
  if (!access) return false;
  if (access.superAdmin) return true;
  return Boolean(access.access?.[accessKey]);
}

export function hasAnyAccess(accessKeys = []) {
  if (!Array.isArray(accessKeys) || accessKeys.length === 0) return true;
  if (localStorage.getItem("role") === "SUPER_ADMIN") return true;

  const access = getStoredAccess();
  if (!access) return false;
  if (access.superAdmin) return true;
  return accessKeys.some((accessKey) => Boolean(access.access?.[accessKey]));
}

export function clearAccess() {
  localStorage.removeItem(ACCESS_STORAGE_KEY);
}
