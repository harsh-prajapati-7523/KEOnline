import { BrowserRouter, Routes, Route, useNavigate, useLocation } from "react-router-dom";
import { Home, Ticket } from "lucide-react";
import HomePage from "./pages/Home";
import RiseTicket from "./pages/Riseticket";
import EmployeeLogin from "./pages/EmployeeLogin";
import EmployeeDashboard from "./pages/EmployeeDashboard";
import ProtectedRoute from "./components/ProtectedRoute";

function Navbar() {
  const navigate = useNavigate();
  const location = useLocation();
  const active = location.pathname;

  return (
    <nav className="bg-blue-950 text-white shadow-lg">
      <div className="max-w-7xl mx-auto px-4 py-4 flex flex-col lg:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-3 text-center lg:text-left">
          <div className="w-12 h-12 md:w-14 md:h-14 rounded-full border-4 border-yellow-400 flex items-center justify-center text-2xl md:text-3xl font-bold italic">
            ke
          </div>
          <div>
            <h1 className="text-lg md:text-2xl font-extrabold tracking-wide leading-tight">
              KUMAR ELECTRONICS & ELECTRICALS
            </h1>
            <p className="text-yellow-400 text-xs md:text-sm font-semibold">
              POWER BACKUP & SOLAR SOLUTIONS
            </p>
          </div>
        </div>
        <div className="flex flex-wrap justify-center gap-3 w-full lg:w-auto">
          <button
            onClick={() => navigate("/")}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl font-semibold transition ${
              active === "Home" ? "bg-yellow-400 text-black" : "bg-white/10 hover:bg-white/20"
            }`}
          >
            <Home size={18} /> Home
          </button>
          <button onClick={() => navigate("/ticket")}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl font-semibold transition ${
              active === "RiseTicket" ? "bg-yellow-400 text-black" : "bg-white/10 hover:bg-white/20"
            }`}
          >
            <Ticket size={18} /> Rise Ticket
          </button>
          <button onClick={() => navigate("/employee-login")}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl font-semibold transition ${
              active === "/employee-login"
                ? "bg-yellow-400 text-black"
                : "bg-white/10 hover:bg-white/20"
            }`}
          >
            Employee Login
          </button>
        </div>
      </div>
    </nav>
  );
}

function App() {
  return (
    <BrowserRouter>
      <Navbar />
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/ticket" element={<RiseTicket />} />
        <Route path="/employee-login" element={<EmployeeLogin />} />
        <Route path="/employee/dashboard" element={
          <ProtectedRoute>
            <Route path="/employee-dashboard" element={<EmployeeDashboard />} />
          </ProtectedRoute>
        }/>
      </Routes>
      
    </BrowserRouter>
  );
}

export default App;