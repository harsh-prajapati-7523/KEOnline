import { useState } from "react";
import { Lock, ShieldCheck } from "lucide-react";
import { useNavigate } from "react-router-dom";

export default function Login() {
  const [pin, setPin] = useState("");
  const [error, setError] = useState("");

  const navigate = useNavigate();

  // Your 6-digit PIN
  const correctPin = "123456";

  const handleSubmit = (e) => {
    e.preventDefault();

    if (pin === correctPin) {
      navigate("/");
    } else {
      setError("Invalid 6-digit PIN");
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-r from-blue-950 to-blue-800 flex items-center justify-center px-4">

      <div className="bg-white w-full max-w-md rounded-3xl shadow-2xl p-8">

        {/* Logo */}
        <div className="flex flex-col items-center">

          <div className="w-20 h-20 rounded-full border-4 border-yellow-400 flex items-center justify-center text-4xl font-bold italic text-blue-950">
            ke
          </div>

          <h1 className="text-3xl font-extrabold text-blue-950 mt-4 text-center">
            Kumar Electronics and Electricals
          </h1>

          <p className="text-gray-500 text-sm mt-2 text-center">
            Enter 6 Digit Security PIN
          </p>

        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="mt-8">

          <label className="font-semibold text-gray-700 block mb-2">
            Security PIN
          </label>

          <div className="flex items-center border-2 border-gray-200 rounded-2xl px-4 py-3 focus-within:border-yellow-400 transition">

            <Lock className="text-blue-950 mr-3" size={22} />

            <input
              type="password"
              maxLength={6}
              value={pin}
              onChange={(e) => {
                setPin(e.target.value);
                setError("");
              }}
              placeholder="Enter 6 Digit PIN"
              className="w-full outline-none text-lg tracking-[8px]"
              required
            />

          </div>

          {error && (
            <p className="text-red-500 text-sm mt-3">
              {error}
            </p>
          )}

          <button
            type="submit"
            className="w-full mt-6 bg-yellow-400 hover:bg-yellow-300 text-black py-3 rounded-2xl font-bold text-lg flex items-center justify-center gap-2 transition"
          >
            <ShieldCheck size={22} />
            Login
          </button>

        </form>

        {/* Footer */}
        <p className="text-center text-gray-400 text-sm mt-6">
          Secure Access Only
        </p>

      </div>
    </div>
  );
}
