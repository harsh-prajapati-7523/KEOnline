import { useEffect, useState } from "react";
import { User, Lock, ShieldCheck } from "lucide-react";
import { useLocation, useNavigate } from "react-router-dom";
import KEWaveBackground from "../components/KEWaveBackground";
import { clearAccess, fetchCurrentAccess } from "../utils/access";
import { getValidToken, isPinLoginAvailable, persistAuthSession } from "../utils/auth";

export default function EmployeeLogin() {
  const navigate = useNavigate();
  const location = useLocation();
  const redirectPath = location.state?.from
    ? `${location.state.from.pathname || ""}${location.state.from.search || ""}${location.state.from.hash || ""}`
    : "/employee-dashboard";
  const [employeeId, setEmployeeId] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    let isCurrent = true;
    if (getValidToken()) return undefined;

    isPinLoginAvailable().then((available) => {
      if (isCurrent && available) {
        navigate("/pin-login", { replace: true, state: location.state });
      }
    });

    return () => {
      isCurrent = false;
    };
  }, [location.state, navigate]);

  const handleEmployeeIdChange = (event) => {
    setEmployeeId(event.target.value);
    setError("");
  };

  const handlePasswordChange = (event) => {
    setPassword(event.target.value);
    setError("");
  };

  const handleLogin = async (e) => {
    e.preventDefault();
    if (isSubmitting) return;

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

      if (!data.token) {
        throw new Error("Missing token");
      }

      persistAuthSession(data);
      try {
        await fetchCurrentAccess();
      } catch {
        clearAccess();
      }
      if (data.pinRequired) {
        navigate("/pin-setup", { replace: true, state: { from: redirectPath } });
        return;
      }
      navigate(redirectPath.startsWith("/") ? redirectPath : "/employee-dashboard", { replace: true });
    } catch (error) {
      clearAccess();
      setError(error.message || "Unable to log in. Please check your employee ID and password.");
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

            <label htmlFor="employee-password" className="ke-login-label">
              Password
            </label>

            <div className="ke-login-control">
            
              <Lock className="text-blue-950 mr-3" size={22} />

              <input
                id="employee-password"
                type="password"
                value={password}
                onChange={handlePasswordChange}
                placeholder="Enter Password"
                className="ke-login-input"
                autoComplete="current-password"
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
