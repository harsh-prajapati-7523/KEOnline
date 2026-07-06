import { useState } from "react";
import { KeyRound, Lock, ShieldCheck } from "lucide-react";
import { Navigate, useLocation, useNavigate } from "react-router-dom";
import KEPremiumCardBackground from "../components/KEPremiumCardBackground";
import { clearAuthSession, getValidToken } from "../utils/auth";

const emptyForm = {
  pin: "",
  confirmPin: "",
};

function normalizePin(value) {
  return value.replace(/\D/g, "").slice(0, 6);
}

export default function PinSetup() {
  const navigate = useNavigate();
  const location = useLocation();
  const [form, setForm] = useState(emptyForm);
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
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
    <main id="main-content" className="ke-page-main dashboard-page lg:px-8">
      <div className="dashboard-mobile-container max-w-xl">
        <header className="dashboard-welcome-card">
          <KEPremiumCardBackground className="dashboard-welcome-premium-bg">
            <div className="dashboard-welcome-content">
              <div className="dashboard-user-avatar" aria-hidden="true">
                <KeyRound />
              </div>
              <div className="dashboard-user-info">
                <h1 className="dashboard-welcome-title">Create 6 Digit PIN</h1>
                <p className="dashboard-welcome-helper">Use this PIN for quick secure login on this device.</p>
              </div>
            </div>
          </KEPremiumCardBackground>
        </header>

        <form onSubmit={handleSubmit} className="mt-4 rounded-2xl border border-blue-100 bg-white p-5 shadow-sm sm:p-6">
          <label htmlFor="pin" className="ke-form-label">
            PIN
          </label>
          <div className="mb-4 flex min-h-12 w-full items-center rounded-xl border border-blue-100 bg-white px-3 py-1.5 focus-within:border-blue-950">
            <Lock className="mr-3 shrink-0 text-blue-950" size={20} aria-hidden="true" />
            <input id="pin" name="pin" type="password" inputMode="numeric" autoComplete="one-time-code" maxLength={6} value={form.pin} onChange={handleChange} className="min-h-10 min-w-0 flex-1 bg-transparent text-base font-semibold text-slate-900 outline-none" required />
          </div>

          <label htmlFor="confirm-pin" className="ke-form-label">
            Confirm PIN
          </label>
          <div className="flex min-h-12 w-full items-center rounded-xl border border-blue-100 bg-white px-3 py-1.5 focus-within:border-blue-950">
            <ShieldCheck className="mr-3 shrink-0 text-blue-950" size={20} aria-hidden="true" />
            <input id="confirm-pin" name="confirmPin" type="password" inputMode="numeric" autoComplete="one-time-code" maxLength={6} value={form.confirmPin} onChange={handleChange} className="min-h-10 min-w-0 flex-1 bg-transparent text-base font-semibold text-slate-900 outline-none" required />
          </div>

          <button type="submit" disabled={isSubmitting} className="ke-accent-action mt-5 flex min-h-12 w-full items-center justify-center gap-2 rounded-xl px-4 py-2 text-base font-bold disabled:opacity-70">
            <KeyRound size={19} aria-hidden="true" />
            {isSubmitting ? "Creating..." : "Create PIN"}
          </button>

          {error && (
            <p role="alert" className="mt-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">
              {error}
            </p>
          )}
        </form>
      </div>
    </main>
  );
}
