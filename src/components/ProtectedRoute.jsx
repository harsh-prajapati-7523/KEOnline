import { useEffect, useState } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { fetchCurrentAccess, getStoredAccess, hasAccess, hasAnyAccess } from "../utils/access";
import { getValidToken, isPinLoginAvailable } from "../utils/auth";

export default function ProtectedRoute({ children, allowedRoles, accessKey, anyAccessKey }) {
  const location = useLocation();
  const [isCheckingSession, setIsCheckingSession] = useState(false);
  const [authRedirectPath, setAuthRedirectPath] = useState("");
  const [isLoadingAccess, setIsLoadingAccess] = useState(false);
  const [, setAccessRefreshKey] = useState(0);
  const token = getValidToken();
  const role = localStorage.getItem("role");
  const needsAccess = Boolean(accessKey || anyAccessKey);

  useEffect(() => {
    let isCurrent = true;
    if (token || authRedirectPath) return undefined;

    setIsCheckingSession(true);
    isPinLoginAvailable()
      .then((available) => {
        if (!isCurrent) return;
        setAuthRedirectPath(available ? "/pin-login" : "/employee-login");
      })
      .finally(() => {
        if (!isCurrent) return;
        setIsCheckingSession(false);
      });

    return () => {
      isCurrent = false;
    };
  }, [authRedirectPath, token]);

  useEffect(() => {
    let isCurrent = true;
    if (!token || !needsAccess || role === "SUPER_ADMIN" || getStoredAccess()) return undefined;

    setIsLoadingAccess(true);
    fetchCurrentAccess()
      .catch(() => {})
      .finally(() => {
        if (!isCurrent) return;
        setIsLoadingAccess(false);
        setAccessRefreshKey((current) => current + 1);
      });

    return () => {
      isCurrent = false;
    };
  }, [needsAccess, role, token]);

  if (!token) {
    if (isCheckingSession || !authRedirectPath) {
      return <main className="min-h-screen bg-gray-50 px-4 py-6 text-sm font-semibold text-gray-600">Checking session...</main>;
    }
    return <Navigate to={authRedirectPath} replace state={{ from: location }} />;
  }

  if (allowedRoles && !allowedRoles.includes(role)) {
    return <Navigate to="/employee-dashboard" replace />;
  }

  if (isLoadingAccess) {
    return <main className="min-h-screen bg-gray-50 px-4 py-6 text-sm font-semibold text-gray-600">Loading access...</main>;
  }

  if (accessKey && !hasAccess(accessKey)) {
    return <Navigate to="/employee-dashboard" replace />;
  }

  if (anyAccessKey && !hasAnyAccess(anyAccessKey)) {
    return <Navigate to="/employee-dashboard" replace />;
  }

  return children;
}
