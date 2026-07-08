import { useCallback, useEffect, useRef, useState } from "react";
import { Lock } from "lucide-react";
import { Navigate, useLocation, useNavigate } from "react-router-dom";
import KEWaveBackground from "../components/KEWaveBackground";
import { clearAccess, fetchCurrentAccess } from "../utils/access";
import { getPinLoginStatus, getValidToken, persistAuthSession, resetPinSession } from "../utils/auth";

function normalizePin(value) {
  return value.replace(/\D/g, "").slice(0, 6);
}

const MAX_PIN_ATTEMPTS = 5;
const PIN_RESET_STATUS = 423;
const PIN_FAILED_ATTEMPTS_KEY = "ke_pin_failed_attempts";

function readFailedPinAttempts() {
  if (typeof window === "undefined") {
    return 0;
  }

  const storedValue = window.sessionStorage.getItem(PIN_FAILED_ATTEMPTS_KEY);
  const parsedValue = Number.parseInt(storedValue || "0", 10);
  return Number.isNaN(parsedValue) ? 0 : parsedValue;
}

function writeFailedPinAttempts(value) {
  if (typeof window === "undefined") {
    return;
  }

  window.sessionStorage.setItem(PIN_FAILED_ATTEMPTS_KEY, String(value));
}

function clearFailedPinAttempts() {
  if (typeof window === "undefined") {
    return;
  }

  window.sessionStorage.removeItem(PIN_FAILED_ATTEMPTS_KEY);
}

export default function PinLogin() {
  const navigate = useNavigate();
  const location = useLocation();
  const [pin, setPin] = useState("");
  const [error, setError] = useState("");
  const [failedAttempts, setFailedAttempts] = useState(readFailedPinAttempts);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isResettingPin, setIsResettingPin] = useState(false);
  const [isPinFocused, setIsPinFocused] = useState(false);
  const [employeeName, setEmployeeName] = useState("");
  const pinInputRef = useRef(null);
  const validToken = getValidToken();
  const redirectPath = location.state?.from
    ? typeof location.state.from === "string"
      ? location.state.from
      : `${location.state.from.pathname || ""}${location.state.from.search || ""}${location.state.from.hash || ""}`
    : "/employee-dashboard";

  const returnToEmployeeLogin = useCallback(() => {
    clearFailedPinAttempts();
    setFailedAttempts(0);
    setPin("");
    clearAccess();
    navigate("/employee-login", { replace: true });
  }, [navigate]);

  useEffect(() => {
    if (validToken) return undefined;

    let isCurrent = true;

    getPinLoginStatus().then((status) => {
      if (!isCurrent) return;
      if (isCurrent && status.pinLoginAvailable && status.employeeName) {
        setEmployeeName(status.employeeName);
        return;
      }
      if (!status.sessionValid || !status.pinLoginAvailable) {
        returnToEmployeeLogin();
      }
    });

    return () => {
      isCurrent = false;
    };
  }, [returnToEmployeeLogin, validToken]);

  if (validToken) {
    return <Navigate to="/employee-dashboard" replace />;
  }

  const unlockWithPin = async (pinValue) => {
    if (isSubmitting) return;

    if (!/^\d{6}$/.test(pinValue)) {
      setError("Please enter a valid 6 digit PIN.");
      return;
    }

    setIsSubmitting(true);
    setError("");
    try {
      const response = await fetch("/volt/auth/pin/login", {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ pin: pinValue }),
      });

      if (response.status === PIN_RESET_STATUS) {
        setError("Too many invalid PIN attempts. Resetting PIN...");
        await resetPinSession();
        returnToEmployeeLogin();
        return;
      }

      if (!response.ok) {
        const status = await getPinLoginStatus();
        if (!status.sessionValid || !status.pinLoginAvailable) {
          returnToEmployeeLogin();
          return;
        }
        throw new Error("PIN expired or incorrect.");
      }

      const data = await response.json();
      persistAuthSession(data);
      clearFailedPinAttempts();
      setFailedAttempts(0);
      try {
        await fetchCurrentAccess();
      } catch {
        clearAccess();
      }
      const safeRedirectPath = redirectPath.startsWith("/") ? redirectPath : "/employee-dashboard";
      navigate(data.pinRequired ? "/pin-setup" : safeRedirectPath, { replace: true });
    } catch (error) {
      const nextFailedAttempts = failedAttempts + 1;
      const attemptsRemaining = MAX_PIN_ATTEMPTS - nextFailedAttempts;
      clearAccess();
      setPin("");
      writeFailedPinAttempts(nextFailedAttempts);
      setFailedAttempts(nextFailedAttempts);

      if (nextFailedAttempts >= MAX_PIN_ATTEMPTS) {
        setError("Too many invalid PIN attempts. Resetting PIN...");
        await resetPinSession();
        returnToEmployeeLogin();
        return;
      }

      setError(
        attemptsRemaining === 1
          ? `${error.message || "PIN expired or incorrect."} 1 attempt remaining.`
          : `${error.message || "PIN expired or incorrect."} ${attemptsRemaining} attempts remaining.`
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    await unlockWithPin(pin);
  };

  const handlePinChange = (event) => {
    const nextPin = normalizePin(event.target.value);
    setPin(nextPin);
    setError("");
    if (nextPin.length === 6) {
      void unlockWithPin(nextPin);
    }
  };

  const focusPinInput = () => {
    pinInputRef.current?.focus();
  };

  const handleResetPin = async () => {
    if (isResettingPin) return;

    setIsResettingPin(true);
    setError("");
    await resetPinSession();
    returnToEmployeeLogin();
  };

  return (
    <main id="main-content" className="app-screen ke-login-page ke-login-page--premium">
      <div className="ke-login-shell">
        <KEWaveBackground className="login-premium-header">
          <header className="login-header-content flex flex-col items-center">
            <img src="/ke-logo-256w.png" alt="" aria-hidden="true" className="ke-login-logo" />
            <p className="ke-login-brand">Kumar Electronics and Electricals</p>
            <h1 className="ke-login-title">PIN Login</h1>
            <p className="ke-login-subtitle">Secure Staff Access</p>
          </header>
        </KEWaveBackground>

        <div className="ke-login-card ke-login-form-area">
          <form onSubmit={handleSubmit} className="ke-login-form">
            {employeeName && (
              <p className="text-center text-base font-extrabold text-blue-950">
                Welcome, {employeeName}
              </p>
            )}

            <label htmlFor="employee-pin" className="ke-login-label">
              6 Digit PIN
            </label>

            <div className="ke-pin-entry" onClick={focusPinInput}>
              <input
                ref={pinInputRef}
                id="employee-pin"
                type="password"
                inputMode="numeric"
                autoComplete="one-time-code"
                maxLength={6}
                value={pin}
                onChange={handlePinChange}
                onFocus={() => setIsPinFocused(true)}
                onBlur={() => setIsPinFocused(false)}
                className="ke-pin-entry-input"
                aria-label="6 Digit PIN"
                required
              />
              <div className="ke-pin-box-grid" aria-hidden="true">
                {Array.from({ length: 6 }).map((_, index) => {
                  const isFilled = index < pin.length;
                  const isActive = isPinFocused && index === Math.min(pin.length, 5);
                  return (
                    <span key={index} className={`ke-pin-box ${isActive ? "ke-pin-box--active" : ""}`}>
                      {isFilled ? <span className="ke-pin-dot" /> : isActive ? <span className="ke-pin-caret" /> : null}
                    </span>
                  );
                })}
              </div>
            </div>

            <div className="ke-pin-helper">
              <Lock size={16} aria-hidden="true" />
              <span>Enter 6-digit PIN</span>
            </div>

            {isSubmitting && (
              <p role="status" className="mt-4 text-center text-sm font-bold text-blue-950">
                Unlocking...
              </p>
            )}

            <p className="ke-pin-reset-row">
              <span>Forgot PIN?</span>
              <button type="button" onClick={handleResetPin} disabled={isResettingPin || isSubmitting} className="ke-pin-reset-link">
                {isResettingPin ? "Resetting..." : "Reset PIN"}
              </button>
            </p>

            {error && (
              <p role="alert" className="mt-4 rounded-xl bg-red-50 px-4 py-3 text-center text-sm font-semibold text-red-700">
                {error}
              </p>
            )}
          </form>
        </div>
      </div>
    </main>
  );
}
