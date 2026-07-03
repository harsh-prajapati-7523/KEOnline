import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Background,
  Controls,
  Handle,
  MarkerType,
  Position,
  ReactFlow,
} from "@xyflow/react";
import dagre from "dagre";
import "@xyflow/react/dist/style.css";
import {
  CheckCircle2,
  Database,
  Flag,
  Home,
  LayoutDashboard,
  Layers3,
  RefreshCw,
  Users,
  Workflow,
  Zap,
} from "lucide-react";
import { useNavigate } from "react-router-dom";

const tabs = [
  { id: "overview", label: "Overview" },
  { id: "map", label: "Map" },
  { id: "statuses", label: "Statuses" },
  { id: "actions", label: "Actions" },
  { id: "transitions", label: "Transitions" },
  { id: "roleAccess", label: "Role Access" },
  { id: "validation", label: "Validation" },
];

const protectedStatusKeys = ["NEW", "IN_PROGRESS", "COMPLETED", "CANCELLED"];
const protectedActionKeys = ["PICK_TICKET", "START_WORK", "COMPLETE_TICKET", "CANCEL_TICKET"];
const behaviorBucketOptions = ["NEW", "IN_PROGRESS", "COMPLETED", "CANCELLED"];

const emptyStatusForm = {
  statusKey: "",
  displayName: "",
  behaviorBucket: "",
  terminal: false,
  active: true,
  sortOrder: "",
};

const emptyActionForm = {
  actionKey: "",
  displayName: "",
  buttonLabel: "",
  description: "",
  active: true,
  sortOrder: "",
  requiresComment: false,
  confirmationRequired: false,
};

const emptyTransitionForm = {
  fromStatusId: "",
  actionKey: "",
  toStatusId: "",
  displayName: "",
  active: true,
  enableForSelectedCategory: true,
  sortOrder: "",
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

function normalizeRulesByTransitionId(data) {
  const rulesByTransitionId = data?.rulesByTransitionId || {};
  return Object.fromEntries(
    Object.entries(rulesByTransitionId).map(([transitionId, rules]) => [
      transitionId,
      Array.isArray(rules) ? rules : [],
    ])
  );
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

function isProtectedStatus(status) {
  return Boolean(status?.systemStatus || status?.protectedStatus || protectedStatusKeys.includes(status?.statusKey));
}

function isProtectedAction(action) {
  return Boolean(action?.systemAction || action?.protectedAction || protectedActionKeys.includes(action?.actionKey));
}

function isProtectedTransition(transition) {
  return Boolean(transition?.systemTransition || transition?.protectedTransition);
}

function getTransitionRuntimeState(transition, selectedCategoryId, categoryRulesByTransitionId, transitionIssueRows = [], actionByKey = {}) {
  const selectedRule = getSelectedCategoryRule(transition, selectedCategoryId, categoryRulesByTransitionId);
  const blockingIssues = transitionIssueRows.filter((row) => !row.warning);
  const warningIssues = transitionIssueRows.filter((row) => row.warning);
  const action = actionByKey[transition?.actionKey];
  const inactiveMetadata = transition?.fromStatusActive === false || transition?.toStatusActive === false || action?.active === false;

  if (!transition?.active || (selectedCategoryId && selectedRule && !selectedRule.active) || (selectedCategoryId && !selectedRule)) {
    return { label: "Inactive", tone: "slate", detail: "Transition metadata or the selected-category rule is inactive." };
  }
  if (blockingIssues.length > 0 || inactiveMetadata) {
    return { label: "Blocked", tone: "red", detail: blockingIssues[0]?.guidance?.fix || "Validation or inactive metadata is blocking this path." };
  }
  if (warningIssues.length > 0) {
    return { label: "Warning", tone: "yellow", detail: warningIssues[0]?.guidance?.fix || "Validation reported a non-blocking warning for this path." };
  }
  return { label: "Executable", tone: "green", detail: "Active path with an active selected-category rule and no validation blocker." };
}

function getTransitionAccessSummary(transition, activeRoles, roleAccessByRoleId, roleRulesByTransitionId) {
  const roleRules = roleRulesByTransitionId[transition?.id] || [];
  const actionAuthorizedCount = activeRoles.filter((role) => actionAccessState(transition?.actionKey, role, roleAccessByRoleId) === "full").length;
  const executableRoleCount = activeRoles.filter((role) => combinedTransitionRoleState(transition, role, roleAccessByRoleId, roleRulesByTransitionId) === "full").length;

  if (activeRoles.length === 0) {
    return { label: "No active roles", detail: "No active role records are loaded for access review.", tone: "red" };
  }
  if (roleRules.length === 0) {
    return {
      label: `${actionAuthorizedCount}/${activeRoles.length} roles`,
      detail: "Open to roles with action permission; no transition-specific restriction is configured.",
      tone: actionAuthorizedCount > 0 ? "green" : "red",
    };
  }

  const activeRuleCount = roleRules.filter((rule) => rule.active).length;
  return {
    label: `${executableRoleCount}/${activeRoles.length} roles`,
    detail: `${activeRuleCount}/${roleRules.length} transition restrictions are active.`,
    tone: executableRoleCount > 0 ? "yellow" : "red",
  };
}

function normalizeKey(value) {
  return String(value || "").trim().toUpperCase().replace(/[^A-Z0-9_]/g, "_");
}

function FormField({ label, children }) {
  return (
    <label className="block text-sm font-bold text-slate-700">
      <span className="mb-1 block">{label}</span>
      {children}
    </label>
  );
}

function textInputClass() {
  return "min-h-10 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-blue-950 outline-none focus:border-blue-950 disabled:bg-slate-100 disabled:text-slate-500";
}

function EntityFormModal({ formState, onCancel, onChange, onSubmit, isSaving, error }) {
  if (!formState) return null;

  const { entityType, mode, values, original } = formState;
  const isStatus = entityType === "status";
  const isCreate = mode === "create";
  const title = isCreate
    ? `Create Global ${isStatus ? "Status" : "Action"} Metadata`
    : `Edit ${isStatus ? "Custom Status" : "Custom Action"}`;

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-950/40 px-4" role="dialog" aria-modal="true" aria-label={title}>
      <form onSubmit={onSubmit} className="max-h-[92vh] w-full max-w-2xl overflow-y-auto rounded-lg border border-slate-200 bg-white shadow-2xl">
        <div className="border-b border-slate-200 px-5 py-4">
          <p className="text-xs font-extrabold uppercase text-slate-500">Workflow Metadata</p>
          <h2 className="mt-1 text-lg font-extrabold text-blue-950">{title}</h2>
        </div>

        <div className="grid gap-4 px-5 py-4 sm:grid-cols-2">
          {error && (
            <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm font-semibold text-red-700 sm:col-span-2" role="alert">
              {error}
            </div>
          )}
          {isStatus ? (
            <>
              <FormField label="Display Name">
                <input className={textInputClass()} value={values.displayName} onChange={(event) => onChange("displayName", event.target.value)} maxLength={80} required />
              </FormField>
              <FormField label="Status Key">
                <input className={textInputClass()} value={values.statusKey} onChange={(event) => onChange("statusKey", normalizeKey(event.target.value))} maxLength={50} disabled={!isCreate} required />
              </FormField>
              <FormField label="Behavior Bucket">
                <select className={textInputClass()} value={values.behaviorBucket} onChange={(event) => onChange("behaviorBucket", event.target.value)}>
                  <option value="">Not set</option>
                  {behaviorBucketOptions.map((bucket) => (
                    <option key={bucket} value={bucket}>{formatLabel(bucket)}</option>
                  ))}
                </select>
              </FormField>
              <FormField label="Sort Order">
                <input className={textInputClass()} type="number" value={values.sortOrder} onChange={(event) => onChange("sortOrder", event.target.value)} />
              </FormField>
              <label className="flex min-h-10 items-center gap-2 text-sm font-bold text-slate-700">
                <input type="checkbox" checked={values.terminal} onChange={(event) => onChange("terminal", event.target.checked)} />
                Terminal status
              </label>
              {isCreate && (
                <label className="flex min-h-10 items-center gap-2 text-sm font-bold text-slate-700">
                  <input type="checkbox" checked={values.active} onChange={(event) => onChange("active", event.target.checked)} />
                  Active on create
                </label>
              )}
            </>
          ) : (
            <>
              <FormField label="Display Name">
                <input className={textInputClass()} value={values.displayName} onChange={(event) => onChange("displayName", event.target.value)} maxLength={80} required />
              </FormField>
              <FormField label="Action Key / Access Key">
                <input className={textInputClass()} value={values.actionKey} onChange={(event) => onChange("actionKey", normalizeKey(event.target.value))} maxLength={60} disabled={!isCreate} required />
              </FormField>
              <FormField label="Button Label">
                <input className={textInputClass()} value={values.buttonLabel} onChange={(event) => onChange("buttonLabel", event.target.value)} maxLength={80} />
              </FormField>
              <FormField label="Sort Order">
                <input className={textInputClass()} type="number" value={values.sortOrder} onChange={(event) => onChange("sortOrder", event.target.value)} />
              </FormField>
              <FormField label="Description">
                <textarea className={`${textInputClass()} min-h-24 sm:col-span-2`} value={values.description} onChange={(event) => onChange("description", event.target.value)} maxLength={255} />
              </FormField>
              <label className="flex min-h-10 items-center gap-2 text-sm font-bold text-slate-700">
                <input type="checkbox" checked={values.requiresComment} onChange={(event) => onChange("requiresComment", event.target.checked)} />
                Requires comment
              </label>
              <label className="flex min-h-10 items-center gap-2 text-sm font-bold text-slate-700">
                <input type="checkbox" checked={values.confirmationRequired} onChange={(event) => onChange("confirmationRequired", event.target.checked)} />
                Confirmation required
              </label>
              {isCreate && (
                <label className="flex min-h-10 items-center gap-2 text-sm font-bold text-slate-700">
                  <input type="checkbox" checked={values.active} onChange={(event) => onChange("active", event.target.checked)} />
                  Active on create
                </label>
              )}
              <div className="rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 text-xs font-semibold text-blue-950 sm:col-span-2">
                Action key is the access key. Creating this action does not grant role access automatically.
              </div>
            </>
          )}
          {!isCreate && original && (
            <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-semibold text-slate-600 sm:col-span-2">
              Immutable key locked after create: {isStatus ? original.statusKey : original.actionKey}
            </div>
          )}
        </div>

        <div className="flex flex-col gap-2 border-t border-slate-200 px-5 py-4 sm:flex-row sm:justify-end">
          <button type="button" onClick={onCancel} disabled={isSaving} className="inline-flex min-h-10 items-center justify-center rounded-lg border border-slate-300 px-4 py-2 text-sm font-bold text-slate-700 hover:bg-slate-50 disabled:opacity-60">
            Cancel
          </button>
          <button type="submit" disabled={isSaving} className="inline-flex min-h-10 items-center justify-center rounded-lg bg-blue-950 px-4 py-2 text-sm font-bold text-white hover:bg-blue-900 disabled:opacity-60">
            {isSaving ? "Saving..." : "Save"}
          </button>
        </div>
      </form>
    </div>
  );
}

function TransitionFormModal({ formState, statuses, actions, selectedCategory, onCancel, onChange, onSubmit, isSaving, error }) {
  if (!formState) return null;

  const { mode, values, original } = formState;
  const isCreate = mode === "create";
  const activeStatuses = statuses.filter((status) => status.active);
  const activeCustomActions = actions.filter((action) => action.active && !isProtectedAction(action));

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-950/40 px-4" role="dialog" aria-modal="true" aria-label={`${isCreate ? "Create" : "Edit"} workflow transition`}>
      <form onSubmit={onSubmit} className="max-h-[92vh] w-full max-w-2xl overflow-y-auto rounded-lg border border-slate-200 bg-white shadow-2xl">
        <div className="border-b border-slate-200 px-5 py-4">
          <p className="text-xs font-extrabold uppercase text-slate-500">Workflow Transition</p>
          <h2 className="mt-1 text-lg font-extrabold text-blue-950">{isCreate ? "Create Custom Transition" : "Edit Transition Metadata"}</h2>
        </div>

        {error && (
          <div className="mx-5 mt-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm font-bold text-red-800">
            {error}
          </div>
        )}

        <div className="grid gap-4 px-5 py-4 sm:grid-cols-2">
          {isCreate ? (
            <>
              <FormField label="From Status">
                <select className={textInputClass()} value={values.fromStatusId} onChange={(event) => onChange("fromStatusId", event.target.value)} required>
                  <option value="">Select source status</option>
                  {activeStatuses.map((status) => (
                    <option key={status.id} value={status.id}>{status.displayName || formatLabel(status.statusKey)} / {status.statusKey}</option>
                  ))}
                </select>
              </FormField>
              <FormField label="Action">
                <select className={textInputClass()} value={values.actionKey} onChange={(event) => onChange("actionKey", event.target.value)} required>
                  <option value="">Select custom action</option>
                  {activeCustomActions.map((action) => (
                    <option key={action.id ?? action.actionKey} value={action.actionKey}>{action.displayName || formatLabel(action.actionKey)} / {action.actionKey}</option>
                  ))}
                </select>
              </FormField>
              <FormField label="To Status">
                <select className={textInputClass()} value={values.toStatusId} onChange={(event) => onChange("toStatusId", event.target.value)} required>
                  <option value="">Select target status</option>
                  {activeStatuses.map((status) => (
                    <option key={status.id} value={status.id}>{status.displayName || formatLabel(status.statusKey)} / {status.statusKey}</option>
                  ))}
                </select>
              </FormField>
            </>
          ) : (
            <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-3 text-xs font-semibold text-slate-600 sm:col-span-2">
              <BusinessKeyLabel label={original?.displayName || formatLabel(original?.actionKey)} technicalKey={original?.actionKey} subtle />
              <p className="mt-2">From Status, Action, and To Status are create-only to avoid breaking configured workflow paths.</p>
            </div>
          )}

          {!isCreate && (
            <FormField label="Display Name">
              <input className={textInputClass()} value={values.displayName} onChange={(event) => onChange("displayName", event.target.value)} maxLength={80} required />
            </FormField>
          )}
          <FormField label="Sort Order">
            <input className={textInputClass()} type="number" value={values.sortOrder} onChange={(event) => onChange("sortOrder", event.target.value)} />
          </FormField>
          {isCreate && (
            <label className="flex min-h-10 items-center gap-2 text-sm font-bold text-slate-700">
              <input type="checkbox" checked={values.active} onChange={(event) => onChange("active", event.target.checked)} />
              Active on create
            </label>
          )}
          {isCreate && selectedCategory?.id && (
            <label className="flex min-h-10 items-center gap-2 text-sm font-bold text-slate-700 sm:col-span-2">
              <input type="checkbox" checked={values.enableForSelectedCategory} onChange={(event) => onChange("enableForSelectedCategory", event.target.checked)} />
              Enable for {selectedCategory.displayName || formatLabel(selectedCategory.categoryKey)}
            </label>
          )}
          <div className="rounded-lg border border-yellow-200 bg-yellow-50 px-3 py-2 text-xs font-semibold text-yellow-800 sm:col-span-2">
            Category use is controlled by the category rule. Role access is still configured separately after creation.
          </div>
        </div>

        <div className="flex flex-col gap-2 border-t border-slate-200 px-5 py-4 sm:flex-row sm:justify-end">
          <button type="button" onClick={onCancel} disabled={isSaving} className="inline-flex min-h-10 items-center justify-center rounded-lg border border-slate-300 px-4 py-2 text-sm font-bold text-slate-700 hover:bg-slate-50 disabled:opacity-60">
            Cancel
          </button>
          <button type="submit" disabled={isSaving} className="inline-flex min-h-10 items-center justify-center rounded-lg bg-blue-950 px-4 py-2 text-sm font-bold text-white hover:bg-blue-900 disabled:opacity-60">
            {isSaving ? "Saving..." : "Save"}
          </button>
        </div>
      </form>
    </div>
  );
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

function ConfirmMetadataChangeDialog({ pendingChange, onCancel, onConfirm, isSaving }) {
  if (!pendingChange) return null;

  const isStatus = pendingChange.entityType === "status";
  const isState = pendingChange.kind === "state";
  const key = isStatus ? pendingChange.item?.statusKey : pendingChange.item?.actionKey;
  const label = pendingChange.item?.displayName || formatLabel(key);
  const actionText = isState
    ? pendingChange.nextActive ? "Enable" : "Disable"
    : pendingChange.mode === "create" ? "Create" : "Save";

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-slate-950/40 px-4" role="dialog" aria-modal="true" aria-label="Confirm workflow metadata change">
      <div className="w-full max-w-lg rounded-lg border border-slate-200 bg-white shadow-2xl">
        <div className="border-b border-slate-200 px-5 py-4">
          <p className="text-xs font-extrabold uppercase text-slate-500">Strong Confirmation</p>
          <h2 className="mt-1 text-lg font-extrabold text-blue-950">
            {actionText} {isStatus ? "workflow status" : "workflow action"}
          </h2>
        </div>
        <div className="space-y-3 px-5 py-4 text-sm font-semibold text-slate-700">
          <BusinessKeyLabel label={label} technicalKey={key} subtle />
          {isStatus ? (
            <p>This may affect transitions that use this status. Validation will run after the change.</p>
          ) : (
            <p>This may affect transitions that use this action. This does not grant or remove role access automatically. Validation will run after the change.</p>
          )}
          {pendingChange.reason && (
            <div className="rounded-lg border border-yellow-200 bg-yellow-50 px-3 py-2 text-xs font-bold text-yellow-800">
              {pendingChange.reason}
            </div>
          )}
        </div>
        <div className="flex flex-col gap-2 border-t border-slate-200 px-5 py-4 sm:flex-row sm:justify-end">
          <button type="button" onClick={onCancel} disabled={isSaving} className="inline-flex min-h-10 items-center justify-center rounded-lg border border-slate-300 px-4 py-2 text-sm font-bold text-slate-700 hover:bg-slate-50 disabled:opacity-60">
            Cancel
          </button>
          <button type="button" onClick={onConfirm} disabled={isSaving} className="inline-flex min-h-10 items-center justify-center rounded-lg bg-blue-950 px-4 py-2 text-sm font-bold text-white hover:bg-blue-900 disabled:opacity-60">
            {isSaving ? "Saving..." : "Confirm"}
          </button>
        </div>
      </div>
    </div>
  );
}

function ConfirmTransitionChangeDialog({ pendingChange, onCancel, onConfirm, isSaving }) {
  if (!pendingChange) return null;

  const isState = pendingChange.kind === "state";
  const actionText = isState
    ? pendingChange.nextActive ? "Enable" : "Disable"
    : pendingChange.mode === "create" ? "Create" : "Save";

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-slate-950/40 px-4" role="dialog" aria-modal="true" aria-label="Confirm workflow transition change">
      <div className="w-full max-w-lg rounded-lg border border-slate-200 bg-white shadow-2xl">
        <div className="border-b border-slate-200 px-5 py-4">
          <p className="text-xs font-extrabold uppercase text-slate-500">Confirm Transition Change</p>
          <h2 className="mt-1 text-lg font-extrabold text-blue-950">{actionText} workflow transition</h2>
        </div>
        <div className="space-y-3 px-5 py-4 text-sm font-semibold text-slate-700">
          <BusinessKeyLabel label={pendingChange.item?.displayName || formatLabel(pendingChange.item?.actionKey)} technicalKey={pendingChange.item?.actionKey} subtle />
          {isState && pendingChange.nextActive && (
            <p>Backend may reject this if another active transition already uses the same source status and action. Validation will run after the change.</p>
          )}
          {isState && !pendingChange.nextActive && (
            <p>This may remove an available workflow path for the selected category. Validation will run after the change.</p>
          )}
          {!isState && (
            <p>Validation will run after the transition metadata change.</p>
          )}
          {pendingChange.reason && (
            <div className="rounded-lg border border-yellow-200 bg-yellow-50 px-3 py-2 text-xs font-bold text-yellow-800">
              {pendingChange.reason}
            </div>
          )}
        </div>
        <div className="flex flex-col gap-2 border-t border-slate-200 px-5 py-4 sm:flex-row sm:justify-end">
          <button type="button" onClick={onCancel} disabled={isSaving} className="inline-flex min-h-10 items-center justify-center rounded-lg border border-slate-300 px-4 py-2 text-sm font-bold text-slate-700 hover:bg-slate-50 disabled:opacity-60">
            Cancel
          </button>
          <button type="button" onClick={onConfirm} disabled={isSaving} className="inline-flex min-h-10 items-center justify-center rounded-lg bg-blue-950 px-4 py-2 text-sm font-bold text-white hover:bg-blue-900 disabled:opacity-60">
            {isSaving ? "Saving..." : "Confirm"}
          </button>
        </div>
      </div>
    </div>
  );
}

function ConfirmWorkflowModeChangeDialog({ pendingChange, onCancel, onConfirm, isSaving }) {
  if (!pendingChange) return null;

  const isActivation = pendingChange.targetConfig.workflowMode === "DB_CONFIGURED";
  const category = pendingChange.category;
  const currentConfig = pendingChange.currentConfig;
  const targetConfig = pendingChange.targetConfig;

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-slate-950/40 px-4" role="dialog" aria-modal="true" aria-label="Confirm category workflow mode change">
      <div className="w-full max-w-xl rounded-lg border border-slate-200 bg-white shadow-2xl">
        <div className="border-b border-slate-200 px-5 py-4">
          <p className="text-xs font-extrabold uppercase text-slate-500">Strong Confirmation</p>
          <h2 className="mt-1 text-lg font-extrabold text-blue-950">
            {isActivation ? "Activate DB Configured Workflow" : "Rollback to Legacy Fixed Workflow"}
          </h2>
        </div>
        <div className="space-y-3 px-5 py-4 text-sm font-semibold text-slate-700">
          <BusinessKeyLabel label={category?.displayName} technicalKey={category?.categoryKey} subtle />
          <div className="grid gap-2 sm:grid-cols-2">
            <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
              <p className="text-xs font-extrabold uppercase text-slate-500">Current Mode</p>
              <p className="mt-1 text-blue-950">{currentConfig?.workflowMode || "Not loaded"}</p>
              <p className="mt-1 text-xs text-slate-600">DB: {currentConfig?.dbWorkflowEnabled ? "Enabled" : "Disabled"} / Fixed: {currentConfig?.fixedActionsEnabled ? "Enabled" : "Disabled"}</p>
            </div>
            <div className="rounded-lg border border-blue-200 bg-blue-50 px-3 py-2">
              <p className="text-xs font-extrabold uppercase text-blue-950">Target Mode</p>
              <p className="mt-1 text-blue-950">{targetConfig.workflowMode}</p>
              <p className="mt-1 text-xs text-blue-950">DB: {targetConfig.dbWorkflowEnabled ? "Enabled" : "Disabled"} / Fixed: {targetConfig.fixedActionsEnabled ? "Enabled" : "Disabled"}</p>
            </div>
          </div>
          {isActivation ? (
            <p>Only the selected category changes. Normal categories are not affected. Validation will run again after activation.</p>
          ) : (
            <p>Rollback only affects the selected category. Workflow metadata, transitions, rules, statuses, actions, workflow history, and ticket data are preserved.</p>
          )}
        </div>
        <div className="flex flex-col gap-2 border-t border-slate-200 px-5 py-4 sm:flex-row sm:justify-end">
          <button type="button" onClick={onCancel} disabled={isSaving} className="inline-flex min-h-10 items-center justify-center rounded-lg border border-slate-300 px-4 py-2 text-sm font-bold text-slate-700 hover:bg-slate-50 disabled:opacity-60">
            Cancel
          </button>
          <button type="button" onClick={onConfirm} disabled={isSaving} className="inline-flex min-h-10 items-center justify-center rounded-lg bg-blue-950 px-4 py-2 text-sm font-bold text-white hover:bg-blue-900 disabled:opacity-60">
            {isSaving ? "Saving..." : "Confirm"}
          </button>
        </div>
      </div>
    </div>
  );
}

function statusSearchText(status) {
  return `${status?.statusKey || ""} ${status?.displayName || ""}`.toUpperCase();
}

function matchesStatus(status, terms) {
  const text = statusSearchText(status);
  return terms.some((term) => text.includes(term));
}

function findStatusByPriority(statuses, priorities) {
  for (const priority of priorities) {
    const exact = statuses.find((status) => String(status.statusKey || "").toUpperCase() === priority);
    if (exact) return exact;
  }

  for (const priority of priorities) {
    const fuzzy = statuses.find((status) => matchesStatus(status, [priority, priority.replaceAll("_", " ")]));
    if (fuzzy) return fuzzy;
  }

  return null;
}

function findTransitionBetween(transitions, fromStatus, toStatus) {
  if (!fromStatus || !toStatus) return null;
  return transitions.find((transition) => String(transition.fromStatusId) === String(fromStatus.id) && String(transition.toStatusId) === String(toStatus.id));
}

function getWorkflowStory(statuses, transitions) {
  const sortedStatuses = [...statuses].sort((first, second) => (first.sortOrder ?? 999) - (second.sortOrder ?? 999) || String(first.statusKey).localeCompare(String(second.statusKey)));
  const statusFor = (priorities) => findStatusByPriority(sortedStatuses, priorities);
  const newStatus = statusFor(["NEW", "CUSTOM_NEW"]);
  const inProgress = statusFor(["IN_PROGRESS", "CUSTOM_IN_PROGRESS"]);
  const repairCompleted = statusFor(["REPAIR_COMPLETED", "READY_FOR_DELIVERY"]) || statusFor(["CUSTOM_DONE"]) || statusFor(["COMPLETED"]);
  const delivered = statusFor(["DELIVERED_TO_CUSTOMER"]) || sortedStatuses.find((status) => status.terminal && matchesStatus(status, ["DELIVERED", "CUSTOMER"])) || repairCompleted;

  const makeNode = (id, label, status, tone = "blue", terminal = false) => ({
    id,
    label,
    status,
    tone,
    terminal,
  });

  const labelFor = (status, fallback) => status?.displayName || fallback;
  const nodes = {
    new: makeNode("new", labelFor(newStatus, "New"), newStatus, "blue"),
    inProgress: makeNode("inProgress", labelFor(inProgress, "In Progress"), inProgress, "blue"),
    repairCompleted: makeNode("repairCompleted", labelFor(repairCompleted, "Repair Completed"), repairCompleted, "green"),
    delivered: makeNode("delivered", labelFor(delivered, "Delivered to Customer"), delivered, "purple", true),
    missingPart: makeNode("missingPart", labelFor(statusFor(["MISSING_PART"]), "Missing Part"), statusFor(["MISSING_PART"]), "blue"),
    partAvailable: makeNode("partAvailable", labelFor(statusFor(["PART_AVAILABLE"]), "Part Available"), statusFor(["PART_AVAILABLE"]), "blue"),
    approvalPending: makeNode("approvalPending", labelFor(statusFor(["CUSTOMER_APPROVAL_PENDING"]), "Customer Approval Pending"), statusFor(["CUSTOMER_APPROVAL_PENDING"]), "orange"),
    customerDeclined: makeNode("customerDeclined", labelFor(statusFor(["CUSTOMER_DECLINED", "CUSTOMER_DECLINED_REPAIR"]), "Customer Declined"), statusFor(["CUSTOMER_DECLINED", "CUSTOMER_DECLINED_REPAIR"]), "orange"),
    cancelledPending: makeNode("cancelledPending", labelFor(statusFor(["CANCELLED_PENDING_DELIVERY"]), "Cancelled Pending Delivery"), statusFor(["CANCELLED_PENDING_DELIVERY"]), "orange"),
    inWarranty: makeNode("inWarranty", labelFor(statusFor(["IN_WARRANTY"]), "In Warranty"), statusFor(["IN_WARRANTY"]), "green"),
    warrantyLogged: makeNode("warrantyLogged", labelFor(statusFor(["WARRANTY_COMPLAINT_LOGGED"]), "Warranty Complaint Logged"), statusFor(["WARRANTY_COMPLAINT_LOGGED"]), "green"),
  };

  const transitionFor = (from, to, fallbackLabel) => {
    const transition = findTransitionBetween(transitions, from?.status, to?.status);
    return {
      id: `${from.id}-${to.id}`,
      from: from.id,
      to: to.id,
      label: transition?.displayName || fallbackLabel,
      transition,
    };
  };

  const groups = [
    {
      id: "main",
      label: "Main Path",
      nodes: [nodes.new, nodes.inProgress, nodes.repairCompleted, nodes.delivered],
      edges: [
        transitionFor(nodes.new, nodes.inProgress, "Start Repair"),
        transitionFor(nodes.inProgress, nodes.repairCompleted, "Mark Repair Completed"),
        transitionFor(nodes.repairCompleted, nodes.delivered, "Deliver To Customer"),
      ],
    },
    {
      id: "missing",
      label: "Missing Part",
      entryLabel: "Mark Missing Part",
      nodes: [nodes.missingPart, nodes.partAvailable, nodes.inProgress],
      edges: [
        transitionFor(nodes.missingPart, nodes.partAvailable, "Mark Part Available"),
        transitionFor(nodes.partAvailable, nodes.inProgress, "Resume Work"),
      ],
      tone: "blue",
    },
    {
      id: "approval",
      label: "Customer Approval",
      entryLabel: "Need Customer Approval",
      nodes: [nodes.approvalPending, nodes.customerDeclined, nodes.cancelledPending, nodes.delivered],
      edges: [
        transitionFor(nodes.approvalPending, nodes.customerDeclined, "Customer Declined Repair"),
        transitionFor(nodes.customerDeclined, nodes.cancelledPending, "Cancel Pending Delivery"),
        transitionFor(nodes.cancelledPending, nodes.delivered, "Deliver To Customer"),
      ],
      tone: "orange",
    },
    {
      id: "warranty",
      label: "Warranty",
      entryLabel: "Mark In Warranty",
      nodes: [nodes.inWarranty, nodes.warrantyLogged, nodes.repairCompleted, nodes.delivered],
      edges: [
        transitionFor(nodes.inWarranty, nodes.warrantyLogged, "Log Warranty Complaint"),
        transitionFor(nodes.warrantyLogged, nodes.repairCompleted, "Mark Repair Completed"),
        transitionFor(nodes.repairCompleted, nodes.delivered, "Deliver To Customer"),
      ],
      tone: "green",
    },
    {
      id: "declined",
      label: "Declined",
      nodes: [nodes.approvalPending, nodes.customerDeclined, nodes.cancelledPending, nodes.delivered],
      edges: [
        transitionFor(nodes.approvalPending, nodes.customerDeclined, "Customer Declined Repair"),
        transitionFor(nodes.customerDeclined, nodes.cancelledPending, "Cancel Pending Delivery"),
        transitionFor(nodes.cancelledPending, nodes.delivered, "Deliver To Customer"),
      ],
      tone: "orange",
    },
  ];

  return { nodes, groups };
}

function getGenericWorkflowStory(statuses, transitions, actionByKey = {}) {
  const statusMap = new Map();
  statuses.forEach((status) => {
    if (status?.id != null) statusMap.set(String(status.id), status);
  });

  const statusFromTransition = (transition, direction) => {
    const id = direction === "from" ? transition.fromStatusId : transition.toStatusId;
    const existing = statusMap.get(String(id));
    if (existing) return existing;
    return {
      id,
      statusKey: direction === "from" ? transition.fromStatusKey || transition.fromStatus : transition.toStatusKey || transition.toStatus,
      displayName: direction === "from"
        ? transition.fromStatusDisplayName || formatLabel(transition.fromStatusKey || transition.fromStatus)
        : transition.toStatusDisplayName || formatLabel(transition.toStatusKey || transition.toStatus),
      terminal: direction === "to" ? Boolean(transition.toStatusTerminal) : Boolean(transition.fromStatusTerminal),
    };
  };

  const nodeFromStatus = (status, suffix) => ({
    id: `generic-${status.id ?? status.statusKey}-${suffix}`,
    label: status.displayName || formatLabel(status.statusKey),
    status,
    tone: status.terminal ? "purple" : String(status.statusKey || "").toUpperCase().includes("CANCEL") ? "orange" : "blue",
    terminal: Boolean(status.terminal),
  });

  return {
    groups: [...transitions]
      .sort((first, second) => (first.sortOrder ?? 999) - (second.sortOrder ?? 999) || (first.id ?? 0) - (second.id ?? 0))
      .map((transition) => {
        const fromStatus = statusFromTransition(transition, "from");
        const toStatus = statusFromTransition(transition, "to");
        const edge = {
          id: `generic-edge-${transition.id ?? `${transition.fromStatusId}-${transition.actionKey}-${transition.toStatusId}`}`,
          from: String(transition.fromStatusId),
          to: String(transition.toStatusId),
          label: transition.displayName || actionByKey[transition.actionKey]?.displayName || formatLabel(transition.actionKey),
          transition,
        };
        return {
          id: `configured-transition-${transition.id}`,
          label: `Path ${transition.sortOrder ?? transition.id ?? ""}`.trim(),
          nodes: [
            nodeFromStatus(fromStatus, `from-${transition.id}`),
            nodeFromStatus(toStatus, `to-${transition.id}`),
          ],
          edges: [edge],
          tone: String(toStatus.statusKey || "").toUpperCase().includes("CANCEL") ? "orange" : toStatus.terminal ? "green" : "blue",
        };
      }),
  };
}

function statusMatchesTransition(status, transition) {
  if (!status || !transition) return false;
  const statusId = String(status.id);
  const statusKey = String(status.statusKey || "").toUpperCase();
  return String(transition.fromStatusId) === statusId
    || String(transition.toStatusId) === statusId
    || String(transition.fromStatusKey || transition.fromStatus || "").toUpperCase() === statusKey
    || String(transition.toStatusKey || transition.toStatus || "").toUpperCase() === statusKey;
}

function WorkflowNode({ node, selected, onSelect }) {
  const tones = {
    blue: "border-blue-500 bg-blue-50 text-blue-950",
    green: "border-emerald-500 bg-emerald-50 text-emerald-900",
    orange: "border-orange-400 bg-orange-50 text-orange-800",
    purple: "border-violet-500 bg-violet-50 text-violet-800",
  };

  return (
    <button
      type="button"
      onClick={() => onSelect({ type: "story-status", data: node })}
      className={`relative flex min-h-14 w-[8.6rem] shrink-0 items-center justify-center rounded-lg border bg-white px-3 py-2 text-center text-sm font-extrabold shadow-sm transition hover:shadow-md ${tones[node.tone] ?? tones.blue} ${selected ? "ring-2 ring-blue-400 ring-offset-2" : ""}`}
      title={node.status?.statusKey ? `${node.label} (${node.status.statusKey})` : node.label}
    >
      <span className="leading-tight">{node.label}</span>
      {node.terminal && (
        <span className="absolute bottom-1.5 left-1/2 inline-flex -translate-x-1/2 items-center gap-1 rounded-md bg-violet-600 px-2 py-0.5 text-[0.62rem] font-extrabold text-white">
          <span aria-hidden="true">★</span> Terminal
        </span>
      )}
    </button>
  );
}

function WorkflowEdge({ edge, selected, onSelect }) {
  return (
    <button
      type="button"
      onClick={() => edge.transition && onSelect({ type: "transition", data: edge.transition })}
      className={`relative flex min-w-24 flex-1 items-center justify-center border-0 bg-transparent px-2 py-1 text-[0.68rem] font-bold text-slate-700 ${edge.transition ? "cursor-pointer hover:text-blue-700" : "cursor-default"}`}
      title={edge.transition?.actionKey || edge.label}
    >
      <span className="absolute inset-x-0 top-1/2 h-px -translate-y-1/2 bg-slate-400" aria-hidden="true" />
      <span className="absolute right-0 top-1/2 h-0 w-0 -translate-y-1/2 border-y-[5px] border-l-[8px] border-y-transparent border-l-slate-500" aria-hidden="true" />
      <span className={`relative z-10 max-w-[9rem] truncate rounded-md border bg-white px-2 py-1 shadow-sm ${selected ? "border-blue-500 text-blue-700 ring-2 ring-blue-100" : "border-slate-200"}`}>
        {edge.label}
      </span>
    </button>
  );
}

function LegacyWorkflowMapView({
  statuses,
  transitions,
  configuredTransitionCount,
  actionByKey,
  selectedItem,
  onSelectItem,
  selectedCategory,
  isLegacyWorkflowMode,
  isLoadingCategoryWorkflow,
}) {
  const genericStory = useMemo(() => getGenericWorkflowStory(statuses, transitions, actionByKey), [actionByKey, statuses, transitions]);
  const mapGroups = genericStory.groups.filter((group) => group.nodes.length > 0);
  const visibleGroups = mapGroups;
  const isNodeSelected = (node) => selectedItem?.type === "story-status" && selectedItem.data.id === node.id;
  const isEdgeSelected = (edge) => selectedItem?.type === "transition" && edge.transition && String(selectedItem.data.id) === String(edge.transition.id);
  const sectionTone = {
    blue: "border-blue-200 bg-blue-50/40 text-blue-700",
    orange: "border-orange-200 bg-orange-50/50 text-orange-700",
    green: "border-emerald-200 bg-emerald-50/50 text-emerald-700",
  };

  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
      <div className="space-y-5 overflow-hidden">
        {isLoadingCategoryWorkflow && (
          <div className="rounded-lg border border-blue-200 bg-blue-50 px-4 py-5 text-sm font-semibold text-blue-950">
            Refreshing workflow details for {selectedCategory?.displayName || "the selected category"}...
          </div>
        )}
        {!isLoadingCategoryWorkflow && isLegacyWorkflowMode && (
          <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-5 text-sm font-semibold text-amber-900">
            This category is currently LEGACY_FIXED. {configuredTransitionCount > 0 ? `${configuredTransitionCount} configured category transition${configuredTransitionCount === 1 ? " is" : "s are"} available for setup/review in the tabs. ` : ""}The active DB workflow map will be available after DB workflow activation.
          </div>
        )}
        {!isLoadingCategoryWorkflow && !isLegacyWorkflowMode && mapGroups.length === 0 && (
          <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-5 text-sm font-semibold text-amber-900">
            No workflow transitions are configured for this category yet. Create transitions and enable category rules to build this category workflow.
          </div>
        )}
        {!isLoadingCategoryWorkflow && !isLegacyWorkflowMode && mapGroups.length > 0 && (
          <div className="rounded-lg border border-blue-200 bg-blue-50 px-4 py-3 text-sm font-semibold text-blue-950">
            Showing active selected-category transitions from the transition table.
          </div>
        )}
        {!isLoadingCategoryWorkflow && !isLegacyWorkflowMode && mapGroups.length > 0 && visibleGroups.length === 0 && (
          <div className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-5 text-sm font-semibold text-slate-700">
            No active configured transitions match this filter for {selectedCategory?.displayName || "the selected category"}.
          </div>
        )}
        {!isLoadingCategoryWorkflow && !isLegacyWorkflowMode && visibleGroups.map((group) => (
          <section
            key={group.id}
            className={`rounded-lg ${group.id === "main" ? "border border-transparent bg-white" : `border border-dashed px-3 py-3 ${sectionTone[group.tone] ?? sectionTone.blue}`}`}
          >
            {group.id !== "main" && <h3 className="mb-3 text-xs font-extrabold">{group.label}</h3>}
            <div className="flex min-h-20 items-center gap-0 overflow-hidden">
              {group.entryLabel && (
                <span className="mr-3 hidden shrink-0 rounded-md border border-slate-200 bg-white px-2 py-1 text-[0.68rem] font-bold text-slate-700 shadow-sm min-[1280px]:inline-flex">
                  {group.entryLabel}
                </span>
              )}
              {group.nodes.map((node, index) => (
                <div key={`${group.id}-${node.id}-${index}`} className={`flex min-w-0 items-center ${index === group.nodes.length - 1 ? "shrink-0" : "flex-1"}`}>
                  <WorkflowNode node={node} selected={isNodeSelected(node)} onSelect={onSelectItem} />
                  {group.edges[index] && <WorkflowEdge edge={group.edges[index]} selected={isEdgeSelected(group.edges[index])} onSelect={onSelectItem} />}
                </div>
              ))}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}

const workflowMapNodeWidth = 190;
const workflowMapNodeHeight = 86;
const workflowNodeTypes = { workflowStatus: WorkflowStatusFlowNode };

function statusNodeId(status) {
  return String(status?.id ?? status?.statusKey ?? "unknown-status");
}

function transitionEdgeId(transition) {
  return String(transition?.id ?? `${transition?.fromStatusId ?? transition?.fromStatusKey}-${transition?.actionKey}-${transition?.toStatusId ?? transition?.toStatusKey}`);
}

function getTransitionStatus(transition, direction, statusById, statusByKey) {
  const id = direction === "from" ? transition.fromStatusId : transition.toStatusId;
  const key = direction === "from" ? transition.fromStatusKey || transition.fromStatus : transition.toStatusKey || transition.toStatus;
  const displayName = direction === "from" ? transition.fromStatusDisplayName : transition.toStatusDisplayName;
  const active = direction === "from" ? transition.fromStatusActive : transition.toStatusActive;
  const terminal = direction === "from" ? transition.fromStatusTerminal : transition.toStatusTerminal;
  const existing = id != null ? statusById.get(String(id)) : statusByKey.get(String(key || "").toUpperCase());

  return existing || {
    id: id ?? key,
    statusKey: key,
    displayName: displayName || formatLabel(key),
    active: active !== false,
    terminal: Boolean(terminal),
    systemStatus: false,
    protectedStatus: false,
  };
}

function getSelectedCategoryRule(transition, selectedCategoryId, categoryRulesByTransitionId) {
  if (!selectedCategoryId || !transition?.id) return null;
  return (categoryRulesByTransitionId[transition.id] || [])
    .find((rule) => String(rule.categoryId) === String(selectedCategoryId)) || null;
}

function getCategoryRuleLabel(rule, selectedCategoryId) {
  if (!selectedCategoryId) return "Global view";
  if (rule?.active) return "Enabled";
  if (rule) return "Disabled";
  return "Unconfigured";
}

function isCancelTransition(transition) {
  return [
    transition?.actionKey,
    transition?.displayName,
    transition?.toStatusKey,
    transition?.toStatusDisplayName,
  ].some((value) => String(value || "").toUpperCase().includes("CANCEL"));
}

function layoutWorkflowElements(nodes, edges, direction) {
  const graph = new dagre.graphlib.Graph();
  graph.setDefaultEdgeLabel(() => ({}));
  graph.setGraph({ rankdir: direction, nodesep: 56, ranksep: 96, marginx: 24, marginy: 24 });

  nodes.forEach((node) => {
    graph.setNode(node.id, { width: workflowMapNodeWidth, height: workflowMapNodeHeight });
  });
  edges.forEach((edge) => graph.setEdge(edge.source, edge.target));
  dagre.layout(graph);

  return nodes.map((node) => {
    const positioned = graph.node(node.id);
    return {
      ...node,
      position: {
        x: positioned.x - workflowMapNodeWidth / 2,
        y: positioned.y - workflowMapNodeHeight / 2,
      },
    };
  });
}

function WorkflowStatusFlowNode({ data, selected }) {
  const isTerminal = Boolean(data.status.terminal);
  const isInactive = data.status.active === false;
  const isCancel = String(data.status.statusKey || "").toUpperCase().includes("CANCEL");
  const protectedRecord = isProtectedStatus(data.status);
  const tone = isTerminal
    ? "border-emerald-500 bg-emerald-50 text-emerald-950"
    : isCancel
    ? "border-red-300 bg-red-50 text-red-900"
    : "border-blue-300 bg-white text-blue-950";

  return (
    <div className={`relative flex h-[86px] w-[190px] flex-col justify-center rounded-lg border-2 px-3 py-2 shadow-sm ${tone} ${isInactive ? "opacity-55" : ""} ${selected ? "ring-2 ring-blue-500 ring-offset-2" : ""}`}>
      <Handle type="target" position={Position.Left} className="opacity-0" />
      <Handle type="source" position={Position.Right} className="opacity-0" />
      <p className="line-clamp-2 break-words text-sm font-extrabold leading-tight">{data.label}</p>
      <div className="mt-2 flex flex-wrap gap-1">
        {isTerminal && <span className="rounded bg-emerald-600 px-1.5 py-0.5 text-[0.62rem] font-extrabold uppercase text-white">End</span>}
        {protectedRecord && <span className="rounded bg-slate-200 px-1.5 py-0.5 text-[0.62rem] font-extrabold uppercase text-slate-700">Protected</span>}
        {isInactive && <span className="rounded bg-slate-200 px-1.5 py-0.5 text-[0.62rem] font-extrabold uppercase text-slate-700">Inactive</span>}
      </div>
      <p className="mt-1 truncate text-[0.66rem] font-bold uppercase text-slate-500">{data.status.statusKey || "UNKNOWN"}</p>
    </div>
  );
}

function buildWorkflowMapData({
  statuses,
  transitions,
  actionByKey,
  categoryRulesByTransitionId,
  selectedCategoryId,
  showInactivePaths,
  layoutDirection,
}) {
  const statusById = new Map();
  const statusByKey = new Map();
  statuses.forEach((status) => {
    if (status?.id != null) statusById.set(String(status.id), status);
    if (status?.statusKey) statusByKey.set(String(status.statusKey).toUpperCase(), status);
  });

  const visibleTransitions = transitions.filter((transition) => {
    const rule = getSelectedCategoryRule(transition, selectedCategoryId, categoryRulesByTransitionId);
    if (!selectedCategoryId) return showInactivePaths || transition.active;
    if (showInactivePaths) return true;
    return transition.active && rule?.active;
  });

  const mapStatuses = new Map();
  visibleTransitions.forEach((transition) => {
    const fromStatus = getTransitionStatus(transition, "from", statusById, statusByKey);
    const toStatus = getTransitionStatus(transition, "to", statusById, statusByKey);
    mapStatuses.set(statusNodeId(fromStatus), fromStatus);
    mapStatuses.set(statusNodeId(toStatus), toStatus);
  });

  const incomingCounts = {};
  const outgoingCounts = {};
  visibleTransitions.forEach((transition) => {
    const fromStatus = getTransitionStatus(transition, "from", statusById, statusByKey);
    const toStatus = getTransitionStatus(transition, "to", statusById, statusByKey);
    const fromId = statusNodeId(fromStatus);
    const toId = statusNodeId(toStatus);
    outgoingCounts[fromId] = (outgoingCounts[fromId] || 0) + 1;
    incomingCounts[toId] = (incomingCounts[toId] || 0) + 1;
  });

  const nodes = [...mapStatuses.values()].map((status) => {
    const id = statusNodeId(status);
    return {
      id,
      type: "workflowStatus",
      data: {
        label: status.displayName || formatLabel(status.statusKey),
        status,
        incomingCount: incomingCounts[id] || 0,
        outgoingCount: outgoingCounts[id] || 0,
      },
      position: { x: 0, y: 0 },
    };
  });

  const edges = visibleTransitions.map((transition) => {
    const rule = getSelectedCategoryRule(transition, selectedCategoryId, categoryRulesByTransitionId);
    const fromStatus = getTransitionStatus(transition, "from", statusById, statusByKey);
    const toStatus = getTransitionStatus(transition, "to", statusById, statusByKey);
    const action = actionByKey[transition.actionKey];
    const disabled = !transition.active || Boolean(selectedCategoryId && !rule?.active);
    const cancel = isCancelTransition(transition);
    const edgeColor = disabled ? "#94a3b8" : cancel ? "#dc2626" : "#2563eb";

    return {
      id: transitionEdgeId(transition),
      source: statusNodeId(fromStatus),
      target: statusNodeId(toStatus),
      label: transition.displayName || action?.displayName || formatLabel(transition.actionKey),
      type: "smoothstep",
      animated: !disabled,
      markerEnd: { type: MarkerType.ArrowClosed, color: edgeColor },
      style: {
        stroke: edgeColor,
        strokeWidth: disabled ? 1.5 : 2.4,
        strokeDasharray: disabled ? "7 6" : undefined,
      },
      labelStyle: {
        fill: disabled ? "#64748b" : "#0f172a",
        fontWeight: 800,
        fontSize: 12,
      },
      labelBgStyle: {
        fill: "#ffffff",
        fillOpacity: 0.92,
      },
      data: {
        transition,
        action,
        fromStatus,
        toStatus,
        selectedCategoryRule: rule,
        categoryRuleLabel: getCategoryRuleLabel(rule, selectedCategoryId),
      },
    };
  });

  return {
    nodes: layoutWorkflowElements(nodes, edges, layoutDirection),
    edges,
    visibleTransitionCount: visibleTransitions.length,
  };
}

function ReadOnlyWorkflowMapDetails({ selectedItem, selectedCategory }) {
  if (!selectedItem) {
    return (
      <aside className="sticky top-4 rounded-lg border border-slate-200 bg-white px-4 py-4 shadow-sm">
        <MapPanelSection title="Map Details">
          <p className="text-sm font-semibold text-slate-600">Select a status node or transition arrow to inspect read-only workflow details.</p>
        </MapPanelSection>
        <MapPanelSection title="Scope">
          <dl>
            <DetailRow label="Selected Category" value={selectedCategory?.displayName || "Global workflow"} />
            <DetailRow label="Category Key" value={selectedCategory?.categoryKey || "Not selected"} />
          </dl>
        </MapPanelSection>
      </aside>
    );
  }

  if (selectedItem.type === "status") {
    const status = selectedItem.data.status;
    return (
      <aside className="sticky top-4 rounded-lg border border-slate-200 bg-white px-4 py-4 shadow-sm">
        <MapPanelSection title="Status Details">
          <dl>
            <DetailRow label="Display Name" value={status.displayName || formatLabel(status.statusKey)} />
            <DetailRow label="Status Key" value={status.statusKey} />
            <DetailRow label="Active" value={status.active ? "Active" : "Inactive"} />
            <DetailRow label="Terminal" value={status.terminal ? "Yes" : "No"} />
            <DetailRow label="System / Protected" value={`${status.systemStatus ? "System" : "Custom"} / ${isProtectedStatus(status) ? "Protected" : "Editable"}`} />
            <DetailRow label="Behavior Bucket" value={status.behaviorBucket ? formatLabel(status.behaviorBucket) : "Not set"} />
            <DetailRow label="Incoming Transitions" value={selectedItem.data.incomingCount} />
            <DetailRow label="Outgoing Transitions" value={selectedItem.data.outgoingCount} />
          </dl>
        </MapPanelSection>
      </aside>
    );
  }

  const transition = selectedItem.data.transition;
  const fromStatus = selectedItem.data.fromStatus;
  const toStatus = selectedItem.data.toStatus;
  const action = selectedItem.data.action;

  return (
    <aside className="sticky top-4 rounded-lg border border-slate-200 bg-white px-4 py-4 shadow-sm">
      <MapPanelSection title="Transition Details">
        <dl>
          <DetailRow label="Transition / Action" value={transition.displayName || action?.displayName || formatLabel(transition.actionKey)} />
          <DetailRow label="From Status" value={fromStatus.displayName || formatLabel(fromStatus.statusKey)} />
          <DetailRow label="To Status" value={toStatus.displayName || formatLabel(toStatus.statusKey)} />
          <DetailRow label="Action Key" value={transition.actionKey} />
          <DetailRow label="Action Display Name" value={action?.displayName || transition.displayName || formatLabel(transition.actionKey)} />
          <DetailRow label="Transition Active" value={transition.active ? "Active" : "Inactive"} />
          <DetailRow label="System / Protected" value={`${transition.systemTransition ? "System" : "Custom"} / ${isProtectedTransition(transition) ? "Protected" : "Editable"}`} />
          <DetailRow label="Selected Category Rule" value={selectedItem.data.categoryRuleLabel} />
        </dl>
      </MapPanelSection>
    </aside>
  );
}

function WorkflowMapView({
  statuses,
  transitions,
  configuredTransitionCount,
  actionByKey,
  onSelectItem,
  selectedCategory,
  isLegacyWorkflowMode,
  isLoadingCategoryWorkflow,
  categoryRulesByTransitionId,
  selectedCategoryId,
}) {
  const [showInactivePaths, setShowInactivePaths] = useState(false);
  const layoutDirection = window.matchMedia?.("(max-width: 767px)")?.matches ? "TB" : "LR";
  const mapData = useMemo(() => buildWorkflowMapData({
    statuses,
    transitions,
    actionByKey,
    categoryRulesByTransitionId,
    selectedCategoryId,
    showInactivePaths,
    layoutDirection,
  }), [actionByKey, categoryRulesByTransitionId, layoutDirection, selectedCategoryId, showInactivePaths, statuses, transitions]);

  const hasNoStatuses = !isLoadingCategoryWorkflow && statuses.length === 0;
  const hasNoTransitions = !isLoadingCategoryWorkflow && transitions.length === 0;
  const hasNoVisibleTransitions = !isLoadingCategoryWorkflow && transitions.length > 0 && mapData.visibleTransitionCount === 0;
  const helperText = selectedCategoryId
    ? "Showing active transitions for the selected category. Enable disabled/unconfigured to inspect hidden paths."
    : "Showing global active transitions. Enable disabled/unconfigured to inspect inactive global paths.";

  return (
    <div className="space-y-3">
      <div className="rounded-lg border border-slate-200 bg-white px-4 py-3 shadow-sm">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h2 className="text-base font-extrabold text-blue-950">Workflow Map</h2>
            <p className="mt-1 text-sm font-semibold text-slate-600">{helperText}</p>
          </div>
          <label className="inline-flex min-h-10 items-center gap-2 text-sm font-bold text-slate-700">
            <input
              type="checkbox"
              checked={showInactivePaths}
              onChange={(event) => {
                setShowInactivePaths(event.target.checked);
                onSelectItem(null);
              }}
            />
            Show disabled/unconfigured
          </label>
        </div>
        {isLegacyWorkflowMode && (
          <p className="mt-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm font-semibold text-amber-900">
            This category is currently LEGACY_FIXED. The map visualizes configured category rules for review only; it does not activate DB workflow.
          </p>
        )}
      </div>

      <div className="rounded-lg border border-slate-200 bg-white shadow-sm">
        {isLoadingCategoryWorkflow && (
          <div className="flex min-h-[560px] items-center justify-center px-4 py-8 text-sm font-semibold text-blue-950">
            Loading workflow map for {selectedCategory?.displayName || "the selected category"}...
          </div>
        )}
        {hasNoStatuses && (
          <div className="flex min-h-[560px] items-center justify-center px-4 py-8 text-sm font-semibold text-amber-900">
            No workflow statuses found.
          </div>
        )}
        {!hasNoStatuses && hasNoTransitions && (
          <div className="flex min-h-[560px] items-center justify-center px-4 py-8 text-sm font-semibold text-amber-900">
            No workflow transitions found.
          </div>
        )}
        {!hasNoStatuses && !hasNoTransitions && hasNoVisibleTransitions && (
          <div className="flex min-h-[560px] items-center justify-center px-4 py-8 text-center text-sm font-semibold text-slate-700">
            {selectedCategoryId ? "No active transitions are configured for the selected category. Enable disabled/unconfigured to inspect hidden paths." : "No active global transitions found."}
          </div>
        )}
        {!isLoadingCategoryWorkflow && !hasNoStatuses && !hasNoTransitions && !hasNoVisibleTransitions && (
          <div className="h-[560px] min-h-[560px] overflow-hidden rounded-lg sm:h-[640px]">
            <ReactFlow
              nodes={mapData.nodes}
              edges={mapData.edges}
              nodeTypes={workflowNodeTypes}
              nodesDraggable={false}
              nodesConnectable={false}
              elementsSelectable
              fitView
              fitViewOptions={{ padding: 0.2 }}
              minZoom={0.2}
              onNodeClick={(_, node) => onSelectItem({ type: "status", data: node.data })}
              onEdgeClick={(_, edge) => onSelectItem({ type: "transition", data: edge.data })}
              onPaneClick={() => onSelectItem(null)}
            >
              <Background gap={20} color="#e2e8f0" />
              <Controls showInteractive={false} />
            </ReactFlow>
          </div>
        )}
      </div>

      <div className="flex flex-wrap gap-3 rounded-lg border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700">
        <span className="inline-flex items-center gap-2"><span className="h-3 w-6 rounded-sm bg-blue-600" /> Active transition</span>
        <span className="inline-flex items-center gap-2"><span className="h-3 w-6 rounded-sm border border-slate-400 bg-white" /> Disabled/unconfigured</span>
        <span className="inline-flex items-center gap-2"><span className="h-3 w-6 rounded-sm bg-red-600" /> Cancel path</span>
        <span className="inline-flex items-center gap-2"><span className="h-3 w-3 rounded border-2 border-emerald-500 bg-emerald-50" /> Terminal status</span>
        <span className="inline-flex items-center gap-2"><span className="h-3 w-3 rounded border-2 border-blue-300 bg-white" /> Normal status</span>
      </div>

      {configuredTransitionCount === 0 && !showInactivePaths && (
        <p className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-900">
          No active selected-category transitions are configured yet.
        </p>
      )}
    </div>
  );
}

function MapPanelSection({ title, children }) {
  return (
    <section className="border-t border-slate-200 py-4">
      <h3 className="text-xs font-extrabold uppercase text-slate-500">{title}</h3>
      <div className="mt-3">{children}</div>
    </section>
  );
}

function MapDisclosureSection({ title, children }) {
  return (
    <details className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
      <summary className="cursor-pointer text-xs font-extrabold uppercase text-blue-950">{title}</summary>
      <div className="mt-3">{children}</div>
    </details>
  );
}

function businessWorkflowMode(config) {
  if (!config) return "Workflow mode not loaded";
  if (config.workflowMode === "DB_CONFIGURED") return "Database workflow configured";
  if (config.workflowMode === "LEGACY_FIXED") return "Legacy fixed workflow";
  return formatLabel(config.workflowMode);
}

function readinessTone(status) {
  if (status === "complete") return "green";
  if (status === "warning") return "yellow";
  return "red";
}

function ChecklistItem({ item }) {
  return (
    <li className="rounded-lg border border-slate-200 bg-white px-3 py-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-extrabold text-blue-950">{item.label}</p>
          <p className="mt-1 text-sm font-semibold text-slate-600">{item.detail}</p>
        </div>
        <Badge tone={readinessTone(item.status)}>{item.badge}</Badge>
      </div>
    </li>
  );
}

function WorkflowReadinessChecklist({ items, nextAction, onNextAction }) {
  return (
    <section className="mt-5 rounded-lg border border-slate-200 bg-slate-50 px-4 py-4 shadow-sm" aria-label="Workflow readiness checklist">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <h2 className="text-base font-extrabold text-blue-950">Workflow Readiness</h2>
          <p className="mt-1 max-w-4xl text-sm font-semibold text-slate-600">
            A category workflow is usable when its statuses, actions, transitions, selected-category rules, current role/action permissions, and backend validation all agree.
          </p>
        </div>
        {nextAction && (
          <button
            type="button"
            onClick={onNextAction}
            disabled={nextAction.disabled}
            className="inline-flex min-h-10 shrink-0 items-center justify-center rounded-lg bg-blue-950 px-4 py-2 text-sm font-bold text-white hover:bg-blue-900 disabled:opacity-50"
          >
            {nextAction.label}
          </button>
        )}
      </div>
      {nextAction?.reason && (
        <p className="mt-3 rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 text-sm font-bold text-blue-950">
          Next best action: {nextAction.reason}
        </p>
      )}
      <ul className="mt-4 grid gap-3 lg:grid-cols-2 xl:grid-cols-3">
        {items.map((item) => <ChecklistItem key={item.id} item={item} />)}
      </ul>
    </section>
  );
}

function getValidationGuidance(issue, transition, actionByKey) {
  const code = issue?.code || "ISSUE";
  const actionLabel = transition
    ? transition.displayName || actionByKey[transition.actionKey]?.displayName || formatLabel(transition.actionKey)
    : "";
  const from = transition ? getStatusLabel(transition, "from") : null;
  const to = transition ? getStatusLabel(transition, "to") : null;
  const affected = transition
    ? `${actionLabel}: ${from.label} to ${to.label}`
    : "Whole selected category workflow";

  const defaults = {
    explanation: issue?.message || "Backend validation reported a workflow configuration issue.",
    fix: "Review the affected workflow configuration and run validation again.",
    targetTabs: ["Validation"],
  };

  const guidanceByCode = {
    UNREACHABLE_WORKFLOW_FROM_NEW: {
      explanation: "Validation could not find an active workflow path starting from NEW. If using a custom start status, backend validation may still require literal NEW or a supported NEW behavior path.",
      fix: "Check that the starting status is active, has behavior bucket NEW, has an active outgoing transition, and that the category rule is enabled. If all are true, report this as a backend validation bug.",
      targetTabs: ["Statuses", "Transitions", "Map"],
    },
    INACTIVE_TARGET_STATUS: {
      explanation: "An active transition points to a target status that is inactive.",
      fix: "Enable the target status or change the transition target.",
      targetTabs: ["Statuses", "Transitions"],
    },
    INACTIVE_SOURCE_STATUS: {
      explanation: "An active transition starts from a source status that is inactive.",
      fix: "Enable the source status or change the transition source.",
      targetTabs: ["Statuses", "Transitions"],
    },
    INACTIVE_OR_MISSING_ACTION: {
      explanation: "An active transition uses an action that is inactive or missing.",
      fix: "Enable the action or update the transition to use an active action.",
      targetTabs: ["Actions", "Transitions"],
    },
    MISSING_ACTION_REFERENCE: {
      explanation: "A transition references an action that no longer exists in workflow action metadata.",
      fix: "Create or enable the missing action, or update the transition.",
      targetTabs: ["Actions", "Transitions"],
    },
    MISSING_STATUS_REFERENCE: {
      explanation: "A transition references a status that no longer exists in workflow status metadata.",
      fix: "Create or enable the missing status, or update the transition.",
      targetTabs: ["Statuses", "Transitions"],
    },
    MISSING_ROLE_TRANSITION_SCOPE_COVERAGE: {
      explanation: "No transition-specific role scope is configured. This transition is open to all roles that have permission for this action.",
      fix: "No fix is required. Use Role Access only if you want to restrict this transition to selected roles.",
      targetTabs: ["Role Access"],
    },
    MISSING_ROLE_ACCESS_GRANT: {
      explanation: "A role connected to this transition does not currently have permission for the action.",
      fix: "Grant the existing action permission in Role Access or adjust the available transition controls.",
      targetTabs: ["Role Access"],
    },
    NOT_EXECUTABLE_BY_ACTIVE_ROLE: {
      explanation: "No active role can currently execute this transition.",
      fix: "Check action permission in Role Access and run validation again.",
      targetTabs: ["Role Access"],
    },
    NO_ACTIVE_ROLE_SCOPE: {
      explanation: "Validation found no active role coverage for this transition.",
      fix: "Review the existing Role Access and transition controls currently available in the UI.",
      targetTabs: ["Role Access"],
    },
    UNREACHABLE_WORKFLOW_PATH: {
      explanation: "Some active workflow paths cannot be reached from the start of the workflow.",
      fix: "Use the Map and Transitions tabs to connect unreachable paths to the main NEW-to-terminal path.",
      targetTabs: ["Map", "Transitions"],
    },
    MISSING_TERMINAL_COMPLETION_PATH: {
      explanation: "The workflow does not have a reachable terminal completion status.",
      fix: "Create or enable a path from the start status to a terminal completion status.",
      targetTabs: ["Map", "Statuses", "Transitions"],
    },
    AMBIGUOUS_TRANSITION: {
      explanation: "Multiple active transitions match the same source status and action.",
      fix: "Disable duplicate or overlapping transitions for this category.",
      targetTabs: ["Transitions"],
    },
    DUPLICATE_ACTIVE_TRANSITION: {
      explanation: "Duplicate active transition metadata exists for the same path.",
      fix: "Disable the duplicate transition or keep only one active path.",
      targetTabs: ["Transitions"],
    },
    TERMINAL_SOURCE_STATUS: {
      explanation: "A terminal status is being used as a transition source.",
      fix: "Terminal statuses should end the workflow. Change or disable the outgoing transition.",
      targetTabs: ["Statuses", "Transitions"],
    },
    STALE_SOURCE_STATUS_BEHAVIOR: {
      explanation: "A transition source behavior is out of sync with its source status metadata.",
      fix: "Review the source status behavior bucket and recreate or update the affected transition if needed.",
      targetTabs: ["Statuses", "Transitions"],
    },
    STALE_TARGET_STATUS_BEHAVIOR: {
      explanation: "A transition target behavior is out of sync with its target status metadata.",
      fix: "Review the target status behavior bucket and recreate or update the affected transition if needed.",
      targetTabs: ["Statuses", "Transitions"],
    },
    INACTIVE_ACTION_ACCESS_METADATA_ACTIVE: {
      explanation: "Access metadata is active for a workflow action that is inactive.",
      fix: "Enable the workflow action or review access metadata.",
      targetTabs: ["Actions", "Role Access"],
    },
    NO_VALID_TRANSITIONS: {
      explanation: "This database-configured category has no valid active transitions.",
      fix: "Create active transitions and enable them for the selected category.",
      targetTabs: ["Transitions", "Map"],
    },
  };

  return {
    affected,
    ...(guidanceByCode[code] || defaults),
  };
}

function MapDetailPanel({
  selectedItem,
  selectedCategory,
  categoryWorkflowConfig,
  isLegacyWorkflowMode,
  validationForSelectedCategory,
  readyToActivate,
  blockingIssueCount,
  warningCount,
  selectedCategoryId,
  categoryRulesByTransitionId,
  roleRulesByTransitionId,
  managedRoles,
  actionByKey,
  configuredTransitions,
  onOpenStatusForm,
  onOpenTransitionForm,
  onRequestMetadataStateChange,
  onRequestTransitionStateChange,
  onRequestRuleChange,
  onRequestWorkflowModeChange,
  activationTargetConfig,
  rollbackTargetConfig,
  isSavingRule,
  isSavingWorkflowMode,
}) {
  const configuredActionsFromStatus = (statusKey) => {
    if (!statusKey) return [];
    return configuredTransitions
      .filter((transition) => String(transition.fromStatusKey || transition.fromStatus).toUpperCase() === String(statusKey).toUpperCase())
      .map((transition) => transition.displayName || actionByKey[transition.actionKey]?.displayName || formatLabel(transition.actionKey));
  };

  const renderAdvancedWorkflowControls = () => (
    <MapDisclosureSection title="Advanced Controls">
      <div className="flex flex-col gap-2">
        <button
          type="button"
          onClick={() => onRequestWorkflowModeChange(activationTargetConfig)}
          disabled={!selectedCategory?.id || !readyToActivate || categoryWorkflowConfig?.workflowMode === "DB_CONFIGURED" || isSavingWorkflowMode}
          className="inline-flex min-h-10 items-center justify-center rounded-lg bg-blue-950 px-4 py-2 text-sm font-bold text-white hover:bg-blue-900 disabled:opacity-50"
        >
          Activate DB Workflow
        </button>
        <button
          type="button"
          onClick={() => onRequestWorkflowModeChange(rollbackTargetConfig)}
          disabled={!selectedCategory?.id || !categoryWorkflowConfig || categoryWorkflowConfig.workflowMode === "LEGACY_FIXED" || isSavingWorkflowMode}
          className="inline-flex min-h-10 items-center justify-center rounded-lg border border-red-200 px-4 py-2 text-sm font-bold text-red-700 hover:bg-red-50 disabled:opacity-50"
        >
          Rollback to Legacy
        </button>
      </div>
    </MapDisclosureSection>
  );

  if (!selectedItem) {
    const hasConfiguredTransitions = configuredTransitions.length > 0;
    const defaultStatusLabel = isLegacyWorkflowMode ? "Legacy fixed workflow" : hasConfiguredTransitions ? "In Progress" : "No configured status";
    const defaultActions = hasConfiguredTransitions
      ? configuredActionsFromStatus("IN_PROGRESS")
      : [isLegacyWorkflowMode ? "Configure and validate DB workflow before activation" : "No configured workflow transitions"];

    return (
      <aside className="sticky top-4 rounded-lg border border-slate-200 bg-white px-4 py-4 shadow-sm">
        <MapPanelSection title="Status Details">
          <div className="rounded-lg border border-blue-300 bg-blue-50 px-3 py-4 text-sm font-bold text-blue-950">
            Status: <span className="text-blue-700">{defaultStatusLabel}</span>
          </div>
        </MapPanelSection>

        <MapPanelSection title="Available Next Actions">
          <ul className="space-y-3 text-sm font-semibold text-slate-700">
            {(defaultActions.length > 0 ? defaultActions : ["No configured next action"]).map((action) => (
              <li key={action} className="flex items-center gap-3">
                <span className="h-1.5 w-1.5 rounded-full bg-blue-600" aria-hidden="true" />
                {action}
              </li>
            ))}
          </ul>
        </MapPanelSection>

        <MapPanelSection title="Rules Summary">
          <div className="flex flex-wrap gap-2">
            <Badge tone={isLegacyWorkflowMode ? "yellow" : "blue"}>{isLegacyWorkflowMode ? "Legacy Fixed" : categoryWorkflowConfig?.workflowMode || "Not loaded"}</Badge>
            <Badge tone={readyToActivate ? "green" : "yellow"}>{readyToActivate ? "Ready to Activate" : "Validation Needed"}</Badge>
            <Badge tone={blockingIssueCount > 0 ? "red" : "green"}>{blockingIssueCount} Blockers</Badge>
            <Badge tone={warningCount > 0 ? "yellow" : "slate"}>{warningCount} Warnings</Badge>
          </div>
          {!validationForSelectedCategory && <p className="mt-3 text-sm font-bold text-yellow-800">Run Validation before activation.</p>}
        </MapPanelSection>

        {renderAdvancedWorkflowControls()}
      </aside>
    );
  }

  if (selectedItem.type === "story-status") {
    const node = selectedItem.data;
    const status = node.status;
    const visualActions = status?.statusKey
      ? configuredActionsFromStatus(status.statusKey)
      : [];
    const displayActions = visualActions.length > 0 ? visualActions : [node.terminal ? "No next action" : "No configured next action"];

    return (
      <aside className="sticky top-4 rounded-lg border border-slate-200 bg-white px-4 py-4 shadow-sm">
        <MapPanelSection title="Status Details">
          <div className="rounded-lg border border-blue-300 bg-blue-50 px-3 py-4 text-sm font-bold text-blue-950">
            Status: <span className="text-blue-700">{node.label}</span>
          </div>
        </MapPanelSection>

        <MapPanelSection title="Available Next Actions">
          <ul className="space-y-3 text-sm font-semibold text-slate-700">
            {displayActions.map((action) => (
              <li key={action} className="flex items-center gap-3">
                <span className="h-1.5 w-1.5 rounded-full bg-blue-600" aria-hidden="true" />
                {action}
              </li>
            ))}
          </ul>
        </MapPanelSection>

        {status && (
          <MapDisclosureSection title="Advanced Status Metadata">
            <dl className="space-y-1">
              <DetailRow label="Display Name" value={status.displayName || node.label} />
              <DetailRow label="Status Key" value={status.statusKey} />
              <DetailRow label="Behavior Bucket" value={status.behaviorBucket ? formatLabel(status.behaviorBucket) : "Not set"} />
              <DetailRow label="Active" value={status.active ? "Active" : "Inactive"} />
            </dl>
          </MapDisclosureSection>
        )}
        {renderAdvancedWorkflowControls()}
      </aside>
    );
  }

  if (selectedItem.type === "status") {
    const status = selectedItem.data;
    const protectedRecord = isProtectedStatus(status);
    return (
      <aside className="sticky top-4 rounded-lg border border-slate-200 bg-white px-4 py-4">
        <MapPanelSection title="Selected Item">
          <BusinessKeyLabel label={status.displayName} technicalKey={status.statusKey} />
        </MapPanelSection>

        <MapPanelSection title="Basic Details">
          <dl className="space-y-1">
            <DetailRow label="Behavior Bucket" value={status.behaviorBucket ? formatLabel(status.behaviorBucket) : "Not set"} />
            <DetailRow label="Terminal" value={status.terminal ? "Yes" : "No"} />
            <DetailRow label="Active" value={status.active ? "Active" : "Inactive"} />
          </dl>
        </MapPanelSection>

        <MapPanelSection title="Rules Summary">
          <div className="flex flex-wrap gap-2">
            <Badge tone={protectedRecord ? "yellow" : "blue"}>{protectedRecord ? "Protected" : "Custom"}</Badge>
            <Badge tone={status.active ? "green" : "red"}>{status.active ? "Active" : "Inactive"}</Badge>
            {status.terminal && <Badge tone="green">Terminal</Badge>}
          </div>
        </MapPanelSection>

        <MapPanelSection title="Actions Available">
          <p className="text-sm font-semibold text-slate-600">{protectedRecord ? "System/protected statuses are read-only." : "Custom statuses can be edited or safely disabled."}</p>
        </MapPanelSection>

        <MapPanelSection title="Advanced Controls">
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={() => onOpenStatusForm(status)} disabled={protectedRecord} className="inline-flex min-h-9 items-center justify-center rounded-lg border border-slate-300 px-3 py-2 text-xs font-extrabold text-slate-700 hover:bg-slate-50 disabled:opacity-50">Edit Status</button>
            <button type="button" onClick={() => onRequestMetadataStateChange("status", status, !status.active)} disabled={protectedRecord} className="inline-flex min-h-9 items-center justify-center rounded-lg border border-blue-200 px-3 py-2 text-xs font-extrabold text-blue-950 hover:bg-blue-50 disabled:opacity-50">{status.active ? "Disable" : "Enable"}</button>
          </div>
        </MapPanelSection>
      </aside>
    );
  }

  const transition = selectedItem.data;
  const from = getStatusLabel(transition, "from");
  const to = getStatusLabel(transition, "to");
  const protectedRecord = isProtectedTransition(transition);
  const categoryRules = categoryRulesByTransitionId[transition.id] || [];
  const selectedCategoryRule = categoryRules.find((rule) => String(rule.categoryId) === String(selectedCategoryId));
  const categoryState = getRuleVisualState(selectedCategoryRule);
  const roleRules = roleRulesByTransitionId[transition.id] || [];
  const action = actionByKey[transition.actionKey];

  return (
    <aside className="sticky top-4 rounded-lg border border-slate-200 bg-white px-4 py-4">
      <MapPanelSection title="Selected Item">
        <BusinessKeyLabel label={transition.displayName || action?.displayName} technicalKey={transition.actionKey} />
      </MapPanelSection>

      <MapPanelSection title="Basic Details">
        <dl className="space-y-1">
          <DetailRow label="From Status" value={from.label} />
          <DetailRow label="Action" value={transition.displayName || action?.displayName || formatLabel(transition.actionKey)} />
          <DetailRow label="To Status" value={to.label} />
          <DetailRow label="Active" value={transition.active ? "Active" : "Inactive"} />
        </dl>
        <MapDisclosureSection title="Technical Keys">
          <dl className="space-y-1">
            <DetailRow label="From Key" value={from.key || "UNKNOWN"} />
            <DetailRow label="Action Key" value={transition.actionKey} />
            <DetailRow label="To Key" value={to.key || "UNKNOWN"} />
          </dl>
        </MapDisclosureSection>
      </MapPanelSection>

      <MapPanelSection title="Rules Summary">
        <div className="flex flex-wrap gap-2">
          <Badge tone={categoryState.tone}>Category: {categoryState.label}</Badge>
          <Badge tone={roleRules.length === 0 ? "green" : "blue"}>Roles: {roleRules.length === 0 ? "Open to action-authorized" : `${roleRules.filter((rule) => rule.active).length}/${roleRules.length} restricted`}</Badge>
          <Badge tone={protectedRecord ? "yellow" : "blue"}>{protectedRecord ? "Protected" : "Custom"}</Badge>
        </div>
      </MapPanelSection>

      <MapPanelSection title="Actions Available">
        <p className="text-sm font-semibold text-slate-600">{protectedRecord ? "System/protected transitions are read-only." : "Custom transitions can be edited or safely enabled/disabled."}</p>
      </MapPanelSection>

      <MapPanelSection title="Advanced Controls">
        <div className="space-y-3">
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={() => onOpenTransitionForm(transition)} disabled={protectedRecord} className="inline-flex min-h-9 items-center justify-center rounded-lg border border-slate-300 px-3 py-2 text-xs font-extrabold text-slate-700 hover:bg-slate-50 disabled:opacity-50">Edit Transition</button>
            <button type="button" onClick={() => onRequestTransitionStateChange(transition, !transition.active)} disabled={protectedRecord} className="inline-flex min-h-9 items-center justify-center rounded-lg border border-blue-200 px-3 py-2 text-xs font-extrabold text-blue-950 hover:bg-blue-50 disabled:opacity-50">{transition.active ? "Disable" : "Enable"}</button>
          </div>

          <MapDisclosureSection title="Category Rule Controls">
            <div className="flex items-center justify-between gap-3">
              <span className="text-sm font-bold text-slate-700">Selected category</span>
              <Badge tone={categoryState.tone}>{categoryState.label}</Badge>
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              <button type="button" onClick={() => onRequestRuleChange({ scope: "category", transition, category: selectedCategory, rule: selectedCategoryRule, nextActive: true })} disabled={!selectedCategory || selectedCategoryRule?.active || isSavingRule} className="inline-flex min-h-9 items-center justify-center rounded-lg bg-blue-950 px-3 py-2 text-xs font-extrabold text-white hover:bg-blue-900 disabled:opacity-50">Enable</button>
              <button type="button" onClick={() => onRequestRuleChange({ scope: "category", transition, category: selectedCategory, rule: selectedCategoryRule, nextActive: false })} disabled={!selectedCategoryRule || !selectedCategoryRule.active || isSavingRule} className="inline-flex min-h-9 items-center justify-center rounded-lg border border-red-200 px-3 py-2 text-xs font-extrabold text-red-700 hover:bg-red-50 disabled:opacity-50">Disable</button>
            </div>
          </MapDisclosureSection>

          <MapDisclosureSection title="Role Restriction Controls">
            <div className="space-y-2">
              {managedRoles.map((role) => {
                const rule = roleRules.find((item) => String(item.roleId) === String(role.id));
                const state = getRuleVisualState(rule);
                return (
                  <div key={role.id} className="border-b border-slate-200 py-2 last:border-b-0">
                    <div className="flex items-start justify-between gap-2">
                      <BusinessKeyLabel label={role.displayName} technicalKey={role.roleKey} subtle />
                      <Badge tone={state.tone}>{state.label}</Badge>
                    </div>
                    <div className="mt-2 flex flex-wrap gap-2">
                      <button type="button" onClick={() => onRequestRuleChange({ scope: "role", transition, role, rule, nextActive: true })} disabled={rule?.active || isSavingRule} className="inline-flex min-h-8 items-center justify-center rounded-lg bg-blue-950 px-3 py-1.5 text-xs font-extrabold text-white hover:bg-blue-900 disabled:opacity-50">Enable</button>
                      <button type="button" onClick={() => onRequestRuleChange({ scope: "role", transition, role, rule, nextActive: false })} disabled={!rule || !rule.active || isSavingRule} className="inline-flex min-h-8 items-center justify-center rounded-lg border border-red-200 px-3 py-1.5 text-xs font-extrabold text-red-700 hover:bg-red-50 disabled:opacity-50">Disable</button>
                    </div>
                  </div>
                );
              })}
            </div>
          </MapDisclosureSection>
        </div>
      </MapPanelSection>
    </aside>
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
                <h3 className="text-sm font-extrabold text-blue-950">Optional Transition Role Restrictions</h3>
                <p className="mt-1 text-xs font-semibold text-slate-600">
                  Without transition-specific restriction, this transition stays open to every role that has action permission.
                </p>
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
  const [activeTab, setActiveTab] = useState("map");
  const [categories, setCategories] = useState([]);
  const [selectedCategoryId, setSelectedCategoryId] = useState("");
  const [categoryWorkflowConfig, setCategoryWorkflowConfig] = useState(null);
  const [transitions, setTransitions] = useState([]);
  const [statuses, setStatuses] = useState([]);
  const [actions, setActions] = useState([]);
  const [accessKeys, setAccessKeys] = useState([]);
  const [roles, setRoles] = useState([]);
  const [categoryRulesByTransitionId, setCategoryRulesByTransitionId] = useState({});
  const [roleRulesByTransitionId, setRoleRulesByTransitionId] = useState({});
  const [roleAccessByRoleId, setRoleAccessByRoleId] = useState({});
  const [validationResult, setValidationResult] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isValidating, setIsValidating] = useState(false);
  const [isSavingRule, setIsSavingRule] = useState(false);
  const [isSavingMetadata, setIsSavingMetadata] = useState(false);
  const [isSavingTransition, setIsSavingTransition] = useState(false);
  const [isSavingWorkflowMode, setIsSavingWorkflowMode] = useState(false);
  const [savingRoleAccessKey, setSavingRoleAccessKey] = useState("");
  const [isLoadingCategoryWorkflow, setIsLoadingCategoryWorkflow] = useState(false);
  const [error, setError] = useState("");
  const [statusMessage, setStatusMessage] = useState("");
  const [drawerItem, setDrawerItem] = useState(null);
  const [pendingRuleChange, setPendingRuleChange] = useState(null);
  const [metadataForm, setMetadataForm] = useState(null);
  const [metadataFormError, setMetadataFormError] = useState("");
  const [pendingMetadataChange, setPendingMetadataChange] = useState(null);
  const [transitionForm, setTransitionForm] = useState(null);
  const [transitionFormError, setTransitionFormError] = useState("");
  const [pendingTransitionChange, setPendingTransitionChange] = useState(null);
  const [pendingWorkflowModeChange, setPendingWorkflowModeChange] = useState(null);
  const [selectedMapItem, setSelectedMapItem] = useState(null);
  const [selectedTransitionId, setSelectedTransitionId] = useState("");
  const [transitionFilter, setTransitionFilter] = useState("all");

  const selectedCategory = useMemo(
    () => categories.find((category) => String(category.id) === String(selectedCategoryId)),
    [categories, selectedCategoryId]
  );

  const selectedCategoryActiveTransitions = useMemo(
    () => transitions.filter((transition) => {
      if (!transition.active || !selectedCategoryId) return false;
      const rules = categoryRulesByTransitionId[transition.id] || [];
      return rules.some((rule) => String(rule.categoryId) === String(selectedCategoryId) && rule.active);
    }),
    [categoryRulesByTransitionId, selectedCategoryId, transitions]
  );

  const isLegacyWorkflowMode = categoryWorkflowConfig?.workflowMode === "LEGACY_FIXED";
  const categoryWorkflowTransitions = useMemo(
    () => isLegacyWorkflowMode ? [] : selectedCategoryActiveTransitions,
    [isLegacyWorkflowMode, selectedCategoryActiveTransitions]
  );
  const selectedCategoryConfiguredTransitions = selectedCategoryActiveTransitions;
  const workflowBuilderLabel = selectedCategoryConfiguredTransitions.length > 0 ? "Edit Workflow Path" : "Build Workflow";

  const selectedCategoryConfiguredActionKeys = useMemo(
    () => new Set(selectedCategoryConfiguredTransitions.map((transition) => transition.actionKey)),
    [selectedCategoryConfiguredTransitions]
  );

  const selectedCategoryConfiguredStatusIds = useMemo(() => {
    const ids = new Set();
    selectedCategoryConfiguredTransitions.forEach((transition) => {
      ids.add(String(transition.fromStatusId));
      ids.add(String(transition.toStatusId));
    });
    return ids;
  }, [selectedCategoryConfiguredTransitions]);

  const selectedCategoryConfiguredStatuses = useMemo(
    () => statuses.filter((status) => selectedCategoryConfiguredStatusIds.has(String(status.id))
      || selectedCategoryConfiguredTransitions.some((transition) => statusMatchesTransition(status, transition))),
    [selectedCategoryConfiguredStatusIds, selectedCategoryConfiguredTransitions, statuses]
  );

  const configuredActionCount = useMemo(
    () => selectedCategoryConfiguredActionKeys.size,
    [selectedCategoryConfiguredActionKeys]
  );

  const selectedCategoryConfiguredActions = useMemo(
    () => actions.filter((action) => selectedCategoryConfiguredActionKeys.has(action.actionKey)),
    [actions, selectedCategoryConfiguredActionKeys]
  );

  const categoryWorkflowActionKeys = useMemo(
    () => new Set(categoryWorkflowTransitions.map((transition) => transition.actionKey)),
    [categoryWorkflowTransitions]
  );

  const categoryWorkflowStatusIds = useMemo(() => {
    const ids = new Set();
    categoryWorkflowTransitions.forEach((transition) => {
      ids.add(String(transition.fromStatusId));
      ids.add(String(transition.toStatusId));
    });
    return ids;
  }, [categoryWorkflowTransitions]);

  const categoryWorkflowStatuses = useMemo(
    () => statuses.filter((status) => categoryWorkflowStatusIds.has(String(status.id))
      || categoryWorkflowTransitions.some((transition) => statusMatchesTransition(status, transition))),
    [categoryWorkflowStatusIds, categoryWorkflowTransitions, statuses]
  );

  const categoryWorkflowActions = useMemo(
    () => actions.filter((action) => categoryWorkflowActionKeys.has(action.actionKey)),
    [actions, categoryWorkflowActionKeys]
  );

  const availableGlobalTransitions = useMemo(() => {
    const selectedTransitionIds = new Set(selectedCategoryConfiguredTransitions.map((transition) => String(transition.id)));
    return transitions.filter((transition) => !selectedTransitionIds.has(String(transition.id)));
  }, [selectedCategoryConfiguredTransitions, transitions]);

  const transitionsTabRows = useMemo(() => {
    if (!selectedCategoryId) return selectedCategoryConfiguredTransitions;
    return transitions.filter((transition) => {
      const rules = categoryRulesByTransitionId[transition.id] || [];
      return rules.some((rule) => String(rule.categoryId) === String(selectedCategoryId));
    });
  }, [categoryRulesByTransitionId, selectedCategoryConfiguredTransitions, selectedCategoryId, transitions]);

  const actionByKey = useMemo(() => {
    const next = {};
    actions.forEach((action) => {
      if (action.actionKey) next[action.actionKey] = action;
    });
    return next;
  }, [actions]);

  const accessKeyByKey = useMemo(() => {
    const next = {};
    accessKeys.forEach((accessKey) => {
      if (accessKey.accessKey) next[accessKey.accessKey] = accessKey;
    });
    return next;
  }, [accessKeys]);

  const activeRoles = useMemo(
    () => roles.filter((role) => role.active),
    [roles]
  );

  const validationForSelectedCategory = validationResult && String(validationResult.categoryId) === String(selectedCategoryId);
  const validationStatus = validationForSelectedCategory
    ? validationResult.readyToActivate || validationResult.valid
      ? "Ready"
      : "Not Ready"
    : "Not run";
  const blockingIssueCount = validationForSelectedCategory ? (validationResult.blockingIssues || validationResult.issues || []).length : 0;
  const warningCount = validationForSelectedCategory ? (validationResult.warnings || []).length : 0;
  const readyToActivate = Boolean(validationForSelectedCategory && validationResult.readyToActivate && blockingIssueCount === 0);
  const activationTargetConfig = { workflowMode: "DB_CONFIGURED", dbWorkflowEnabled: true, fixedActionsEnabled: false };
  const rollbackTargetConfig = { workflowMode: "LEGACY_FIXED", dbWorkflowEnabled: false, fixedActionsEnabled: true };
  const configuredTerminalStatus = selectedCategoryConfiguredStatuses.find((status) => status.terminal);
  const terminalStatusLabel = configuredTerminalStatus?.displayName || "Not configured";
  const workflowModeLabel = businessWorkflowMode(categoryWorkflowConfig);
  const workflowStatusLabel = isLegacyWorkflowMode
    ? "Legacy Fixed"
    : categoryWorkflowConfig?.dbWorkflowEnabled
    ? categoryWorkflowTransitions.length > 0 ? "Active in Test" : "No Active Paths"
    : "Validation Needed";
  const summaryTiles = [
    { label: "Mode", value: workflowModeLabel, icon: Database, tone: "text-blue-600" },
    { label: "Status", value: workflowStatusLabel, icon: CheckCircle2, tone: categoryWorkflowConfig?.dbWorkflowEnabled && categoryWorkflowTransitions.length > 0 ? "text-emerald-600" : "text-amber-600" },
    { label: "Total Statuses", value: selectedCategoryConfiguredStatuses.length, icon: Layers3, tone: "text-violet-600" },
    { label: "Total Actions", value: configuredActionCount, icon: Zap, tone: "text-blue-600" },
    { label: "Terminal Status", value: terminalStatusLabel, icon: Flag, tone: "text-orange-600" },
  ];

  const inactiveConfiguredStatuses = useMemo(
    () => selectedCategoryConfiguredStatuses.filter((status) => !status.active),
    [selectedCategoryConfiguredStatuses]
  );
  const inactiveConfiguredActions = useMemo(
    () => selectedCategoryConfiguredActions.filter((action) => !action.active),
    [selectedCategoryConfiguredActions]
  );
  const inactiveConfiguredTransitions = useMemo(
    () => selectedCategoryConfiguredTransitions.filter((transition) => !transition.active),
    [selectedCategoryConfiguredTransitions]
  );
  const transitionsMissingSelectedCategoryRule = useMemo(
    () => selectedCategoryConfiguredTransitions.filter((transition) => {
      const selectedRule = (categoryRulesByTransitionId[transition.id] || [])
        .find((rule) => String(rule.categoryId) === String(selectedCategoryId));
      return !selectedRule?.active;
    }),
    [categoryRulesByTransitionId, selectedCategoryConfiguredTransitions, selectedCategoryId]
  );
  const roleCoverageWarnings = useMemo(
    () => validationForSelectedCategory
      ? (validationResult.warnings || []).filter((issue) => issue.code === "MISSING_ROLE_TRANSITION_SCOPE_COVERAGE")
      : [],
    [validationForSelectedCategory, validationResult]
  );
  const hasRoleActionCoverage = useMemo(
    () => selectedCategoryConfiguredActions.length > 0
      && selectedCategoryConfiguredActions.every((action) => activeRoles.some((role) => actionAccessState(action.actionKey, role, roleAccessByRoleId) === "full")),
    [activeRoles, roleAccessByRoleId, selectedCategoryConfiguredActions]
  );

  const readinessItems = useMemo(() => {
    const configuredTransitionCount = selectedCategoryConfiguredTransitions.length;
    const statusCount = selectedCategoryConfiguredStatuses.length;
    const actionCount = selectedCategoryConfiguredActions.length;
    const validationBadge = validationForSelectedCategory
      ? readyToActivate ? "Ready" : "Not ready"
      : "Not run";

    return [
      {
        id: "category",
        label: "Selected category",
        status: selectedCategory?.active ? "complete" : "blocked",
        badge: selectedCategory?.active ? "Active" : "Needs attention",
        detail: selectedCategory
          ? `${selectedCategory.displayName || formatLabel(selectedCategory.categoryKey)} is the category being reviewed.`
          : "Select a category before configuring workflow readiness.",
      },
      {
        id: "statuses",
        label: "Statuses are active",
        status: statusCount > 0 && inactiveConfiguredStatuses.length === 0 ? "complete" : "blocked",
        badge: statusCount > 0 && inactiveConfiguredStatuses.length === 0 ? "Ready" : "Fix statuses",
        detail: statusCount === 0
          ? "No statuses are used by the selected category workflow yet."
          : inactiveConfiguredStatuses.length > 0
          ? `${inactiveConfiguredStatuses.length} configured status${inactiveConfiguredStatuses.length === 1 ? " is" : "es are"} inactive.`
          : `${statusCount} configured status${statusCount === 1 ? " is" : "es are"} active.`,
      },
      {
        id: "actions",
        label: "Actions are active",
        status: actionCount > 0 && inactiveConfiguredActions.length === 0 ? "complete" : "blocked",
        badge: actionCount > 0 && inactiveConfiguredActions.length === 0 ? "Ready" : "Fix actions",
        detail: actionCount === 0
          ? "No actions are used by the selected category workflow yet."
          : inactiveConfiguredActions.length > 0
          ? `${inactiveConfiguredActions.length} configured action${inactiveConfiguredActions.length === 1 ? " is" : "s are"} inactive.`
          : `${actionCount} configured action${actionCount === 1 ? " is" : "s are"} active.`,
      },
      {
        id: "transitions",
        label: "Transitions and category rules are enabled",
        status: configuredTransitionCount > 0 && inactiveConfiguredTransitions.length === 0 && transitionsMissingSelectedCategoryRule.length === 0 ? "complete" : "blocked",
        badge: configuredTransitionCount > 0 && inactiveConfiguredTransitions.length === 0 && transitionsMissingSelectedCategoryRule.length === 0 ? "Ready" : "Fix paths",
        detail: configuredTransitionCount === 0
          ? "No active transitions are enabled for this selected category."
          : inactiveConfiguredTransitions.length > 0
          ? `${inactiveConfiguredTransitions.length} selected-category transition${inactiveConfiguredTransitions.length === 1 ? " is" : "s are"} inactive.`
          : transitionsMissingSelectedCategoryRule.length > 0
          ? `${transitionsMissingSelectedCategoryRule.length} transition${transitionsMissingSelectedCategoryRule.length === 1 ? " is" : "s are"} missing the selected-category rule.`
          : `${configuredTransitionCount} transition${configuredTransitionCount === 1 ? " is" : "s are"} enabled for this category.`,
      },
      {
        id: "role-access",
        label: "Role/action permission is configured",
        status: hasRoleActionCoverage ? "complete" : "blocked",
        badge: hasRoleActionCoverage
          ? roleCoverageWarnings.length > 0 ? "Open to roles" : "Ready"
          : "Review access",
        detail: !hasRoleActionCoverage
          ? "At least one active role needs existing action permission for each configured workflow action."
          : roleCoverageWarnings.length > 0
          ? "Optional transition restrictions are not configured on one or more transitions; those transitions are open to action-authorized roles."
          : "Existing role/action permissions cover the configured workflow actions.",
      },
      {
        id: "validation",
        label: "Backend validation passes",
        status: readyToActivate ? "complete" : validationForSelectedCategory ? "blocked" : "warning",
        badge: validationBadge,
        detail: validationForSelectedCategory
          ? readyToActivate
            ? "Backend validation reports this workflow is ready."
            : `${blockingIssueCount} blocker${blockingIssueCount === 1 ? "" : "s"} and ${warningCount} warning${warningCount === 1 ? "" : "s"} need review.`
          : "Run validation after changing statuses, actions, transitions, or access.",
      },
      {
        id: "mode",
        label: "Category workflow mode",
        status: categoryWorkflowConfig?.dbWorkflowEnabled ? "complete" : readyToActivate ? "warning" : "blocked",
        badge: categoryWorkflowConfig?.dbWorkflowEnabled ? "Live" : readyToActivate ? "Ready to activate" : "Not live",
        detail: categoryWorkflowConfig
          ? `${businessWorkflowMode(categoryWorkflowConfig)}. ${categoryWorkflowConfig.dbWorkflowEnabled ? "DB workflow currently live." : "DB workflow is not live for this category yet."}`
          : "Category workflow mode has not loaded yet.",
      },
    ];
  }, [
    blockingIssueCount,
    categoryWorkflowConfig,
    hasRoleActionCoverage,
    inactiveConfiguredActions,
    inactiveConfiguredStatuses,
    inactiveConfiguredTransitions,
    readyToActivate,
    roleCoverageWarnings,
    selectedCategory,
    selectedCategoryConfiguredActions,
    selectedCategoryConfiguredStatuses,
    selectedCategoryConfiguredTransitions,
    transitionsMissingSelectedCategoryRule,
    validationForSelectedCategory,
    warningCount,
  ]);

  const nextBestAction = useMemo(() => {
    const blockers = validationForSelectedCategory ? (validationResult.blockingIssues || validationResult.issues || []) : [];
    const warnings = validationForSelectedCategory ? (validationResult.warnings || []) : [];
    const firstIssue = blockers[0] || warnings[0];

    if (!selectedCategoryId) {
      return { label: "Select category", reason: "Choose a category before reviewing readiness.", tab: "overview", disabled: true };
    }
    if (selectedCategoryConfiguredTransitions.length === 0) {
      return { label: "Build workflow", reason: "Create or enable transitions for this category.", action: "builder" };
    }
    if (inactiveConfiguredStatuses.length > 0) {
      return { label: "Fix inactive statuses", reason: "Enable inactive statuses used by this workflow.", tab: "statuses" };
    }
    if (inactiveConfiguredActions.length > 0) {
      return { label: "Fix inactive actions", reason: "Enable inactive actions used by this workflow.", tab: "actions" };
    }
    if (inactiveConfiguredTransitions.length > 0 || transitionsMissingSelectedCategoryRule.length > 0) {
      return { label: "Enable category paths", reason: "Review transition active state and selected-category rules.", tab: "transitions" };
    }
    if (!hasRoleActionCoverage) {
      return { label: "Check Role Access", reason: "Review existing role/action permission.", tab: "roleAccess" };
    }
    if (!validationForSelectedCategory) {
      return { label: "Run validation", reason: "Confirm backend readiness for this category.", action: "validate" };
    }
    if (firstIssue?.code === "UNREACHABLE_WORKFLOW_FROM_NEW") {
      return { label: "Review start path", reason: "Validation cannot find a valid path from NEW; custom NEW-bucket workflows may need backend review.", tab: "validation" };
    }
    if (blockers.length > 0) {
      return { label: "Review validation blocker", reason: "Fix the first backend validation blocker.", tab: "validation" };
    }
    if (readyToActivate && !categoryWorkflowConfig?.dbWorkflowEnabled) {
      return { label: "Ready to activate", reason: "Validation passed; category can move to DB workflow mode when approved.", tab: "overview", disabled: true };
    }
    return { label: "Workflow ready", reason: "The selected category workflow is ready for current runtime use.", tab: "overview", disabled: true };
  }, [
    categoryWorkflowConfig,
    hasRoleActionCoverage,
    inactiveConfiguredActions,
    inactiveConfiguredStatuses,
    inactiveConfiguredTransitions,
    readyToActivate,
    selectedCategoryConfiguredTransitions,
    selectedCategoryId,
    transitionsMissingSelectedCategoryRule,
    validationForSelectedCategory,
    validationResult,
  ]);

  const loadTransitionRules = useCallback(async (nextTransitions) => {
    const emptyRulesByTransitionId = Object.fromEntries(
      nextTransitions.map((transition) => [String(transition.id), []])
    );
    const [categoryResponse, roleResponse] = await Promise.all([
      fetch("/volt/workflow/transition-category-rules", { headers: authHeaders() }),
      fetch("/volt/workflow/transition-role-rules", { headers: authHeaders() }),
    ]);

    if (!categoryResponse.ok || !roleResponse.ok) {
      throw new Error("Unable to load workflow transition rules.");
    }

    const [categoryData, roleData] = await Promise.all([
      categoryResponse.json(),
      roleResponse.json(),
    ]);

    setCategoryRulesByTransitionId({
      ...emptyRulesByTransitionId,
      ...normalizeRulesByTransitionId(categoryData),
    });
    setRoleRulesByTransitionId({
      ...emptyRulesByTransitionId,
      ...normalizeRulesByTransitionId(roleData),
    });
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

  const loadTransitionsAndRules = useCallback(async () => {
    const transitionResponse = await fetch("/volt/workflow/transitions", { headers: authHeaders() });

    if (!transitionResponse.ok) {
      throw new Error("Unable to refresh workflow transitions.");
    }

    const transitionData = await transitionResponse.json();
    const nextTransitions = normalizeArray(transitionData, "transitions");
    setTransitions(nextTransitions);
    await loadTransitionRules(nextTransitions);
  }, [loadTransitionRules]);

  const loadWorkflowMetadata = useCallback(async () => {
    const [statusResponse, actionResponse, accessKeyResponse] = await Promise.all([
      fetch("/volt/workflow/statuses", { headers: authHeaders() }),
      fetch("/volt/workflow/actions", { headers: authHeaders() }),
      fetch("/volt/access/keys", { headers: authHeaders() }),
    ]);

    if (!statusResponse.ok || !actionResponse.ok) {
      throw new Error("Unable to refresh workflow metadata.");
    }

    const [statusData, actionData] = await Promise.all([
      statusResponse.json(),
      actionResponse.json(),
    ]);
    setStatuses(normalizeArray(statusData, "statuses"));
    setActions(normalizeArray(actionData, "actions"));

    if (accessKeyResponse.ok) {
      setAccessKeys(normalizeArray(await accessKeyResponse.json(), "accessKeys"));
    }
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
      const [categoryResponse, transitionResponse, statusResponse, actionResponse, roleResponse, accessKeyResponse] = await Promise.all([
        fetch("/volt/ticket-categories", { headers: authHeaders() }),
        fetch("/volt/workflow/transitions", { headers: authHeaders() }),
        fetch("/volt/workflow/statuses", { headers: authHeaders() }),
        fetch("/volt/workflow/actions", { headers: authHeaders() }),
        fetch("/volt/roles", { headers: authHeaders() }),
        fetch("/volt/access/keys", { headers: authHeaders() }),
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
      if (accessKeyResponse.ok) {
        setAccessKeys(normalizeArray(await accessKeyResponse.json(), "accessKeys"));
      }
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
      return null;
    }

    try {
      const response = await fetch(`/volt/ticket-categories/${categoryId}/workflow-config`, { headers: authHeaders() });
      if (!response.ok) throw new Error("Unable to load category workflow config.");
      return await response.json();
    } catch {
      return null;
    }
  }, []);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      loadBaseData();
    }, 0);

    return () => window.clearTimeout(timeoutId);
  }, [loadBaseData]);

  useEffect(() => {
    let ignore = false;
    setCategoryWorkflowConfig(null);
    setValidationResult(null);
    setPendingWorkflowModeChange(null);
    setPendingRuleChange(null);
    setPendingTransitionChange(null);
    setTransitionForm(null);
    setTransitionFormError("");
    setSelectedMapItem(null);
    setSelectedTransitionId("");
    setTransitionFilter("all");
    setDrawerItem(null);
    setError("");
    setStatusMessage("");

    const timeoutId = window.setTimeout(async () => {
      setIsLoadingCategoryWorkflow(Boolean(selectedCategoryId));
      const config = await loadCategoryConfig(selectedCategoryId);
      if (!ignore) {
        setCategoryWorkflowConfig(config);
        setIsLoadingCategoryWorkflow(false);
      }
    }, 0);

    return () => {
      ignore = true;
      window.clearTimeout(timeoutId);
    };
  }, [loadCategoryConfig, selectedCategoryId]);

  useEffect(() => {
    if (!selectedMapItem) return;

    if (selectedMapItem.type === "transition") {
      const stillVisible = categoryWorkflowTransitions.some((transition) => String(transition.id) === String(selectedMapItem.data.id));
      if (!stillVisible) setSelectedMapItem(null);
      return;
    }

    if (selectedMapItem.type === "story-status") {
      const statusId = selectedMapItem.data.status?.id;
      const stillVisible = statusId && categoryWorkflowStatuses.some((status) => String(status.id) === String(statusId));
      if (!stillVisible) setSelectedMapItem(null);
    }
  }, [categoryWorkflowStatuses, categoryWorkflowTransitions, selectedMapItem]);

  useEffect(() => {
    if (drawerItem?.type !== "transition") return;

    const stillVisible = transitions.some((transition) => String(transition.id) === String(drawerItem.data.id));
    if (!stillVisible) setDrawerItem(null);
  }, [drawerItem, transitions]);

  const changeSelectedCategory = (categoryId) => {
    setSelectedCategoryId(categoryId);
  };

  const openWorkflowBuilder = () => {
    const categoryQuery = selectedCategoryId ? `?categoryId=${encodeURIComponent(selectedCategoryId)}` : "";
    navigate(`/admin/workflow/builder${categoryQuery}`);
  };

  useEffect(() => {
    if (validationResult && String(validationResult.categoryId) !== String(selectedCategoryId)) {
      setValidationResult(null);
    }
  }, [selectedCategoryId, validationResult]);

  const refreshData = async () => {
    setValidationResult(null);
    setStatusMessage("");
    await loadBaseData();
    setCategoryWorkflowConfig(await loadCategoryConfig(selectedCategoryId));
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

  const handleNextBestAction = () => {
    if (!nextBestAction || nextBestAction.disabled) return;
    if (nextBestAction.action === "builder") {
      openWorkflowBuilder();
      return;
    }
    if (nextBestAction.action === "validate") {
      setActiveTab("validation");
      runValidation();
      return;
    }
    if (nextBestAction.tab) {
      setActiveTab(nextBestAction.tab);
    }
  };

  const requestRuleChange = (change) => {
    if (!change?.transition?.id || !change.nextActive && !change.rule) return;
    if (change.scope === "category" && !change.category?.id) return;
    if (change.scope === "role" && !change.role?.id) return;
    setError("");
    setStatusMessage("");
    setPendingRuleChange(change);
  };

  const refreshSingleRoleAccess = useCallback(async (role) => {
    const [roleAccessResponse, dynamicAccessResponse] = await Promise.all([
      fetch(`/volt/role-access/${role.id}`, { headers: authHeaders() }),
      fetch(`/volt/role-access/${role.id}/dynamic`, { headers: authHeaders() }),
    ]);

    if (!roleAccessResponse.ok || !dynamicAccessResponse.ok) {
      throw new Error("Role access was saved, but refreshed access data could not be loaded.");
    }

    const [roleAccess, dynamicAccess] = await Promise.all([
      roleAccessResponse.json(),
      dynamicAccessResponse.json(),
    ]);

    setRoleAccessByRoleId((current) => ({
      ...current,
      [role.id]: {
        ...roleAccess,
        dynamic: dynamicAccess,
        rulesByKey: normalizeRules(roleAccess.rules),
        dynamicRulesByKey: normalizeRules(dynamicAccess.rules),
      },
    }));
  }, []);

  const toggleRoleActionAccess = async (role, action) => {
    if (!role?.id || !action?.actionKey || role.roleKey === "SUPER_ADMIN") return;

    const access = roleAccessByRoleId[role.id];
    const actionKey = action.actionKey;
    const dynamicRule = access?.dynamicRulesByKey?.[actionKey];
    const systemRule = access?.rulesByKey?.[actionKey];
    const isDynamicRule = Boolean(dynamicRule) || !systemRule;
    const currentAllowed = Boolean((isDynamicRule ? dynamicRule : systemRule)?.allowed);
    const nextAllowed = !currentAllowed;

    setSavingRoleAccessKey(`${role.id}:${actionKey}`);
    setError("");
    setStatusMessage("");

    try {
      const endpoint = isDynamicRule
        ? `/volt/role-access/${role.id}/dynamic`
        : `/volt/role-access/${role.id}`;
      const sourceRules = isDynamicRule ? access?.dynamic?.rules : access?.rules;
      const payload = {
        rules: normalizeArray(sourceRules, "rules")
          .filter((rule) => !isDynamicRule || rule.active)
          .map((rule) => ({
            accessKey: rule.accessKey,
            allowed: rule.accessKey === actionKey ? nextAllowed : Boolean(rule.allowed),
          })),
      };

      if (!payload.rules.some((rule) => rule.accessKey === actionKey)) {
        payload.rules.push({ accessKey: actionKey, allowed: nextAllowed });
      }

      const response = await fetch(endpoint, {
        method: "PATCH",
        headers: authHeaders(true),
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        throw new Error(await readApiError(response, "Unable to save role access rule."));
      }

      await refreshSingleRoleAccess(role);
      await runValidation();
      setStatusMessage(`${role.displayName || role.roleKey} access for ${action.displayName || formatLabel(actionKey)} ${nextAllowed ? "enabled" : "disabled"}.`);
    } catch (saveError) {
      setError(saveError.message || "Unable to save role access rule.");
    } finally {
      setSavingRoleAccessKey("");
    }
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

  const refreshMetadataAndValidate = async (message) => {
    await loadWorkflowMetadata();
    await runValidation();
    setStatusMessage(message);
  };

  const metadataSaveSuccessMessage = (isStatus, isCreate) => {
    if (!isCreate) {
      return `Workflow ${isStatus ? "status" : "action"} updated and validation refreshed.`;
    }

    const categoryName = selectedCategory?.displayName || selectedCategory?.categoryKey || "the selected category";
    return isStatus
      ? `Workflow status created as reusable global metadata. To use it in ${categoryName}, create a transition involving this status and enable the category rule.`
      : `Workflow action created as reusable global metadata. To use it in ${categoryName}, create a transition using this action and enable the category rule.`;
  };

  const refreshTransitionsAndValidate = async (message) => {
    await loadTransitionsAndRules();
    await runValidation();
    setStatusMessage(message);
  };

  const openTransitionForm = (transition = null) => {
    if (transition && isProtectedTransition(transition)) return;
    setError("");
    setTransitionFormError("");
    setStatusMessage("");
    setTransitionForm({
      mode: transition ? "edit" : "create",
      original: transition,
      values: transition
        ? {
            fromStatusId: transition.fromStatusId || "",
            actionKey: transition.actionKey || "",
            toStatusId: transition.toStatusId || "",
            displayName: transition.displayName || "",
            active: Boolean(transition.active),
            sortOrder: transition.sortOrder ?? "",
          }
        : emptyTransitionForm,
    });
  };

  const updateTransitionForm = (field, value) => {
    setTransitionFormError("");
    setTransitionForm((current) => current ? {
      ...current,
      values: {
        ...current.values,
        [field]: value,
      },
    } : current);
  };

  const findDuplicateTransition = (values) => transitions.find((transition) => (
    String(transition.fromStatusId) === String(values.fromStatusId)
      && String(transition.toStatusId) === String(values.toStatusId)
      && transition.actionKey === values.actionKey
  ));

  const attachExistingTransitionToSelectedCategory = async (transition) => {
    if (!transition?.id || !selectedCategory?.id) return false;

    const categoryName = selectedCategory.displayName || selectedCategory.categoryKey || "the selected category";
    const existingRule = (categoryRulesByTransitionId[transition.id] || [])
      .find((rule) => String(rule.categoryId) === String(selectedCategory.id));

    if (existingRule?.active) {
      setTransitionFormError(`This transition already exists and is already enabled for ${categoryName}. Use the Selected Category Transitions list to edit it.`);
      return false;
    }

    const endpoint = `/volt/workflow/transitions/${transition.id}/category-rules`;
    const response = existingRule
      ? await fetch(`${endpoint}/${existingRule.id}`, {
          method: "PATCH",
          headers: authHeaders(true),
          body: JSON.stringify({ active: true }),
        })
      : await fetch(endpoint, {
          method: "POST",
          headers: authHeaders(true),
          body: JSON.stringify({ categoryId: Number(selectedCategory.id), active: true }),
        });

    if (!response.ok) {
      throw new Error(await readApiError(response, "Transition already exists, but the category rule could not be enabled."));
    }

    setTransitionForm(null);
    setPendingTransitionChange(null);
    await refreshTransitionsAndValidate(`Existing workflow transition enabled for ${categoryName}. Validation refreshed.`);
    openTransitionDrawer(transition);
    return true;
  };

  const buildTransitionPayload = (values, includeCreateOnly) => {
    const selectedAction = actions.find((action) => action.actionKey === values.actionKey);
    const displayName = includeCreateOnly
      ? (selectedAction?.displayName ?? "").trim()
      : values.displayName.trim();

    return {
      ...(includeCreateOnly ? {
      fromStatusId: Number(values.fromStatusId),
      actionKey: values.actionKey,
      toStatusId: Number(values.toStatusId),
      active: Boolean(values.active),
      } : {}),
      displayName,
      sortOrder: values.sortOrder === "" ? null : Number(values.sortOrder),
    };
  };

  const saveTransitionForm = async (change = transitionForm) => {
    if (!change) return;
    if (isSavingTransition) return;
    const isCreate = change.mode === "create";
    const duplicateTransition = isCreate ? findDuplicateTransition(change.values) : null;

    if (duplicateTransition) {
      if (!change.values.enableForSelectedCategory || !selectedCategory?.id) {
        setTransitionFormError("This workflow transition already exists. Use the Available / Global Transitions section to enable it for the selected category instead of creating a duplicate.");
        return;
      }

      setIsSavingTransition(true);
      setError("");
      setTransitionFormError("");
      setStatusMessage("");
      try {
        await attachExistingTransitionToSelectedCategory(duplicateTransition);
      } catch (saveError) {
        setTransitionFormError(saveError.message || "Transition already exists, but the category rule could not be enabled.");
      } finally {
        setIsSavingTransition(false);
      }
      return;
    }

    setIsSavingTransition(true);
    setError("");
    setTransitionFormError("");
    setStatusMessage("");
    try {
      const response = await fetch(isCreate ? "/volt/workflow/transitions" : `/volt/workflow/transitions/${change.original.id}`, {
        method: isCreate ? "POST" : "PATCH",
        headers: authHeaders(true),
        body: JSON.stringify(buildTransitionPayload(change.values, isCreate)),
      });

      if (!response.ok) {
        throw new Error(await readApiError(response, "Unable to save workflow transition."));
      }

      const savedTransition = await response.json();
      let categoryRuleAttached = false;
      let categoryRuleError = "";
      if (isCreate && change.values.enableForSelectedCategory && selectedCategory?.id && savedTransition?.id) {
        const categoryRuleResponse = await fetch(`/volt/workflow/transitions/${savedTransition.id}/category-rules`, {
          method: "POST",
          headers: authHeaders(true),
          body: JSON.stringify({ categoryId: Number(selectedCategory.id), active: true }),
        });

        if (categoryRuleResponse.ok) {
          categoryRuleAttached = true;
        } else {
          categoryRuleError = await readApiError(categoryRuleResponse, "Transition created, but category rule could not be enabled.");
        }
      }

      setTransitionForm(null);
      setPendingTransitionChange(null);
      const categoryName = selectedCategory?.displayName || selectedCategory?.categoryKey || "the selected category";
      const successMessage = isCreate
        ? categoryRuleAttached
          ? `Workflow transition created and enabled for ${categoryName}. Validation refreshed.`
          : categoryRuleError
          ? categoryRuleError
          : `Workflow transition created as workflow metadata. To use it in ${categoryName}, enable the category rule for this transition.`
        : "Workflow transition updated and validation refreshed.";
      await refreshTransitionsAndValidate(successMessage);
      if (isCreate && savedTransition?.id) {
        openTransitionDrawer(savedTransition);
      }
    } catch (saveError) {
      setTransitionFormError(saveError.message || "Unable to save workflow transition.");
      try {
        await loadTransitionsAndRules();
      } catch {
        // Keep the original conflict/save message visible.
      }
    } finally {
      setIsSavingTransition(false);
    }
  };

  const submitTransitionForm = (event) => {
    event.preventDefault();
    if (!transitionForm) return;
    if (isSavingTransition) return;
    saveTransitionForm(transitionForm);
  };

  const requestTransitionStateChange = (transition, nextActive) => {
    if (isProtectedTransition(transition)) return;
    setError("");
    setStatusMessage("");
    setPendingTransitionChange({
      kind: "state",
      item: transition,
      nextActive,
      reason: nextActive ? "Activation can fail when category/action/source status matches overlap." : "Disable is used instead of delete.",
      action: async () => {
        setIsSavingTransition(true);
        setError("");
        setStatusMessage("");
        try {
          const response = await fetch(`/volt/workflow/transitions/${transition.id}`, {
            method: "PATCH",
            headers: authHeaders(true),
            body: JSON.stringify({ active: nextActive }),
          });
          if (!response.ok) {
            throw new Error(await readApiError(response, `Unable to ${nextActive ? "enable" : "disable"} workflow transition.`));
          }
          setPendingTransitionChange(null);
          await refreshTransitionsAndValidate(`Workflow transition ${nextActive ? "enabled" : "disabled"} and validation refreshed.`);
        } catch (stateError) {
          setError(stateError.message || `Unable to ${nextActive ? "enable" : "disable"} workflow transition.`);
          try {
            await loadTransitionsAndRules();
          } catch {
            // Keep the original conflict/save message visible.
          }
        } finally {
          setIsSavingTransition(false);
        }
      },
    });
  };

  const confirmTransitionChange = () => {
    pendingTransitionChange?.action?.();
  };

  const requestWorkflowModeChange = (targetConfig) => {
    if (!selectedCategoryId || !selectedCategory || !categoryWorkflowConfig) {
      setError("Select a category and load its workflow config before changing workflow mode.");
      return;
    }

    if (targetConfig.workflowMode === "DB_CONFIGURED" && !readyToActivate) {
      setError("Run validation before activation. Activation requires readyToActivate=true with no blocking issues.");
      return;
    }

    setError("");
    setStatusMessage("");
    setPendingWorkflowModeChange({
      categoryId: selectedCategoryId,
      category: selectedCategory,
      currentConfig: categoryWorkflowConfig,
      targetConfig,
    });
  };

  const confirmWorkflowModeChange = async () => {
    if (!pendingWorkflowModeChange) return;
    if (String(pendingWorkflowModeChange.categoryId) !== String(selectedCategoryId)) {
      setError("Selected category changed before confirmation. Please review and try again.");
      setPendingWorkflowModeChange(null);
      return;
    }

    const { categoryId, targetConfig } = pendingWorkflowModeChange;
    const activating = targetConfig.workflowMode === "DB_CONFIGURED";
    if (activating && !readyToActivate) {
      setError("Activation stopped because validation is no longer ready.");
      setPendingWorkflowModeChange(null);
      return;
    }

    setIsSavingWorkflowMode(true);
    setError("");
    setStatusMessage("");
    try {
      const response = await fetch(`/volt/ticket-categories/${categoryId}/workflow-config`, {
        method: "PATCH",
        headers: authHeaders(true),
        body: JSON.stringify(targetConfig),
      });

      if (!response.ok) {
        throw new Error(await readApiError(response, "Unable to update category workflow mode."));
      }

      setCategoryWorkflowConfig(await response.json());
      const [, config] = await Promise.all([loadBaseData(), loadCategoryConfig(categoryId), loadTransitionsAndRules()]);
      setCategoryWorkflowConfig(config);
      await runValidation(categoryId);
      setPendingWorkflowModeChange(null);
      setStatusMessage(activating ? "Selected category activated for DB configured workflow." : "Selected category rolled back to legacy fixed workflow.");
    } catch (modeError) {
      setError(modeError.message || "Unable to update category workflow mode.");
    } finally {
      setIsSavingWorkflowMode(false);
    }
  };

  const openStatusForm = (status = null) => {
    if (status && isProtectedStatus(status)) return;
    setError("");
    setMetadataFormError("");
    setStatusMessage("");
    setMetadataForm({
      entityType: "status",
      mode: status ? "edit" : "create",
      original: status,
      values: status
        ? {
            statusKey: status.statusKey || "",
            displayName: status.displayName || "",
            behaviorBucket: status.behaviorBucket || "",
            terminal: Boolean(status.terminal),
            active: Boolean(status.active),
            sortOrder: status.sortOrder ?? "",
          }
        : emptyStatusForm,
    });
  };

  const openActionForm = (action = null) => {
    if (action && isProtectedAction(action)) return;
    setError("");
    setMetadataFormError("");
    setStatusMessage("");
    setMetadataForm({
      entityType: "action",
      mode: action ? "edit" : "create",
      original: action,
      values: action
        ? {
            actionKey: action.actionKey || "",
            displayName: action.displayName || "",
            buttonLabel: action.buttonLabel || "",
            description: action.description || "",
            active: Boolean(action.active),
            sortOrder: action.sortOrder ?? "",
            requiresComment: Boolean(action.requiresComment),
            confirmationRequired: Boolean(action.confirmationRequired),
          }
        : emptyActionForm,
    });
  };

  const updateMetadataForm = (field, value) => {
    setMetadataFormError("");
    setMetadataForm((current) => current ? {
      ...current,
      values: {
        ...current.values,
        [field]: value,
      },
    } : current);
  };

  const buildStatusPayload = (values, includeKey) => ({
    ...(includeKey ? { statusKey: values.statusKey.trim() } : {}),
    displayName: values.displayName.trim(),
    ...(includeKey ? { active: Boolean(values.active) } : {}),
    terminal: Boolean(values.terminal),
    behaviorBucket: values.behaviorBucket || null,
    sortOrder: values.sortOrder === "" ? null : Number(values.sortOrder),
  });

  const buildActionPayload = (values, includeKey) => ({
    ...(includeKey ? { actionKey: values.actionKey.trim() } : {}),
    displayName: values.displayName.trim(),
    buttonLabel: values.buttonLabel.trim(),
    description: values.description.trim(),
    ...(includeKey ? { active: Boolean(values.active) } : {}),
    sortOrder: values.sortOrder === "" ? null : Number(values.sortOrder),
    requiresComment: Boolean(values.requiresComment),
    confirmationRequired: Boolean(values.confirmationRequired),
  });

  const visibleStatusKeys = useMemo(
    () => new Set(selectedCategoryConfiguredStatuses.map((status) => String(status.statusKey || "").trim().toUpperCase())),
    [selectedCategoryConfiguredStatuses]
  );

  const visibleActionKeys = useMemo(
    () => new Set(selectedCategoryConfiguredActions.map((action) => String(action.actionKey || "").trim().toUpperCase())),
    [selectedCategoryConfiguredActions]
  );

  const findDuplicateMetadata = (change) => {
    if (!change || change.mode !== "create") return null;
    const isStatus = change.entityType === "status";
    const keyField = isStatus ? "statusKey" : "actionKey";
    const requestedKey = normalizeKey(change.values[keyField]).trim().toUpperCase();
    if (!requestedKey) return null;

    const records = isStatus ? statuses : actions;
    const duplicate = records.find((record) => String(record[keyField] || "").trim().toUpperCase() === requestedKey);
    if (!duplicate) return null;

    const visibleKeys = isStatus ? visibleStatusKeys : visibleActionKeys;
    const isVisible = visibleKeys.has(requestedKey);
    const isEditable = isStatus ? !isProtectedStatus(duplicate) : !isProtectedAction(duplicate);
    const recordName = isStatus ? "status" : "action";
    const listName = isStatus ? "Statuses" : "Actions";
    const baseMessage = isStatus
      ? "This status key already exists. Search the Statuses list and edit or enable the existing status instead of creating a duplicate."
      : "This action key already exists. Search the Actions list and edit or enable the existing action instead of creating a duplicate.";
    const inactiveMessage = `This ${recordName} key already exists but is inactive. Enable the existing custom ${recordName} instead of creating a duplicate.`;
    const hiddenMessage = ` This key already exists in workflow metadata. It may not be visible in the current category view. Use the full ${listName} list or enable the existing record if available.`;

    return {
      duplicate,
      message: `${!duplicate.active && isEditable ? inactiveMessage : baseMessage}${isVisible ? "" : hiddenMessage}`,
    };
  };

  const saveMetadataForm = async (change = metadataForm) => {
    if (!change || isSavingMetadata) return;
    const isStatus = change.entityType === "status";
    const isCreate = change.mode === "create";
    const duplicate = findDuplicateMetadata(change);
    if (duplicate) {
      setMetadataFormError(duplicate.message);
      setError("");
      return;
    }
    const endpoint = isStatus ? "/volt/workflow/statuses" : "/volt/workflow/actions";
    const payload = isStatus
      ? buildStatusPayload(change.values, isCreate)
      : buildActionPayload(change.values, isCreate);

    setIsSavingMetadata(true);
    setError("");
    setMetadataFormError("");
    setStatusMessage("");
    try {
      const response = await fetch(isCreate ? endpoint : `${endpoint}/${change.original.id}`, {
        method: isCreate ? "POST" : "PATCH",
        headers: authHeaders(true),
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        throw new Error(await readApiError(response, `Unable to save workflow ${isStatus ? "status" : "action"}.`));
      }

      setMetadataForm(null);
      setPendingMetadataChange(null);
      await refreshMetadataAndValidate(metadataSaveSuccessMessage(isStatus, isCreate));
    } catch (saveError) {
      const message = saveError.message || `Unable to save workflow ${isStatus ? "status" : "action"}.`;
      setMetadataFormError(message);
      setError("");
    } finally {
      setIsSavingMetadata(false);
    }
  };

  const submitMetadataForm = (event) => {
    event.preventDefault();
    if (!metadataForm || isSavingMetadata) return;

    const { entityType, mode, original, values } = metadataForm;
    if (entityType === "status" && mode === "edit") {
      const terminalChanged = Boolean(original.terminal) !== Boolean(values.terminal);
      const bucketChanged = (original.behaviorBucket || "") !== (values.behaviorBucket || "");
      if (terminalChanged || bucketChanged) {
        setPendingMetadataChange({
          kind: "save",
          entityType,
          mode,
          item: { ...original, ...values },
          reason: `${terminalChanged ? "Terminal flag changed. " : ""}${bucketChanged ? "Behavior bucket changed." : ""}`.trim(),
          action: () => saveMetadataForm(metadataForm),
        });
        return;
      }
    }

    saveMetadataForm(metadataForm);
  };

  const requestMetadataStateChange = (entityType, item, nextActive) => {
    const protectedRecord = entityType === "status" ? isProtectedStatus(item) : isProtectedAction(item);
    if (protectedRecord) return;
    setError("");
    setStatusMessage("");
    setPendingMetadataChange({
      kind: "state",
      entityType,
      item,
      nextActive,
      reason: nextActive ? "This will re-enable the custom record." : "Disable is used instead of delete.",
      action: async () => {
        const endpoint = entityType === "status"
          ? `/volt/workflow/statuses/${item.id}/status`
          : `/volt/workflow/actions/${item.id}/status`;
        setIsSavingMetadata(true);
        setError("");
        setStatusMessage("");
        try {
          const response = await fetch(endpoint, {
            method: "PATCH",
            headers: authHeaders(true),
            body: JSON.stringify({ active: nextActive }),
          });
          if (!response.ok) {
            throw new Error(await readApiError(response, `Unable to ${nextActive ? "enable" : "disable"} workflow ${entityType}.`));
          }
          setPendingMetadataChange(null);
          await refreshMetadataAndValidate(`Workflow ${entityType} ${nextActive ? "enabled" : "disabled"} and validation refreshed.`);
        } catch (stateError) {
          setError(stateError.message || `Unable to ${nextActive ? "enable" : "disable"} workflow ${entityType}.`);
        } finally {
          setIsSavingMetadata(false);
        }
      },
    });
  };

  const confirmMetadataChange = () => {
    pendingMetadataChange?.action?.();
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

  const selectedValidationResult = validationForSelectedCategory ? validationResult : null;
  const issueRows = selectedValidationResult
    ? (selectedValidationResult.blockingIssues?.length || selectedValidationResult.warnings?.length)
      ? [...(selectedValidationResult.blockingIssues || []), ...(selectedValidationResult.warnings || [])]
      : selectedValidationResult.issues || []
    : [];
  const validationGuidanceRows = issueRows.map((issue) => {
    const transition = transitions.find((item) => String(item.id) === String(issue.transitionId));
    return {
      issue,
      transition,
      guidance: getValidationGuidance(issue, transition, actionByKey),
      warning: (selectedValidationResult?.warnings || []).some((warning) => warning === issue),
    };
  });

  const transitionIssueRowsById = useMemo(() => {
    const next = {};
    validationGuidanceRows.forEach((row) => {
      const transitionId = row.issue?.transitionId ?? row.transition?.id;
      if (transitionId == null) return;
      const key = String(transitionId);
      next[key] = [...(next[key] || []), row];
    });
    return next;
  }, [validationGuidanceRows]);

  const transitionRuntimeById = useMemo(() => {
    const next = {};
    transitionsTabRows.forEach((transition) => {
      next[String(transition.id)] = getTransitionRuntimeState(
        transition,
        selectedCategoryId,
        categoryRulesByTransitionId,
        transitionIssueRowsById[String(transition.id)] || [],
        actionByKey
      );
    });
    return next;
  }, [actionByKey, categoryRulesByTransitionId, selectedCategoryId, transitionIssueRowsById, transitionsTabRows]);

  const transitionRuntimeCounts = useMemo(() => {
    const counts = { executable: 0, warning: 0, blocked: 0, inactive: 0 };
    transitionsTabRows.forEach((transition) => {
      const runtime = transitionRuntimeById[String(transition.id)];
      const key = String(runtime?.label || "").toLowerCase();
      if (counts[key] != null) counts[key] += 1;
    });
    return counts;
  }, [transitionRuntimeById, transitionsTabRows]);

  const filteredTransitionsTabRows = useMemo(() => {
    if (transitionFilter === "custom") {
      return transitionsTabRows.filter((transition) => !transition.systemTransition && !isProtectedTransition(transition));
    }
    if (transitionFilter === "all") return transitionsTabRows;
    return transitionsTabRows.filter((transition) => String(transitionRuntimeById[String(transition.id)]?.label || "").toLowerCase() === transitionFilter);
  }, [transitionFilter, transitionRuntimeById, transitionsTabRows]);

  const selectedInspectorTransition = useMemo(() => {
    if (selectedTransitionId) {
      const selected = transitionsTabRows.find((transition) => String(transition.id) === String(selectedTransitionId))
        || availableGlobalTransitions.find((transition) => String(transition.id) === String(selectedTransitionId));
      if (selected) return selected;
    }
    return filteredTransitionsTabRows[0] || transitionsTabRows[0] || null;
  }, [availableGlobalTransitions, filteredTransitionsTabRows, selectedTransitionId, transitionsTabRows]);

  const sidebarItems = [
    { label: "Dashboard", icon: LayoutDashboard, onClick: () => navigate("/employee-dashboard") },
    { label: "Workflows", icon: Workflow, active: true },
    { label: "Users", icon: Users, onClick: () => navigate("/admin/employees") },
  ];

  return (
    <main id="main-content" className="min-h-screen bg-slate-50">
      <div className="flex min-h-screen">
        <aside className="hidden w-56 shrink-0 flex-col bg-[#061b36] text-white shadow-2xl lg:flex">
          <div className="flex h-20 items-center gap-3 px-5">
            <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-600 shadow-lg shadow-blue-950/30">
              <Workflow size={23} aria-hidden="true" />
            </span>
            <span className="text-xl font-extrabold">RepairFlow</span>
          </div>
          <nav className="mt-5 space-y-2 px-3" aria-label="Workflow screen navigation">
            {sidebarItems.map((item) => {
              const Icon = item.icon;
              return (
                <button
                  key={item.label}
                  type="button"
                  onClick={item.onClick}
                  className={`flex min-h-12 w-full items-center gap-3 rounded-lg px-4 text-left text-sm font-bold transition ${
                    item.active ? "bg-blue-600 text-white shadow-lg shadow-blue-950/30" : "text-blue-100 hover:bg-white/10 hover:text-white"
                  }`}
                >
                  <Icon size={19} aria-hidden="true" />
                  {item.label}
                </button>
              );
            })}
          </nav>
          <div className="mt-auto border-t border-white/10 p-4">
            <div className="flex items-center gap-3">
              <span className="flex h-11 w-11 items-center justify-center rounded-full bg-blue-600 text-sm font-extrabold">AD</span>
              <span className="min-w-0">
                <span className="block truncate text-sm font-bold">Admin User</span>
                <span className="block truncate text-xs text-blue-200">Administrator</span>
              </span>
            </div>
          </div>
        </aside>

        <div className="min-w-0 flex-1 px-4 py-5 sm:px-6 lg:px-8">
        <header className="border-b border-slate-200 pb-4">
          <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
            <div>
              <h1 className="text-2xl font-extrabold text-slate-950 sm:text-3xl">Workflow Management</h1>
              <p className="mt-1 text-lg font-semibold text-slate-600">{selectedCategory?.displayName || "Repair Workflow Test"}</p>
            </div>
            <div className="flex flex-col gap-3 lg:items-end">
              <div className="flex items-center gap-2 text-sm font-semibold text-slate-500">
                <Home size={16} aria-hidden="true" />
                <span>/</span>
                <span>Workflows</span>
                <span>/</span>
                <span className="text-slate-700">{selectedCategory?.displayName || "Repair Workflow Test"}</span>
              </div>
              <div className="flex flex-col gap-2 lg:flex-row lg:items-center">
                <label className="flex items-center gap-2 text-sm font-bold text-slate-700">
                  Category
                  <select
                    value={selectedCategoryId}
                    onChange={(event) => changeSelectedCategory(event.target.value)}
                    className="min-h-10 min-w-60 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-blue-950 outline-none focus:border-blue-950"
                  >
                    {categories.length === 0 && <option value="">No categories available</option>}
                    {categories.map((category) => (
                      <option key={category.id} value={category.id}>
                        {category.displayName || formatLabel(category.categoryKey)}
                      </option>
                    ))}
                  </select>
                </label>
                <button
                  type="button"
                  onClick={refreshData}
                  disabled={isLoading}
                  className="inline-flex min-h-10 items-center justify-center gap-2 rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-bold text-blue-950 hover:bg-blue-50 disabled:opacity-60"
                >
                  <RefreshCw size={16} aria-hidden="true" />
                  {isLoading ? "Refreshing..." : "Refresh"}
                </button>
              </div>
            </div>
          </div>
        </header>

        {error && <p className="mt-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">{error}</p>}
        {statusMessage && <p className="mt-4 rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm font-semibold text-green-700">{statusMessage}</p>}
        {isLoadingCategoryWorkflow && <p className="mt-4 rounded-lg border border-blue-200 bg-blue-50 px-4 py-3 text-sm font-semibold text-blue-950">Refreshing selected category workflow...</p>}
        {!isLoadingCategoryWorkflow && isLegacyWorkflowMode && (
          <p className="mt-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-900">
            This category is currently LEGACY_FIXED. Configured category transitions are shown for setup/review in the tabs. The active DB workflow map will be available after DB workflow activation.
          </p>
        )}

        <section className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-5" aria-label="Workflow summary">
          {summaryTiles.map((tile) => {
            const Icon = tile.icon;
            return (
              <div key={tile.label} className="flex min-h-20 items-center gap-4 rounded-lg border border-slate-200 bg-white px-5 py-4 shadow-sm">
                <Icon className={tile.tone} size={29} aria-hidden="true" />
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-slate-950">
                    {tile.label}: <span className={`font-extrabold ${tile.tone}`}>{tile.value}</span>
                  </p>
                </div>
              </div>
            );
          })}
        </section>

        <WorkflowReadinessChecklist
          items={readinessItems}
          nextAction={nextBestAction}
          onNextAction={handleNextBestAction}
        />

        <nav className="mt-4 overflow-x-auto border-b border-slate-200" aria-label="Workflow tabs">
          <div className="flex min-w-max items-end gap-6">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                className={`border-b-3 px-1 py-3 text-base font-semibold ${
                  activeTab === tab.id
                    ? "border-blue-600 text-blue-700"
                    : "border-transparent text-slate-500 hover:text-blue-950"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </nav>

        <section className="mt-4">
          {activeTab === "map" && (
            <div className="grid gap-4 2xl:grid-cols-[minmax(0,1fr)_22rem]">
              <div className="min-w-0 space-y-3">
                <WorkflowMapView
                  statuses={statuses}
                  transitions={transitions}
                  configuredTransitionCount={selectedCategoryConfiguredTransitions.length}
                  actionByKey={actionByKey}
                  onSelectItem={setSelectedMapItem}
                  selectedCategory={selectedCategory}
                  isLegacyWorkflowMode={isLegacyWorkflowMode}
                  isLoadingCategoryWorkflow={isLoadingCategoryWorkflow}
                  categoryRulesByTransitionId={categoryRulesByTransitionId}
                  selectedCategoryId={selectedCategoryId}
                />
              </div>

              <ReadOnlyWorkflowMapDetails
                selectedItem={selectedMapItem}
                selectedCategory={selectedCategory}
              />
            </div>
          )}

          {activeTab === "overview" && (
            <div className="space-y-4">
              <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_22rem]">
                <section className="rounded-lg border border-slate-200 bg-white px-4 py-4 shadow-sm">
                  <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                    <div>
                      <p className="text-xs font-extrabold uppercase text-slate-500">Readiness Dashboard</p>
                      <h2 className="mt-1 text-xl font-extrabold text-blue-950">
                        {readyToActivate ? "Workflow is ready" : validationForSelectedCategory ? "Workflow needs fixes" : "Workflow needs validation"}
                      </h2>
                      <p className="mt-2 text-sm font-semibold text-slate-600">
                        {selectedCategory?.displayName || "No category selected"} uses {businessWorkflowMode(categoryWorkflowConfig).toLowerCase()}.
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={handleNextBestAction}
                      disabled={nextBestAction?.disabled}
                      className="inline-flex min-h-10 items-center justify-center rounded-lg bg-blue-950 px-4 py-2 text-sm font-bold text-white hover:bg-blue-900 disabled:opacity-50"
                    >
                      {nextBestAction?.label || "Review workflow"}
                    </button>
                  </div>

                  <div className="mt-4 grid gap-3 md:grid-cols-2">
                    <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-3">
                      <p className="text-xs font-extrabold uppercase text-slate-500">Current workflow mode</p>
                      <p className="mt-1 text-sm font-extrabold text-blue-950">{businessWorkflowMode(categoryWorkflowConfig)}</p>
                      <p className="mt-1 text-sm font-semibold text-slate-600">
                        {categoryWorkflowConfig?.dbWorkflowEnabled ? "DB workflow currently live" : "DB workflow is not live"}
                      </p>
                    </div>
                    <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-3">
                      <p className="text-xs font-extrabold uppercase text-slate-500">Main blocker</p>
                      <p className="mt-1 text-sm font-extrabold text-blue-950">{nextBestAction?.reason || "No blocker found."}</p>
                      <p className="mt-1 text-sm font-semibold text-slate-600">Recommended next action: {nextBestAction?.label || "Review workflow"}</p>
                    </div>
                  </div>
                </section>

                <section className="rounded-lg border border-slate-200 bg-white px-4 py-4 shadow-sm">
                  <p className="text-xs font-extrabold uppercase text-slate-500">Configuration Snapshot</p>
                  <dl className="mt-3 space-y-3 text-sm font-semibold text-slate-700">
                    <div className="flex items-center justify-between gap-3">
                      <dt>Status metadata used</dt>
                      <dd className="font-extrabold text-blue-950">{selectedCategoryConfiguredStatuses.length}</dd>
                    </div>
                    <div className="flex items-center justify-between gap-3">
                      <dt>Action metadata used</dt>
                      <dd className="font-extrabold text-blue-950">{selectedCategoryConfiguredActions.length}</dd>
                    </div>
                    <div className="flex items-center justify-between gap-3">
                      <dt>Category transitions</dt>
                      <dd className="font-extrabold text-blue-950">{selectedCategoryConfiguredTransitions.length}</dd>
                    </div>
                    <div className="flex items-center justify-between gap-3">
                      <dt>Validation</dt>
                      <dd><Badge tone={validationStatus === "Ready" ? "green" : validationStatus === "Not Ready" ? "red" : "yellow"}>{validationStatus}</Badge></dd>
                    </div>
                  </dl>
                </section>
              </div>

              <details className="rounded-lg border border-slate-200 bg-white px-4 py-3">
                <summary className="cursor-pointer text-sm font-extrabold text-blue-950">Advanced Technical State</summary>
                <div className="mt-3 grid gap-3 md:grid-cols-2">
                  <DetailRow label="Selected Category Key" value={selectedCategory?.categoryKey || "Not selected"} />
                  <DetailRow label="Raw Workflow Mode" value={categoryWorkflowConfig?.workflowMode || "Not loaded"} />
                  <DetailRow label="DB Workflow Currently Live" value={categoryWorkflowConfig?.dbWorkflowEnabled ? "Yes" : "No"} />
                  <DetailRow label="Fixed Workflow Actions Enabled" value={categoryWorkflowConfig?.fixedActionsEnabled ? "Yes" : "No"} />
                </div>
              </details>
            </div>
          )}

          {activeTab === "transitions" && (
            <div className="space-y-4">
              <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                <div className="min-w-0">
                  <h2 className="text-base font-extrabold text-blue-950">Selected Category Transitions</h2>
                  <div className="mt-2 flex flex-wrap gap-2">
                    <Badge tone="green">Executable: {transitionRuntimeCounts.executable}</Badge>
                    <Badge tone="yellow">Warning: {transitionRuntimeCounts.warning}</Badge>
                    <Badge tone="red">Blocked: {transitionRuntimeCounts.blocked}</Badge>
                    <Badge tone="slate">Inactive: {transitionRuntimeCounts.inactive}</Badge>
                    <Badge tone="blue">Available global: {availableGlobalTransitions.length}</Badge>
                  </div>
                </div>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={openWorkflowBuilder}
                    disabled={!selectedCategoryId}
                    className="inline-flex min-h-10 items-center justify-center gap-2 rounded-lg bg-blue-950 px-4 py-2 text-sm font-bold text-white hover:bg-blue-900 disabled:opacity-50"
                  >
                    <Workflow size={16} aria-hidden="true" />
                    {workflowBuilderLabel}
                  </button>
                  <button
                    type="button"
                    onClick={() => openTransitionForm()}
                    className="inline-flex min-h-10 items-center justify-center rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-bold text-blue-950 hover:bg-blue-50"
                  >
	                  Create Transition
	                </button>
                </div>
              </div>

              <div className="flex flex-wrap gap-2">
                {[
                  ["all", `All (${transitionsTabRows.length})`],
                  ["executable", `Executable (${transitionRuntimeCounts.executable})`],
                  ["warning", `Warning (${transitionRuntimeCounts.warning})`],
                  ["blocked", `Blocked (${transitionRuntimeCounts.blocked})`],
                  ["inactive", `Inactive (${transitionRuntimeCounts.inactive})`],
                  ["custom", "Custom only"],
                ].map(([filterId, label]) => (
                  <button
                    key={filterId}
                    type="button"
                    onClick={() => setTransitionFilter(filterId)}
                    className={`min-h-9 rounded-lg border px-3 py-1.5 text-xs font-extrabold ${
                      transitionFilter === filterId
                        ? "border-blue-950 bg-blue-950 text-white"
                        : "border-slate-200 bg-white text-slate-700 hover:bg-blue-50"
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>

              <div className="grid gap-4 2xl:grid-cols-[minmax(0,1fr)_24rem]">
                <div className="min-w-0 space-y-4">
                  <TableShell minWidth="min-w-[1040px]">
                    <thead>
                      <tr>
                        <HeaderCell>From</HeaderCell>
                        <HeaderCell>Action</HeaderCell>
                        <HeaderCell>To</HeaderCell>
                        <HeaderCell>Runtime</HeaderCell>
                        <HeaderCell>Access</HeaderCell>
                        <HeaderCell>Category Rule</HeaderCell>
                        <HeaderCell>Actions</HeaderCell>
                      </tr>
                    </thead>
                    <tbody>
                      {(isLoading || isLoadingCategoryWorkflow) && <EmptyRows colSpan={7}>Loading workflow transitions for selected category...</EmptyRows>}
                      {!isLoading && !isLoadingCategoryWorkflow && transitionsTabRows.length === 0 && (
                        <EmptyRows colSpan={7}>
                          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                            <span>No workflow transitions are configured for this category yet.</span>
                            <button
                              type="button"
                              onClick={openWorkflowBuilder}
                              disabled={!selectedCategoryId}
                              className="inline-flex min-h-10 items-center justify-center gap-2 rounded-lg bg-blue-950 px-4 py-2 text-sm font-bold text-white hover:bg-blue-900 disabled:opacity-50"
                            >
                              <Workflow size={16} aria-hidden="true" />
                              Build Workflow
                            </button>
                          </div>
                        </EmptyRows>
                      )}
                      {!isLoading && !isLoadingCategoryWorkflow && transitionsTabRows.length > 0 && filteredTransitionsTabRows.length === 0 && (
                        <EmptyRows colSpan={7}>No selected-category transitions match this filter.</EmptyRows>
                      )}
                      {!isLoading && !isLoadingCategoryWorkflow && filteredTransitionsTabRows.map((transition) => {
                        const from = getStatusLabel(transition, "from");
                        const to = getStatusLabel(transition, "to");
                        const categoryState = getCategoryRuleState(transition.id, selectedCategoryId, categoryRulesByTransitionId);
                        const runtimeState = transitionRuntimeById[String(transition.id)] || getTransitionRuntimeState(transition, selectedCategoryId, categoryRulesByTransitionId, [], actionByKey);
                        const accessSummary = getTransitionAccessSummary(transition, activeRoles, roleAccessByRoleId, roleRulesByTransitionId);
                        const protectedRecord = isProtectedTransition(transition);
                        const isSelected = String(selectedInspectorTransition?.id) === String(transition.id);

                        return (
                          <tr
                            key={transition.id}
                            onClick={() => setSelectedTransitionId(String(transition.id))}
                            className={`cursor-pointer hover:bg-blue-50/50 ${isSelected ? "bg-blue-50/70" : ""}`}
                          >
                            <BodyCell><BusinessKeyLabel label={from.label} technicalKey={from.key} subtle /></BodyCell>
                            <BodyCell><BusinessKeyLabel label={transition.displayName || actionByKey[transition.actionKey]?.displayName} technicalKey={transition.actionKey} /></BodyCell>
                            <BodyCell><BusinessKeyLabel label={to.label} technicalKey={to.key} subtle /></BodyCell>
                            <BodyCell>
                              <div className="space-y-1">
                                <Badge tone={runtimeState.tone}>{runtimeState.label}</Badge>
                                <p className="max-w-56 text-xs font-semibold text-slate-600">{runtimeState.detail}</p>
                              </div>
                            </BodyCell>
                            <BodyCell>
                              <div className="space-y-1">
                                <Badge tone={accessSummary.tone}>{accessSummary.label}</Badge>
                                <p className="max-w-56 text-xs font-semibold text-slate-600">{accessSummary.detail}</p>
                              </div>
                            </BodyCell>
                            <BodyCell><Badge tone={categoryState.tone}>{categoryState.label}</Badge></BodyCell>
                            <BodyCell>
                              <div className="flex flex-wrap gap-2">
                                <button
                                  type="button"
                                  onClick={(event) => {
                                    event.stopPropagation();
                                    setSelectedTransitionId(String(transition.id));
                                  }}
                                  className="inline-flex min-h-9 items-center justify-center rounded-lg border border-blue-200 px-3 py-2 text-xs font-extrabold text-blue-950 hover:bg-blue-50"
                                >
                                  Details
                                </button>
                                <button
                                  type="button"
                                  onClick={(event) => {
                                    event.stopPropagation();
                                    openTransitionForm(transition);
                                  }}
                                  disabled={protectedRecord}
                                  title={protectedRecord ? "System/protected transitions cannot be edited or disabled." : "Edit transition"}
                                  className="inline-flex min-h-9 items-center justify-center rounded-lg border border-slate-300 px-3 py-2 text-xs font-extrabold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                                >
                                  Edit
                                </button>
                              </div>
                            </BodyCell>
                          </tr>
                        );
                      })}
                    </tbody>
                  </TableShell>

                  {!isLoading && !isLoadingCategoryWorkflow && (
                  <details className="rounded-lg border border-slate-200 bg-white px-4 py-3">
	                <summary className="cursor-pointer text-sm font-extrabold text-blue-950">Available / Global Transitions</summary>
	                <p className="mt-2 text-sm font-semibold text-slate-600">These transitions exist as workflow metadata but are not enabled for the selected category yet. Enable the category rule to include one in this category workflow and map.</p>
	                <div className="mt-3">
	                  <TableShell minWidth="min-w-[1180px]">
	                    <thead>
	                      <tr>
	                        <HeaderCell>From Status</HeaderCell>
	                        <HeaderCell>Action</HeaderCell>
	                        <HeaderCell>To Status</HeaderCell>
	                        <HeaderCell>Category Rule</HeaderCell>
	                        <HeaderCell>Active</HeaderCell>
	                        <HeaderCell>Protected/System</HeaderCell>
	                        <HeaderCell>Actions</HeaderCell>
	                      </tr>
	                    </thead>
	                    <tbody>
	                      {availableGlobalTransitions.length === 0 && <EmptyRows colSpan={7}>No available global transitions outside the selected category workflow.</EmptyRows>}
	                      {availableGlobalTransitions.map((transition) => {
	                        const from = getStatusLabel(transition, "from");
	                        const to = getStatusLabel(transition, "to");
	                        const rules = categoryRulesByTransitionId[transition.id] || [];
	                        const selectedCategoryRule = rules.find((rule) => String(rule.categoryId) === String(selectedCategoryId));
	                        const categoryState = getRuleVisualState(selectedCategoryRule);
	                        const protectedRecord = isProtectedTransition(transition);
	                        return (
	                          <tr key={transition.id} onClick={() => openTransitionDrawer(transition)} className="cursor-pointer hover:bg-blue-50/50">
	                            <BodyCell><BusinessKeyLabel label={from.label} technicalKey={from.key} subtle /></BodyCell>
	                            <BodyCell><BusinessKeyLabel label={transition.displayName || actionByKey[transition.actionKey]?.displayName} technicalKey={transition.actionKey} /></BodyCell>
	                            <BodyCell><BusinessKeyLabel label={to.label} technicalKey={to.key} subtle /></BodyCell>
	                            <BodyCell>
	                              <div className="space-y-1">
	                                <Badge tone={categoryState.tone}>{categoryState.label}</Badge>
	                                {!selectedCategoryRule?.active && <p className="text-xs font-semibold text-slate-600">Not enabled for this category yet.</p>}
	                              </div>
	                            </BodyCell>
	                            <BodyCell><StateBadge enabled={transition.active} trueLabel="Active" falseLabel="Inactive" /></BodyCell>
	                            <BodyCell>
	                              <div className="flex flex-wrap gap-1.5">
	                                <Badge tone={transition.systemTransition ? "blue" : "slate"}>{transition.systemTransition ? "System" : "Custom"}</Badge>
	                                <Badge tone={protectedRecord ? "yellow" : "slate"}>{protectedRecord ? "Protected" : "Editable"}</Badge>
	                              </div>
	                            </BodyCell>
	                            <BodyCell>
	                              <div className="flex flex-wrap gap-2">
	                                <button
	                                  type="button"
	                                  onClick={(event) => {
	                                    event.stopPropagation();
	                                    requestRuleChange({ scope: "category", transition, category: selectedCategory, rule: selectedCategoryRule, nextActive: true });
	                                  }}
	                                  disabled={!selectedCategory || selectedCategoryRule?.active || isSavingRule}
	                                  className="inline-flex min-h-9 items-center justify-center rounded-lg bg-blue-950 px-3 py-2 text-xs font-extrabold text-white hover:bg-blue-900 disabled:opacity-50"
	                                >
	                                  Enable Category Rule
	                                </button>
	                                <button
	                                  type="button"
	                                  onClick={(event) => {
	                                    event.stopPropagation();
	                                    openTransitionForm(transition);
	                                  }}
	                                  disabled={protectedRecord}
	                                  title={protectedRecord ? "System/protected transitions cannot be edited or disabled." : "Edit transition"}
	                                  className="inline-flex min-h-9 items-center justify-center rounded-lg border border-slate-300 px-3 py-2 text-xs font-extrabold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
	                                >
	                                  Edit
	                                </button>
	                              </div>
	                            </BodyCell>
	                          </tr>
	                        );
	                      })}
	                    </tbody>
	                  </TableShell>
	                </div>
	              </details>
                  )}
                </div>

                <aside className="rounded-lg border border-slate-200 bg-white shadow-sm 2xl:sticky 2xl:top-4 2xl:max-h-[calc(100vh-2rem)] 2xl:overflow-y-auto">
                  {!selectedInspectorTransition && (
                    <div className="px-4 py-5 text-sm font-semibold text-slate-600">
                      Select a transition to review runtime readiness, access, validation, and technical metadata.
                    </div>
                  )}
                  {selectedInspectorTransition && (() => {
                    const transition = selectedInspectorTransition;
                    const from = getStatusLabel(transition, "from");
                    const to = getStatusLabel(transition, "to");
                    const selectedCategoryRule = getSelectedCategoryRule(transition, selectedCategoryId, categoryRulesByTransitionId);
                    const categoryState = getRuleVisualState(selectedCategoryRule);
                    const issueRowsForTransition = transitionIssueRowsById[String(transition.id)] || [];
                    const runtimeState = transitionRuntimeById[String(transition.id)] || getTransitionRuntimeState(transition, selectedCategoryId, categoryRulesByTransitionId, issueRowsForTransition, actionByKey);
                    const accessSummary = getTransitionAccessSummary(transition, activeRoles, roleAccessByRoleId, roleRulesByTransitionId);
                    const roleRules = roleRulesByTransitionId[transition.id] || [];
                    const protectedRecord = isProtectedTransition(transition);
                    return (
                      <div>
                        <div className="border-b border-slate-200 px-4 py-4">
                          <p className="text-xs font-extrabold uppercase text-slate-500">Transition Inspector</p>
                          <h3 className="mt-1 break-words text-lg font-extrabold text-blue-950">
                            {transition.displayName || actionByKey[transition.actionKey]?.displayName || formatLabel(transition.actionKey)}
                          </h3>
                          <div className="mt-3 flex flex-wrap gap-2">
                            <Badge tone={runtimeState.tone}>{runtimeState.label}</Badge>
                            <Badge tone={categoryState.tone}>Rule: {categoryState.label}</Badge>
                          </div>
                        </div>

                        <div className="space-y-4 px-4 py-4">
                          <section>
                            <h4 className="text-sm font-extrabold text-blue-950">Business Path</h4>
                            <dl className="mt-2">
                              <DetailRow label="From status" value={from.label} />
                              <DetailRow label="Action" value={transition.displayName || actionByKey[transition.actionKey]?.displayName || formatLabel(transition.actionKey)} />
                              <DetailRow label="To status" value={to.label} />
                            </dl>
                          </section>

                          <section>
                            <h4 className="text-sm font-extrabold text-blue-950">Runtime Readiness</h4>
                            <p className="mt-2 text-sm font-semibold text-slate-700">{runtimeState.detail}</p>
                            {issueRowsForTransition.length > 0 && (
                              <div className="mt-3 space-y-2">
                                {issueRowsForTransition.map((row, index) => (
                                  <div key={`${row.issue?.code || "issue"}-${index}`} className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
                                    <div className="flex items-center justify-between gap-2">
                                      <p className="text-xs font-extrabold uppercase text-slate-500">{row.issue?.code || "Validation issue"}</p>
                                      <Badge tone={row.warning ? "yellow" : "red"}>{row.warning ? "Warning" : "Blocker"}</Badge>
                                    </div>
                                    <p className="mt-1 text-sm font-semibold text-slate-700">{row.issue?.message || row.guidance?.explanation}</p>
                                    <p className="mt-1 text-xs font-bold text-blue-950">{row.guidance?.fix}</p>
                                  </div>
                                ))}
                              </div>
                            )}
                            {issueRowsForTransition.length === 0 && (
                              <p className="mt-2 rounded-lg border border-green-200 bg-green-50 px-3 py-2 text-sm font-bold text-green-700">
                                No validation issue is currently attached to this transition.
                              </p>
                            )}
                          </section>

                          <section>
                            <h4 className="text-sm font-extrabold text-blue-950">Access</h4>
                            <div className="mt-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-3">
                              <Badge tone={accessSummary.tone}>{accessSummary.label}</Badge>
                              <p className="mt-2 text-sm font-semibold text-slate-700">{accessSummary.detail}</p>
                              <p className="mt-2 text-xs font-semibold text-slate-600">
                                Optional transition restrictions: {roleRules.length === 0 ? "not configured" : `${roleRules.filter((rule) => rule.active).length}/${roleRules.length} active`}.
                              </p>
                            </div>
                          </section>

                          <details className="rounded-lg border border-slate-200 bg-white px-3 py-3">
                            <summary className="cursor-pointer text-sm font-extrabold text-blue-950">Technical Metadata</summary>
                            <dl className="mt-2">
                              <DetailRow label="Transition ID" value={transition.id} />
                              <DetailRow label="From key" value={from.key || "UNKNOWN"} />
                              <DetailRow label="Action key" value={transition.actionKey || "UNKNOWN"} />
                              <DetailRow label="To key" value={to.key || "UNKNOWN"} />
                              <DetailRow label="Transition active" value={transition.active ? "Active" : "Inactive"} />
                              <DetailRow label="System / protected" value={`${transition.systemTransition ? "System" : "Custom"} / ${protectedRecord ? "Protected" : "Editable"}`} />
                              <DetailRow label="Sort order" value={transition.sortOrder ?? "Not set"} />
                            </dl>
                          </details>
                        </div>

                        <div className="flex flex-wrap gap-2 border-t border-slate-200 px-4 py-4">
                          <button
                            type="button"
                            onClick={() => openTransitionForm(transition)}
                            disabled={protectedRecord}
                            className="inline-flex min-h-9 items-center justify-center rounded-lg border border-slate-300 px-3 py-2 text-xs font-extrabold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                          >
                            Edit
                          </button>
                          <button
                            type="button"
                            onClick={() => requestRuleChange({ scope: "category", transition, category: selectedCategory, rule: selectedCategoryRule, nextActive: !selectedCategoryRule?.active })}
                            disabled={!selectedCategory || isSavingRule}
                            className="inline-flex min-h-9 items-center justify-center rounded-lg border border-amber-200 px-3 py-2 text-xs font-extrabold text-amber-800 hover:bg-amber-50 disabled:opacity-50"
                          >
                            {selectedCategoryRule?.active ? "Disable Category Rule" : "Enable Category Rule"}
                          </button>
                          <button
                            type="button"
                            onClick={() => requestTransitionStateChange(transition, !transition.active)}
                            disabled={protectedRecord}
                            className="inline-flex min-h-9 items-center justify-center rounded-lg border border-blue-200 px-3 py-2 text-xs font-extrabold text-blue-950 hover:bg-blue-50 disabled:opacity-50"
                          >
                            {transition.active ? "Disable Transition" : "Enable Transition"}
                          </button>
                          <button
                            type="button"
                            onClick={() => openTransitionDrawer(transition)}
                            className="inline-flex min-h-9 items-center justify-center rounded-lg border border-slate-200 px-3 py-2 text-xs font-extrabold text-slate-700 hover:bg-slate-50"
                          >
                            Full Details
                          </button>
                        </div>
                      </div>
                    );
                  })()}
                </aside>
	            </div>
            </div>
	          )}

          {activeTab === "statuses" && (
            <div className="space-y-3">
              <div className="flex justify-end">
                <button
                  type="button"
                  onClick={() => openStatusForm()}
                  className="inline-flex min-h-10 items-center justify-center rounded-lg bg-blue-950 px-4 py-2 text-sm font-bold text-white hover:bg-blue-900"
                >
                  Create Global Status Metadata
                </button>
              </div>
              <p className="text-sm font-semibold text-slate-600">Selected-category statuses below come from this category's transitions. New status metadata becomes available for transition creation, then appears here after a selected-category transition uses it.</p>
              <TableShell minWidth="min-w-[1040px]">
                <thead>
                  <tr>
                    <HeaderCell>Display Name</HeaderCell>
                    <HeaderCell>Status Key</HeaderCell>
                    <HeaderCell>Behavior Bucket</HeaderCell>
                    <HeaderCell>Terminal</HeaderCell>
                    <HeaderCell>Active</HeaderCell>
                    <HeaderCell>System/Protected</HeaderCell>
                    <HeaderCell>Sort Order</HeaderCell>
                    <HeaderCell>Actions</HeaderCell>
                  </tr>
                </thead>
                <tbody>
                  {(isLoading || isLoadingCategoryWorkflow) && <EmptyRows colSpan={8}>Loading workflow statuses for selected category...</EmptyRows>}
                  {!isLoading && !isLoadingCategoryWorkflow && selectedCategoryConfiguredStatuses.length === 0 && <EmptyRows colSpan={8}>No workflow statuses are used by the selected category workflow yet.</EmptyRows>}
                  {!isLoading && !isLoadingCategoryWorkflow && selectedCategoryConfiguredStatuses.map((status) => {
                    const protectedRecord = isProtectedStatus(status);
                    return (
                      <tr key={status.id ?? status.statusKey} onClick={() => openStatusDrawer(status)} className="cursor-pointer hover:bg-blue-50/50">
                        <BodyCell><span className="font-bold text-blue-950">{status.displayName || formatLabel(status.statusKey)}</span></BodyCell>
                        <BodyCell><span className="break-all text-xs font-extrabold uppercase text-slate-600">{status.statusKey || "UNKNOWN"}</span></BodyCell>
                        <BodyCell>{status.behaviorBucket ? formatLabel(status.behaviorBucket) : "Not set"}</BodyCell>
                        <BodyCell><Badge tone={status.terminal ? "red" : "slate"}>{status.terminal ? "Terminal" : "Non-terminal"}</Badge></BodyCell>
                        <BodyCell><StateBadge enabled={status.active} trueLabel="Active" falseLabel="Inactive" /></BodyCell>
                        <BodyCell>
                          <div className="flex flex-wrap gap-1.5">
                            <Badge tone={status.systemStatus ? "blue" : "slate"}>{status.systemStatus ? "System" : "Custom"}</Badge>
                            <Badge tone={protectedRecord ? "yellow" : "slate"}>{protectedRecord ? "Protected" : "Editable"}</Badge>
                          </div>
                        </BodyCell>
                        <BodyCell>{status.sortOrder ?? "Not set"}</BodyCell>
                        <BodyCell>
                          <div className="flex flex-wrap gap-2">
                            <button
                              type="button"
                              onClick={(event) => {
                                event.stopPropagation();
                                openStatusForm(status);
                              }}
                              disabled={protectedRecord}
                              className="inline-flex min-h-9 items-center justify-center rounded-lg border border-slate-300 px-3 py-2 text-xs font-extrabold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                            >
                              Edit
                            </button>
                            <button
                              type="button"
                              onClick={(event) => {
                                event.stopPropagation();
                                requestMetadataStateChange("status", status, !status.active);
                              }}
                              disabled={protectedRecord}
                              className="inline-flex min-h-9 items-center justify-center rounded-lg border border-blue-200 px-3 py-2 text-xs font-extrabold text-blue-950 hover:bg-blue-50 disabled:opacity-50"
                            >
                              {status.active ? "Disable" : "Enable"}
                            </button>
                          </div>
                        </BodyCell>
                      </tr>
                    );
                  })}
                </tbody>
              </TableShell>
              <details className="rounded-lg border border-slate-200 bg-white px-4 py-3">
                <summary className="cursor-pointer text-sm font-extrabold text-blue-950">Advanced Global Status Metadata</summary>
                <p className="mt-2 text-sm font-semibold text-slate-600">Global workflow statuses can be created, edited, enabled, or disabled here. These records may belong to another category until a transition and category rule use them.</p>
                <div className="mt-3">
                  <TableShell minWidth="min-w-[1040px]">
                    <thead>
                      <tr>
                        <HeaderCell>Display Name</HeaderCell>
                        <HeaderCell>Status Key</HeaderCell>
                        <HeaderCell>Active</HeaderCell>
                        <HeaderCell>System/Protected</HeaderCell>
                        <HeaderCell>Actions</HeaderCell>
                      </tr>
                    </thead>
                    <tbody>
                      {statuses.map((status) => {
                        const protectedRecord = isProtectedStatus(status);
                        return (
                          <tr key={status.id ?? status.statusKey} onClick={() => openStatusDrawer(status)} className="cursor-pointer hover:bg-blue-50/50">
                            <BodyCell><span className="font-bold text-blue-950">{status.displayName || formatLabel(status.statusKey)}</span></BodyCell>
                            <BodyCell><span className="break-all text-xs font-extrabold uppercase text-slate-600">{status.statusKey || "UNKNOWN"}</span></BodyCell>
                            <BodyCell><StateBadge enabled={status.active} trueLabel="Active" falseLabel="Inactive" /></BodyCell>
                            <BodyCell>
                              <div className="flex flex-wrap gap-1.5">
                                <Badge tone={status.systemStatus ? "blue" : "slate"}>{status.systemStatus ? "System" : "Custom"}</Badge>
                                <Badge tone={protectedRecord ? "yellow" : "slate"}>{protectedRecord ? "Protected" : "Editable"}</Badge>
                              </div>
                            </BodyCell>
                            <BodyCell>
                              <div className="flex flex-wrap gap-2">
                                <button type="button" onClick={(event) => { event.stopPropagation(); openStatusForm(status); }} disabled={protectedRecord} className="inline-flex min-h-9 items-center justify-center rounded-lg border border-slate-300 px-3 py-2 text-xs font-extrabold text-slate-700 hover:bg-slate-50 disabled:opacity-50">Edit</button>
                                <button type="button" onClick={(event) => { event.stopPropagation(); requestMetadataStateChange("status", status, !status.active); }} disabled={protectedRecord} className="inline-flex min-h-9 items-center justify-center rounded-lg border border-blue-200 px-3 py-2 text-xs font-extrabold text-blue-950 hover:bg-blue-50 disabled:opacity-50">{status.active ? "Disable" : "Enable"}</button>
                              </div>
                            </BodyCell>
                          </tr>
                        );
                      })}
                      {statuses.length === 0 && <EmptyRows colSpan={5}>No global workflow statuses loaded.</EmptyRows>}
                    </tbody>
                  </TableShell>
                </div>
              </details>
            </div>
          )}

          {activeTab === "actions" && (
            <div className="space-y-3">
              <div className="flex flex-col gap-2 lg:flex-row lg:items-center lg:justify-between">
                <p className="text-sm font-semibold text-slate-600">Selected-category actions below come from this category's transitions. New action metadata becomes available for transition creation, then appears here after a selected-category transition uses it. Creating a custom action does not grant role access automatically.</p>
                <button
                  type="button"
                  onClick={() => openActionForm()}
                  className="inline-flex min-h-10 items-center justify-center rounded-lg bg-blue-950 px-4 py-2 text-sm font-bold text-white hover:bg-blue-900"
                >
                  Create Global Action Metadata
                </button>
              </div>
              <TableShell minWidth="min-w-[1120px]">
                <thead>
                  <tr>
                    <HeaderCell>Display Name</HeaderCell>
                    <HeaderCell>Action Key / Access Key</HeaderCell>
                    <HeaderCell>Active</HeaderCell>
                    <HeaderCell>Requires Comment</HeaderCell>
                    <HeaderCell>Confirmation Required</HeaderCell>
                    <HeaderCell>System/Protected</HeaderCell>
                    <HeaderCell>Sort Order</HeaderCell>
                    <HeaderCell>Actions</HeaderCell>
                  </tr>
                </thead>
                <tbody>
                  {(isLoading || isLoadingCategoryWorkflow) && <EmptyRows colSpan={8}>Loading workflow actions for selected category...</EmptyRows>}
                  {!isLoading && !isLoadingCategoryWorkflow && selectedCategoryConfiguredActions.length === 0 && <EmptyRows colSpan={8}>No workflow actions are used by the selected category workflow yet.</EmptyRows>}
                  {!isLoading && !isLoadingCategoryWorkflow && selectedCategoryConfiguredActions.map((action) => {
                    const protectedRecord = isProtectedAction(action);
                    const metadata = accessKeyByKey[action.actionKey];
                    return (
                      <tr key={action.id ?? action.actionKey} onClick={() => openActionDrawer(action)} className="cursor-pointer hover:bg-blue-50/50">
                        <BodyCell><BusinessKeyLabel label={action.displayName} technicalKey={action.actionKey} /></BodyCell>
                        <BodyCell>
                          <BusinessKeyLabel label={metadata?.displayName || action.displayName} technicalKey={action.actionKey} subtle />
                          <span className="mt-1 block text-xs font-semibold text-slate-600">{metadata ? "Access metadata linked" : "Access metadata pending"}</span>
                        </BodyCell>
                        <BodyCell><StateBadge enabled={action.active} trueLabel="Active" falseLabel="Inactive" /></BodyCell>
                        <BodyCell><Badge tone={action.requiresComment ? "yellow" : "slate"}>{action.requiresComment ? "Required" : "No"}</Badge></BodyCell>
                        <BodyCell><Badge tone={action.confirmationRequired ? "yellow" : "slate"}>{action.confirmationRequired ? "Required" : "No"}</Badge></BodyCell>
                        <BodyCell>
                          <div className="flex flex-wrap gap-1.5">
                            <Badge tone={action.systemAction ? "blue" : "slate"}>{action.systemAction ? "System" : "Custom"}</Badge>
                            <Badge tone={protectedRecord ? "yellow" : "slate"}>{protectedRecord ? "Protected" : "Editable"}</Badge>
                          </div>
                        </BodyCell>
                        <BodyCell>{action.sortOrder ?? "Not set"}</BodyCell>
                        <BodyCell>
                          <div className="flex flex-wrap gap-2">
                            <button
                              type="button"
                              onClick={(event) => {
                                event.stopPropagation();
                                openActionForm(action);
                              }}
                              disabled={protectedRecord}
                              className="inline-flex min-h-9 items-center justify-center rounded-lg border border-slate-300 px-3 py-2 text-xs font-extrabold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                            >
                              Edit
                            </button>
                            <button
                              type="button"
                              onClick={(event) => {
                                event.stopPropagation();
                                requestMetadataStateChange("action", action, !action.active);
                              }}
                              disabled={protectedRecord}
                              className="inline-flex min-h-9 items-center justify-center rounded-lg border border-blue-200 px-3 py-2 text-xs font-extrabold text-blue-950 hover:bg-blue-50 disabled:opacity-50"
                            >
                              {action.active ? "Disable" : "Enable"}
                            </button>
                          </div>
                        </BodyCell>
                      </tr>
                    );
                  })}
                </tbody>
              </TableShell>
              <details className="rounded-lg border border-slate-200 bg-white px-4 py-3">
                <summary className="cursor-pointer text-sm font-extrabold text-blue-950">Advanced Global Action Metadata</summary>
                <p className="mt-2 text-sm font-semibold text-slate-600">Global workflow actions can be created, edited, enabled, or disabled here. These records may belong to another category until a selected-category transition uses them.</p>
                <div className="mt-3">
                  <TableShell minWidth="min-w-[1120px]">
                    <thead>
                      <tr>
                        <HeaderCell>Display Name</HeaderCell>
                        <HeaderCell>Action Key / Access Key</HeaderCell>
                        <HeaderCell>Active</HeaderCell>
                        <HeaderCell>System/Protected</HeaderCell>
                        <HeaderCell>Actions</HeaderCell>
                      </tr>
                    </thead>
                    <tbody>
                      {actions.map((action) => {
                        const protectedRecord = isProtectedAction(action);
                        const metadata = accessKeyByKey[action.actionKey];
                        return (
                          <tr key={action.id ?? action.actionKey} onClick={() => openActionDrawer(action)} className="cursor-pointer hover:bg-blue-50/50">
                            <BodyCell><BusinessKeyLabel label={action.displayName} technicalKey={action.actionKey} /></BodyCell>
                            <BodyCell>
                              <BusinessKeyLabel label={metadata?.displayName || action.displayName} technicalKey={action.actionKey} subtle />
                              <span className="mt-1 block text-xs font-semibold text-slate-600">{metadata ? "Access metadata linked" : "Access metadata pending"}</span>
                            </BodyCell>
                            <BodyCell><StateBadge enabled={action.active} trueLabel="Active" falseLabel="Inactive" /></BodyCell>
                            <BodyCell>
                              <div className="flex flex-wrap gap-1.5">
                                <Badge tone={action.systemAction ? "blue" : "slate"}>{action.systemAction ? "System" : "Custom"}</Badge>
                                <Badge tone={protectedRecord ? "yellow" : "slate"}>{protectedRecord ? "Protected" : "Editable"}</Badge>
                              </div>
                            </BodyCell>
                            <BodyCell>
                              <div className="flex flex-wrap gap-2">
                                <button type="button" onClick={(event) => { event.stopPropagation(); openActionForm(action); }} disabled={protectedRecord} className="inline-flex min-h-9 items-center justify-center rounded-lg border border-slate-300 px-3 py-2 text-xs font-extrabold text-slate-700 hover:bg-slate-50 disabled:opacity-50">Edit</button>
                                <button type="button" onClick={(event) => { event.stopPropagation(); requestMetadataStateChange("action", action, !action.active); }} disabled={protectedRecord} className="inline-flex min-h-9 items-center justify-center rounded-lg border border-blue-200 px-3 py-2 text-xs font-extrabold text-blue-950 hover:bg-blue-50 disabled:opacity-50">{action.active ? "Disable" : "Enable"}</button>
                              </div>
                            </BodyCell>
                          </tr>
                        );
                      })}
                      {actions.length === 0 && <EmptyRows colSpan={5}>No global workflow actions loaded.</EmptyRows>}
                    </tbody>
                  </TableShell>
                </div>
              </details>
            </div>
          )}

          {activeTab === "roleAccess" && (
            <div className="space-y-5">
              <div>
                <h2 className="mb-2 text-sm font-extrabold uppercase text-slate-600">Selected Category Action Access</h2>
                <TableShell minWidth="min-w-[900px]">
                  <thead>
                    <tr>
                      <HeaderCell>Action</HeaderCell>
                      {activeRoles.map((role) => <HeaderCell key={role.id}>{role.displayName || role.roleKey}</HeaderCell>)}
                    </tr>
                  </thead>
                  <tbody>
                    {selectedCategoryConfiguredActions.map((action) => (
                      <tr key={action.id ?? action.actionKey}>
                        <BodyCell><BusinessKeyLabel label={action.displayName} technicalKey={action.actionKey} /></BodyCell>
                        {activeRoles.map((role) => {
                          const protectedRole = role.roleKey === "SUPER_ADMIN";
                          const accessState = actionAccessState(action.actionKey, role, roleAccessByRoleId);
                          const isSavingThisRule = savingRoleAccessKey === `${role.id}:${action.actionKey}`;
                          return (
                          <BodyCell key={role.id}>
                            <div className="flex flex-col gap-2">
                              <ScopeBadge value={accessState} />
                              <button
                                type="button"
                                onClick={() => toggleRoleActionAccess(role, action)}
                                disabled={protectedRole || isSavingThisRule}
                                className="inline-flex min-h-8 items-center justify-center rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-extrabold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                              >
                                {isSavingThisRule ? "Saving..." : accessState === "full" ? "Disable" : "Enable"}
                              </button>
                            </div>
                          </BodyCell>
                          );
                        })}
                      </tr>
                    ))}
                    {selectedCategoryConfiguredActions.length === 0 && <EmptyRows colSpan={activeRoles.length + 1}>No selected-category workflow actions available for role access matrix.</EmptyRows>}
                  </tbody>
                </TableShell>
              </div>

              <div>
                <h2 className="mb-2 text-sm font-extrabold uppercase text-slate-600">Selected Category Optional Transition Restrictions</h2>
                <p className="mb-3 max-w-4xl text-sm font-semibold text-slate-600">
                  Action permission decides who can use an action. Transition role scope is optional and narrows that action permission for a specific transition. If no transition role scope is configured, all roles with action permission can use the transition.
                </p>
                <TableShell minWidth="min-w-[1040px]">
                  <thead>
                    <tr>
                      <HeaderCell>Action / Transition</HeaderCell>
                      {activeRoles.map((role) => <HeaderCell key={role.id}>{role.displayName || role.roleKey}</HeaderCell>)}
                    </tr>
                  </thead>
                  <tbody>
                    {selectedCategoryConfiguredTransitions.map((transition) => {
                      const from = getStatusLabel(transition, "from");
                      const to = getStatusLabel(transition, "to");
                      return (
                        <tr key={transition.id} onClick={() => openTransitionDrawer(transition)} className="cursor-pointer hover:bg-blue-50/50">
                          <BodyCell>
                            <BusinessKeyLabel label={transition.displayName || actionByKey[transition.actionKey]?.displayName} technicalKey={transition.actionKey} />
                            <span className="mt-1 block text-xs font-semibold text-slate-600">{from.label} to {to.label}</span>
                          </BodyCell>
                          {activeRoles.map((role) => {
                            const roleRules = roleRulesByTransitionId[transition.id] || [];
                            const rule = roleRules.find((item) => String(item.roleId) === String(role.id));
                            const scopeState = roleRuleState(transition.id, role.id, roleRulesByTransitionId);
                            return (
                              <BodyCell key={role.id}>
                                <div className="flex flex-col gap-2">
                                  <ScopeBadge value={combinedTransitionRoleState(transition, role, roleAccessByRoleId, roleRulesByTransitionId)} />
                                  <button
                                    type="button"
                                    onClick={(event) => {
                                      event.stopPropagation();
                                      requestRuleChange({ scope: "role", transition, role, rule, nextActive: scopeState !== "full" });
                                    }}
                                    disabled={isSavingRule || (scopeState === "full" && !rule)}
                                    className="inline-flex min-h-8 items-center justify-center rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-extrabold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                                  >
                                    {scopeState === "full" ? "Remove Restriction" : "Restrict by Role"}
                                  </button>
                                </div>
                              </BodyCell>
                            );
                          })}
                        </tr>
                      );
                    })}
                    {selectedCategoryConfiguredTransitions.length === 0 && <EmptyRows colSpan={activeRoles.length + 1}>No selected-category workflow transitions available for role rule matrix.</EmptyRows>}
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

              {selectedValidationResult && (
                <div className="grid gap-3 md:grid-cols-3">
                  <div className="rounded-lg border border-slate-200 bg-white px-4 py-3">
                    <p className="text-xs font-extrabold uppercase text-slate-500">Validation Result</p>
                    <p className={`mt-1 text-lg font-extrabold ${(selectedValidationResult.readyToActivate || selectedValidationResult.valid) ? "text-green-700" : "text-red-700"}`}>
                      {(selectedValidationResult.readyToActivate || selectedValidationResult.valid) ? "Ready" : "Not Ready"}
                    </p>
                  </div>
                  <div className="rounded-lg border border-slate-200 bg-white px-4 py-3">
                    <p className="text-xs font-extrabold uppercase text-slate-500">Blocking Issues</p>
                    <p className="mt-1 text-lg font-extrabold text-blue-950">{(selectedValidationResult.blockingIssues || []).length}</p>
                  </div>
                  <div className="rounded-lg border border-slate-200 bg-white px-4 py-3">
                    <p className="text-xs font-extrabold uppercase text-slate-500">Warnings</p>
                    <p className="mt-1 text-lg font-extrabold text-blue-950">{(selectedValidationResult.warnings || []).length}</p>
                  </div>
                </div>
              )}

              <TableShell minWidth="min-w-[1180px]">
                <thead>
                  <tr>
                    <HeaderCell>Issue Type</HeaderCell>
                    <HeaderCell>Code</HeaderCell>
                    <HeaderCell>Plain English Explanation</HeaderCell>
                    <HeaderCell>Affected Item</HeaderCell>
                    <HeaderCell>Suggested Fix</HeaderCell>
                    <HeaderCell>Target Tab</HeaderCell>
                  </tr>
                </thead>
                <tbody>
                  {!selectedValidationResult && <EmptyRows colSpan={6}>Validation has not been run for the selected category. Run validation to confirm backend readiness and get fix guidance.</EmptyRows>}
                  {selectedValidationResult && validationGuidanceRows.length === 0 && (
                    <EmptyRows colSpan={6}>No validation issues found for the selected category.</EmptyRows>
                  )}
                  {validationGuidanceRows.map(({ issue, transition, guidance, warning }, index) => {
                    return (
                      <tr key={`${issue.code}-${issue.transitionId ?? "none"}-${index}`} className={transition ? "cursor-pointer hover:bg-blue-50/50" : ""} onClick={() => transition && openTransitionDrawer(transition)}>
                        <BodyCell><Badge tone={warning ? "yellow" : "red"}>{warning ? "Warning" : "Blocking"}</Badge></BodyCell>
                        <BodyCell><span className="break-all text-xs font-extrabold uppercase text-slate-600">{issue.code || "ISSUE"}</span></BodyCell>
                        <BodyCell>
                          <p className="font-semibold text-slate-800">{guidance.explanation}</p>
                          {issue.message && <p className="mt-1 text-xs font-semibold text-slate-500">Backend message: {issue.message}</p>}
                        </BodyCell>
                        <BodyCell>
                          <p className="font-semibold text-blue-950">{guidance.affected}</p>
                          {issue.transitionId && <p className="mt-1 text-xs font-bold text-slate-500">Transition #{issue.transitionId}</p>}
                        </BodyCell>
                        <BodyCell><p className="font-semibold text-slate-700">{guidance.fix}</p></BodyCell>
                        <BodyCell>
                          <div className="flex flex-wrap gap-2">
                            {guidance.targetTabs.map((tabLabel) => {
                              const targetTab = tabs.find((tab) => tab.label === tabLabel);
                              return (
                                <button
                                  key={tabLabel}
                                  type="button"
                                  onClick={(event) => {
                                    event.stopPropagation();
                                    if (targetTab) setActiveTab(targetTab.id);
                                  }}
                                  className="inline-flex min-h-8 items-center justify-center rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-extrabold text-blue-950 hover:bg-blue-50"
                                >
                                  {tabLabel}
                                </button>
                              );
                            })}
                          </div>
                        </BodyCell>
                      </tr>
                    );
                  })}
                </tbody>
              </TableShell>
            </div>
          )}
        </section>
      </div>
      </div>

      <DetailDrawer
        item={drawerItem}
        onClose={() => setDrawerItem(null)}
        selectedCategory={selectedCategory}
        managedRoles={activeRoles}
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
      <EntityFormModal
        formState={metadataForm}
        onCancel={() => setMetadataForm(null)}
        onChange={updateMetadataForm}
        onSubmit={submitMetadataForm}
        isSaving={isSavingMetadata}
        error={metadataFormError}
      />
      <ConfirmMetadataChangeDialog
        pendingChange={pendingMetadataChange}
        onCancel={() => setPendingMetadataChange(null)}
        onConfirm={confirmMetadataChange}
        isSaving={isSavingMetadata}
      />
      <TransitionFormModal
        formState={transitionForm}
        statuses={statuses}
        actions={actions}
        selectedCategory={selectedCategory}
        onCancel={() => {
          setTransitionForm(null);
          setTransitionFormError("");
        }}
        onChange={updateTransitionForm}
        onSubmit={submitTransitionForm}
        isSaving={isSavingTransition}
        error={transitionFormError}
      />
      <ConfirmTransitionChangeDialog
        pendingChange={pendingTransitionChange}
        onCancel={() => setPendingTransitionChange(null)}
        onConfirm={confirmTransitionChange}
        isSaving={isSavingTransition}
      />
      <ConfirmWorkflowModeChangeDialog
        pendingChange={pendingWorkflowModeChange}
        onCancel={() => setPendingWorkflowModeChange(null)}
        onConfirm={confirmWorkflowModeChange}
        isSaving={isSavingWorkflowMode}
      />
    </main>
  );
}
