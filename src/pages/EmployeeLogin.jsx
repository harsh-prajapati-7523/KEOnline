import { useEffect, useMemo, useState } from "react";
import { Clock3, Lock, QrCode, RefreshCw, ShieldCheck, Smartphone, User } from "lucide-react";
import QRCode from "qrcode";
import { Navigate, useLocation, useNavigate } from "react-router-dom";
import KEWaveBackground from "../components/KEWaveBackground";
import { clearAuthSession, getValidToken, isPinLoginAvailable, persistAuthSession } from "../utils/auth";

const AUTH_MODES = {
  PASSWORD_PIN: "PASSWORD_PIN",
  DEVICE_PAIRING_PIN: "DEVICE_PAIRING_PIN",
};

function SessionCheckScreen() {
  return (
    <main id="main-content" className="app-screen ke-login-page ke-login-page--premium">
      <div className="ke-login-shell">
        <KEWaveBackground className="login-premium-header">
          <header className="login-header-content flex flex-col items-center">
            <img src="/ke-logo-256w.png" alt="" aria-hidden="true" className="ke-login-logo" />
            <p className="ke-login-brand">Kumar Electronics and Electricals</p>
            <h1 className="ke-login-title">Secure Staff Access</h1>
            <p className="ke-login-subtitle">Checking session...</p>
          </header>
        </KEWaveBackground>
      </div>
    </main>
  );
}

function getRedirectPath(from) {
  if (!from) return "/employee-dashboard";
  if (typeof from === "string") return from;
  return `${from.pathname || ""}${from.search || ""}${from.hash || ""}` || "/employee-dashboard";
}

function getDeviceFingerprint() {
  const key = "ke_device_fingerprint";
  const existing = localStorage.getItem(key);
  if (existing) return existing;
  const bytes = new Uint8Array(16);
  window.crypto?.getRandomValues?.(bytes);
  const value = Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("") || `${Date.now()}-${Math.random()}`;
  localStorage.setItem(key, value);
  return value;
}

function getDeviceLabel() {
  const platform = navigator.userAgentData?.platform || navigator.platform || "Unknown device";
  return `${platform} browser`;
}

function ErrorMessage({ children }) {
  if (!children) return null;
  return (
    <p role="alert" className="mt-4 rounded-xl bg-red-50 px-4 py-3 text-center text-sm font-semibold text-red-700">
      {children}
    </p>
  );
}

export default function EmployeeLogin() {
  const navigate = useNavigate();
  const location = useLocation();
  const redirectPath = getRedirectPath(location.state?.from);
  const [employeeId, setEmployeeId] = useState("");
  const [password, setPassword] = useState("");
  const [authMode, setAuthMode] = useState(null);
  const [pairing, setPairing] = useState(null);
  const [qrDataUrl, setQrDataUrl] = useState("");
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isCheckingPinLogin, setIsCheckingPinLogin] = useState(() => !getValidToken());

  const isDeviceMode = authMode === AUTH_MODES.DEVICE_PAIRING_PIN;
  const pairingToken = pairing?.pairingToken || "";
  const deviceFingerprint = useMemo(() => getDeviceFingerprint(), []);
  const validToken = getValidToken();

  useEffect(() => {
    let isCurrent = true;
    if (getValidToken()) {
      setIsCheckingPinLogin(false);
      return undefined;
    }

    setIsCheckingPinLogin(true);
    isPinLoginAvailable().then((available) => {
      if (!isCurrent) return;

      if (available) {
        navigate("/pin-login", { replace: true, state: location.state });
        return;
      }

      setIsCheckingPinLogin(false);
    });

    return () => {
      isCurrent = false;
    };
  }, [location.state, navigate]);

  useEffect(() => {
    let active = true;
    if (!pairingToken) {
      setQrDataUrl("");
      return undefined;
    }
    QRCode.toDataURL(pairingToken, { margin: 1, width: 220 })
      .then((url) => {
        if (active) setQrDataUrl(url);
      })
      .catch(() => {
        if (active) setQrDataUrl("");
      });
    return () => {
      active = false;
    };
  }, [pairingToken]);

  useEffect(() => {
    if (!pairing?.requestId || !pairing?.nonce) return undefined;
    let cancelled = false;
    let timeoutId;

    const poll = async () => {
      try {
        const response = await fetch("/volt/auth/device-pairing/status", {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            requestId: pairing.requestId,
            nonce: pairing.nonce,
            deviceFingerprint,
          }),
        });
        if (!response.ok) throw new Error("Pairing status unavailable");
        const data = await response.json();
        if (cancelled) return;

        if (data.status === "EXPIRED" || data.status === "CANCELLED") {
          setError("Device pairing request expired. Please request pairing again.");
          setPairing(null);
          return;
        }

        if (data.session?.token) {
          persistAuthSession(data.session);
          navigate(data.session.pinRequired ? "/pin-setup" : redirectPath, { replace: true, state: { from: redirectPath } });
          return;
        }
      } catch {
        if (!cancelled) setError("Waiting for approval. Status check will retry.");
      }

      if (!cancelled) timeoutId = window.setTimeout(poll, (pairing.pollAfterSeconds || 3) * 1000);
    };

    timeoutId = window.setTimeout(poll, 1000);
    return () => {
      cancelled = true;
      window.clearTimeout(timeoutId);
    };
  }, [deviceFingerprint, navigate, pairing, redirectPath]);

  if (validToken) {
    return <Navigate to="/employee-dashboard" replace />;
  }

  if (isCheckingPinLogin) {
    return <SessionCheckScreen />;
  }

  const resolveAuthMode = async () => {
    if (!employeeId.trim()) {
      setError("Enter your employee ID first.");
      return;
    }
    setIsSubmitting(true);
    setError("");
    try {
      const response = await fetch("/volt/auth/config", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ employeeId }),
      });
      if (!response.ok) throw new Error("Unable to determine login method.");
      const data = await response.json();
      setAuthMode(data.authenticationMode || AUTH_MODES.PASSWORD_PIN);
      setPairing(null);
    } catch (error) {
      setAuthMode(null);
      setError(error.message || "Unable to determine login method.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const startPairing = async () => {
    if (!employeeId.trim()) {
      setError("Enter your employee ID first.");
      return;
    }

    setIsSubmitting(true);
    setError("");
    try {
      if (pairing?.requestId && pairing?.nonce) {
        void cancelPairing(pairing);
      }
      const response = await fetch("/volt/auth/device-pairing/requests", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          employeeId,
          deviceFingerprint,
          deviceLabel: getDeviceLabel(),
        }),
      });
      if (!response.ok) throw new Error("Unable to request device pairing.");
      const data = await response.json();
      setAuthMode(AUTH_MODES.DEVICE_PAIRING_PIN);
      setPairing(data);
    } catch (error) {
      setPairing(null);
      setError(error.message || "Unable to request device pairing.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const cancelPairing = async (pairingRequest) => {
    try {
      await fetch("/volt/auth/device-pairing/cancel", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          requestId: pairingRequest.requestId,
          nonce: pairingRequest.nonce,
        }),
      });
    } catch {
      // Best effort only; pending requests also expire quickly server-side.
    }
  };

  const handleLogin = async (e) => {
    e.preventDefault();
    if (isSubmitting) return;

    if (!authMode) {
      await resolveAuthMode();
      return;
    }

    if (isDeviceMode) {
      await startPairing();
      return;
    }

    setError("");
    setIsSubmitting(true);

    try {
      const response = await fetch("/volt/auth/employeelogin", {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          employeeId,
          password,
        }),
      });

      if (!response.ok) {
        let message = "Unable to log in. Please check your employee ID and password.";
        if (response.status === 423) {
          message = "Account is locked. Please contact an administrator to reset your password.";
        }
        throw new Error(message);
      }

      const data = await response.json();
      if (!data.token) throw new Error("Missing token");

      if (data.pinRequired) {
        persistAuthSession(data);
        navigate("/pin-setup", { replace: true, state: { from: redirectPath } });
        return;
      }
      clearAuthSession();
      navigate("/pin-login", { replace: true, state: { from: redirectPath } });
    } catch (error) {
      clearAuthSession();
      setError(error.message || "Unable to log in. Please check your employee ID and password.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const resetMode = () => {
    if (pairing?.requestId && pairing?.nonce) {
      void cancelPairing(pairing);
    }
    setAuthMode(null);
    setPassword("");
    setPairing(null);
    setError("");
  };

  return (
    <main id="main-content" className="app-screen ke-login-page ke-login-page--premium">
      <div className="ke-login-shell">
        <KEWaveBackground className="login-premium-header">
          <header className="login-header-content flex flex-col items-center">
            <img src="/ke-logo-256w.png" alt="" aria-hidden="true" className="ke-login-logo" />
            <p className="ke-login-brand">Kumar Electronics and Electricals</p>
            <h1 className="ke-login-title">{isDeviceMode ? "Device Pairing" : "Employee Login"}</h1>
            <p className="ke-login-subtitle">Secure Staff Access</p>
          </header>
        </KEWaveBackground>

        <div className="ke-login-card ke-login-form-area">
          <form onSubmit={handleLogin} className="ke-login-form">
            {!isDeviceMode && (
              <>
                <label htmlFor="employee-id" className="ke-login-label">
                  Employee ID
                </label>
                <div className="ke-login-control mb-4">
                  <User className="text-blue-950 mr-3" size={22} />
                  <input
                    id="employee-id"
                    type="text"
                    value={employeeId}
                    onChange={(event) => {
                      setEmployeeId(event.target.value);
                      setAuthMode(null);
                      setPassword("");
                      setError("");
                    }}
                    placeholder="Enter Employee ID"
                    className="ke-login-input"
                    autoComplete="username"
                    required={!isDeviceMode}
                  />
                </div>
              </>
            )}

            {authMode === AUTH_MODES.PASSWORD_PIN && (
              <>
                <label htmlFor="employee-password" className="ke-login-label">
                  Password
                </label>
                <div className="ke-login-control">
                  <Lock className="text-blue-950 mr-3" size={22} />
                  <input
                    id="employee-password"
                    type="password"
                    value={password}
                    onChange={(event) => {
                      setPassword(event.target.value);
                      setError("");
                    }}
                    placeholder="Enter Password"
                    className="ke-login-input"
                    autoComplete="current-password"
                    required
                  />
                </div>
              </>
            )}

            {isDeviceMode && (
              <div className="rounded-2xl border border-blue-100 bg-blue-50 p-4 text-center">
                {!pairing && (
                  <Smartphone className="mx-auto text-blue-950" size={34} aria-hidden="true" />
                )}
                {pairing && (
                  <>
                    {qrDataUrl ? (
                      <img src={qrDataUrl} alt="Device pairing QR code" className="mx-auto h-56 w-56 rounded-xl bg-white p-2" />
                    ) : (
                      <QrCode className="mx-auto text-blue-950" size={42} aria-hidden="true" />
                    )}
                    <p className="mt-3 flex items-center justify-center gap-2 text-sm font-bold text-blue-950">
                      <Clock3 size={16} aria-hidden="true" />
                      Waiting for manager approval
                    </p>
                  </>
                )}
              </div>
            )}

            <button
              type="submit"
              disabled={isSubmitting}
              aria-busy={isSubmitting}
              className="ke-login-button"
            >
              {isSubmitting ? <RefreshCw size={22} /> : <ShieldCheck size={22} />}
              {isSubmitting
                ? "Please wait..."
                : !authMode
                  ? "Continue"
                  : isDeviceMode
                    ? pairing ? "Request Again" : "Request Device Pairing"
                    : "Login"}
            </button>

            {!isDeviceMode && (
              <button type="button" onClick={startPairing} disabled={isSubmitting} className="text-sm font-bold text-blue-950 underline disabled:opacity-60">
                Request device pairing
              </button>
            )}

            {authMode && (
              <button type="button" onClick={resetMode} className="text-sm font-bold text-slate-600 underline">
                Use another login method
              </button>
            )}

            <ErrorMessage>{error}</ErrorMessage>
          </form>
        </div>
      </div>
    </main>
  );
}
