import { useCallback, useEffect, useMemo, useState } from "react";
import { ArrowLeft, CheckCircle2, RefreshCw, Search, XCircle } from "lucide-react";
import { useNavigate } from "react-router-dom";

const tabs = [
  { id: "overview", label: "Overview" },
  { id: "transitions", label: "Transitions" },
  { id: "statuses", label: "Statuses" },
  { id: "actions", label: "Actions" },
  { id: "roleAccess", label: "Role Access" },
  { id: "validation", label: "Validation" },
];

const managedRoleKeys = ["SUPER_ADMIN", "ADMIN", "TECHNICIAN"];

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

function formatLabel(value) {
  if (!value) return "Not available";
  return String(value).replaceAll("_", " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function formatDateTime(value) {
  if (!value) return "Not available";
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? "Not available"
    : date.toLocaleString([], { dateStyle: "medium", timeStyle: "short" });
}

function normalizeArray(data, key) {
  return Array.isArray(data) ? data : Array.isArray(data?.[key]) ? data[key] : [];
}

function normalizeRules(rules, keyName = "accessKey") {
  const next = {};
  if (!Array.isArray(rules)) return next;
  rules.forEach((rule) => {
    const key = rule?.[keyName];
    if (typeof key === "string" && key.trim()) next[key] = rule;
  });
  return next;
}

function Badge({ children, tone = "slate" }) {
  const tones = {
    green: "border-green-200 bg-green-50 text-green-700",
    red: "border-red-200 bg-red-50 text-red-700",
    blue: "border-blue-200 bg-blue-50 text-blue-950",
    yellow: "border-yellow-200 bg-yellow-50 text-yellow-800",
    slate: "border-slate-200 bg-slate-100 text-slate-700",
  };

  return (
    <span className={`inline-flex min-h-6 items-center rounded-full border px-2 py-0.5 text-xs font-bold ${tones[tone] ?? tones.slate}`}>
      {children}
    </span>
  );
}

function BusinessKeyLabel({ label, technicalKey, subtle = false }) {
  return (
    <span className="block min-w-0">
      <span className={`block break-words font-bold ${subtle ? "text-slate-700" : "text-blue-950"}`}>
        {label || formatLabel(technicalKey)}
      </span>
      <span className="mt-0.5 block break-all text-[0.7rem] font-bold uppercase text-slate-500">
        {technicalKey || "UNKNOWN"}
      </span>
    </span>
  );
}

function EmptyRows({ colSpan, children }) {
  return (
    <tr>
      <td colSpan={colSpan} className="px-4 py-5 text-sm font-semibold text-slate-600">
        {children}
      </td>
    </tr>
  );
}

function TableShell({ children, minWidth = "min-w-[980px]" }) {
  return (
    <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
      <table className={`${minWidth} w-full border-separate border-spacing-0 text-left text-sm`}>
        {children}
      </table>
    </div>
  );
}

function HeaderCell({ children }) {
  return (
    <th className="sticky top-0 z-10 border-b border-slate-200 bg-slate-50 px-4 py-3 text-xs font-extrabold uppercase tracking-wide text-slate-600">
      {children}
    </th>
  );
}

function BodyCell({ children, className = "" }) {
  return <td className={`border-b border-slate-100 px-4 py-3 align-top ${className}`}>{children}</td>;
}

function StateBadge({ enabled, trueLabel = "Enabled", falseLabel = "Disabled" }) {
  return <Badge tone={enabled ? "green" : "red"}>{enabled ? trueLabel : falseLabel}</Badge>;
}

function ScopeBadge({ value }) {
  if (value === "full") return <Badge tone="green">Full</Badge>;
  if (value === "partial") return <Badge tone="yellow">Partial</Badge>;
  return <Badge tone="red">None</Badge>;
}

function DetailRow({ label, value }) {
  return (
    <div className="border-b border-slate-100 py-3">
      <dt className="text-xs font-extrabold uppercase text-slate-500">{label}</dt>
      <dd className="mt-1 break-words text-sm font-semibold text-slate-800">{value ?? "Not available"}</dd>
    </div>
  );
}

function getStatusLabel(transition, direction) {
  if (direction === "from") {
    return {
      label: transition.fromStatusDisplayName || formatLabel(transition.fromStatusKey || transition.fromStatus),
      key: transition.fromStatusKey || transition.fromStatus,
    };
  }

  return {
    label: transition.toStatusDisplayName || formatLabel(transition.toStatusKey || transition.toStatus),
    key: transition.toStatusKey || transition.toStatus,
  };
}

function getCategoryRuleState(transitionId, selectedCategoryId, categoryRulesByTransitionId) {
  const rules = categoryRulesByTransitionId[transitionId] || [];
  if (!selectedCategoryId) return { label: "No category", tone: "slate" };
  const selectedRule = rules.find((rule) => String(rule.categoryId) === String(selectedCategoryId));
  if (selectedRule?.active) return { label: "Active", tone: "green" };
  if (selectedRule) return { label: "Inactive", tone: "yellow" };
  return { label: "Missing", tone: "slate" };
}

function getRuleVisualState(rule) {
  if (rule?.active) return { label: "Active", tone: "green" };
  if (rule) return { label: "Inactive", tone: "yellow" };
  return { label: "Missing", tone: "slate" };
}

function roleRuleState(transitionId, roleId, roleRulesByTransitionId) {
  const rules = roleRulesByTransitionId[transitionId] || [];
  if (rules.length === 0) return "full";
  const rule = rules.find((item) => String(item.roleId) === String(roleId));
  if (rule?.active) return "full";
  if (rule) return "partial";
  return "none";
}

function actionAccessState(actionKey, role, roleAccessByRoleId) {
  if (role?.roleKey === "SUPER_ADMIN") return "full";
  const access = roleAccessByRoleId[role?.id];
  const rule = access?.rulesByKey?.[actionKey] || access?.dynamicRulesByKey?.[actionKey];
  return rule?.allowed ? "full" : "none";
}

function combinedTransitionRoleState(transition, role, roleAccessByRoleId, roleRulesByTransitionId) {
  const actionState = actionAccessState(transition.actionKey, role, roleAccessByRoleId);
  const scopeState = roleRuleState(transition.id, role?.id, roleRulesByTransitionId);
  if (actionState === "full" && scopeState === "full") return "full";
  if (actionState === "full" || scopeState === "full" || scopeState === "partial") return "partial";
  return "none";
}

function ConfirmRuleChangeDialog({ pendingChange, onCancel, onConfirm, isSaving }) {
  if (!pendingChange) return null;

  const isCategory = pendingChange.scope === "category";
  const targetLabel = isCategory
    ? pendingChange.category?.displayName || formatLabel(pendingChange.category?.categoryKey)
    : pendingChange.role?.displayName || formatLabel(pendingChange.role?.roleKey);
  const targetKey = isCategory ? pendingChange.category?.categoryKey : pendingChange.role?.roleKey;

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-950/40 px-4" role="dialog" aria-modal="true" aria-label="Confirm workflow rule change">
      <div className="w-full max-w-lg rounded-lg border border-slate-200 bg-white shadow-2xl">
        <div className="border-b border-slate-200 px-5 py-4">
          <p className="text-xs font-extrabold uppercase text-slate-500">Confirm Rule Change</p>
          <h2 className="mt-1 text-lg font-extrabold text-blue-950">
            {pendingChange.nextActive ? "Enable" : "Disable"} {isCategory ? "category" : "role"} rule
          </h2>
        </div>
        <div className="space-y-3 px-5 py-4 text-sm font-semibold text-slate-700">
          <p>
            {isCategory
              ? "You are changing workflow rule availability for the selected category only. This does not activate or deactivate the category workflow mode."
              : "You are changing which role can use this transition. This does not change ticket category workflow mode."}
          </p>
          <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-3">
            <BusinessKeyLabel label={pendingChange.transition?.displayName || formatLabel(pendingChange.transition?.actionKey)} technicalKey={pendingChange.transition?.actionKey} subtle />
            <div className="mt-3 flex flex-wrap gap-2">
              <Badge tone="blue">{isCategory ? "Category" : "Role"}: {targetLabel}</Badge>
              <Badge tone="slate">Key: {targetKey || "UNKNOWN"}</Badge>
              <Badge tone={pendingChange.nextActive ? "green" : "red"}>{pendingChange.nextActive ? "Enable" : "Disable"}</Badge>
            </div>
          </div>
        </div>
        <div className="flex flex-col gap-2 border-t border-slate-200 px-5 py-4 sm:flex-row sm:justify-end">
          <button
            type="button"
            onClick={onCancel}
            disabled={isSaving}
            className="inline-flex min-h-10 items-center justify-center rounded-lg border border-slate-300 px-4 py-2 text-sm font-bold text-slate-700 hover:bg-slate-50 disabled:opacity-60"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={isSaving}
            className="inline-flex min-h-10 items-center justify-center rounded-lg bg-blue-950 px-4 py-2 text-sm font-bold text-white hover:bg-blue-900 disabled:opacity-60"
          >
            {isSaving ? "Saving..." : "Confirm Change"}
          </button>
        </div>
      </div>
    </div>
  );
}

function DetailDrawer({
  item,
  onClose,
  selectedCategory,
  managedRoles,
  categoryRulesByTransitionId,
  roleRulesByTransitionId,
  onRequestRuleChange,
  isSavingRule,
}) {
  if (!item) return null;

  const isTransition = item.type === "transition";
  const rules = isTransition ? categoryRulesByTransitionId[item.data.id] || [] : [];
  const roleRules = isTransition ? roleRulesByTransitionId[item.data.id] || [] : [];
  const selectedCategoryRule = rules.find((rule) => String(rule.categoryId) === String(selectedCategory?.id));
  const selectedCategoryState = getRuleVisualState(selectedCategoryRule);

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-slate-950/30" role="dialog" aria-modal="true" aria-label="Workflow details">
      <button type="button" className="hidden flex-1 lg:block" onClick={onClose} aria-label="Close details" />
      <aside className="flex h-full w-full max-w-xl flex-col bg-white shadow-2xl sm:w-[34rem]">
        <div className="flex items-start justify-between gap-3 border-b border-slate-200 px-5 py-4">
          <div className="min-w-0">
            <p className="text-xs font-extrabold uppercase text-slate-500">{item.type}</p>
            <h2 className="mt-1 break-words text-lg font-extrabold text-blue-950">
              {item.title}
            </h2>
          </div>
          <button type="button" onClick={onClose} className="rounded-lg border border-slate-200 px-3 py-2 text-sm font-bold text-slate-700 hover:bg-slate-50">
            Close
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-3">
          <dl>
            {Object.entries(item.details).map(([label, value]) => (
              <DetailRow key={label} label={label} value={value} />
            ))}
          </dl>

          {isTransition && (
            <>
              <section className="mt-5">
                <div className="flex items-center justify-between gap-3">
                  <h3 className="text-sm font-extrabold text-blue-950">Selected Category Rule</h3>
                  <Badge tone={selectedCategoryState.tone}>{selectedCategoryState.label}</Badge>
                </div>
                <div className="mt-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-3">
                  <BusinessKeyLabel label={selectedCategory?.displayName} technicalKey={selectedCategory?.categoryKey} subtle />
                  <div className="mt-3 flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => onRequestRuleChange({
                        scope: "category",
                        transition: item.data,
                        category: selectedCategory,
                        rule: selectedCategoryRule,
                        nextActive: true,
                      })}
                      disabled={!selectedCategory || selectedCategoryRule?.active || isSavingRule}
                      className="inline-flex min-h-9 items-center justify-center rounded-lg bg-blue-950 px-3 py-2 text-xs font-extrabold text-white hover:bg-blue-900 disabled:opacity-50"
                    >
                      Enable
                    </button>
                    <button
                      type="button"
                      onClick={() => onRequestRuleChange({
                        scope: "category",
                        transition: item.data,
                        category: selectedCategory,
                        rule: selectedCategoryRule,
                        nextActive: false,
                      })}
                      disabled={!selectedCategoryRule || !selectedCategoryRule.active || isSavingRule}
                      className="inline-flex min-h-9 items-center justify-center rounded-lg border border-red-200 px-3 py-2 text-xs font-extrabold text-red-700 hover:bg-red-50 disabled:opacity-50"
                    >
                      Disable
                    </button>
                  </div>
                  {!selectedCategoryRule && (
                    <p className="mt-2 text-xs font-semibold text-slate-600">Missing rule can be created only by enabling this selected category.</p>
                  )}
                </div>
              </section>

              <section className="mt-5">
                <h3 className="text-sm font-extrabold text-blue-950">Workflow Transition Role Rules</h3>
                <div className="mt-2 space-y-2">
                  {managedRoles.map((role) => {
                    const rule = roleRules.find((item) => String(item.roleId) === String(role.id));
                    const state = getRuleVisualState(rule);
                    return (
                      <div key={role.id} className="border-b border-slate-100 py-3 text-sm">
                        <div className="flex items-start justify-between gap-3">
                          <BusinessKeyLabel label={role.displayName} technicalKey={role.roleKey} subtle />
                          <Badge tone={state.tone}>{state.label}</Badge>
                        </div>
                        <div className="mt-2 flex flex-wrap gap-2">
                          <button
                            type="button"
                            onClick={() => onRequestRuleChange({
                              scope: "role",
                              transition: item.data,
                              role,
                              rule,
                              nextActive: true,
                            })}
                            disabled={rule?.active || isSavingRule}
                            className="inline-flex min-h-9 items-center justify-center rounded-lg bg-blue-950 px-3 py-2 text-xs font-extrabold text-white hover:bg-blue-900 disabled:opacity-50"
                          >
                            Enable
                          </button>
                          <button
                            type="button"
                            onClick={() => onRequestRuleChange({
                              scope: "role",
                              transition: item.data,
                              role,
                              rule,
                              nextActive: false,
                            })}
                            disabled={!rule || !rule.active || isSavingRule}
                            className="inline-flex min-h-9 items-center justify-center rounded-lg border border-red-200 px-3 py-2 text-xs font-extrabold text-red-700 hover:bg-red-50 disabled:opacity-50"
                          >
                            Disable
                          </button>
                        </div>
                      </div>
                    );
                  })}
                  {managedRoles.length === 0 && (
                    <div className="py-2 text-sm font-semibold text-slate-600">No approved roles are available for rule management.</div>
                  )}
                  {roleRules.length > managedRoles.length && (
                    <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-semibold text-slate-600">
                      Additional role rules are visible in matrices but outside Phase 2 management scope.
                    </div>
                  )}
                </div>
              </section>
            </>
          )}
        </div>
      </aside>
    </div>
  );
}

export default function WorkflowManagement() {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState("overview");
  const [categories, setCategories] = useState([]);
  const [selectedCategoryId, setSelectedCategoryId] = useState("");
  const [categoryWorkflowConfig, setCategoryWorkflowConfig] = useState(null);
  const [transitions, setTransitions] = useState([]);
  const [statuses, setStatuses] = useState([]);
  const [actions, setActions] = useState([]);
  const [roles, setRoles] = useState([]);
  const [categoryRulesByTransitionId, setCategoryRulesByTransitionId] = useState({});
  const [roleRulesByTransitionId, setRoleRulesByTransitionId] = useState({});
  const [roleAccessByRoleId, setRoleAccessByRoleId] = useState({});
  const [validationResult, setValidationResult] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingCategory, setIsLoadingCategory] = useState(false);
  const [isValidating, setIsValidating] = useState(false);
  const [isSavingRule, setIsSavingRule] = useState(false);
  const [error, setError] = useState("");
  const [statusMessage, setStatusMessage] = useState("");
  const [drawerItem, setDrawerItem] = useState(null);
  const [pendingRuleChange, setPendingRuleChange] = useState(null);

  const selectedCategory = useMemo(
    () => categories.find((category) => String(category.id) === String(selectedCategoryId)),
    [categories, selectedCategoryId]
  );

  const activeTransitions = useMemo(
    () => transitions.filter((transition) => transition.active),
    [transitions]
  );

  const actionByKey = useMemo(() => {
    const next = {};
    actions.forEach((action) => {
      if (action.actionKey) next[action.actionKey] = action;
    });
    return next;
  }, [actions]);

  const enabledRoleCount = useMemo(
    () => roles.filter((role) => role.active).length,
    [roles]
  );

  const managedRoles = useMemo(
    () => roles.filter((role) => managedRoleKeys.includes(role.roleKey)),
    [roles]
  );

  const validationStatus = validationResult
    ? validationResult.readyToActivate || validationResult.valid
      ? "Ready"
      : "Not Ready"
    : "Not run";

  const loadTransitionRules = useCallback(async (nextTransitions) => {
    const categoryRuleEntries = await Promise.all(
      nextTransitions.map(async (transition) => {
        try {
          const response = await fetch(`/volt/workflow/transitions/${transition.id}/category-rules`, { headers: authHeaders() });
          if (!response.ok) throw new Error("Category rules request failed");
          return [transition.id, normalizeArray(await response.json(), "rules")];
        } catch {
          return [transition.id, []];
        }
      })
    );

    const roleRuleEntries = await Promise.all(
      nextTransitions.map(async (transition) => {
        try {
          const response = await fetch(`/volt/workflow/transitions/${transition.id}/role-rules`, { headers: authHeaders() });
          if (!response.ok) throw new Error("Role rules request failed");
          return [transition.id, normalizeArray(await response.json(), "rules")];
        } catch {
          return [transition.id, []];
        }
      })
    );

    setCategoryRulesByTransitionId(Object.fromEntries(categoryRuleEntries));
    setRoleRulesByTransitionId(Object.fromEntries(roleRuleEntries));
  }, []);

  const loadSingleTransitionRules = useCallback(async (transitionId) => {
    const [categoryResponse, roleResponse] = await Promise.all([
      fetch(`/volt/workflow/transitions/${transitionId}/category-rules`, { headers: authHeaders() }),
      fetch(`/volt/workflow/transitions/${transitionId}/role-rules`, { headers: authHeaders() }),
    ]);

    if (!categoryResponse.ok || !roleResponse.ok) {
      throw new Error("Rule was saved, but refreshed rule data could not be loaded.");
    }

    const [categoryRules, roleRules] = await Promise.all([
      categoryResponse.json(),
      roleResponse.json(),
    ]);

    setCategoryRulesByTransitionId((current) => ({
      ...current,
      [transitionId]: normalizeArray(categoryRules, "rules"),
    }));
    setRoleRulesByTransitionId((current) => ({
      ...current,
      [transitionId]: normalizeArray(roleRules, "rules"),
    }));
  }, []);

  const loadRoleAccess = useCallback(async (nextRoles) => {
    const entries = await Promise.all(
      nextRoles.map(async (role) => {
        try {
          const [roleAccessResponse, dynamicAccessResponse] = await Promise.all([
            fetch(`/volt/role-access/${role.id}`, { headers: authHeaders() }),
            fetch(`/volt/role-access/${role.id}/dynamic`, { headers: authHeaders() }),
          ]);

          if (!roleAccessResponse.ok || !dynamicAccessResponse.ok) throw new Error("Role access request failed");

          const roleAccess = await roleAccessResponse.json();
          const dynamicAccess = await dynamicAccessResponse.json();
          return [role.id, {
            ...roleAccess,
            dynamic: dynamicAccess,
            rulesByKey: normalizeRules(roleAccess.rules),
            dynamicRulesByKey: normalizeRules(dynamicAccess.rules),
          }];
        } catch {
          return [role.id, { rulesByKey: {}, dynamicRulesByKey: {} }];
        }
      })
    );

    setRoleAccessByRoleId(Object.fromEntries(entries));
  }, []);

  const loadBaseData = useCallback(async () => {
    setIsLoading(true);
    setError("");
    try {
      const [categoryResponse, transitionResponse, statusResponse, actionResponse, roleResponse] = await Promise.all([
        fetch("/volt/ticket-categories", { headers: authHeaders() }),
        fetch("/volt/workflow/transitions", { headers: authHeaders() }),
        fetch("/volt/workflow/statuses", { headers: authHeaders() }),
        fetch("/volt/workflow/actions", { headers: authHeaders() }),
        fetch("/volt/roles", { headers: authHeaders() }),
      ]);

      const responses = [categoryResponse, transitionResponse, statusResponse, actionResponse, roleResponse];
      if (responses.some((response) => !response.ok)) {
        throw new Error("Unable to load workflow management data. Please try again.");
      }

      const [categoryData, transitionData, statusData, actionData, roleData] = await Promise.all(responses.map((response) => response.json()));
      const nextCategories = normalizeArray(categoryData, "categories");
      const nextTransitions = normalizeArray(transitionData, "transitions");
      const nextStatuses = normalizeArray(statusData, "statuses");
      const nextActions = normalizeArray(actionData, "actions");
      const nextRoles = normalizeArray(roleData, "roles");

      setCategories(nextCategories);
      setTransitions(nextTransitions);
      setStatuses(nextStatuses);
      setActions(nextActions);
      setRoles(nextRoles);
      setSelectedCategoryId((current) => current || nextCategories[0]?.id || "");

      await Promise.all([loadTransitionRules(nextTransitions), loadRoleAccess(nextRoles)]);
    } catch (loadError) {
      setError(loadError.message || "Unable to load workflow management data. Please try again.");
    } finally {
      setIsLoading(false);
    }
  }, [loadRoleAccess, loadTransitionRules]);

  const loadCategoryConfig = useCallback(async (categoryId) => {
    if (!categoryId) {
      setCategoryWorkflowConfig(null);
      return;
    }

    setIsLoadingCategory(true);
    try {
      const response = await fetch(`/volt/ticket-categories/${categoryId}/workflow-config`, { headers: authHeaders() });
      if (!response.ok) throw new Error("Unable to load category workflow config.");
      setCategoryWorkflowConfig(await response.json());
    } catch {
      setCategoryWorkflowConfig(null);
    } finally {
      setIsLoadingCategory(false);
    }
  }, []);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      loadBaseData();
    }, 0);

    return () => window.clearTimeout(timeoutId);
  }, [loadBaseData]);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      loadCategoryConfig(selectedCategoryId);
      setValidationResult(null);
    }, 0);

    return () => window.clearTimeout(timeoutId);
  }, [loadCategoryConfig, selectedCategoryId]);

  const refreshData = async () => {
    setValidationResult(null);
    setStatusMessage("");
    await loadBaseData();
  };

  const runValidation = async (categoryId = selectedCategoryId) => {
    if (!categoryId) return null;
    setIsValidating(true);
    setError("");
    try {
      const response = await fetch("/volt/workflow/validate-category-workflow", {
        method: "POST",
        headers: authHeaders(true),
        body: JSON.stringify({ categoryId: Number(categoryId) }),
      });
      if (!response.ok) throw new Error(await readApiError(response, "Unable to validate selected category workflow."));
      const result = await response.json();
      setValidationResult(result);
      return result;
    } catch (validationError) {
      setError(validationError.message || "Unable to validate selected category workflow.");
      return null;
    } finally {
      setIsValidating(false);
    }
  };

  const requestRuleChange = (change) => {
    if (!change?.transition?.id || !change.nextActive && !change.rule) return;
    if (change.scope === "category" && !change.category?.id) return;
    if (change.scope === "role" && !managedRoleKeys.includes(change.role?.roleKey)) return;
    setError("");
    setStatusMessage("");
    setPendingRuleChange(change);
  };

  const confirmRuleChange = async () => {
    if (!pendingRuleChange) return;

    const { scope, transition, rule, nextActive, category, role } = pendingRuleChange;
    setIsSavingRule(true);
    setError("");
    setStatusMessage("");

    try {
      const endpoint = scope === "category"
        ? `/volt/workflow/transitions/${transition.id}/category-rules`
        : `/volt/workflow/transitions/${transition.id}/role-rules`;
      const response = rule
        ? await fetch(`${endpoint}/${rule.id}`, {
            method: "PATCH",
            headers: authHeaders(true),
            body: JSON.stringify({ active: nextActive }),
          })
        : await fetch(endpoint, {
            method: "POST",
            headers: authHeaders(true),
            body: JSON.stringify(scope === "category"
              ? { categoryId: Number(category.id), active: true }
              : { roleId: Number(role.id), active: true }),
          });

      if (!response.ok) {
        throw new Error(await readApiError(response, "Unable to save workflow rule change."));
      }

      await loadSingleTransitionRules(transition.id);
      await runValidation(category?.id || selectedCategoryId);
      setPendingRuleChange(null);
      setStatusMessage(`${scope === "category" ? "Category" : "Role"} rule ${nextActive ? "enabled" : "disabled"} and validation refreshed.`);
    } catch (saveError) {
      setError(saveError.message || "Unable to save workflow rule change.");
    } finally {
      setIsSavingRule(false);
    }
  };

  const openTransitionDrawer = (transition) => {
    const from = getStatusLabel(transition, "from");
    const to = getStatusLabel(transition, "to");
    setDrawerItem({
      type: "transition",
      title: transition.displayName || formatLabel(transition.actionKey),
      data: transition,
      details: {
        "Action": `${transition.displayName || formatLabel(transition.actionKey)} / ${transition.actionKey || "UNKNOWN"}`,
        "From Status": `${from.label} / ${from.key || "UNKNOWN"}`,
        "To Status": `${to.label} / ${to.key || "UNKNOWN"}`,
        "Active": transition.active ? "Active" : "Inactive",
        "System": transition.systemTransition ? "System" : "Custom",
        "Protected": transition.protectedTransition ? "Protected" : "Read-only",
        "Sort Order": transition.sortOrder ?? "Not set",
        "Created": formatDateTime(transition.createdAt),
        "Updated": formatDateTime(transition.updatedAt),
      },
    });
  };

  const openStatusDrawer = (status) => {
    setDrawerItem({
      type: "status",
      title: status.displayName || formatLabel(status.statusKey),
      data: status,
      details: {
        "Status": `${status.displayName || formatLabel(status.statusKey)} / ${status.statusKey || "UNKNOWN"}`,
        "Behavior Bucket": status.behaviorBucket ? formatLabel(status.behaviorBucket) : "Not set",
        "Terminal": status.terminal ? "Terminal" : "Non-terminal",
        "Active": status.active ? "Active" : "Inactive",
        "System": status.systemStatus ? "System" : "Custom",
        "Protected": status.protectedStatus ? "Protected" : "Read-only",
        "Sort Order": status.sortOrder ?? "Not set",
        "Created": formatDateTime(status.createdAt),
        "Updated": formatDateTime(status.updatedAt),
      },
    });
  };

  const openActionDrawer = (action) => {
    setDrawerItem({
      type: "action",
      title: action.displayName || formatLabel(action.actionKey),
      data: action,
      details: {
        "Action": `${action.displayName || formatLabel(action.actionKey)} / ${action.actionKey || "UNKNOWN"}`,
        "Button Label": action.buttonLabel || "Not available",
        "Description": action.description || "Not available",
        "Active": action.active ? "Active" : "Inactive",
        "System": action.systemAction ? "System" : "Custom",
        "Protected": action.protectedAction ? "Protected" : "Read-only",
        "Requires Comment": action.requiresComment ? "Yes" : "No",
        "Confirmation Required": action.confirmationRequired ? "Yes" : "No",
        "Sort Order": action.sortOrder ?? "Not set",
        "Created": formatDateTime(action.createdAt),
        "Updated": formatDateTime(action.updatedAt),
      },
    });
  };

  const issueRows = validationResult
    ? (validationResult.blockingIssues?.length || validationResult.warnings?.length)
      ? [...(validationResult.blockingIssues || []), ...(validationResult.warnings || [])]
      : validationResult.issues || []
    : [];

  return (
    <main id="main-content" className="min-h-screen bg-gray-50 px-4 py-5 sm:px-6 lg:px-8">
      <div className="mx-auto w-full max-w-[92rem]">
        <button type="button" onClick={() => navigate("/employee-dashboard")} className="inline-flex items-center gap-2 text-sm font-bold text-blue-950">
          <ArrowLeft size={17} aria-hidden="true" /> Dashboard
        </button>

        <header className="mt-4 border-b border-slate-200 pb-4">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <p className="text-xs font-extrabold uppercase text-slate-500">Administration</p>
              <h1 className="mt-1 text-2xl font-extrabold text-blue-950 sm:text-3xl">Workflow Management</h1>
            </div>
            <button
              type="button"
              onClick={refreshData}
              disabled={isLoading}
              className="inline-flex min-h-10 items-center justify-center gap-2 rounded-lg border border-blue-950 px-4 py-2 text-sm font-bold text-blue-950 hover:bg-blue-50 disabled:opacity-60 lg:self-center"
            >
              <RefreshCw size={16} aria-hidden="true" />
              {isLoading ? "Refreshing..." : "Refresh"}
            </button>
          </div>
        </header>

        {error && <p className="mt-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">{error}</p>}
        {statusMessage && <p className="mt-4 rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm font-semibold text-green-700">{statusMessage}</p>}

        <section className="mt-4" aria-label="Workflow summary">
          <div className="flex flex-wrap gap-2">
            <Badge tone="blue">Category: {selectedCategory?.displayName || "Select category"}</Badge>
            <Badge tone="slate">Key: {selectedCategory?.categoryKey || "Not selected"}</Badge>
            <Badge tone="blue">Mode: {categoryWorkflowConfig?.workflowMode || "Not loaded"}</Badge>
            <StateBadge enabled={Boolean(categoryWorkflowConfig?.dbWorkflowEnabled)} trueLabel="DB workflow enabled" falseLabel="DB workflow disabled" />
            <StateBadge enabled={Boolean(categoryWorkflowConfig?.fixedActionsEnabled)} trueLabel="Fixed actions enabled" falseLabel="Fixed actions disabled" />
            <Badge tone={validationStatus === "Ready" ? "green" : validationStatus === "Not Ready" ? "red" : "yellow"}>Validation: {validationStatus}</Badge>
            <Badge tone="green">Active transitions: {activeTransitions.length}</Badge>
            <Badge tone="blue">Roles enabled: {enabledRoleCount}</Badge>
          </div>
        </section>

        <section className="mt-4 flex flex-col gap-3 border-y border-slate-200 bg-white px-3 py-3 lg:flex-row lg:items-center lg:justify-between" aria-label="Workflow controls">
          <label className="flex min-w-0 flex-1 flex-col gap-1 text-sm font-bold text-slate-700 lg:max-w-md">
            Category selector
            <select
              value={selectedCategoryId}
              onChange={(event) => setSelectedCategoryId(event.target.value)}
              className="min-h-10 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-blue-950 outline-none focus:border-blue-950"
            >
              {categories.length === 0 && <option value="">No categories available</option>}
              {categories.map((category) => (
                <option key={category.id} value={category.id}>
                  {category.displayName || formatLabel(category.categoryKey)} / {category.categoryKey}
                </option>
              ))}
            </select>
          </label>
          <div className="flex items-center gap-2 text-sm font-semibold text-slate-600">
            <Search size={16} aria-hidden="true" />
            {isLoadingCategory ? "Loading category config..." : "Rule changes apply only to the selected category"}
          </div>
        </section>

        <nav className="mt-4 overflow-x-auto border-b border-slate-200" aria-label="Workflow tabs">
          <div className="flex min-w-max gap-1">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                className={`border-b-2 px-4 py-3 text-sm font-extrabold ${
                  activeTab === tab.id
                    ? "border-blue-950 text-blue-950"
                    : "border-transparent text-slate-500 hover:text-blue-950"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </nav>

        <section className="mt-4">
          {activeTab === "overview" && (
            <TableShell minWidth="min-w-[760px]">
              <thead>
                <tr>
                  <HeaderCell>Area</HeaderCell>
                  <HeaderCell>Value</HeaderCell>
                  <HeaderCell>Status</HeaderCell>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <BodyCell><span className="font-bold text-blue-950">Selected category</span></BodyCell>
                  <BodyCell><BusinessKeyLabel label={selectedCategory?.displayName} technicalKey={selectedCategory?.categoryKey} subtle /></BodyCell>
                  <BodyCell><StateBadge enabled={Boolean(selectedCategory?.active)} trueLabel="Active" falseLabel="Inactive" /></BodyCell>
                </tr>
                <tr>
                  <BodyCell><span className="font-bold text-blue-950">Workflow config</span></BodyCell>
                  <BodyCell>{categoryWorkflowConfig?.workflowMode || "Not available"}</BodyCell>
                  <BodyCell>
                    <div className="flex flex-wrap gap-2">
                      <StateBadge enabled={Boolean(categoryWorkflowConfig?.dbWorkflowEnabled)} trueLabel="DB workflow enabled" falseLabel="DB workflow disabled" />
                      <StateBadge enabled={Boolean(categoryWorkflowConfig?.fixedActionsEnabled)} trueLabel="Fixed enabled" falseLabel="Fixed disabled" />
                    </div>
                  </BodyCell>
                </tr>
                <tr>
                  <BodyCell><span className="font-bold text-blue-950">Transitions</span></BodyCell>
                  <BodyCell>{transitions.length} total, {activeTransitions.length} active</BodyCell>
                  <BodyCell><Badge tone="blue">Rule management</Badge></BodyCell>
                </tr>
                <tr>
                  <BodyCell><span className="font-bold text-blue-950">Statuses</span></BodyCell>
                  <BodyCell>{statuses.length} status records</BodyCell>
                  <BodyCell><Badge tone="blue">Read-only</Badge></BodyCell>
                </tr>
                <tr>
                  <BodyCell><span className="font-bold text-blue-950">Actions</span></BodyCell>
                  <BodyCell>{actions.length} action records</BodyCell>
                  <BodyCell><Badge tone="blue">Read-only</Badge></BodyCell>
                </tr>
                <tr>
                  <BodyCell><span className="font-bold text-blue-950">Validation</span></BodyCell>
                  <BodyCell>{validationStatus}</BodyCell>
                  <BodyCell><Badge tone={validationStatus === "Ready" ? "green" : validationStatus === "Not Ready" ? "red" : "yellow"}>{validationStatus}</Badge></BodyCell>
                </tr>
              </tbody>
            </TableShell>
          )}

          {activeTab === "transitions" && (
            <TableShell>
              <thead>
                <tr>
                  <HeaderCell>From Status</HeaderCell>
                  <HeaderCell>Action</HeaderCell>
                  <HeaderCell>To Status</HeaderCell>
                  <HeaderCell>Category Rule</HeaderCell>
                  <HeaderCell>Roles Enabled</HeaderCell>
                  <HeaderCell>Active</HeaderCell>
                  <HeaderCell>Protected/System</HeaderCell>
                </tr>
              </thead>
              <tbody>
                {isLoading && <EmptyRows colSpan={7}>Loading workflow transitions...</EmptyRows>}
                {!isLoading && transitions.length === 0 && <EmptyRows colSpan={7}>No workflow transitions found.</EmptyRows>}
                {!isLoading && transitions.map((transition) => {
                  const from = getStatusLabel(transition, "from");
                  const to = getStatusLabel(transition, "to");
                  const categoryState = getCategoryRuleState(transition.id, selectedCategoryId, categoryRulesByTransitionId);
                  const roleRules = roleRulesByTransitionId[transition.id] || [];
                  const activeRoleRules = roleRules.filter((rule) => rule.active);

                  return (
                    <tr key={transition.id} onClick={() => openTransitionDrawer(transition)} className="cursor-pointer hover:bg-blue-50/50">
                      <BodyCell><BusinessKeyLabel label={from.label} technicalKey={from.key} subtle /></BodyCell>
                      <BodyCell><BusinessKeyLabel label={transition.displayName || actionByKey[transition.actionKey]?.displayName} technicalKey={transition.actionKey} /></BodyCell>
                      <BodyCell><BusinessKeyLabel label={to.label} technicalKey={to.key} subtle /></BodyCell>
                      <BodyCell><Badge tone={categoryState.tone}>{categoryState.label}</Badge></BodyCell>
                      <BodyCell>{roleRules.length === 0 ? <Badge tone="green">All roles</Badge> : <Badge tone="yellow">{activeRoleRules.length}/{roleRules.length} scoped</Badge>}</BodyCell>
                      <BodyCell><StateBadge enabled={transition.active} trueLabel="Active" falseLabel="Inactive" /></BodyCell>
                      <BodyCell>
                        <div className="flex flex-wrap gap-1.5">
                          <Badge tone={transition.protectedTransition ? "yellow" : "slate"}>{transition.protectedTransition ? "Protected" : "Not protected"}</Badge>
                          <Badge tone={transition.systemTransition ? "blue" : "slate"}>{transition.systemTransition ? "System" : "Custom"}</Badge>
                        </div>
                      </BodyCell>
                    </tr>
                  );
                })}
              </tbody>
            </TableShell>
          )}

          {activeTab === "statuses" && (
            <TableShell minWidth="min-w-[860px]">
              <thead>
                <tr>
                  <HeaderCell>Display Name</HeaderCell>
                  <HeaderCell>Status Key</HeaderCell>
                  <HeaderCell>Behavior Bucket</HeaderCell>
                  <HeaderCell>Terminal</HeaderCell>
                  <HeaderCell>Active</HeaderCell>
                  <HeaderCell>System/Protected</HeaderCell>
                  <HeaderCell>Sort Order</HeaderCell>
                </tr>
              </thead>
              <tbody>
                {isLoading && <EmptyRows colSpan={7}>Loading workflow statuses...</EmptyRows>}
                {!isLoading && statuses.length === 0 && <EmptyRows colSpan={7}>No workflow statuses found.</EmptyRows>}
                {!isLoading && statuses.map((status) => (
                  <tr key={status.id ?? status.statusKey} onClick={() => openStatusDrawer(status)} className="cursor-pointer hover:bg-blue-50/50">
                    <BodyCell><span className="font-bold text-blue-950">{status.displayName || formatLabel(status.statusKey)}</span></BodyCell>
                    <BodyCell><span className="break-all text-xs font-extrabold uppercase text-slate-600">{status.statusKey || "UNKNOWN"}</span></BodyCell>
                    <BodyCell>{status.behaviorBucket ? formatLabel(status.behaviorBucket) : "Not set"}</BodyCell>
                    <BodyCell><Badge tone={status.terminal ? "red" : "slate"}>{status.terminal ? "Terminal" : "Non-terminal"}</Badge></BodyCell>
                    <BodyCell><StateBadge enabled={status.active} trueLabel="Active" falseLabel="Inactive" /></BodyCell>
                    <BodyCell>
                      <div className="flex flex-wrap gap-1.5">
                        <Badge tone={status.systemStatus ? "blue" : "slate"}>{status.systemStatus ? "System" : "Custom"}</Badge>
                        <Badge tone={status.protectedStatus ? "yellow" : "slate"}>{status.protectedStatus ? "Protected" : "Read-only"}</Badge>
                      </div>
                    </BodyCell>
                    <BodyCell>{status.sortOrder ?? "Not set"}</BodyCell>
                  </tr>
                ))}
              </tbody>
            </TableShell>
          )}

          {activeTab === "actions" && (
            <TableShell minWidth="min-w-[860px]">
              <thead>
                <tr>
                  <HeaderCell>Display Name</HeaderCell>
                  <HeaderCell>Action Key</HeaderCell>
                  <HeaderCell>Active</HeaderCell>
                  <HeaderCell>System/Protected</HeaderCell>
                  <HeaderCell>Sort Order</HeaderCell>
                  <HeaderCell>Access Key</HeaderCell>
                </tr>
              </thead>
              <tbody>
                {isLoading && <EmptyRows colSpan={6}>Loading workflow actions...</EmptyRows>}
                {!isLoading && actions.length === 0 && <EmptyRows colSpan={6}>No workflow actions found.</EmptyRows>}
                {!isLoading && actions.map((action) => (
                  <tr key={action.id ?? action.actionKey} onClick={() => openActionDrawer(action)} className="cursor-pointer hover:bg-blue-50/50">
                    <BodyCell><BusinessKeyLabel label={action.displayName} technicalKey={action.actionKey} /></BodyCell>
                    <BodyCell><span className="break-all text-xs font-extrabold uppercase text-slate-600">{action.actionKey || "UNKNOWN"}</span></BodyCell>
                    <BodyCell><StateBadge enabled={action.active} trueLabel="Active" falseLabel="Inactive" /></BodyCell>
                    <BodyCell>
                      <div className="flex flex-wrap gap-1.5">
                        <Badge tone={action.systemAction ? "blue" : "slate"}>{action.systemAction ? "System" : "Custom"}</Badge>
                        <Badge tone={action.protectedAction ? "yellow" : "slate"}>{action.protectedAction ? "Protected" : "Read-only"}</Badge>
                      </div>
                    </BodyCell>
                    <BodyCell>{action.sortOrder ?? "Not set"}</BodyCell>
                    <BodyCell><span className="break-all text-xs font-extrabold uppercase text-slate-600">{action.actionKey || "Not available"}</span></BodyCell>
                  </tr>
                ))}
              </tbody>
            </TableShell>
          )}

          {activeTab === "roleAccess" && (
            <div className="space-y-5">
              <div>
                <h2 className="mb-2 text-sm font-extrabold uppercase text-slate-600">role_access_rules</h2>
                <TableShell minWidth="min-w-[900px]">
                  <thead>
                    <tr>
                      <HeaderCell>Action</HeaderCell>
                      {roles.map((role) => <HeaderCell key={role.id}>{role.displayName || role.roleKey}</HeaderCell>)}
                    </tr>
                  </thead>
                  <tbody>
                    {actions.map((action) => (
                      <tr key={action.id ?? action.actionKey}>
                        <BodyCell><BusinessKeyLabel label={action.displayName} technicalKey={action.actionKey} /></BodyCell>
                        {roles.map((role) => (
                          <BodyCell key={role.id}>
                            <ScopeBadge value={actionAccessState(action.actionKey, role, roleAccessByRoleId)} />
                          </BodyCell>
                        ))}
                      </tr>
                    ))}
                    {actions.length === 0 && <EmptyRows colSpan={roles.length + 1}>No workflow actions available for role access matrix.</EmptyRows>}
                  </tbody>
                </TableShell>
              </div>

              <div>
                <h2 className="mb-2 text-sm font-extrabold uppercase text-slate-600">workflow_transition_role_rules</h2>
                <TableShell minWidth="min-w-[1040px]">
                  <thead>
                    <tr>
                      <HeaderCell>Action / Transition</HeaderCell>
                      {roles.map((role) => <HeaderCell key={role.id}>{role.displayName || role.roleKey}</HeaderCell>)}
                    </tr>
                  </thead>
                  <tbody>
                    {transitions.map((transition) => {
                      const from = getStatusLabel(transition, "from");
                      const to = getStatusLabel(transition, "to");
                      return (
                        <tr key={transition.id} onClick={() => openTransitionDrawer(transition)} className="cursor-pointer hover:bg-blue-50/50">
                          <BodyCell>
                            <BusinessKeyLabel label={transition.displayName || actionByKey[transition.actionKey]?.displayName} technicalKey={transition.actionKey} />
                            <span className="mt-1 block text-xs font-semibold text-slate-600">{from.label} to {to.label}</span>
                          </BodyCell>
                          {roles.map((role) => (
                            <BodyCell key={role.id}>
                              <ScopeBadge value={combinedTransitionRoleState(transition, role, roleAccessByRoleId, roleRulesByTransitionId)} />
                            </BodyCell>
                          ))}
                        </tr>
                      );
                    })}
                    {transitions.length === 0 && <EmptyRows colSpan={roles.length + 1}>No workflow transitions available for role rule matrix.</EmptyRows>}
                  </tbody>
                </TableShell>
              </div>
            </div>
          )}

          {activeTab === "validation" && (
            <div className="space-y-4">
              <div className="flex flex-col gap-3 border border-slate-200 bg-white px-4 py-3 lg:flex-row lg:items-center lg:justify-between">
                <div>
                  <h2 className="text-base font-extrabold text-blue-950">Selected Category Validation</h2>
                  <p className="mt-1 text-sm font-semibold text-slate-600">
                    {selectedCategory?.displayName || "No category selected"} / {selectedCategory?.categoryKey || "UNKNOWN"}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => runValidation()}
                  disabled={!selectedCategoryId || isValidating}
                  className="inline-flex min-h-10 items-center justify-center gap-2 rounded-lg bg-blue-950 px-4 py-2 text-sm font-bold text-white hover:bg-blue-900 disabled:opacity-60"
                >
                  <RefreshCw size={16} aria-hidden="true" />
                  {isValidating ? "Validating..." : "Run Validation"}
                </button>
              </div>

              <TableShell minWidth="min-w-[820px]">
                <thead>
                  <tr>
                    <HeaderCell>Result</HeaderCell>
                    <HeaderCell>Code</HeaderCell>
                    <HeaderCell>Message</HeaderCell>
                    <HeaderCell>Transition</HeaderCell>
                  </tr>
                </thead>
                <tbody>
                  {!validationResult && <EmptyRows colSpan={4}>Validation has not been run for the selected category.</EmptyRows>}
                  {validationResult && (
                    <tr>
                      <BodyCell>
                        <span className="inline-flex items-center gap-2 font-bold text-blue-950">
                          {(validationResult.readyToActivate || validationResult.valid) ? <CheckCircle2 size={17} className="text-green-600" aria-hidden="true" /> : <XCircle size={17} className="text-red-600" aria-hidden="true" />}
                          {(validationResult.readyToActivate || validationResult.valid) ? "Ready" : "Not Ready"}
                        </span>
                      </BodyCell>
                      <BodyCell>SUMMARY</BodyCell>
                      <BodyCell>
                        Blocking issues: {(validationResult.blockingIssues || []).length}; Warnings: {(validationResult.warnings || []).length}
                      </BodyCell>
                      <BodyCell>All</BodyCell>
                    </tr>
                  )}
                  {issueRows.map((issue, index) => {
                    const transition = transitions.find((item) => String(item.id) === String(issue.transitionId));
                    return (
                      <tr key={`${issue.code}-${issue.transitionId ?? "none"}-${index}`} className={transition ? "cursor-pointer hover:bg-blue-50/50" : ""} onClick={() => transition && openTransitionDrawer(transition)}>
                        <BodyCell><Badge tone={(validationResult?.warnings || []).some((warning) => warning === issue) ? "yellow" : "red"}>{(validationResult?.warnings || []).some((warning) => warning === issue) ? "Warning" : "Blocking"}</Badge></BodyCell>
                        <BodyCell><span className="break-all text-xs font-extrabold uppercase text-slate-600">{issue.code || "ISSUE"}</span></BodyCell>
                        <BodyCell>{issue.message || "Validation issue found"}</BodyCell>
                        <BodyCell>{issue.transitionId ? `#${issue.transitionId}` : "Not linked"}</BodyCell>
                      </tr>
                    );
                  })}
                </tbody>
              </TableShell>
            </div>
          )}
        </section>
      </div>

      <DetailDrawer
        item={drawerItem}
        onClose={() => setDrawerItem(null)}
        selectedCategory={selectedCategory}
        managedRoles={managedRoles}
        categoryRulesByTransitionId={categoryRulesByTransitionId}
        roleRulesByTransitionId={roleRulesByTransitionId}
        onRequestRuleChange={requestRuleChange}
        isSavingRule={isSavingRule}
      />
      <ConfirmRuleChangeDialog
        pendingChange={pendingRuleChange}
        onCancel={() => setPendingRuleChange(null)}
        onConfirm={confirmRuleChange}
        isSaving={isSavingRule}
      />
    </main>
  );
}
