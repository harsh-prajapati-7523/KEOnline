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
    <div className="flex min-h-screen w-full overflow-x-hidden bg-gradient-to-r from-blue-950 to-blue-800 px-3 py-6 sm:items-center sm:justify-center sm:px-4">
      
      <div className="mx-auto w-full max-w-md rounded-2xl bg-white p-5 shadow-2xl sm:rounded-3xl sm:p-8">

        <div className="flex flex-col items-center">
          
          <div className="flex h-16 w-16 items-center justify-center rounded-full border-4 border-yellow-400 text-3xl font-bold italic text-blue-950 sm:h-20 sm:w-20 sm:text-4xl">
            ke
          </div>

          <h1 className="mt-4 text-center text-2xl font-extrabold text-blue-950 sm:text-3xl">
            Employee Login
          </h1>

          <p className="text-gray-500 text-sm mt-2 text-center">
            Secure Staff Access
          </p>

        </div>

        <form onSubmit={handleLogin} className="mt-7 sm:mt-8">

          <label className="font-semibold text-gray-700 block mb-2">
            Employee ID
          </label>

          <div className="mb-4 flex min-h-12 items-center rounded-2xl border-2 border-gray-200 px-4 py-3 focus-within:border-blue-950">
            
            <User className="text-blue-950 mr-3" size={22} />

            <input
              type="text"
              value={employeeId}
              onChange={(e) => setEmployeeId(e.target.value)}
              placeholder="Enter Employee ID"
              className="w-full min-w-0 bg-transparent text-base outline-none"
              autoComplete="username"
              required
            />

          </div>

          <label className="font-semibold text-gray-700 block mb-2">
            Password
          </label>

          <div className="flex min-h-12 items-center rounded-2xl border-2 border-gray-200 px-4 py-3 focus-within:border-blue-950">
            
            <Lock className="text-blue-950 mr-3" size={22} />

            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Enter Password"
              className="w-full min-w-0 bg-transparent text-base outline-none"
              autoComplete="current-password"
              required
            />

          </div>

          <button
            type="submit"
            disabled={isSubmitting}
            aria-busy={isSubmitting}
            className="mt-6 flex min-h-12 w-full items-center justify-center gap-2 rounded-2xl bg-yellow-400 px-5 py-3 text-lg font-bold text-black transition hover:bg-yellow-300 disabled:cursor-wait disabled:opacity-70"
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
  );
}
