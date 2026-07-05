import { ArrowLeft, ChevronRight, KeyRound, Settings2 } from "lucide-react";
import { useNavigate } from "react-router-dom";

function IconBubble({ icon: Icon, tone = "slate" }) {
  const toneClassNames = {
    blue: "bg-blue-50 text-blue-950",
    slate: "bg-slate-100 text-slate-700",
  };

  return (
    <span className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${toneClassNames[tone] || toneClassNames.slate}`}>
      <Icon size={20} aria-hidden="true" />
    </span>
  );
}

function SettingsRow({ icon, label, value, onClick, tone = "slate" }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex min-h-14 w-full items-center gap-3 border-t border-blue-100 py-2.5 text-left first:border-t-0"
    >
      <IconBubble icon={icon} tone={tone} />
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-semibold text-slate-900">{label}</span>
      </span>
      <span className="min-w-0 max-w-[45%] break-words text-right text-sm font-bold text-blue-950">
        {value}
      </span>
      <ChevronRight className="shrink-0 text-blue-700" size={20} aria-hidden="true" />
    </button>
  );
}

export default function Settings() {
  const navigate = useNavigate();
  const employeeName = localStorage.getItem("employeeName") || "Employee";

  return (
    <main id="main-content" className="ke-page-main ticket-detail-page bg-gray-50 lg:px-8">
      <div className="mx-auto w-full max-w-4xl">
        <button type="button" onClick={() => navigate("/employee-dashboard")} className="flex min-h-10 items-center gap-2 rounded-xl px-1 py-1.5 text-base font-semibold text-blue-950">
          <ArrowLeft size={18} aria-hidden="true" /> Dashboard
        </button>

        <div className="mt-4 min-w-0 space-y-3.5">
          <header className="rounded-2xl bg-blue-950 p-3.5 text-white shadow-lg">
            <div className="flex min-w-0 items-center gap-3">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-white/15">
                <Settings2 size={24} aria-hidden="true" />
              </div>
              <div className="min-w-0">
                <h1 className="break-words text-2xl font-extrabold">Settings</h1>
                <p className="mt-1 break-words text-sm font-semibold text-blue-100">{employeeName}</p>
              </div>
            </div>
          </header>

          <section className="min-w-0 rounded-2xl border border-blue-100 bg-white p-3.5 shadow-sm" aria-label="Account settings">
            <SettingsRow
              icon={KeyRound}
              label="Change Password"
              value="Open"
              tone="blue"
              onClick={() => navigate("/change-password")}
            />
          </section>
        </div>
      </div>
    </main>
  );
}
