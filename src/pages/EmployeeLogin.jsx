import { useState } from "react";
import { User, Lock, ShieldCheck } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { clearAccess, fetchCurrentAccess } from "../utils/access";

export default function EmployeeLogin() {
  const navigate = useNavigate();
  const [employeeId, setEmployeeId] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleLogin = async (e) => {
    e.preventDefault();
    if (isSubmitting) return;

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
          password,
        }),
      });

      if (!response.ok) {
        throw new Error("Invalid credentials");
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
      navigate("/employee-dashboard", { replace: true });
    } catch {
      clearAccess();
      setError("Unable to log in. Please check your employee ID and password.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <main id="main-content" className="ke-login-page">
      
      <div className="ke-login-card">

        <header className="flex flex-col items-center">
          
          <img src="/ke-logo-256w.png" alt="" aria-hidden="true" className="ke-login-logo" />

          <p className="ke-login-brand">
            Kumar Electronics
          </p>

          <h1 className="ke-login-title">
            Employee Login
          </h1>

          <p className="ke-login-subtitle">
            Secure Staff Access
          </p>

        </header>

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
              onChange={(e) => setEmployeeId(e.target.value)}
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
              onChange={(e) => setPassword(e.target.value)}
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
    </main>
  );
}
