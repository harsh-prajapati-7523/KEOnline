import { useEffect, useState } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { fetchCurrentAccess, getStoredAccess, hasAccess, hasAnyAccess } from "../utils/access";
import { getValidToken, refreshAccessToken } from "../utils/auth";

export default function ProtectedRoute({ children, allowedRoles, accessKey, anyAccessKey }) {
  const location = useLocation();
  const [isRefreshingSession, setIsRefreshingSession] = useState(false);
  const [refreshFailed, setRefreshFailed] = useState(false);
  const [, setSessionRefreshKey] = useState(0);
  const [isLoadingAccess, setIsLoadingAccess] = useState(false);
  const [, setAccessRefreshKey] = useState(0);
  const token = getValidToken();
  const role = localStorage.getItem("role");
  const needsAccess = Boolean(accessKey || anyAccessKey);

  useEffect(() => {
    let isCurrent = true;
    if (token || refreshFailed) return undefined;

    setIsRefreshingSession(true);
    refreshAccessToken()
      .then(() => {
        if (!isCurrent) return;
        setRefreshFailed(false);
        setSessionRefreshKey((current) => current + 1);
      })
      .catch(() => {
        if (!isCurrent) return;
        setRefreshFailed(true);
      })
      .finally(() => {
        if (!isCurrent) return;
        setIsRefreshingSession(false);
      });

    return () => {
      isCurrent = false;
    };
  }, [refreshFailed, token]);

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
    if (isRefreshingSession && !refreshFailed) {
      return <main className="min-h-screen bg-gray-50 px-4 py-6 text-sm font-semibold text-gray-600">Restoring session...</main>;
    }
    return <Navigate to="/employee-login" replace state={{ from: location }} />;
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
