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
    <div className="min-h-screen bg-gradient-to-r from-blue-950 to-blue-800 flex items-center justify-center px-4">
      
      <div className="bg-white w-full max-w-md rounded-3xl shadow-2xl p-8">

        <div className="flex flex-col items-center">
          
          <div className="w-20 h-20 rounded-full border-4 border-yellow-400 flex items-center justify-center text-4xl font-bold italic text-blue-950">
            ke
          </div>

          <h1 className="text-3xl font-extrabold text-blue-950 mt-4 text-center">
            Employee Login
          </h1>

          <p className="text-gray-500 text-sm mt-2 text-center">
            Secure Staff Access
          </p>

        </div>

        <form onSubmit={handleLogin} className="mt-8">

          <label className="font-semibold text-gray-700 block mb-2">
            Employee ID
          </label>

          <div className="flex items-center border-2 border-gray-200 rounded-2xl px-4 py-3 mb-4">
            
            <User className="text-blue-950 mr-3" size={22} />

            <input
              type="text"
              value={employeeId}
              onChange={(e) => setEmployeeId(e.target.value)}
              placeholder="Enter Employee ID"
              className="w-full outline-none"
              required
            />

          </div>

          <label className="font-semibold text-gray-700 block mb-2">
            Password
          </label>

          <div className="flex items-center border-2 border-gray-200 rounded-2xl px-4 py-3">
            
            <Lock className="text-blue-950 mr-3" size={22} />

            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Enter Password"
              className="w-full outline-none"
              required
            />

          </div>

          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full mt-6 bg-yellow-400 hover:bg-yellow-300 text-black py-3 rounded-2xl font-bold text-lg flex items-center justify-center gap-2 transition"
          >
            <ShieldCheck size={22} />
            {isSubmitting ? "Logging in..." : "Login"}
          </button>

          {error && (
            <p className="mt-4 text-center text-sm font-semibold text-red-600">
              {error}
            </p>
          )}

        </form>

      </div>
    </div>
  );
}
