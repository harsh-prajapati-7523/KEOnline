import { useEffect, useState } from "react";
import { User, Lock, ShieldCheck } from "lucide-react";
import { useLocation, useNavigate } from "react-router-dom";
import KEWaveBackground from "../components/KEWaveBackground";
import { clearAccess, fetchCurrentAccess } from "../utils/access";

const LOGIN_MODE = {
  PIN: "PIN",
  PASSWORD: "PASSWORD",
};

export default function EmployeeLogin() {
  const navigate = useNavigate();
  const location = useLocation();
  const redirectPath = location.state?.from
    ? `${location.state.from.pathname || ""}${location.state.from.search || ""}${location.state.from.hash || ""}`
    : "/employee-dashboard";
  const [employeeId, setEmployeeId] = useState("");
  const [credential, setCredential] = useState("");
  const [loginMode, setLoginMode] = useState(LOGIN_MODE.PIN);
  const [isCheckingLoginMode, setIsCheckingLoginMode] = useState(false);
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const isPasswordMode = loginMode === LOGIN_MODE.PASSWORD;
  const credentialLabel = isPasswordMode ? "Password" : "6 Digit PIN";
  const credentialPlaceholder = isPasswordMode ? "Enter Password" : "Enter 6 Digit PIN";

  useEffect(() => {
    const trimmedEmployeeId = employeeId.trim();
    if (!trimmedEmployeeId) {
      setLoginMode(LOGIN_MODE.PIN);
      setIsCheckingLoginMode(false);
      return undefined;
    }

    const controller = new AbortController();
    const timeoutId = window.setTimeout(async () => {
      setIsCheckingLoginMode(true);
      try {
        const response = await fetch(`/volt/auth/employee-login-mode?employeeId=${encodeURIComponent(trimmedEmployeeId)}`, {
          signal: controller.signal,
        });
        if (!response.ok) throw new Error("Unable to check login mode");
        const data = await response.json();
        const nextMode = data.credentialType === LOGIN_MODE.PASSWORD ? LOGIN_MODE.PASSWORD : LOGIN_MODE.PIN;
        setLoginMode((currentMode) => {
          if (currentMode !== nextMode) {
            setCredential("");
          }
          return nextMode;
        });
      } catch (error) {
        if (error.name !== "AbortError") {
          setLoginMode(LOGIN_MODE.PIN);
        }
      } finally {
        if (!controller.signal.aborted) {
          setIsCheckingLoginMode(false);
        }
      }
    }, 250);

    return () => {
      controller.abort();
      window.clearTimeout(timeoutId);
    };
  }, [employeeId]);

  const handleEmployeeIdChange = (event) => {
    setEmployeeId(event.target.value);
    setError("");
  };

  const handleCredentialChange = (event) => {
    const value = event.target.value;
    setCredential(isPasswordMode ? value : value.replace(/\D/g, "").slice(0, 6));
    setError("");
  };

  const handleLogin = async (e) => {
    e.preventDefault();
    if (isSubmitting) return;

    if (!isPasswordMode && !/^\d{6}$/.test(credential)) {
      setError("Please enter a valid 6 digit PIN.");
      return;
    }

    setError("");
    setIsSubmitting(true);

    try {
      const response = await fetch("/volt/auth/employeelogin", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          employeeId,
          password: credential,
        }),
      });

      if (!response.ok) {
        let message = `Unable to log in. Please check your employee ID and ${isPasswordMode ? "password" : "PIN"}.`;
        if (response.status === 423) {
          message = "Account is locked. Please contact an administrator to reset your password.";
        }
        throw new Error(message);
      }

      const data = await response.json();

      if (!data.token) {
        throw new Error("Missing token");
      }

      localStorage.setItem("token", data.token);
      localStorage.setItem("employeeName", data.employeeName ?? "");
      localStorage.setItem("role", data.role ?? "");
      localStorage.setItem("employeeId", data.employeeId ?? "");
      try {
        await fetchCurrentAccess();
      } catch {
        clearAccess();
      }
      navigate(redirectPath.startsWith("/") ? redirectPath : "/employee-dashboard", { replace: true });
    } catch (error) {
      clearAccess();
      setError(error.message || `Unable to log in. Please check your employee ID and ${isPasswordMode ? "password" : "PIN"}.`);
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

            <p className="ke-login-brand">
              Kumar Electronics and Electricals
            </p>

            <h1 className="ke-login-title">
              Employee Login
            </h1>

            <p className="ke-login-subtitle">
              Secure Staff Access
            </p>

          </header>
        </KEWaveBackground>

        <div className="ke-login-card ke-login-form-area">
          <form onSubmit={handleLogin} className="ke-login-form">

            <label htmlFor="employee-id" className="ke-login-label">
              Employee ID
            </label>

            <div className="ke-login-control mb-4">
            
              <User className="text-blue-950 mr-3" size={22} />

              <input
                id="employee-id"
                type="text"
                value={employeeId}
                onChange={handleEmployeeIdChange}
                placeholder="Enter Employee ID"
                className="ke-login-input"
                autoComplete="username"
                required
              />

            </div>

            <label htmlFor="employee-credential" className="ke-login-label">
              {credentialLabel}
              {isCheckingLoginMode && <span className="ml-2 text-xs font-semibold text-gray-500">Checking...</span>}
            </label>

            <div className="ke-login-control">
            
              <Lock className="text-blue-950 mr-3" size={22} />

              <input
                id="employee-credential"
                type="password"
                value={credential}
                onChange={handleCredentialChange}
                placeholder={credentialPlaceholder}
                className="ke-login-input"
                autoComplete={isPasswordMode ? "current-password" : "one-time-code"}
                inputMode={isPasswordMode ? undefined : "numeric"}
                maxLength={isPasswordMode ? undefined : 6}
                pattern={isPasswordMode ? undefined : "\\d{6}"}
                required
              />

            </div>

            <button
              type="submit"
              disabled={isSubmitting}
              aria-busy={isSubmitting}
              className="ke-login-button"
            >
              <ShieldCheck size={22} />
              {isSubmitting ? "Logging in..." : "Login"}
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
