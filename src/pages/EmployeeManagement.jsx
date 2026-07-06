import { useCallback, useEffect, useState } from "react";
import { ArrowLeft, KeyRound, PlusCircle, RefreshCw, ShieldCheck, UserRoundCog, X } from "lucide-react";
import { useNavigate } from "react-router-dom";

const employeeIdPattern = /^[a-zA-Z0-9_]{3,30}$/;
const emptyCreateForm = {
  name: "",
  employeeId: "",
  roleId: "",
  password: "",
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

function formatDate(value) {
  if (!value) return "Not available";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "Not available" : date.toLocaleDateString();
}

async function readApiError(response, fallback) {
  try {
    const body = await response.json();
    return typeof body.message === "string" && body.message.length <= 160 ? body.message : fallback;
  } catch {
    return fallback;
  }
}

function authHeaders(includeContentType = false) {
  return {
    ...(includeContentType ? { "Content-Type": "application/json" } : {}),
    Authorization: `Bearer ${localStorage.getItem("token")}`,
  };
}

function formatRoleLabel(role) {
  if (!role) return "Not available";
  const roleKey = role.roleKey ?? role.role ?? "";
  return role.displayName ? `${role.displayName} (${roleKey})` : roleKey || "Not available";
}

function formatEmployeeRole(employee) {
  if (employee.roleDisplayName && (employee.roleKey || employee.role)) {
    return `${employee.roleDisplayName} (${employee.roleKey ?? employee.role})`;
  }
  return employee.roleKey ?? employee.role ?? "Not available";
}

function validateCreate(form) {
  const errors = {};
  if (!form.name.trim()) errors.name = "Employee name is required.";
  if (!form.employeeId.trim()) {
    errors.employeeId = "Employee ID is required.";
  } else if (!employeeIdPattern.test(form.employeeId.trim())) {
    errors.employeeId = "Use 3 to 30 letters, digits, or underscores.";
  }
  if (!form.roleId) errors.roleId = "Role is required.";
  if (form.password.length < 8) errors.password = "Temporary password must contain at least 8 characters.";
  return errors;
}

export default function EmployeeManagement() {
  const navigate = useNavigate();
  const [employees, setEmployees] = useState([]);
  const [roles, setRoles] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingRoles, setIsLoadingRoles] = useState(true);
  const [listError, setListError] = useState("");
  const [roleError, setRoleError] = useState("");
  const [message, setMessage] = useState("");
  const [messageType, setMessageType] = useState("success");
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [createForm, setCreateForm] = useState(emptyCreateForm);
  const [createErrors, setCreateErrors] = useState({});
  const [isCreating, setIsCreating] = useState(false);
  const [openAction, setOpenAction] = useState(null);
  const [roleIdValue, setRoleIdValue] = useState("");
  const [passwordValue, setPasswordValue] = useState("");
  const [actionError, setActionError] = useState("");
  const [processingKey, setProcessingKey] = useState("");

  const loadEmployees = useCallback(async () => {
    setIsLoading(true);
    setListError("");
    try {
      const response = await fetch("/volt/employees", { headers: authHeaders() });
      if (!response.ok) throw new Error("Employee list request failed");
      const data = await response.json();
      setEmployees(Array.isArray(data) ? data : []);
    } catch {
      setEmployees([]);
      setListError("Unable to load employees. Please try again.");
    } finally {
      setIsLoading(false);
    }
  }, []);

  const loadRoles = useCallback(async () => {
    setIsLoadingRoles(true);
    setRoleError("");
    try {
      const response = await fetch("/volt/roles", { headers: authHeaders() });
      if (!response.ok) throw new Error("Role list request failed");
      const data = await response.json();
      setRoles(Array.isArray(data) ? data.filter((role) => role.active) : []);
    } catch {
      setRoles([]);
      setRoleError("Unable to load roles.");
    } finally {
      setIsLoadingRoles(false);
    }
  }, []);

  useEffect(() => {
    loadEmployees();
    loadRoles();
  }, [loadEmployees, loadRoles]);

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
      const response = await fetch("/volt/employees", {
        method: "POST",
        headers: authHeaders(true),
        body: JSON.stringify({
          name: createForm.name.trim(),
          employeeId: createForm.employeeId.trim(),
          password: createForm.password,
          roleId: Number(createForm.roleId),
          active: createForm.active,
        }),
      });
      if (!response.ok) throw new Error(await readApiError(response, "Unable to create employee. Please check the details."));
      closeCreateForm();
      setMessageType("success");
      setMessage("Employee created successfully.");
      await loadEmployees();
    } catch (error) {
      setMessageType("error");
      setMessage(error.message || "Unable to create employee. Please check the details.");
    } finally {
      setIsCreating(false);
    }
  };

  const closeAction = () => {
    setOpenAction(null);
    setRoleIdValue("");
    setPasswordValue("");
    setActionError("");
  };

  const toggleAction = (employee, type) => {
    if (openAction?.id === employee.id && openAction.type === type) {
      closeAction();
      return;
    }
    setOpenAction({ id: employee.id, type });
    setRoleIdValue(employee.roleId ? String(employee.roleId) : "");
    setPasswordValue("");
    setActionError("");
    setMessage("");
  };

  const updateStatus = async (employee) => {
    const active = !employee.active;
    const key = `status-${employee.id}`;
    setProcessingKey(key);
    setActionError("");
    setMessage("");
    try {
      const response = await fetch(`/volt/employees/${employee.id}/status`, {
        method: "PATCH",
        headers: authHeaders(true),
        body: JSON.stringify({ active }),
      });
      if (!response.ok) throw new Error(await readApiError(response, "Unable to update employee status."));
      setMessageType("success");
      setMessage(`Employee ${active ? "enabled" : "disabled"} successfully.`);
      await loadEmployees();
    } catch (error) {
      setMessageType("error");
      setMessage(error.message || "Unable to update employee status.");
    } finally {
      setProcessingKey("");
    }
  };

  const updateRole = async (employee) => {
    if (!roleIdValue) {
      setActionError("Role is required.");
      return;
    }

    const key = `role-${employee.id}`;
    setProcessingKey(key);
    setActionError("");
    try {
      const response = await fetch(`/volt/employees/${employee.id}/role`, {
        method: "PATCH",
        headers: authHeaders(true),
        body: JSON.stringify({ roleId: Number(roleIdValue) }),
      });
      if (!response.ok) throw new Error(await readApiError(response, "Unable to change role. Please try again."));
      closeAction();
      setMessageType("success");
      setMessage("Employee role updated successfully.");
      await loadEmployees();
    } catch (error) {
      setActionError(error.message || "Unable to change role. Please try again.");
    } finally {
      setProcessingKey("");
    }
  };

  const resetPassword = async (employee) => {
    if (passwordValue.length < 8) {
      setActionError("Temporary password must contain at least 8 characters.");
      return;
    }

    const key = `password-${employee.id}`;
    setProcessingKey(key);
    setActionError("");
    try {
      const response = await fetch(`/volt/employees/${employee.id}/password`, {
        method: "PATCH",
        headers: authHeaders(true),
        body: JSON.stringify({ password: passwordValue }),
      });
      if (!response.ok) throw new Error(await readApiError(response, "Unable to reset password."));
      closeAction();
      setMessageType("success");
      setMessage("Employee password reset successfully. Account unlocked.");
      await loadEmployees();
    } catch (error) {
      setActionError(error.message || "Unable to reset password.");
    } finally {
      setProcessingKey("");
    }
  };

  return (
    <main className="min-h-screen bg-gray-50 px-4 py-6 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-5xl">
        <button type="button" onClick={() => navigate("/employee-dashboard")} className="flex items-center gap-2 font-semibold text-blue-950">
          <ArrowLeft size={18} aria-hidden="true" /> Dashboard
        </button>

        <header className="mt-4 rounded-3xl bg-blue-950 p-5 text-white shadow-lg sm:p-7">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h1 className="text-2xl font-extrabold sm:text-3xl">Employee Management</h1>
              <p className="mt-2 text-sm text-blue-100">Manage employee access and roles.</p>
            </div>
            <button type="button" onClick={() => showCreateForm ? closeCreateForm() : setShowCreateForm(true)} disabled={isLoadingRoles || roles.length === 0} className="flex min-h-12 items-center justify-center gap-2 rounded-2xl bg-yellow-400 px-4 py-3 font-bold text-black transition hover:bg-yellow-300 disabled:opacity-60">
              {showCreateForm ? <X size={19} aria-hidden="true" /> : <PlusCircle size={19} aria-hidden="true" />}
              {showCreateForm ? "Close Form" : "Add Employee"}
            </button>
          </div>
        </header>

        {showCreateForm && (
          <form onSubmit={handleCreate} className="mt-5 grid grid-cols-1 gap-4 rounded-2xl border border-blue-100 bg-white p-5 shadow-sm sm:grid-cols-2">
            <h2 className="text-xl font-extrabold text-blue-950 sm:col-span-2">Add Employee</h2>
            <label className="font-semibold text-gray-700">
              Employee Name
              <input name="name" value={createForm.name} onChange={handleCreateChange} className="mt-2 w-full rounded-xl border border-gray-300 px-4 py-3 outline-none focus:border-blue-950" />
              <FieldError message={createErrors.name} />
            </label>
            <label className="font-semibold text-gray-700">
              Employee ID
              <input name="employeeId" value={createForm.employeeId} onChange={handleCreateChange} placeholder="TECHNICIAN_001" className="mt-2 w-full rounded-xl border border-gray-300 px-4 py-3 outline-none focus:border-blue-950" />
              <FieldError message={createErrors.employeeId} />
            </label>
            <label className="font-semibold text-gray-700">
              Role
              <select name="roleId" value={createForm.roleId} onChange={handleCreateChange} disabled={isLoadingRoles || roles.length === 0} className="mt-2 w-full rounded-xl border border-gray-300 bg-white px-4 py-3 outline-none focus:border-blue-950 disabled:opacity-60">
                <option value="">{isLoadingRoles ? "Loading roles..." : "Select role"}</option>
                {roles.map((role) => <option key={role.id} value={role.id}>{formatRoleLabel(role)}</option>)}
              </select>
              <FieldError message={createErrors.roleId} />
            </label>
            <label className="font-semibold text-gray-700">
              Temporary Password
              <input name="password" type="password" value={createForm.password} onChange={handleCreateChange} className="mt-2 w-full rounded-xl border border-gray-300 px-4 py-3 outline-none focus:border-blue-950" />
              <FieldError message={createErrors.password} />
            </label>
            <label className="flex items-center gap-3 font-semibold text-gray-700 sm:col-span-2">
              <input name="active" type="checkbox" checked={createForm.active} onChange={handleCreateChange} className="h-5 w-5 accent-blue-950" />
              Active employee
            </label>
            <div className="flex flex-col gap-3 sm:col-span-2 sm:flex-row">
              <button type="submit" disabled={isCreating || isLoadingRoles || roles.length === 0} className="rounded-xl bg-blue-950 px-5 py-3 font-bold text-white hover:bg-blue-900 disabled:opacity-60">
                {isCreating ? "Saving..." : "Save Employee"}
              </button>
              <button type="button" onClick={closeCreateForm} className="rounded-xl border border-blue-950 px-5 py-3 font-bold text-blue-950 hover:bg-blue-50">Cancel</button>
            </div>
          </form>
        )}

        <Message type={messageType}>{message}</Message>
        <Message type="error">{listError}</Message>
        <Message type="error">{roleError}</Message>
        {isLoadingRoles && <p className="mt-4 text-sm font-semibold text-gray-600">Loading roles...</p>}
        {!isLoadingRoles && !roleError && roles.length === 0 && (
          <p className="mt-4 rounded-xl border border-yellow-200 bg-yellow-50 px-4 py-3 text-sm font-semibold text-yellow-800">
            No active roles are available for employee assignment.
          </p>
        )}

        <section className="mt-6" aria-labelledby="employee-list-heading">
          <div className="flex items-center justify-between gap-3">
            <h2 id="employee-list-heading" className="text-xl font-extrabold text-blue-950">Employees</h2>
            <button type="button" onClick={() => { loadEmployees(); loadRoles(); }} disabled={isLoading || isLoadingRoles} className="flex items-center gap-2 rounded-xl border border-blue-950 px-3 py-2 text-sm font-bold text-blue-950 hover:bg-blue-50 disabled:opacity-60">
              <RefreshCw size={16} aria-hidden="true" /> Refresh
            </button>
          </div>

          {isLoading && <p className="mt-4 text-sm font-semibold text-gray-600">Loading employees...</p>}
          {!isLoading && !listError && employees.length === 0 && <p className="mt-4 text-sm font-semibold text-gray-600">No employees found.</p>}

          <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-2">
            {employees.map((employee) => (
              <article key={employee.id} className="rounded-2xl border border-blue-100 bg-white p-5 shadow-sm">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <h3 className="text-lg font-extrabold text-blue-950">{employee.name || "Unnamed employee"}</h3>
                    <p className="mt-1 text-sm font-semibold text-gray-500">{employee.employeeId || "Not available"}</p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <span className={`rounded-full px-3 py-1 text-xs font-bold ${employee.active ? "bg-green-100 text-green-800" : "bg-gray-200 text-gray-700"}`}>
                      {employee.active ? "Active" : "Inactive"}
                    </span>
                    {employee.accountLocked && (
                      <span className="rounded-full bg-red-100 px-3 py-1 text-xs font-bold text-red-800">
                        Locked
                      </span>
                    )}
                  </div>
                </div>

                <dl className="mt-4 grid grid-cols-1 gap-3 text-sm min-[390px]:grid-cols-2">
                  <div><dt className="font-bold text-gray-500">Role</dt><dd className="mt-1 text-gray-800">{formatEmployeeRole(employee)}</dd></div>
                  <div><dt className="font-bold text-gray-500">Created Date</dt><dd className="mt-1 text-gray-800">{formatDate(employee.createdAt)}</dd></div>
                  <div><dt className="font-bold text-gray-500">Failed Login Attempts</dt><dd className="mt-1 text-gray-800">{employee.failedLoginAttempts ?? 0}</dd></div>
                </dl>

                <div className="mt-4 grid grid-cols-1 gap-2 min-[390px]:grid-cols-3">
                  <button type="button" onClick={() => updateStatus(employee)} disabled={processingKey === `status-${employee.id}`} className="rounded-xl border border-blue-950 px-3 py-2 text-sm font-bold text-blue-950 hover:bg-blue-50 disabled:opacity-60">
                    {processingKey === `status-${employee.id}` ? "Updating..." : employee.active ? "Disable" : "Enable"}
                  </button>
                  <button type="button" onClick={() => toggleAction(employee, "role")} className="flex items-center justify-center gap-1 rounded-xl border border-blue-950 px-3 py-2 text-sm font-bold text-blue-950 hover:bg-blue-50">
                    <UserRoundCog size={15} aria-hidden="true" /> Change Role
                  </button>
                  <button type="button" onClick={() => toggleAction(employee, "password")} className="flex items-center justify-center gap-1 rounded-xl border border-blue-950 px-3 py-2 text-sm font-bold text-blue-950 hover:bg-blue-50">
                    <KeyRound size={15} aria-hidden="true" /> Reset Password
                  </button>
                </div>

                {openAction?.id === employee.id && openAction.type === "role" && (
                  <div className="mt-4 border-t border-blue-100 pt-4">
                    <label className="text-sm font-semibold text-gray-700">
                      New Role
                      <select value={roleIdValue} onChange={(event) => setRoleIdValue(event.target.value)} disabled={isLoadingRoles || roles.length === 0} className="mt-2 w-full rounded-xl border border-gray-300 bg-white px-4 py-3 outline-none focus:border-blue-950 disabled:opacity-60">
                        <option value="">{isLoadingRoles ? "Loading roles..." : "Select role"}</option>
                        {roles.map((role) => <option key={role.id} value={role.id}>{formatRoleLabel(role)}</option>)}
                      </select>
                    </label>
                    <button type="button" onClick={() => updateRole(employee)} disabled={processingKey === `role-${employee.id}` || isLoadingRoles || roles.length === 0} className="mt-3 flex items-center gap-2 rounded-xl bg-blue-950 px-4 py-2 text-sm font-bold text-white hover:bg-blue-900 disabled:opacity-60">
                      <ShieldCheck size={16} aria-hidden="true" /> {processingKey === `role-${employee.id}` ? "Saving..." : "Save Role"}
                    </button>
                  </div>
                )}

                {openAction?.id === employee.id && openAction.type === "password" && (
                  <div className="mt-4 border-t border-blue-100 pt-4">
                    <label className="text-sm font-semibold text-gray-700">
                      Temporary Password
                      <input type="password" value={passwordValue} onChange={(event) => setPasswordValue(event.target.value)} className="mt-2 w-full rounded-xl border border-gray-300 px-4 py-3 outline-none focus:border-blue-950" />
                    </label>
                    <button type="button" onClick={() => resetPassword(employee)} disabled={processingKey === `password-${employee.id}`} className="mt-3 rounded-xl bg-blue-950 px-4 py-2 text-sm font-bold text-white hover:bg-blue-900 disabled:opacity-60">
                      {processingKey === `password-${employee.id}` ? "Saving..." : "Save Password"}
                    </button>
                  </div>
                )}
                {openAction?.id === employee.id && <Message type="error">{actionError}</Message>}
              </article>
            ))}
          </div>
        </section>
      </div>
    </main>
  );
}
