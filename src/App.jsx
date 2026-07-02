import { lazy, Suspense, useEffect, useState } from "react";
import { BrowserRouter, Navigate, Routes, Route, useNavigate, useLocation } from "react-router-dom";
import { Download, Home, LayoutDashboard, ListChecks, LogIn, LogOut, PlusCircle, X } from "lucide-react";
import EmployeeLogin from "./pages/EmployeeLogin";
import ProtectedRoute from "./components/ProtectedRoute";
import { clearAccess, hasAnyAccess } from "./utils/access";

const HomePage = lazy(() => import("./pages/Home"));
const EmployeeDashboard = lazy(() => import("./pages/EmployeeDashboard"));
const EmployeeManagement = lazy(() => import("./pages/EmployeeManagement"));
const RoleManagement = lazy(() => import("./pages/RoleManagement"));
const RoleAccessManagement = lazy(() => import("./pages/RoleAccessManagement"));
const WorkflowManagement = lazy(() => import("./pages/WorkflowManagement"));
const WorkflowBuilder = lazy(() => import("./pages/WorkflowBuilder"));
const TicketCategoryManagement = lazy(() => import("./pages/TicketCategoryManagement"));
const TicketCategoryFieldManagement = lazy(() => import("./pages/TicketCategoryFieldManagement"));
const TicketFieldManagement = lazy(() => import("./pages/TicketFieldManagement"));
const DropdownSourceManagement = lazy(() => import("./pages/DropdownSourceManagement"));
const CreateTicket = lazy(() => import("./pages/CreateTicket"));
const MyTickets = lazy(() => import("./pages/MyTickets"));
const OpenTicket = lazy(() => import("./pages/OpenTicket"));

let ticketListImportPromise;
function loadTicketList() {
  ticketListImportPromise ??= import("./pages/TicketList");
  return ticketListImportPromise;
}

function preloadTicketList() {
  void loadTicketList();
}

const TicketList = lazy(loadTicketList);

let ticketDetailImportPromise;
function loadTicketDetail() {
  ticketDetailImportPromise ??= import("./pages/TicketDetail");
  return ticketDetailImportPromise;
}

function preloadTicketDetail() {
  void loadTicketDetail();
}

const TicketDetail = lazy(loadTicketDetail);

function scheduleIdlePreload(callback, delay = 1200) {
  let idleId;
  const timeoutId = window.setTimeout(() => {
    if ("requestIdleCallback" in window) {
      idleId = window.requestIdleCallback(callback, { timeout: 2500 });
      return;
    }

    callback();
  }, delay);

  return () => {
    window.clearTimeout(timeoutId);
    if (idleId) window.cancelIdleCallback?.(idleId);
  };
}

if (window.location.pathname === "/tickets" || window.location.pathname === "/tickets/find") {
  preloadTicketList();
}

if (/^\/tickets\/\d+/.test(window.location.pathname)) {
  preloadTicketDetail();
}

function isStandaloneDisplay() {
  return window.matchMedia?.("(display-mode: standalone)")?.matches || window.navigator.standalone === true;
}

function RouteLoadingFallback() {
  return (
    <main className="ke-page-main">
      <p className="text-sm font-semibold text-gray-600">Loading...</p>
    </main>
  );
}

function InstallAppPrompt() {
  const location = useLocation();
  const [installPromptEvent, setInstallPromptEvent] = useState(null);
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    if (location.pathname === "/employee-login") return undefined;
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
  }, [location.pathname]);

  const handleInstall = async () => {
    if (!installPromptEvent) return;

    installPromptEvent.prompt();
    const choice = await installPromptEvent.userChoice;
    setInstallPromptEvent(null);

    if (choice?.outcome !== "accepted") {
      setIsVisible(false);
    }
  };

  if (location.pathname === "/employee-login" || !installPromptEvent || !isVisible) return null;

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
  const isEmployeeLogin = active === "/employee-login";
  const isCreateTicket = active === "/tickets/new";
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

  const buttonClassName = (isActive) => `flex min-h-10 min-w-0 items-center justify-center gap-1.5 rounded-xl px-2.5 py-1.5 text-sm font-semibold transition sm:min-h-11 sm:gap-2 sm:px-4 sm:py-2 sm:text-base ${
    isActive ? "ke-nav-active" : "bg-white/10 hover:bg-white/20"
  }`;

  if (isEmployeeLogin) return null;

  return (
    <nav className={`ke-app-header ${isCreateTicket ? "ke-app-header-compact" : ""} w-full overflow-hidden text-white`}>
      <div className="ke-app-header-inner mx-auto flex w-full max-w-7xl items-center justify-between gap-3 px-3 py-2 sm:gap-3 sm:px-4 sm:py-3">
        <div className="ke-app-header-brand flex min-w-0 items-center gap-2.5 text-center sm:gap-3 lg:text-left">
          <span className="ke-brand-logo-badge shrink-0" aria-hidden="true">
            <img
              src="/ke-icon-64.png"
              alt=""
              aria-hidden="true"
              width="34"
              height="34"
              className="ke-brand-logo"
            />
          </span>
          <div className="min-w-0 flex-1">
            <p className="ke-brand-title break-words font-extrabold leading-tight">
              <span>Kumar Electronics and Electricals</span>
            </p>
            <p className="ke-brand-subtitle text-xs font-semibold">
              <span>Service Ticket Management</span>
            </p>
          </div>
        </div>
        <div className={`${isAuthenticated ? "hidden sm:flex" : "flex"} ml-auto min-w-0 flex-wrap justify-end gap-2 sm:gap-3`}>
          {isAuthenticated ? (
            <>
              <span className="flex min-h-11 min-w-0 max-w-full items-center overflow-hidden rounded-xl bg-white/10 px-3 py-2 text-sm font-semibold text-blue-100">
                {employeeName || "Employee"}
              </span>
              <button type="button" onClick={() => navigate("/employee-dashboard")} className={buttonClassName(active === "/employee-dashboard")} aria-label="Dashboard">
                <LayoutDashboard size={18} aria-hidden="true" /> Dashboard
              </button>
              <button type="button" onPointerEnter={preloadTicketList} onFocus={preloadTicketList} onClick={() => navigate("/tickets/find")} className={buttonClassName(active.startsWith("/tickets"))} aria-label="Find Tickets">
                <ListChecks size={18} aria-hidden="true" /> Find Tickets
              </button>
              <button type="button" onClick={logout} className="flex min-h-11 min-w-0 items-center justify-center rounded-xl bg-white/10 px-3 py-2 text-sm font-semibold transition hover:bg-white/20 sm:px-4 sm:text-base" aria-label="Logout">
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

  if (!isAuthenticated || active === "/employee-login") return null;

  const canCreateTicket = hasAnyAccess(["CREATE_TICKET"]);
  const canViewTickets = hasAnyAccess(["VIEW_TICKETS"]);

  const logout = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("employeeName");
    localStorage.removeItem("role");
    localStorage.removeItem("employeeId");
    clearAccess();
    navigate("/employee-login", { replace: true });
  };

  const itemClassName = (isActive) => `flex min-h-14 min-w-0 flex-1 flex-col items-center justify-center gap-0.5 rounded-xl px-2 py-1 text-[0.72rem] font-bold transition ${
    isActive ? "ke-nav-active" : "text-blue-950"
  }`;

  return (
    <nav className="ke-bottom-nav fixed inset-x-0 bottom-0 z-40 px-2 pb-[env(safe-area-inset-bottom)] pt-2 backdrop-blur sm:hidden" aria-label="Employee mobile navigation">
      <div className="ke-bottom-nav-inner mx-auto flex max-w-md gap-1">
        <button type="button" onClick={() => navigate("/employee-dashboard")} className={itemClassName(active === "/employee-dashboard")} aria-label="Dashboard">
          <LayoutDashboard size={17} aria-hidden="true" />
          Dashboard
        </button>
        {canCreateTicket && (
          <button type="button" onClick={() => navigate("/tickets/new")} className={itemClassName(active === "/tickets/new")} aria-label="Create Ticket">
            <PlusCircle size={17} aria-hidden="true" />
            Create
          </button>
        )}
        {canViewTickets && (
          <button type="button" onPointerEnter={preloadTicketList} onFocus={preloadTicketList} onClick={() => navigate("/tickets/find")} className={itemClassName(active === "/tickets/find" || active === "/tickets")} aria-label="Find Tickets">
            <ListChecks size={17} aria-hidden="true" />
            Find
          </button>
        )}
        <button type="button" onClick={logout} className={itemClassName(false)} aria-label="Logout">
          <LogOut size={17} aria-hidden="true" />
          Logout
        </button>
      </div>
    </nav>
  );
}

function AppRoutes() {
  const location = useLocation();
  const isAuthenticated = Boolean(localStorage.getItem("token"));

  useEffect(() => {
    if (!isAuthenticated || location.pathname.startsWith("/tickets") || !hasAnyAccess(["VIEW_TICKETS"])) {
      return undefined;
    }

    return scheduleIdlePreload(preloadTicketList);
  }, [isAuthenticated, location.pathname]);

  useEffect(() => {
    if (!isAuthenticated || /^\/tickets\/\d+/.test(location.pathname) || !hasAnyAccess(["VIEW_TICKETS"])) {
      return undefined;
    }

    return scheduleIdlePreload(preloadTicketDetail, location.pathname === "/tickets/find" ? 900 : 1800);
  }, [isAuthenticated, location.pathname]);

  return (
    <div className={isAuthenticated ? "ke-content-with-bottom-nav sm:pb-0" : ""}>
      <Suspense fallback={<RouteLoadingFallback />}>
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
          <Route path="/admin/workflow/builder" element={
            <ProtectedRoute allowedRoles={["SUPER_ADMIN"]}>
              <WorkflowBuilder />
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
          <Route path="/tickets/my" element={
            <ProtectedRoute accessKey="VIEW_TICKETS">
              <MyTickets />
            </ProtectedRoute>
          }/>
          <Route path="/tickets/open" element={
            <ProtectedRoute accessKey="VIEW_TICKETS">
              <OpenTicket />
            </ProtectedRoute>
          }/>
          <Route path="/tickets/find" element={
            <ProtectedRoute accessKey="VIEW_TICKETS">
              <TicketList />
            </ProtectedRoute>
          }/>
          <Route path="/tickets" element={<Navigate to="/tickets/find" replace />} />
          <Route path="/tickets/:ticketId" element={
            <ProtectedRoute accessKey="VIEW_TICKETS">
              <TicketDetail />
            </ProtectedRoute>
          }/>
        </Routes>
      </Suspense>
    </div>
  );
}

function App() {
  return (
    <BrowserRouter>
      <a href="#main-content" className="ke-skip-link">
        Skip to main content
      </a>
      <Navbar />
      <AppRoutes />
      <InstallAppPrompt />
      <AuthenticatedBottomNav />
      
    </BrowserRouter>
  );
}

export default App;
