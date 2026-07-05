import { useEffect, useState } from "react";
import {
  ClipboardList,
  KeyRound,
  GitBranch,
  ListPlus,
  ListChecks,
  PlusCircle,
  Search,
  Settings2,
  ShieldCheck,
  Tags,
  User,
  Users,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import KEPremiumCardBackground from "../components/KEPremiumCardBackground";
import { clearAccess, fetchCurrentAccess, hasAnyAccess } from "../utils/access";

const ROLE_LABELS = {
  SUPER_ADMIN: "Super Admin",
  ADMIN: "Admin",
  TECHNICIAN: "Technician",
  EMPLOYEE: "Employee",
};

function DashboardAction({ children, icon: Icon, onClick, tone = "blue" }) {
  const [isOpening, setIsOpening] = useState(false);
  const iconToneClassNames = {
    amber: "rounded-xl bg-amber-100 p-2 text-amber-800",
    blue: "rounded-xl bg-blue-50 p-2 text-blue-950",
    cyan: "rounded-xl bg-cyan-50 p-2 text-cyan-800",
    emerald: "rounded-xl bg-emerald-50 p-2 text-emerald-800",
    fuchsia: "rounded-xl bg-fuchsia-50 p-2 text-fuchsia-800",
    indigo: "rounded-xl bg-indigo-50 p-2 text-indigo-800",
    orange: "rounded-xl bg-orange-50 p-2 text-orange-800",
    pink: "rounded-xl bg-pink-50 p-2 text-pink-800",
    purple: "rounded-xl bg-purple-50 p-2 text-purple-800",
    rose: "rounded-xl bg-rose-50 p-2 text-rose-800",
    sky: "rounded-xl bg-sky-50 p-2 text-sky-800",
    teal: "rounded-xl bg-teal-50 p-2 text-teal-800",
    yellow: "rounded-xl bg-yellow-100 p-2 text-yellow-800",
  };
  const iconClassName = iconToneClassNames[tone] || iconToneClassNames.blue;
  const label = isOpening ? "Opening..." : children;

  return (
    <button
      type="button"
      onClick={() => {
        setIsOpening(true);
        onClick();
      }}
      aria-label={typeof children === "string" ? children : undefined}
      className="flex min-h-16 w-full min-w-0 items-center gap-3 rounded-2xl border border-blue-100 bg-white p-3.5 text-left shadow-sm transition hover:border-blue-300 hover:shadow-md sm:min-h-[4.5rem] sm:p-4"
    >
      <div className={`${iconClassName} shrink-0`}>
        <Icon size={20} aria-hidden="true" />
      </div>
      <span className="min-w-0 break-words font-semibold text-blue-950">{label}</span>
    </button>
  );
}

function formatRoleLabel(roleValue) {
  const normalizedRole = String(roleValue || "").trim().toUpperCase();
  if (!normalizedRole) return "Employee";
  if (ROLE_LABELS[normalizedRole]) return ROLE_LABELS[normalizedRole];

  return normalizedRole
    .toLowerCase()
    .split("_")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function formatEmployeeName(nameValue, roleValue, roleLabel) {
  let displayName = String(nameValue || "").trim();
  const normalizedRole = String(roleValue || "").trim();
  const suffixes = [normalizedRole, normalizedRole.toUpperCase(), roleLabel].filter(Boolean);

  suffixes.forEach((suffix) => {
    const nameLower = displayName.toLowerCase();
    const suffixLower = ` ${suffix.toLowerCase()}`;
    if (nameLower.endsWith(suffixLower)) {
      displayName = displayName.slice(0, -suffixLower.length).trim();
    }
  });

  return displayName.split(/\s+/)[0] || "";
}

export default function EmployeeDashboard() {
  const navigate = useNavigate();
  const [, setAccessRefreshKey] = useState(0);
  const [accessMessage, setAccessMessage] = useState("");
  const employeeName = localStorage.getItem("employeeName") ?? "";
  const role = localStorage.getItem("role") ?? "";
  const roleLabel = formatRoleLabel(role);
  const displayEmployeeName = formatEmployeeName(employeeName, role, roleLabel);
  const canCreateTicket = hasAnyAccess(["CREATE_TICKET"]);
  const canViewTickets = hasAnyAccess(["VIEW_TICKETS"]);
  const canManageEmployees = hasAnyAccess(["VIEW_EMPLOYEE_MANAGEMENT", "MANAGE_EMPLOYEES"]);
  const canManageRoles = hasAnyAccess(["VIEW_ROLE_MANAGEMENT", "MANAGE_ROLES"]);
  const canManageRoleAccess = role === "SUPER_ADMIN";
  const canManageWorkflow = role === "SUPER_ADMIN";
  const canManageTicketCategories = hasAnyAccess(["VIEW_TICKET_CATEGORY_MANAGEMENT", "MANAGE_TICKET_CATEGORIES"]);
  const canManageTicketFields = hasAnyAccess(["VIEW_TICKET_FIELD_MANAGEMENT", "MANAGE_TICKET_FIELDS"]);
  const canManageCategoryFieldConfiguration = hasAnyAccess(["VIEW_CATEGORY_FIELD_CONFIGURATION", "MANAGE_CATEGORY_FIELD_CONFIGS"]);
  const canManageDropdownSources = hasAnyAccess(["VIEW_DROPDOWN_SOURCE_MANAGEMENT", "MANAGE_DROPDOWN_SOURCES"]);
  const hasAdminActions = canManageEmployees || canManageRoles || canManageRoleAccess || canManageWorkflow
    || canManageTicketCategories || canManageTicketFields || canManageCategoryFieldConfiguration || canManageDropdownSources;

  useEffect(() => {
    let isCurrent = true;
    if (!localStorage.getItem("token")) return undefined;

    fetchCurrentAccess()
      .then(() => {
        if (!isCurrent) return;
        setAccessMessage("");
        setAccessRefreshKey((current) => current + 1);
      })
      .catch(() => {
        if (!isCurrent) return;
        clearAccess();
        setAccessMessage("Unable to load role access. Available actions may be limited.");
        setAccessRefreshKey((current) => current + 1);
      });

    return () => {
      isCurrent = false;
    };
  }, []);

  return (
    <main id="main-content" className="ke-page-main dashboard-page lg:px-8">
      <div className="dashboard-mobile-container max-w-5xl">
        <header className="dashboard-welcome-card">
          <KEPremiumCardBackground className="dashboard-welcome-premium-bg">
            <div className="dashboard-welcome-content">
              <div className="dashboard-user-avatar" aria-hidden="true">
                <User />
              </div>
              <div className="dashboard-user-info">
                <h1 className="dashboard-welcome-title">
                  Welcome{displayEmployeeName ? `, ${displayEmployeeName}` : ""}
                </h1>
                <span className="dashboard-role-pill">
                  {roleLabel}
                </span>
                <p className="dashboard-welcome-helper">
                  Choose a work area to continue.
                </p>
              </div>
            </div>
          </KEPremiumCardBackground>
        </header>

        <section className="mt-4 sm:mt-6" aria-label="Dashboard work areas">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {canCreateTicket && (
              <DashboardAction icon={PlusCircle} tone="yellow" onClick={() => navigate("/tickets/new")}>
                Create Ticket
              </DashboardAction>
            )}
            {canViewTickets && (
              <DashboardAction icon={ListChecks} tone="sky" onClick={() => navigate("/tickets/my")}>
                My Tickets
              </DashboardAction>
            )}
            {canViewTickets && (
              <DashboardAction icon={Search} tone="indigo" onClick={() => navigate("/tickets/open")}>
                Open Ticket
              </DashboardAction>
            )}
            {canViewTickets && (
              <DashboardAction icon={ClipboardList} tone="teal" onClick={() => navigate("/tickets/find")}>
                Find Tickets
              </DashboardAction>
            )}
            <DashboardAction icon={Settings2} tone="blue" onClick={() => navigate("/settings")}>
              Settings
            </DashboardAction>
          </div>

          {hasAdminActions && (
            <details className="dashboard-admin-panel mt-4 rounded-2xl border border-blue-100 bg-white p-4 shadow-sm sm:p-5">
              <summary className="cursor-pointer text-sm font-extrabold text-blue-950">
                Administration Tools
              </summary>
              <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
                {canManageEmployees && (
                  <DashboardAction icon={Users} tone="emerald" onClick={() => navigate("/admin/employees")}>
                    Employee Management
                  </DashboardAction>
                )}
                {canManageRoles && (
                  <DashboardAction icon={ShieldCheck} tone="purple" onClick={() => navigate("/admin/roles")}>
                    Role Management
                  </DashboardAction>
                )}
                {canManageRoleAccess && (
                  <DashboardAction icon={KeyRound} tone="amber" onClick={() => navigate("/admin/role-access")}>
                    Role Access &amp; Keys
                  </DashboardAction>
                )}
                {canManageWorkflow && (
                  <DashboardAction icon={GitBranch} tone="cyan" onClick={() => navigate("/admin/workflow")}>
                    Workflow Management
                  </DashboardAction>
                )}
                {canManageTicketCategories && (
                  <DashboardAction icon={Tags} tone="orange" onClick={() => navigate("/admin/ticket-categories")}>
                    Ticket Categories
                  </DashboardAction>
                )}
                {canManageTicketFields && (
                  <DashboardAction icon={ClipboardList} tone="rose" onClick={() => navigate("/admin/ticket-fields")}>
                    Ticket Fields
                  </DashboardAction>
                )}
                {canManageCategoryFieldConfiguration && (
                  <DashboardAction icon={Settings2} tone="fuchsia" onClick={() => navigate("/admin/ticket-category-fields")}>
                    Category Field Configuration
                  </DashboardAction>
                )}
                {canManageDropdownSources && (
                  <DashboardAction icon={ListPlus} tone="pink" onClick={() => navigate("/admin/dropdown-sources")}>
                    Dropdown Sources
                  </DashboardAction>
                )}
              </div>
            </details>
          )}

          {accessMessage && (
            <p className="mt-3 rounded-xl bg-yellow-50 px-4 py-3 text-sm font-semibold text-yellow-800">
              {accessMessage}
            </p>
          )}
        </section>
      </div>
    </main>
  );
}
