import { useState } from "react";
import { KeyRound, Lock, RotateCcw } from "lucide-react";
import { useLocation, useNavigate } from "react-router-dom";
import KEWaveBackground from "../components/KEWaveBackground";
import { clearAccess, fetchCurrentAccess } from "../utils/access";
import { persistAuthSession, resetPinSession } from "../utils/auth";

function normalizePin(value) {
  return value.replace(/\D/g, "").slice(0, 6);
}

export default function PinLogin() {
  const navigate = useNavigate();
  const location = useLocation();
  const [pin, setPin] = useState("");
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isResettingPin, setIsResettingPin] = useState(false);
  const redirectPath = location.state?.from
    ? typeof location.state.from === "string"
      ? location.state.from
      : `${location.state.from.pathname || ""}${location.state.from.search || ""}${location.state.from.hash || ""}`
    : "/employee-dashboard";

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (isSubmitting) return;

    if (!/^\d{6}$/.test(pin)) {
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
        body: JSON.stringify({ pin }),
      });

      if (!response.ok) {
        throw new Error("PIN expired or incorrect. Please login with password.");
      }

      const data = await response.json();
      persistAuthSession(data);
      try {
        await fetchCurrentAccess();
      } catch {
        clearAccess();
      }
      const safeRedirectPath = redirectPath.startsWith("/") ? redirectPath : "/employee-dashboard";
      navigate(data.pinRequired ? "/pin-setup" : safeRedirectPath, { replace: true });
    } catch (error) {
      clearAccess();
      setError(error.message || "PIN expired or incorrect. Please login with password.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleResetPin = async () => {
    if (isResettingPin) return;

    setIsResettingPin(true);
    setError("");
    await resetPinSession();
    clearAccess();
    navigate("/employee-login", { replace: true });
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
            <label htmlFor="employee-pin" className="ke-login-label">
              6 Digit PIN
            </label>

            <div className="ke-login-control">
              <Lock className="mr-3 text-blue-950" size={22} aria-hidden="true" />
              <input id="employee-pin" type="password" inputMode="numeric" autoComplete="one-time-code" maxLength={6} value={pin} onChange={(event) => { setPin(normalizePin(event.target.value)); setError(""); }} placeholder="Enter 6 Digit PIN" className="ke-login-input" required />
            </div>

            <button type="submit" disabled={isSubmitting} aria-busy={isSubmitting} className="ke-login-button">
              <KeyRound size={22} />
              {isSubmitting ? "Unlocking..." : "Unlock"}
            </button>

            <button type="button" onClick={handleResetPin} disabled={isResettingPin} className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl border border-blue-950 px-4 py-3 text-sm font-bold text-blue-950 transition hover:bg-blue-50 disabled:opacity-60">
              <RotateCcw size={17} aria-hidden="true" />
              {isResettingPin ? "Resetting..." : "Reset PIN"}
            </button>

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
