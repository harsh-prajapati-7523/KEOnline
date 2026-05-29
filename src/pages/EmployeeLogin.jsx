import { useState } from "react";
import { User, Lock, ShieldCheck } from "lucide-react";

export default function EmployeeLogin() {
  const [employeeId, setEmployeeId] = useState("");
  const [password, setPassword] = useState("");

  const handleLogin = (e) => {
    e.preventDefault();

    // Temporary frontend-only login
    if (employeeId === "admin" && password === "123456") {
      alert("Login Successful");
    } else {
      alert("Invalid Credentials");
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
            className="w-full mt-6 bg-yellow-400 hover:bg-yellow-300 text-black py-3 rounded-2xl font-bold text-lg flex items-center justify-center gap-2 transition"
          >
            <ShieldCheck size={22} />
            Login
          </button>

        </form>

      </div>
    </div>
  );
}