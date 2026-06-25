import { useEffect, useState } from "react";
import { BrowserRouter, Routes, Route, useNavigate, useLocation } from "react-router-dom";
import { Download, Home, LayoutDashboard, ListChecks, LogIn, LogOut, PlusCircle, X } from "lucide-react";
import HomePage from "./pages/Home";
import EmployeeLogin from "./pages/EmployeeLogin";
import EmployeeDashboard from "./pages/EmployeeDashboard";
import EmployeeManagement from "./pages/EmployeeManagement";
import RoleManagement from "./pages/RoleManagement";
import RoleAccessManagement from "./pages/RoleAccessManagement";
import WorkflowManagement from "./pages/WorkflowManagement";
import TicketCategoryManagement from "./pages/TicketCategoryManagement";
import TicketCategoryFieldManagement from "./pages/TicketCategoryFieldManagement";
import TicketFieldManagement from "./pages/TicketFieldManagement";
import DropdownSourceManagement from "./pages/DropdownSourceManagement";
import CreateTicket from "./pages/CreateTicket";
import TicketList from "./pages/TicketList";
import TicketDetail from "./pages/TicketDetail";
import ProtectedRoute from "./components/ProtectedRoute";
import { clearAccess, hasAnyAccess } from "./utils/access";

function isStandaloneDisplay() {
  return window.matchMedia?.("(display-mode: standalone)")?.matches || window.navigator.standalone === true;
}

function InstallAppPrompt() {
  const [installPromptEvent, setInstallPromptEvent] = useState(null);
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    if (isStandaloneDisplay()) return undefined;

    const handleBeforeInstallPrompt = (event) => {
      event.preventDefault();
      setInstallPromptEvent(event);
      setIsVisible(true);
    };

    const handleAppInstalled = () => {
      setInstallPromptEvent(null);
      setIsVisible(false);
    };

    window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
    window.addEventListener("appinstalled", handleAppInstalled);

    return () => {
      window.removeEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
      window.removeEventListener("appinstalled", handleAppInstalled);
    };
  }, []);

  const handleInstall = async () => {
    if (!installPromptEvent) return;

    installPromptEvent.prompt();
    const choice = await installPromptEvent.userChoice;
    setInstallPromptEvent(null);

    if (choice?.outcome !== "accepted") {
      setIsVisible(false);
    }
  };

  if (!installPromptEvent || !isVisible) return null;

  return (
    <aside className="fixed inset-x-3 bottom-24 z-50 mx-auto max-w-md rounded-2xl border border-blue-100 bg-white p-3 text-blue-950 shadow-2xl sm:bottom-4 sm:right-4 sm:left-auto sm:mx-0 sm:w-full" aria-label="Install RiseTicket app">
      <div className="flex min-w-0 items-start gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-blue-950 text-white">
          <Download size={19} aria-hidden="true" />
        </div>
        <div className="min-w-0 flex-1">
          <h2 className="text-sm font-extrabold">Add RiseTicket to Home Screen</h2>
          <p className="mt-1 text-xs font-semibold text-gray-600">Install for faster access from your phone.</p>
          <div className="mt-3 flex flex-wrap gap-2">
            <button type="button" onClick={handleInstall} className="inline-flex min-h-10 items-center justify-center gap-2 rounded-xl bg-yellow-400 px-4 py-2 text-sm font-bold text-black hover:bg-yellow-300">
              <Download size={16} aria-hidden="true" /> Add
            </button>
            <button type="button" onClick={() => setIsVisible(false)} className="inline-flex min-h-10 items-center justify-center rounded-xl border border-blue-950 px-4 py-2 text-sm font-bold text-blue-950 hover:bg-blue-50">
              Not now
            </button>
          </div>
        </div>
        <button type="button" onClick={() => setIsVisible(false)} className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-blue-950 hover:bg-blue-50" aria-label="Dismiss install prompt">
          <X size={18} aria-hidden="true" />
        </button>
      </div>
    </aside>
  );
}

function Navbar() {
  const navigate = useNavigate();
  const location = useLocation();
  const active = location.pathname;
  const isAuthenticated = Boolean(localStorage.getItem("token"));
  const employeeName = localStorage.getItem("employeeName") ?? "";

  const logout = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("employeeName");
    localStorage.removeItem("role");
    localStorage.removeItem("employeeId");
    clearAccess();
    navigate("/employee-login", { replace: true });
  };

  const buttonClassName = (isActive) => `flex min-h-11 min-w-0 items-center justify-center gap-2 rounded-xl px-3 py-2 text-sm font-semibold transition sm:px-4 sm:text-base ${
    isActive ? "bg-yellow-400 text-black" : "bg-white/10 hover:bg-white/20"
  }`;

  return (
    <nav className="w-full overflow-hidden bg-blue-950 text-white shadow-lg">
      <div className="mx-auto flex w-full max-w-7xl flex-col items-center justify-between gap-2 px-3 py-2 sm:gap-3 sm:px-4 sm:py-4 lg:flex-row">
        <div className="flex min-w-0 items-center gap-2 text-center sm:gap-3 lg:text-left">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border-[3px] border-yellow-400 text-base font-bold italic sm:h-12 sm:w-12 sm:border-4 sm:text-2xl md:h-14 md:w-14 md:text-3xl">
            ke
          </div>
          <div className="min-w-0">
            <h1 className="break-words text-xs font-extrabold leading-tight sm:text-lg md:text-2xl">
              KUMAR ELECTRONICS & ELECTRICALS
            </h1>
            <p className="hidden text-xs font-semibold text-yellow-400 sm:block md:text-sm">
              POWER BACKUP & SOLAR SOLUTIONS
            </p>
          </div>
        </div>
        <div className={`${isAuthenticated ? "hidden sm:flex" : "flex"} w-full min-w-0 flex-wrap justify-center gap-2 sm:gap-3 lg:w-auto`}>
          {isAuthenticated ? (
            <>
              <span className="flex min-h-11 min-w-0 max-w-full items-center overflow-hidden rounded-xl bg-white/10 px-3 py-2 text-sm font-semibold text-blue-100">
                {employeeName || "Employee"}
              </span>
              <button type="button" onClick={() => navigate("/employee-dashboard")} className={buttonClassName(active === "/employee-dashboard")}>
                <LayoutDashboard size={18} aria-hidden="true" /> Dashboard
              </button>
              <button type="button" onClick={() => navigate("/tickets")} className={buttonClassName(active.startsWith("/tickets"))}>
                <ListChecks size={18} aria-hidden="true" /> Tickets
              </button>
              <button type="button" onClick={logout} className="flex min-h-11 min-w-0 items-center justify-center rounded-xl bg-white/10 px-3 py-2 text-sm font-semibold transition hover:bg-white/20 sm:px-4 sm:text-base">
                Logout
              </button>
            </>
          ) : (
            <>
              <button type="button" onClick={() => navigate("/")} className={buttonClassName(active === "/")}>
                <Home size={18} aria-hidden="true" /> Home
              </button>
              <button type="button" onClick={() => navigate("/employee-login")} className={buttonClassName(active === "/employee-login")}>
                <LogIn size={18} aria-hidden="true" /> Employee Login
              </button>
            </>
          )}
        </div>
      </div>
    </nav>
  );
}

function AuthenticatedBottomNav() {
  const navigate = useNavigate();
  const location = useLocation();
  const active = location.pathname;
  const isAuthenticated = Boolean(localStorage.getItem("token"));
  const canCreateTicket = hasAnyAccess(["CREATE_TICKET"]);
  const canViewTickets = hasAnyAccess(["VIEW_TICKETS"]);

  if (!isAuthenticated) return null;

  const logout = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("employeeName");
    localStorage.removeItem("role");
    localStorage.removeItem("employeeId");
    clearAccess();
    navigate("/employee-login", { replace: true });
  };

  const itemClassName = (isActive) => `flex min-w-0 flex-1 flex-col items-center justify-center gap-1 rounded-xl px-2 py-2 text-xs font-bold transition ${
    isActive ? "bg-yellow-400 text-black" : "text-blue-950"
  }`;

  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-blue-100 bg-white/95 px-2 pb-[env(safe-area-inset-bottom)] pt-2 shadow-[0_-8px_24px_rgba(15,23,42,0.12)] backdrop-blur sm:hidden" aria-label="Employee mobile navigation">
      <div className="mx-auto flex max-w-md gap-1">
        <button type="button" onClick={() => navigate("/employee-dashboard")} className={itemClassName(active === "/employee-dashboard")}>
          <LayoutDashboard size={19} aria-hidden="true" />
          Dashboard
        </button>
        {canCreateTicket && (
          <button type="button" onClick={() => navigate("/tickets/new")} className={itemClassName(active === "/tickets/new")}>
            <PlusCircle size={19} aria-hidden="true" />
            Create
          </button>
        )}
        {canViewTickets && (
          <button type="button" onClick={() => navigate("/tickets")} className={itemClassName(active.startsWith("/tickets") && active !== "/tickets/new")}>
            <ListChecks size={19} aria-hidden="true" />
            Tickets
          </button>
        )}
        <button type="button" onClick={logout} className={itemClassName(false)}>
          <LogOut size={19} aria-hidden="true" />
          Logout
        </button>
      </div>
    </nav>
  );
}

function AppRoutes() {
  useLocation();
  const isAuthenticated = Boolean(localStorage.getItem("token"));

  return (
    <div className={isAuthenticated ? "pb-20 sm:pb-0" : ""}>
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/employee-login" element={<EmployeeLogin />} />
        <Route path="/employee-dashboard" element={
          <ProtectedRoute>
            <EmployeeDashboard />
          </ProtectedRoute>
        }/>
        <Route path="/admin/employees" element={
          <ProtectedRoute anyAccessKey={["VIEW_EMPLOYEE_MANAGEMENT", "MANAGE_EMPLOYEES"]}>
            <EmployeeManagement />
          </ProtectedRoute>
        }/>
        <Route path="/admin/roles" element={
          <ProtectedRoute anyAccessKey={["VIEW_ROLE_MANAGEMENT", "MANAGE_ROLES"]}>
            <RoleManagement />
          </ProtectedRoute>
        }/>
        <Route path="/admin/role-access" element={
          <ProtectedRoute allowedRoles={["SUPER_ADMIN"]}>
            <RoleAccessManagement />
          </ProtectedRoute>
        }/>
        <Route path="/admin/workflow" element={
          <ProtectedRoute allowedRoles={["SUPER_ADMIN"]}>
            <WorkflowManagement />
          </ProtectedRoute>
        }/>
        <Route path="/admin/ticket-categories" element={
          <ProtectedRoute anyAccessKey={["VIEW_TICKET_CATEGORY_MANAGEMENT", "MANAGE_TICKET_CATEGORIES"]}>
            <TicketCategoryManagement />
          </ProtectedRoute>
        }/>
        <Route path="/admin/ticket-fields" element={
          <ProtectedRoute anyAccessKey={["VIEW_TICKET_FIELD_MANAGEMENT", "MANAGE_TICKET_FIELDS"]}>
            <TicketFieldManagement />
          </ProtectedRoute>
        }/>
        <Route path="/admin/ticket-category-fields" element={
          <ProtectedRoute anyAccessKey={["VIEW_CATEGORY_FIELD_CONFIGURATION", "MANAGE_CATEGORY_FIELD_CONFIGS"]}>
            <TicketCategoryFieldManagement />
          </ProtectedRoute>
        }/>
        <Route path="/admin/dropdown-sources" element={
          <ProtectedRoute anyAccessKey={["VIEW_DROPDOWN_SOURCE_MANAGEMENT", "MANAGE_DROPDOWN_SOURCES"]}>
            <DropdownSourceManagement />
          </ProtectedRoute>
        }/>
        <Route path="/tickets/new" element={
          <ProtectedRoute accessKey="CREATE_TICKET">
            <CreateTicket />
          </ProtectedRoute>
        }/>
        <Route path="/tickets" element={
          <ProtectedRoute accessKey="VIEW_TICKETS">
            <TicketList />
          </ProtectedRoute>
        }/>
        <Route path="/tickets/:ticketId" element={
          <ProtectedRoute accessKey="VIEW_TICKETS">
            <TicketDetail />
          </ProtectedRoute>
        }/>
      </Routes>
    </div>
  );
}

function App() {
  return (
    <BrowserRouter>
      <Navbar />
      <AppRoutes />
      <InstallAppPrompt />
      <AuthenticatedBottomNav />
      
    </BrowserRouter>
  );
}

export default App;
