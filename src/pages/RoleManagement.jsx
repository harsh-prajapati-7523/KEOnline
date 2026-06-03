import { useCallback, useEffect, useState } from "react";
import { ArrowLeft, CheckCircle2, PlusCircle, RefreshCw, ShieldCheck, X } from "lucide-react";
import { useNavigate } from "react-router-dom";

const roleKeyPattern = /^[A-Z0-9_]{3,30}$/;
const emptyCreateForm = {
  roleKey: "",
  displayName: "",
  active: true,
};

function FieldError({ message }) {
  return message ? <p className="mt-1 text-sm font-semibold text-red-600">{message}</p> : null;
}

function Message({ children, type = "success" }) {
  if (!children) return null;
  const className = type === "error"
    ? "border-red-200 bg-red-50 text-red-700"
    : "border-green-200 bg-green-50 text-green-700";
  return <p className={`mt-4 rounded-xl border px-4 py-3 text-sm font-semibold ${className}`}>{children}</p>;
}

function authHeaders(includeContentType = false) {
  return {
    ...(includeContentType ? { "Content-Type": "application/json" } : {}),
    Authorization: `Bearer ${localStorage.getItem("token")}`,
  };
}

async function readApiError(response, fallback) {
  try {
    const body = await response.json();
    return typeof body.message === "string" && body.message.length <= 160 ? body.message : fallback;
  } catch {
    return fallback;
  }
}

function formatDateTime(value) {
  if (!value) return "Not available";
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? "Not available"
    : date.toLocaleString([], { dateStyle: "medium", timeStyle: "short" });
}

function validateCreate(form) {
  const errors = {};
  const roleKey = form.roleKey.trim();
  const displayName = form.displayName.trim();

  if (!roleKey) {
    errors.roleKey = "Role Key is required.";
  } else if (!roleKeyPattern.test(roleKey)) {
    errors.roleKey = "Use 3 to 30 uppercase letters, numbers, or underscores.";
  }

  if (!displayName) {
    errors.displayName = "Display Name is required.";
  } else if (displayName.length > 80) {
    errors.displayName = "Display Name must be 80 characters or less.";
  }

  return errors;
}

function roleKind(role) {
  if (role.roleKey === "SUPER_ADMIN") return "Protected";
  return role.systemRole ? "System" : "Custom";
}

export default function RoleManagement() {
  const navigate = useNavigate();
  const [roles, setRoles] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [listError, setListError] = useState("");
  const [message, setMessage] = useState("");
  const [messageType, setMessageType] = useState("success");
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [createForm, setCreateForm] = useState(emptyCreateForm);
  const [createErrors, setCreateErrors] = useState({});
  const [isCreating, setIsCreating] = useState(false);
  const [processingRoleId, setProcessingRoleId] = useState(null);

  const loadRoles = useCallback(async () => {
    setIsLoading(true);
    setListError("");
    try {
      const response = await fetch("/volt/roles", { headers: authHeaders() });
      if (!response.ok) throw new Error("Role list request failed");
      const data = await response.json();
      setRoles(Array.isArray(data) ? data : []);
    } catch {
      setRoles([]);
      setListError("Unable to load roles. Please try again.");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadRoles();
  }, [loadRoles]);

  const closeCreateForm = () => {
    setShowCreateForm(false);
    setCreateForm(emptyCreateForm);
    setCreateErrors({});
  };

  const handleCreateChange = (event) => {
    const { checked, name, type, value } = event.target;
    setCreateForm((current) => ({ ...current, [name]: type === "checkbox" ? checked : value }));
    setCreateErrors((current) => ({ ...current, [name]: "" }));
    setMessage("");
  };

  const handleCreate = async (event) => {
    event.preventDefault();
    const errors = validateCreate(createForm);
    if (Object.keys(errors).length > 0) {
      setCreateErrors(errors);
      return;
    }

    setIsCreating(true);
    setMessage("");
    try {
      const response = await fetch("/volt/roles", {
        method: "POST",
        headers: authHeaders(true),
        body: JSON.stringify({
          roleKey: createForm.roleKey.trim(),
          displayName: createForm.displayName.trim(),
          active: createForm.active,
        }),
      });
      if (!response.ok) throw new Error(await readApiError(response, "Unable to create role. Please check the details."));
      closeCreateForm();
      setMessageType("success");
      setMessage("Role created successfully.");
      await loadRoles();
    } catch (error) {
      setMessageType("error");
      setMessage(error.message || "Unable to create role. Please check the details.");
    } finally {
      setIsCreating(false);
    }
  };

  const updateStatus = async (role) => {
    const active = !role.active;
    setProcessingRoleId(role.id);
    setMessage("");
    try {
      const response = await fetch(`/volt/roles/${role.id}/status`, {
        method: "PATCH",
        headers: authHeaders(true),
        body: JSON.stringify({ active }),
      });
      if (!response.ok) throw new Error(await readApiError(response, "Unable to update role status. Please try again."));
      setMessageType("success");
      setMessage(`Role ${active ? "enabled" : "disabled"} successfully.`);
      await loadRoles();
    } catch (error) {
      setMessageType("error");
      setMessage(error.message || "Unable to update role status. Please try again.");
    } finally {
      setProcessingRoleId(null);
    }
  };

  return (
    <main className="min-h-screen bg-gray-50 px-4 py-6 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-4xl">
        <button type="button" onClick={() => navigate("/employee-dashboard")} className="flex items-center gap-2 font-semibold text-blue-950">
          <ArrowLeft size={18} aria-hidden="true" /> Dashboard
        </button>

        <header className="mt-4 rounded-3xl bg-blue-950 p-5 text-white shadow-lg sm:p-7">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h1 className="text-2xl font-extrabold sm:text-3xl">Role Management</h1>
              <p className="mt-2 text-sm text-blue-100">Create and manage roles used in the system.</p>
            </div>
            <div className="flex flex-col gap-2 min-[420px]:flex-row">
              <button
                type="button"
                onClick={() => showCreateForm ? closeCreateForm() : setShowCreateForm(true)}
                className="flex min-h-11 items-center justify-center gap-2 rounded-2xl bg-yellow-400 px-4 py-2 font-bold text-black transition hover:bg-yellow-300"
              >
                {showCreateForm ? <X size={18} aria-hidden="true" /> : <PlusCircle size={18} aria-hidden="true" />}
                {showCreateForm ? "Close" : "Add Role"}
              </button>
              <button
                type="button"
                onClick={loadRoles}
                disabled={isLoading}
                className="flex min-h-11 items-center justify-center gap-2 rounded-2xl bg-white/10 px-4 py-2 font-bold text-white transition hover:bg-white/20 disabled:opacity-60"
              >
                <RefreshCw size={18} aria-hidden="true" />
                Refresh
              </button>
            </div>
          </div>
        </header>

        <Message type={messageType}>{message}</Message>

        {showCreateForm && (
          <form onSubmit={handleCreate} className="mt-5 grid grid-cols-1 gap-4 rounded-2xl border border-blue-100 bg-white p-5 shadow-sm sm:grid-cols-2">
            <h2 className="text-lg font-extrabold text-blue-950 sm:col-span-2">Add Role</h2>

            <label className="font-semibold text-gray-700">
              Role Key
              <input
                name="roleKey"
                value={createForm.roleKey}
                onChange={handleCreateChange}
                placeholder="FIELD_TECH"
                className="mt-2 w-full rounded-xl border border-gray-300 px-4 py-3 outline-none focus:border-blue-950"
              />
              <span className="mt-1 block text-xs font-semibold text-gray-500">
                Use uppercase letters, numbers, and underscore only. Example: FIELD_TECH
              </span>
              <FieldError message={createErrors.roleKey} />
            </label>

            <label className="font-semibold text-gray-700">
              Display Name
              <input
                name="displayName"
                value={createForm.displayName}
                onChange={handleCreateChange}
                placeholder="Field Technician"
                className="mt-2 w-full rounded-xl border border-gray-300 px-4 py-3 outline-none focus:border-blue-950"
              />
              <FieldError message={createErrors.displayName} />
            </label>

            <label className="flex items-center gap-3 rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 font-semibold text-gray-700 sm:col-span-2">
              <input
                type="checkbox"
                name="active"
                checked={createForm.active}
                onChange={handleCreateChange}
                className="h-5 w-5 accent-blue-950"
              />
              Active
            </label>

            <div className="flex flex-col gap-2 sm:col-span-2 min-[420px]:flex-row">
              <button
                type="submit"
                disabled={isCreating}
                className="flex min-h-11 items-center justify-center gap-2 rounded-2xl bg-blue-950 px-5 py-2 font-bold text-white transition hover:bg-blue-900 disabled:opacity-60"
              >
                <CheckCircle2 size={18} aria-hidden="true" />
                {isCreating ? "Creating..." : "Create Role"}
              </button>
              <button
                type="button"
                onClick={closeCreateForm}
                className="flex min-h-11 items-center justify-center rounded-2xl border border-gray-300 px-5 py-2 font-bold text-gray-700 transition hover:bg-gray-50"
              >
                Cancel
              </button>
            </div>
          </form>
        )}

        <section className="mt-6" aria-labelledby="role-list-title">
          <h2 id="role-list-title" className="text-xl font-extrabold text-blue-950">Role List</h2>

          {isLoading && <p className="mt-4 rounded-xl border border-blue-100 bg-white px-4 py-3 text-sm font-semibold text-gray-600">Loading roles...</p>}
          {!isLoading && listError && <p className="mt-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">{listError}</p>}
          {!isLoading && !listError && roles.length === 0 && <p className="mt-4 rounded-xl border border-blue-100 bg-white px-4 py-3 text-sm font-semibold text-gray-600">No roles found.</p>}

          {!isLoading && !listError && roles.length > 0 && (
            <div className="mt-4 divide-y divide-blue-100 overflow-hidden rounded-2xl border border-blue-100 bg-white shadow-sm">
              {roles.map((role) => {
                const protectedRole = role.roleKey === "SUPER_ADMIN";
                const statusLabel = role.active ? "Active" : "Inactive";
                const kindLabel = roleKind(role);
                const isProcessing = processingRoleId === role.id;

                return (
                  <article key={role.id} className="flex flex-col gap-3 px-4 py-4 sm:flex-row sm:items-center sm:justify-between">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="text-base font-extrabold text-blue-950">{role.displayName || "Unnamed Role"}</h3>
                        {protectedRole && (
                          <span className="inline-flex items-center gap-1 rounded-full bg-yellow-100 px-2.5 py-1 text-xs font-bold text-yellow-800">
                            <ShieldCheck size={13} aria-hidden="true" />
                            Protected
                          </span>
                        )}
                      </div>
                      <p className="mt-1 text-sm font-semibold text-gray-600">
                        {role.roleKey} · {statusLabel} · {kindLabel}
                      </p>
                      <p className="mt-1 text-xs font-medium text-gray-500">
                        Created {formatDateTime(role.createdAt)} · Updated {formatDateTime(role.updatedAt)}
                      </p>
                    </div>

                    {!protectedRole && (
                      <button
                        type="button"
                        onClick={() => updateStatus(role)}
                        disabled={isProcessing}
                        className={`flex min-h-10 items-center justify-center rounded-xl px-4 py-2 text-sm font-bold transition disabled:opacity-60 ${
                          role.active
                            ? "border border-red-200 bg-red-50 text-red-700 hover:bg-red-100"
                            : "border border-green-200 bg-green-50 text-green-700 hover:bg-green-100"
                        }`}
                      >
                        {isProcessing ? "Saving..." : role.active ? "Disable" : "Enable"}
                      </button>
                    )}
                  </article>
                );
              })}
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
