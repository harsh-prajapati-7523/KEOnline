import { useCallback, useEffect, useMemo, useState } from "react";
import { ArrowLeft, CheckCircle2, LockKeyhole, RefreshCw, Save } from "lucide-react";
import { useNavigate } from "react-router-dom";

const accessGroups = [
  {
    title: "General",
    keys: ["VIEW_DASHBOARD"],
  },
  {
    title: "Tickets",
    keys: [
      "VIEW_TICKETS",
      "CREATE_TICKET",
      "PICK_TICKET",
      "START_WORK",
      "COMPLETE_TICKET",
      "CANCEL_TICKET",
      "UPDATE_WARRANTY",
      "VIEW_CUSTOMER_HISTORY",
      "USE_TICKET_SEARCH",
      "USE_TICKET_FILTERS",
      "USE_SMART_SUGGESTIONS",
    ],
  },
  {
    title: "Charges",
    keys: ["VIEW_CHARGES", "ADD_CHARGE", "DELETE_CHARGE"],
  },
  {
    title: "Employee / Role Administration",
    keys: ["VIEW_EMPLOYEE_MANAGEMENT", "MANAGE_EMPLOYEES", "VIEW_ROLE_MANAGEMENT", "MANAGE_ROLES"],
  },
  {
    title: "Configuration",
    keys: [
      "VIEW_TICKET_CATEGORY_MANAGEMENT",
      "MANAGE_TICKET_CATEGORIES",
      "VIEW_TICKET_FIELD_MANAGEMENT",
      "MANAGE_TICKET_FIELDS",
      "VIEW_CATEGORY_FIELD_CONFIGURATION",
      "MANAGE_CATEGORY_FIELD_CONFIGS",
      "VIEW_DROPDOWN_SOURCE_MANAGEMENT",
      "MANAGE_DROPDOWN_SOURCES",
    ],
  },
];

const accessLabels = {
  VIEW_DASHBOARD: "View Dashboard",
  VIEW_TICKETS: "View Tickets",
  CREATE_TICKET: "Create Ticket",
  PICK_TICKET: "Pick Ticket",
  START_WORK: "Start Work",
  COMPLETE_TICKET: "Complete Ticket",
  CANCEL_TICKET: "Cancel Ticket",
  UPDATE_WARRANTY: "Update Warranty",
  VIEW_CUSTOMER_HISTORY: "View Customer History",
  VIEW_CHARGES: "View Charges",
  ADD_CHARGE: "Add Charge",
  DELETE_CHARGE: "Delete Charge",
  USE_TICKET_SEARCH: "Use Ticket Search",
  USE_TICKET_FILTERS: "Use Ticket Filters",
  USE_SMART_SUGGESTIONS: "Use Smart Suggestions",
  VIEW_EMPLOYEE_MANAGEMENT: "View Employee Management",
  MANAGE_EMPLOYEES: "Manage Employees",
  VIEW_ROLE_MANAGEMENT: "View Role Management",
  MANAGE_ROLES: "Manage Roles",
  VIEW_TICKET_CATEGORY_MANAGEMENT: "View Ticket Categories",
  MANAGE_TICKET_CATEGORIES: "Manage Ticket Categories",
  VIEW_TICKET_FIELD_MANAGEMENT: "View Ticket Fields",
  MANAGE_TICKET_FIELDS: "Manage Ticket Fields",
  VIEW_CATEGORY_FIELD_CONFIGURATION: "View Category Field Configuration",
  MANAGE_CATEGORY_FIELD_CONFIGS: "Manage Category Field Configuration",
  VIEW_DROPDOWN_SOURCE_MANAGEMENT: "View Dropdown Sources",
  MANAGE_DROPDOWN_SOURCES: "Manage Dropdown Sources",
};

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

function Message({ children, type = "success" }) {
  if (!children) return null;
  const className = type === "error"
    ? "border-red-200 bg-red-50 text-red-700"
    : "border-green-200 bg-green-50 text-green-700";
  return <p className={`mt-4 rounded-xl border px-4 py-3 text-sm font-semibold ${className}`}>{children}</p>;
}

function formatRoleLabel(role) {
  if (!role) return "Select role";
  const label = role.displayName ? `${role.displayName} (${role.roleKey})` : role.roleKey || "Unnamed Role";
  return role.active ? label : `${label} - Inactive`;
}

function normalizeRules(rules) {
  const next = {};
  if (!Array.isArray(rules)) return next;
  rules.forEach((rule) => {
    if (typeof rule?.accessKey === "string" && rule.accessKey.trim()) {
      next[rule.accessKey] = Boolean(rule.allowed);
    }
  });
  return next;
}

function sameRuleMap(a, b) {
  const keys = new Set([...Object.keys(a), ...Object.keys(b)]);
  for (const key of keys) {
    if (Boolean(a[key]) !== Boolean(b[key])) return false;
  }
  return true;
}

function buildGroupedRules(ruleKeys) {
  const seen = new Set();
  const grouped = accessGroups
    .map((group) => {
      const keys = group.keys.filter((key) => ruleKeys.includes(key));
      keys.forEach((key) => seen.add(key));
      return { ...group, keys };
    })
    .filter((group) => group.keys.length > 0);

  const unknownKeys = ruleKeys.filter((key) => !seen.has(key));
  if (unknownKeys.length > 0) {
    grouped.push({ title: "Other", keys: unknownKeys });
  }
  return grouped;
}

export default function RoleAccessManagement() {
  const navigate = useNavigate();
  const [roles, setRoles] = useState([]);
  const [selectedRoleId, setSelectedRoleId] = useState("");
  const [roleAccess, setRoleAccess] = useState(null);
  const [originalRules, setOriginalRules] = useState({});
  const [editableRules, setEditableRules] = useState({});
  const [isLoadingRoles, setIsLoadingRoles] = useState(true);
  const [isLoadingAccess, setIsLoadingAccess] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [roleError, setRoleError] = useState("");
  const [accessError, setAccessError] = useState("");
  const [message, setMessage] = useState("");
  const [messageType, setMessageType] = useState("success");

  const selectedRole = useMemo(
    () => roles.find((role) => String(role.id) === String(selectedRoleId)),
    [roles, selectedRoleId]
  );
  const protectedRole = Boolean(roleAccess?.protectedRole || roleAccess?.roleKey === "SUPER_ADMIN" || selectedRole?.roleKey === "SUPER_ADMIN");
  const ruleKeys = useMemo(() => Object.keys(editableRules), [editableRules]);
  const groupedRules = useMemo(() => buildGroupedRules(ruleKeys), [ruleKeys]);
  const hasChanges = useMemo(() => !sameRuleMap(originalRules, editableRules), [originalRules, editableRules]);

  const loadRoles = useCallback(async () => {
    setIsLoadingRoles(true);
    setRoleError("");
    try {
      const response = await fetch("/volt/roles", { headers: authHeaders() });
      if (!response.ok) throw new Error("Role list request failed");
      const data = await response.json();
      setRoles(Array.isArray(data) ? data : []);
    } catch {
      setRoles([]);
      setRoleError("Unable to load roles. Please try again.");
    } finally {
      setIsLoadingRoles(false);
    }
  }, []);

  const loadRoleAccess = useCallback(async (roleId) => {
    if (!roleId) {
      setRoleAccess(null);
      setOriginalRules({});
      setEditableRules({});
      setAccessError("");
      return;
    }

    setIsLoadingAccess(true);
    setAccessError("");
    try {
      const response = await fetch(`/volt/role-access/${roleId}`, { headers: authHeaders() });
      if (!response.ok) throw new Error(await readApiError(response, "Unable to load role access. Please try again."));
      const data = await response.json();
      const rules = normalizeRules(data.rules);
      setRoleAccess(data);
      setOriginalRules(rules);
      setEditableRules(rules);
    } catch (error) {
      setRoleAccess(null);
      setOriginalRules({});
      setEditableRules({});
      setAccessError(error.message || "Unable to load role access. Please try again.");
    } finally {
      setIsLoadingAccess(false);
    }
  }, []);

  useEffect(() => {
    loadRoles();
  }, [loadRoles]);

  useEffect(() => {
    loadRoleAccess(selectedRoleId);
  }, [loadRoleAccess, selectedRoleId]);

  const handleRoleChange = (event) => {
    setSelectedRoleId(event.target.value);
    setMessage("");
    setAccessError("");
  };

  const toggleRule = (accessKey) => {
    if (protectedRole) return;
    setEditableRules((current) => ({ ...current, [accessKey]: !current[accessKey] }));
    setMessage("");
  };

  const saveChanges = async () => {
    if (!selectedRoleId) {
      setMessageType("error");
      setMessage("Select a role to manage access.");
      return;
    }
    if (protectedRole) {
      setMessageType("error");
      setMessage("SUPER_ADMIN access is protected and cannot be changed.");
      return;
    }

    setIsSaving(true);
    setMessage("");
    try {
      const payload = {
        rules: ruleKeys.map((accessKey) => ({
          accessKey,
          allowed: Boolean(editableRules[accessKey]),
        })),
      };
      const response = await fetch(`/volt/role-access/${selectedRoleId}`, {
        method: "PATCH",
        headers: authHeaders(true),
        body: JSON.stringify(payload),
      });
      if (!response.ok) throw new Error(await readApiError(response, "Unable to save role access. Please try again."));
      setMessageType("success");
      setMessage("Role access updated successfully.");
      await loadRoleAccess(selectedRoleId);
    } catch (error) {
      setMessageType("error");
      setMessage(error.message || "Unable to save role access. Please try again.");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <main className="min-h-screen bg-gray-50 px-4 py-6 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-5xl">
        <button type="button" onClick={() => navigate("/employee-dashboard")} className="flex items-center gap-2 font-semibold text-blue-950">
          <ArrowLeft size={18} aria-hidden="true" /> Dashboard
        </button>

        <header className="mt-4 rounded-3xl bg-blue-950 p-5 text-white shadow-lg sm:p-7">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div>
              <h1 className="text-2xl font-extrabold sm:text-3xl">Role Access Management</h1>
              <p className="mt-2 text-sm text-blue-100">Control what each role can access and perform.</p>
            </div>
            <button
              type="button"
              onClick={loadRoles}
              disabled={isLoadingRoles}
              className="flex min-h-11 items-center justify-center gap-2 rounded-2xl bg-white/10 px-4 py-2 font-bold text-white transition hover:bg-white/20 disabled:opacity-60"
            >
              <RefreshCw size={18} aria-hidden="true" />
              Refresh
            </button>
          </div>
        </header>

        <Message type={messageType}>{message}</Message>

        <section className="mt-5 rounded-2xl border border-blue-100 bg-white p-5 shadow-sm">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-[1fr_auto] md:items-end">
            <label className="font-semibold text-gray-700">
              Role
              <select
                value={selectedRoleId}
                onChange={handleRoleChange}
                disabled={isLoadingRoles || roles.length === 0}
                className="mt-2 w-full rounded-xl border border-gray-300 bg-white px-4 py-3 outline-none focus:border-blue-950 disabled:opacity-60"
              >
                <option value="">{isLoadingRoles ? "Loading roles..." : "Select a role to manage access"}</option>
                {roles.map((role) => (
                  <option key={role.id} value={role.id}>{formatRoleLabel(role)}</option>
                ))}
              </select>
            </label>
            <button
              type="button"
              onClick={() => loadRoleAccess(selectedRoleId)}
              disabled={!selectedRoleId || isLoadingAccess}
              className="flex min-h-12 items-center justify-center gap-2 rounded-2xl border border-blue-950 px-4 py-2 font-bold text-blue-950 transition hover:bg-blue-50 disabled:opacity-60"
            >
              <RefreshCw size={18} aria-hidden="true" />
              Refresh Access
            </button>
          </div>

          {roleError && <p className="mt-3 rounded-xl bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">{roleError}</p>}
          {!isLoadingRoles && !roleError && roles.length === 0 && (
            <p className="mt-3 rounded-xl bg-gray-50 px-4 py-3 text-sm font-semibold text-gray-600">No roles are available.</p>
          )}
        </section>

        <section className="mt-5 rounded-2xl border border-blue-100 bg-white p-5 shadow-sm">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <h2 className="text-xl font-extrabold text-blue-950">Access Rules</h2>
              <p className="mt-1 text-sm text-gray-500">
                {selectedRole ? formatRoleLabel(selectedRole) : "Select a role to manage access."}
              </p>
            </div>
            {roleAccess && (
              <span className={`inline-flex w-fit items-center gap-2 rounded-full px-3 py-1 text-xs font-bold ${protectedRole ? "bg-yellow-100 text-yellow-800" : "bg-green-50 text-green-700"}`}>
                {protectedRole && <LockKeyhole size={14} aria-hidden="true" />}
                {protectedRole ? "Protected / Read-only" : "Editable"}
              </span>
            )}
          </div>

          {!selectedRoleId && (
            <p className="mt-4 rounded-xl bg-gray-50 px-4 py-3 text-sm font-semibold text-gray-600">Select a role to manage access.</p>
          )}
          {isLoadingAccess && (
            <p className="mt-4 rounded-xl bg-gray-50 px-4 py-3 text-sm font-semibold text-gray-600">Loading role access...</p>
          )}
          {accessError && (
            <p className="mt-4 rounded-xl bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">{accessError}</p>
          )}
          {protectedRole && !isLoadingAccess && !accessError && (
            <p className="mt-4 rounded-xl bg-yellow-50 px-4 py-3 text-sm font-semibold text-yellow-800">
              SUPER_ADMIN has protected full access and cannot be edited.
            </p>
          )}
          {roleAccess && !isLoadingAccess && !accessError && ruleKeys.length === 0 && (
            <p className="mt-4 rounded-xl bg-gray-50 px-4 py-3 text-sm font-semibold text-gray-600">No access rules found for this role.</p>
          )}

          {roleAccess && !isLoadingAccess && !accessError && groupedRules.length > 0 && (
            <div className="mt-5 space-y-5">
              {groupedRules.map((group) => (
                <section key={group.title} className="rounded-2xl border border-gray-200 bg-gray-50 p-4">
                  <h3 className="text-base font-extrabold text-blue-950">{group.title}</h3>
                  <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-2">
                    {group.keys.map((accessKey) => (
                      <label key={accessKey} className="flex min-h-20 items-start gap-3 rounded-xl border border-gray-200 bg-white p-4">
                        <input
                          type="checkbox"
                          checked={Boolean(editableRules[accessKey])}
                          onChange={() => toggleRule(accessKey)}
                          disabled={protectedRole || isSaving}
                          className="mt-1 h-5 w-5 shrink-0 accent-blue-950 disabled:opacity-60"
                        />
                        <span className="min-w-0">
                          <span className="block font-bold text-gray-800">{accessLabels[accessKey] || accessKey}</span>
                          <span className="mt-1 block break-words text-xs font-semibold text-gray-500">{accessKey}</span>
                        </span>
                      </label>
                    ))}
                  </div>
                </section>
              ))}
            </div>
          )}

          {roleAccess && !isLoadingAccess && !accessError && (
            <div className="mt-5 flex flex-col gap-2 sm:flex-row sm:items-center">
              <button
                type="button"
                onClick={saveChanges}
                disabled={protectedRole || !hasChanges || isSaving}
                className="flex min-h-12 items-center justify-center gap-2 rounded-2xl bg-blue-950 px-5 py-3 font-bold text-white transition hover:bg-blue-900 disabled:opacity-60"
              >
                {isSaving ? <RefreshCw size={18} aria-hidden="true" /> : <Save size={18} aria-hidden="true" />}
                {isSaving ? "Saving..." : "Save Changes"}
              </button>
              {hasChanges && !protectedRole && (
                <span className="text-sm font-semibold text-yellow-700">Unsaved changes</span>
              )}
              {!hasChanges && !protectedRole && (
                <span className="inline-flex items-center gap-2 text-sm font-semibold text-green-700">
                  <CheckCircle2 size={16} aria-hidden="true" />
                  No unsaved changes
                </span>
              )}
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
