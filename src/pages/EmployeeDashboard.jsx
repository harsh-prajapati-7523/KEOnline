import {
  Briefcase,
  CalendarCheck,
  CheckCircle2,
  ClipboardList,
  Clock,
  History,
  ListChecks,
  LogOut,
  PlusCircle,
  Wrench,
} from "lucide-react";
import { useNavigate } from "react-router-dom";

const dashboardStats = [
  { label: "My Open Jobs", value: 8, icon: Briefcase },
  { label: "In Progress", value: 3, icon: Clock },
  { label: "Completed Today", value: 2, icon: CheckCircle2 },
  { label: "Assigned Today", value: 5, icon: CalendarCheck },
];

const quickActions = [
  { label: "View Assigned Jobs", icon: ClipboardList },
  { label: "Update Job Status", icon: Wrench },
  { label: "Service History", icon: History },
];

function StatCard({ label, value, icon: Icon }) {
  return (
    <article className="rounded-2xl border border-blue-100 bg-white p-4 shadow-sm">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm font-semibold text-gray-600">{label}</p>
        <div className="rounded-xl bg-blue-50 p-2 text-blue-950">
          <Icon size={20} aria-hidden="true" />
        </div>
      </div>
      <p className="mt-3 text-3xl font-extrabold text-blue-950">{value}</p>
    </article>
  );
}

function QuickActionCard({ label, icon: Icon }) {
  return (
    <button
      type="button"
      disabled
      className="flex min-h-20 w-full cursor-not-allowed items-center gap-3 rounded-2xl border border-gray-200 bg-white p-4 text-left opacity-75 shadow-sm"
    >
      <div className="rounded-xl bg-gray-100 p-2 text-gray-500">
        <Icon size={20} aria-hidden="true" />
      </div>
      <span className="flex-1 font-semibold text-gray-700">{label}</span>
      <span className="rounded-full bg-gray-100 px-3 py-1 text-xs font-bold text-gray-500">
        Coming Soon
      </span>
    </button>
  );
}

export default function EmployeeDashboard() {
  const navigate = useNavigate();
  const employeeName = localStorage.getItem("employeeName") ?? "";
  const role = localStorage.getItem("role") ?? "";
  const canCreateTicket = role === "SUPER_ADMIN" || role === "ADMIN";

  const handleLogout = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("employeeName");
    localStorage.removeItem("role");
    navigate("/employee-login", { replace: true });
  };

  return (
    <main className="min-h-screen bg-gray-50 px-4 py-6 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-5xl">
        <header className="rounded-3xl bg-blue-950 p-5 text-white shadow-lg sm:p-7">
          <p className="text-sm font-semibold uppercase tracking-wide text-yellow-400">
            Technician Dashboard
          </p>
          <h1 className="mt-2 text-2xl font-extrabold sm:text-3xl">
            Welcome, {employeeName}
          </h1>
          <p className="mt-2 text-sm font-semibold text-blue-100">
            Role: {role}
          </p>
        </header>

        <section className="mt-6" aria-labelledby="dashboard-overview">
          <div className="flex items-end justify-between gap-3">
            <div>
              <h2
                id="dashboard-overview"
                className="text-xl font-extrabold text-blue-950"
              >
                Job Overview
              </h2>
              <p className="mt-1 text-sm text-gray-500">
                Preview counts for dashboard planning
              </p>
            </div>
            <span className="rounded-full bg-yellow-100 px-3 py-1 text-xs font-bold text-yellow-800">
              Mock Data
            </span>
          </div>

          <div className="mt-4 grid grid-cols-1 gap-3 min-[390px]:grid-cols-2 lg:grid-cols-4">
            {dashboardStats.map((stat) => (
              <StatCard key={stat.label} {...stat} />
            ))}
          </div>
        </section>

        <section className="mt-8" aria-labelledby="ticket-actions">
          <h2 id="ticket-actions" className="text-xl font-extrabold text-blue-950">
            Ticket Actions
          </h2>
          <p className="mt-1 text-sm text-gray-500">
            Create and review customer service tickets.
          </p>

          <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
            {canCreateTicket && (
              <button
                type="button"
                onClick={() => navigate("/tickets/new")}
                className="flex min-h-20 w-full items-center gap-3 rounded-2xl border border-blue-100 bg-white p-4 text-left shadow-sm transition hover:border-blue-300 hover:shadow-md"
              >
                <div className="rounded-xl bg-yellow-100 p-2 text-yellow-800">
                  <PlusCircle size={20} aria-hidden="true" />
                </div>
                <span className="font-semibold text-blue-950">Create Ticket</span>
              </button>
            )}
            <button
              type="button"
              onClick={() => navigate("/tickets")}
              className="flex min-h-20 w-full items-center gap-3 rounded-2xl border border-blue-100 bg-white p-4 text-left shadow-sm transition hover:border-blue-300 hover:shadow-md"
            >
              <div className="rounded-xl bg-blue-50 p-2 text-blue-950">
                <ListChecks size={20} aria-hidden="true" />
              </div>
              <span className="font-semibold text-blue-950">View Tickets</span>
            </button>
          </div>
        </section>

        <section className="mt-8" aria-labelledby="quick-actions">
          <h2 id="quick-actions" className="text-xl font-extrabold text-blue-950">
            Quick Actions
          </h2>
          <p className="mt-1 text-sm text-gray-500">
            Technician workflow tools will be enabled in a future phase.
          </p>

          <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-3">
            {quickActions.map((action) => (
              <QuickActionCard key={action.label} {...action} />
            ))}
          </div>
        </section>

        <section className="mt-8 border-t border-gray-200 pt-5">
          <button
            type="button"
            onClick={handleLogout}
            className="flex min-h-12 w-full items-center justify-center gap-2 rounded-2xl bg-blue-950 px-5 py-3 font-bold text-white transition hover:bg-blue-900 sm:w-auto"
          >
            <LogOut size={20} aria-hidden="true" />
            Logout
          </button>
        </section>
      </div>
    </main>
  );
}
