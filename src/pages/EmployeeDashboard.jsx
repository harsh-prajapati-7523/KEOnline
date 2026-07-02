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
  Users,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import KEWaveBackground from "../components/KEWaveBackground";
import { clearAccess, fetchCurrentAccess, hasAnyAccess } from "../utils/access";

function DashboardAction({ children, icon: Icon, onClick, tone = "blue" }) {
  const [isOpening, setIsOpening] = useState(false);
  const iconClassName = tone === "yellow"
    ? "rounded-xl bg-yellow-100 p-2 text-yellow-800"
    : "rounded-xl bg-blue-50 p-2 text-blue-950";
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

export default function EmployeeDashboard() {
  const navigate = useNavigate();
  const [, setAccessRefreshKey] = useState(0);
  const [accessMessage, setAccessMessage] = useState("");
  const employeeName = localStorage.getItem("employeeName") ?? "";
  const role = localStorage.getItem("role") ?? "";
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
  const hasDashboardActions = canCreateTicket || canViewTickets || canManageEmployees || canManageRoles || canManageRoleAccess
    || canManageWorkflow || canManageTicketCategories || canManageTicketFields || canManageCategoryFieldConfiguration || canManageDropdownSources;
  const hasPrimaryActions = canCreateTicket || canViewTickets;
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
      <div className="mx-auto w-full max-w-5xl">
        <KEWaveBackground className="dashboard-premium-header">
          <header className="ke-page-header dashboard-hero-card text-white shadow-lg">
            <p className="break-words text-xs font-semibold uppercase text-yellow-400 sm:text-sm">
              Technician Dashboard
            </p>
            <h1 className="ke-page-title mt-1 break-words font-extrabold sm:mt-2">
              Welcome{employeeName ? `, ${employeeName}` : ""}
            </h1>
            <p className="mt-1 break-words text-xs font-semibold text-blue-100 sm:mt-2 sm:text-sm">
              Role: {role}
            </p>
          </header>
        </KEWaveBackground>

        <section className="mt-4 sm:mt-6" aria-labelledby="ticket-actions">
          <h2 id="ticket-actions" className="text-lg font-extrabold text-blue-950 sm:text-xl">
            Available Work Areas
          </h2>

          {hasPrimaryActions && (
            <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
              {canCreateTicket && (
                <DashboardAction icon={PlusCircle} tone="yellow" onClick={() => navigate("/tickets/new")}>
                  Create Ticket
                </DashboardAction>
              )}
              {canViewTickets && (
                <DashboardAction icon={ListChecks} onClick={() => navigate("/tickets/my")}>
                  My Tickets
                </DashboardAction>
              )}
              {canViewTickets && (
                <DashboardAction icon={Search} onClick={() => navigate("/tickets/open")}>
                  Open Ticket
                </DashboardAction>
              )}
              {canViewTickets && (
                <DashboardAction icon={ClipboardList} onClick={() => navigate("/tickets/find")}>
                  Find Tickets
                </DashboardAction>
              )}
            </div>
          )}

          {hasAdminActions && (
            <details className="dashboard-admin-panel mt-4 rounded-2xl border border-blue-100 bg-white p-4 shadow-sm sm:p-5">
              <summary className="cursor-pointer text-sm font-extrabold text-blue-950">
                Administration Tools
              </summary>
              <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
                {canManageEmployees && (
                  <DashboardAction icon={Users} onClick={() => navigate("/admin/employees")}>
                    Employee Management
                  </DashboardAction>
                )}
                {canManageRoles && (
                  <DashboardAction icon={ShieldCheck} onClick={() => navigate("/admin/roles")}>
                    Role Management
                  </DashboardAction>
                )}
                {canManageRoleAccess && (
                  <DashboardAction icon={KeyRound} onClick={() => navigate("/admin/role-access")}>
                    Role Access &amp; Keys
                  </DashboardAction>
                )}
                {canManageWorkflow && (
                  <DashboardAction icon={GitBranch} onClick={() => navigate("/admin/workflow")}>
                    Workflow Management
                  </DashboardAction>
                )}
                {canManageTicketCategories && (
                  <DashboardAction icon={Tags} onClick={() => navigate("/admin/ticket-categories")}>
                    Ticket Categories
                  </DashboardAction>
                )}
                {canManageTicketFields && (
                  <DashboardAction icon={ClipboardList} onClick={() => navigate("/admin/ticket-fields")}>
                    Ticket Fields
                  </DashboardAction>
                )}
                {canManageCategoryFieldConfiguration && (
                  <DashboardAction icon={Settings2} onClick={() => navigate("/admin/ticket-category-fields")}>
                    Category Field Configuration
                  </DashboardAction>
                )}
                {canManageDropdownSources && (
                  <DashboardAction icon={ListPlus} onClick={() => navigate("/admin/dropdown-sources")}>
                    Dropdown Sources
                  </DashboardAction>
                )}
              </div>
            </details>
          )}

          <div className={!hasPrimaryActions && !hasAdminActions ? "mt-4" : ""}>
            {!hasDashboardActions && (
              <p className="rounded-2xl border border-gray-200 bg-white px-4 py-3 text-sm font-semibold text-gray-600">
                No actions available for your role.
              </p>
            )}
          </div>
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
