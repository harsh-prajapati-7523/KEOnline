import { useRef, useState } from "react";
import { KeyRound, Lock, ShieldCheck } from "lucide-react";
import { Navigate, useLocation, useNavigate } from "react-router-dom";
import KEWaveBackground from "../components/KEWaveBackground";
import { clearAuthSession, getValidToken } from "../utils/auth";

const emptyForm = {
  pin: "",
  confirmPin: "",
};

function normalizePin(value) {
  return value.replace(/\D/g, "").slice(0, 6);
}

function PinBoxInput({
  id,
  name,
  value,
  label,
  helper,
  icon: Icon,
  isFocused,
  onBlur,
  onChange,
  onFocus,
  inputRef,
}) {
  const focusInput = () => {
    inputRef.current?.focus();
  };

  return (
    <div>
      <label htmlFor={id} className="ke-login-label">
        {label}
      </label>

      <div className="ke-pin-entry" onClick={focusInput}>
        <input
          ref={inputRef}
          id={id}
          name={name}
          type="password"
          inputMode="numeric"
          autoComplete="one-time-code"
          maxLength={6}
          value={value}
          onChange={onChange}
          onFocus={onFocus}
          onBlur={onBlur}
          className="ke-pin-entry-input"
          aria-label={label}
          required
        />
        <div className="ke-pin-box-grid" aria-hidden="true">
          {Array.from({ length: 6 }).map((_, index) => {
            const isFilled = index < value.length;
            const isActive = isFocused && index === Math.min(value.length, 5);
            return (
              <span key={index} className={`ke-pin-box ${isActive ? "ke-pin-box--active" : ""}`}>
                {isFilled ? <span className="ke-pin-dot" /> : isActive ? <span className="ke-pin-caret" /> : null}
              </span>
            );
          })}
        </div>
      </div>

      <div className="ke-pin-helper">
        <Icon size={16} aria-hidden="true" />
        <span>{helper}</span>
      </div>
    </div>
  );
}

export default function PinSetup() {
  const navigate = useNavigate();
  const location = useLocation();
  const [form, setForm] = useState(emptyForm);
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [focusedField, setFocusedField] = useState("");
  const pinInputRef = useRef(null);
  const confirmPinInputRef = useRef(null);
  const redirectPath = location.state?.from && String(location.state.from).startsWith("/")
    ? location.state.from
    : "/employee-dashboard";

  if (!getValidToken()) {
    return <Navigate to="/employee-login" replace />;
  }

  const handleChange = (event) => {
    const { name, value } = event.target;
    setForm((current) => ({ ...current, [name]: normalizePin(value) }));
    setError("");
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (isSubmitting) return;

    if (!/^\d{6}$/.test(form.pin)) {
      setError("PIN must be exactly 6 digits.");
      return;
    }
    if (form.pin !== form.confirmPin) {
      setError("PIN and confirm PIN must match.");
      return;
    }

    setIsSubmitting(true);
    setError("");
    try {
      const response = await fetch("/volt/auth/pin/setup", {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${getValidToken()}`,
        },
        body: JSON.stringify(form),
      });

      if (!response.ok) {
        throw new Error("Unable to create PIN. Please login again.");
      }

      clearAuthSession();
      navigate("/pin-login", { replace: true, state: { from: redirectPath } });
    } catch (error) {
      setError(error.message || "Unable to create PIN. Please login again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <main id="main-content" className="app-screen ke-login-page ke-login-page--premium">
      <div className="ke-login-shell">
        <KEWaveBackground className="login-premium-header">
          <header className="login-header-content flex flex-col items-center">
            <img src="/ke-logo-256w.png" alt="" aria-hidden="true" className="ke-login-logo" />
            <p className="ke-login-brand">Kumar Electronics and Electricals</p>
            <h1 className="ke-login-title">Create PIN</h1>
            <p className="ke-login-subtitle">Secure Staff Access</p>
          </header>
        </KEWaveBackground>

        <div className="ke-login-card ke-login-form-area">
          <form onSubmit={handleSubmit} className="ke-login-form">
            <PinBoxInput
              id="pin"
              name="pin"
              value={form.pin}
              label="6 Digit PIN"
              helper="Enter 6-digit PIN"
              icon={Lock}
              inputRef={pinInputRef}
              isFocused={focusedField === "pin"}
              onChange={handleChange}
              onFocus={() => setFocusedField("pin")}
              onBlur={() => setFocusedField("")}
            />

            <div className="mt-4">
              <PinBoxInput
                id="confirm-pin"
                name="confirmPin"
                value={form.confirmPin}
                label="Confirm PIN"
                helper="Confirm 6-digit PIN"
                icon={ShieldCheck}
                inputRef={confirmPinInputRef}
                isFocused={focusedField === "confirmPin"}
                onChange={handleChange}
                onFocus={() => setFocusedField("confirmPin")}
                onBlur={() => setFocusedField("")}
              />
            </div>

            <button type="submit" disabled={isSubmitting} className="ke-login-button mt-5">
              <KeyRound size={22} aria-hidden="true" />
              {isSubmitting ? "Creating..." : "Create PIN"}
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
