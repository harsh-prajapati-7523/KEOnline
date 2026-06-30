import { useCallback, useEffect, useMemo, useState } from "react";
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
  XCircle,
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

const managedRoleKeys = ["SUPER_ADMIN", "ADMIN", "TECHNICIAN"];
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
  const title = `${isCreate ? "Create" : "Edit"} ${isStatus ? "Custom Status" : "Custom Action"}`;

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

function TransitionFormModal({ formState, statuses, actions, onCancel, onChange, onSubmit, isSaving }) {
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

          <FormField label="Display Name">
            <input className={textInputClass()} value={values.displayName} onChange={(event) => onChange("displayName", event.target.value)} maxLength={80} required />
          </FormField>
          <FormField label="Sort Order">
            <input className={textInputClass()} type="number" value={values.sortOrder} onChange={(event) => onChange("sortOrder", event.target.value)} />
          </FormField>
          {isCreate && (
            <label className="flex min-h-10 items-center gap-2 text-sm font-bold text-slate-700">
              <input type="checkbox" checked={values.active} onChange={(event) => onChange("active", event.target.checked)} />
              Active on create
            </label>
          )}
          <div className="rounded-lg border border-yellow-200 bg-yellow-50 px-3 py-2 text-xs font-semibold text-yellow-800 sm:col-span-2">
            Creating a transition does not automatically enable it for a category or role. Use category and role rule controls separately after creation.
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

function WorkflowMapView({
  statuses,
  transitions,
  selectedItem,
  onSelectItem,
  selectedCategory,
  isLegacyWorkflowMode,
  isLoadingCategoryWorkflow,
}) {
  const [activeFilter, setActiveFilter] = useState("all");
  const story = useMemo(() => getWorkflowStory(statuses, transitions), [statuses, transitions]);
  useEffect(() => {
    setActiveFilter("all");
  }, [selectedCategory?.id]);
  const filterChips = [
    { id: "all", label: "All" },
    { id: "main", label: "Main Path" },
    { id: "missing", label: "Missing Part" },
    { id: "approval", label: "Customer Approval" },
    { id: "warranty", label: "Warranty" },
    { id: "declined", label: "Declined" },
  ];
  const configuredGroups = story.groups.filter((group) => group.edges.some((edge) => edge.transition));
  const visibleGroups = activeFilter === "all"
    ? configuredGroups.filter((group) => group.id !== "declined")
    : configuredGroups.filter((group) => group.id === activeFilter);
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
            This category is currently using the legacy fixed workflow. Configure and validate DB workflow before activation.
          </div>
        )}
        {!isLoadingCategoryWorkflow && !isLegacyWorkflowMode && configuredGroups.length === 0 && (
          <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-5 text-sm font-semibold text-amber-900">
            No workflow transitions are configured for this category yet. Create transitions and enable category rules to build this category workflow.
          </div>
        )}
        {!isLoadingCategoryWorkflow && !isLegacyWorkflowMode && configuredGroups.length > 0 && (
          <div className="flex flex-wrap gap-3">
            {filterChips.map((chip) => (
              <button
                key={chip.id}
                type="button"
                onClick={() => setActiveFilter(chip.id)}
                className={`min-h-10 rounded-lg border px-4 py-2 text-sm font-bold transition ${
                  activeFilter === chip.id
                    ? "border-blue-600 bg-blue-600 text-white shadow-sm"
                    : "border-slate-200 bg-white text-slate-700 hover:border-blue-300 hover:text-blue-700"
                }`}
              >
                {chip.label}
              </button>
            ))}
          </div>
        )}
        {!isLoadingCategoryWorkflow && !isLegacyWorkflowMode && configuredGroups.length > 0 && visibleGroups.length === 0 && (
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
          <Badge tone={roleRules.length === 0 ? "green" : "blue"}>Roles: {roleRules.length === 0 ? "All roles" : `${roleRules.filter((rule) => rule.active).length}/${roleRules.length} active`}</Badge>
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

          <MapDisclosureSection title="Role Rule Controls">
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
  const [activeTab, setActiveTab] = useState("map");
  const [categories, setCategories] = useState([]);
  const [selectedCategoryId, setSelectedCategoryId] = useState("");
  const [categoryWorkflowConfig, setCategoryWorkflowConfig] = useState(null);
  const [transitions, setTransitions] = useState([]);
  const [transitionOptions, setTransitionOptions] = useState([]);
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
  const [isLoadingCategoryWorkflow, setIsLoadingCategoryWorkflow] = useState(false);
  const [error, setError] = useState("");
  const [statusMessage, setStatusMessage] = useState("");
  const [drawerItem, setDrawerItem] = useState(null);
  const [pendingRuleChange, setPendingRuleChange] = useState(null);
  const [metadataForm, setMetadataForm] = useState(null);
  const [metadataFormError, setMetadataFormError] = useState("");
  const [pendingMetadataChange, setPendingMetadataChange] = useState(null);
  const [transitionForm, setTransitionForm] = useState(null);
  const [pendingTransitionChange, setPendingTransitionChange] = useState(null);
  const [pendingWorkflowModeChange, setPendingWorkflowModeChange] = useState(null);
  const [selectedMapItem, setSelectedMapItem] = useState(null);

  const selectedCategory = useMemo(
    () => categories.find((category) => String(category.id) === String(selectedCategoryId)),
    [categories, selectedCategoryId]
  );

  const configuredTransitions = useMemo(
    () => transitions.filter((transition) => {
      if (!transition.active || !selectedCategoryId) return false;
      const rules = categoryRulesByTransitionId[transition.id] || [];
      return rules.some((rule) => String(rule.categoryId) === String(selectedCategoryId) && rule.active);
    }),
    [categoryRulesByTransitionId, selectedCategoryId, transitions]
  );

  const isLegacyWorkflowMode = categoryWorkflowConfig?.workflowMode === "LEGACY_FIXED";
  const categoryWorkflowTransitions = useMemo(
    () => isLegacyWorkflowMode ? [] : configuredTransitions,
    [configuredTransitions, isLegacyWorkflowMode]
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

  const configuredActionCount = useMemo(
    () => categoryWorkflowActionKeys.size,
    [categoryWorkflowActionKeys]
  );

  const categoryWorkflowActions = useMemo(
    () => actions.filter((action) => categoryWorkflowActionKeys.has(action.actionKey)),
    [actions, categoryWorkflowActionKeys]
  );

  const editableConfiguredTransitions = useMemo(
    () => categoryWorkflowTransitions.filter((transition) => !isProtectedTransition(transition)),
    [categoryWorkflowTransitions]
  );

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

  const managedRoles = useMemo(
    () => roles.filter((role) => managedRoleKeys.includes(role.roleKey)),
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
  const workflowStory = useMemo(() => getWorkflowStory(categoryWorkflowStatuses, categoryWorkflowTransitions), [categoryWorkflowStatuses, categoryWorkflowTransitions]);
  const configuredTerminalStatus = categoryWorkflowStatuses.find((status) => status.terminal);
  const terminalStatusLabel = configuredTerminalStatus?.displayName || (categoryWorkflowTransitions.length > 0 ? workflowStory.nodes.delivered.label : "Not configured");
  const workflowModeLabel = categoryWorkflowConfig?.workflowMode === "DB_CONFIGURED" || categoryWorkflowConfig?.dbWorkflowEnabled ? "DB Configured" : categoryWorkflowConfig?.workflowMode ? formatLabel(categoryWorkflowConfig.workflowMode) : "Not loaded";
  const workflowStatusLabel = isLegacyWorkflowMode
    ? "Legacy Fixed"
    : categoryWorkflowConfig?.dbWorkflowEnabled
    ? categoryWorkflowTransitions.length > 0 ? "Active in Test" : "No Active Paths"
    : "Validation Needed";
  const summaryTiles = [
    { label: "Mode", value: workflowModeLabel, icon: Database, tone: "text-blue-600" },
    { label: "Status", value: workflowStatusLabel, icon: CheckCircle2, tone: categoryWorkflowConfig?.dbWorkflowEnabled && categoryWorkflowTransitions.length > 0 ? "text-emerald-600" : "text-amber-600" },
    { label: "Total Statuses", value: categoryWorkflowStatuses.length, icon: Layers3, tone: "text-violet-600" },
    { label: "Total Actions", value: configuredActionCount, icon: Zap, tone: "text-blue-600" },
    { label: "Terminal Status", value: terminalStatusLabel, icon: Flag, tone: "text-orange-600" },
  ];

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

  const loadTransitionsAndRules = useCallback(async () => {
    const [transitionResponse, optionResponse] = await Promise.all([
      fetch("/volt/workflow/transitions", { headers: authHeaders() }),
      fetch("/volt/workflow/transition-options", { headers: authHeaders() }),
    ]);

    if (!transitionResponse.ok) {
      throw new Error("Unable to refresh workflow transitions.");
    }

    const transitionData = await transitionResponse.json();
    const nextTransitions = normalizeArray(transitionData, "transitions");
    setTransitions(nextTransitions);
    if (optionResponse.ok) {
      const optionData = await optionResponse.json();
      setTransitionOptions(normalizeArray(optionData, "options"));
    }
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
      const [categoryResponse, transitionResponse, transitionOptionResponse, statusResponse, actionResponse, roleResponse, accessKeyResponse] = await Promise.all([
        fetch("/volt/ticket-categories", { headers: authHeaders() }),
        fetch("/volt/workflow/transitions", { headers: authHeaders() }),
        fetch("/volt/workflow/transition-options", { headers: authHeaders() }),
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
      if (transitionOptionResponse.ok) {
        const optionData = await transitionOptionResponse.json();
        setTransitionOptions(normalizeArray(optionData, "options"));
      }
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
    setSelectedMapItem(null);
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

    const stillVisible = categoryWorkflowTransitions.some((transition) => String(transition.id) === String(drawerItem.data.id));
    if (!stillVisible) setDrawerItem(null);
  }, [categoryWorkflowTransitions, drawerItem]);

  const changeSelectedCategory = (categoryId) => {
    setSelectedCategoryId(categoryId);
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

  const refreshMetadataAndValidate = async (message) => {
    await loadWorkflowMetadata();
    await runValidation();
    setStatusMessage(message);
  };

  const refreshTransitionsAndValidate = async (message) => {
    await loadTransitionsAndRules();
    await runValidation();
    setStatusMessage(message);
  };

  const openTransitionForm = (transition = null) => {
    if (transition && isProtectedTransition(transition)) return;
    setError("");
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
    setTransitionForm((current) => current ? {
      ...current,
      values: {
        ...current.values,
        [field]: value,
      },
    } : current);
  };

  const hasDuplicateTransition = (values) => transitions.some((transition) => (
    String(transition.fromStatusId) === String(values.fromStatusId)
      && String(transition.toStatusId) === String(values.toStatusId)
      && transition.actionKey === values.actionKey
  ));

  const buildTransitionPayload = (values, includeCreateOnly) => ({
    ...(includeCreateOnly ? {
      fromStatusId: Number(values.fromStatusId),
      actionKey: values.actionKey,
      toStatusId: Number(values.toStatusId),
      active: Boolean(values.active),
    } : {}),
    displayName: values.displayName.trim(),
    sortOrder: values.sortOrder === "" ? null : Number(values.sortOrder),
  });

  const saveTransitionForm = async (change = transitionForm) => {
    if (!change) return;
    const isCreate = change.mode === "create";

    if (isCreate && hasDuplicateTransition(change.values)) {
      setError("Workflow transition already exists for the selected source status, action, and target status.");
      return;
    }

    setIsSavingTransition(true);
    setError("");
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

      setTransitionForm(null);
      setPendingTransitionChange(null);
      await refreshTransitionsAndValidate(`Workflow transition ${isCreate ? "created" : "updated"} and validation refreshed.`);
    } catch (saveError) {
      setError(saveError.message || "Unable to save workflow transition.");
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
    () => new Set(categoryWorkflowStatuses.map((status) => String(status.statusKey || "").trim().toUpperCase())),
    [categoryWorkflowStatuses]
  );

  const visibleActionKeys = useMemo(
    () => new Set(categoryWorkflowActions.map((action) => String(action.actionKey || "").trim().toUpperCase())),
    [categoryWorkflowActions]
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
      await refreshMetadataAndValidate(`Workflow ${isStatus ? "status" : "action"} ${isCreate ? "created" : "updated"} and validation refreshed.`);
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
            This category is currently using the legacy fixed workflow. Configure and validate DB workflow before activation.
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
                  statuses={categoryWorkflowStatuses}
                  transitions={categoryWorkflowTransitions}
                  selectedItem={selectedMapItem}
                  onSelectItem={setSelectedMapItem}
                  selectedCategory={selectedCategory}
                  isLegacyWorkflowMode={isLegacyWorkflowMode}
                  isLoadingCategoryWorkflow={isLoadingCategoryWorkflow}
                  actionByKey={actionByKey}
                  categoryRulesByTransitionId={categoryRulesByTransitionId}
                  selectedCategoryId={selectedCategoryId}
                />

                <div className="flex flex-wrap gap-3 rounded-lg border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700">
                  <span className="inline-flex items-center gap-2"><span className="h-3 w-3 rounded-full border-2 border-blue-300 bg-blue-50" /> Open / Active</span>
                  <span className="inline-flex items-center gap-2"><span className="h-3 w-3 rounded-full border-2 border-yellow-300 bg-yellow-50" /> Waiting / Pending</span>
                  <span className="inline-flex items-center gap-2"><span className="h-3 w-3 rounded-full border-2 border-violet-300 bg-violet-50" /> Complete</span>
                  <span className="inline-flex items-center gap-2"><span className="h-3 w-3 rounded-full border-2 border-red-300 bg-red-50" /> Cancelled</span>
                  <span className="inline-flex items-center gap-2"><span className="h-3 w-3 rounded-full border-2 border-green-400 bg-green-50" /> Terminal</span>
                </div>
              </div>

              <MapDetailPanel
                selectedItem={selectedMapItem}
                selectedCategory={selectedCategory}
                categoryWorkflowConfig={categoryWorkflowConfig}
                isLegacyWorkflowMode={isLegacyWorkflowMode}
                validationForSelectedCategory={validationForSelectedCategory}
                readyToActivate={readyToActivate}
                blockingIssueCount={blockingIssueCount}
                warningCount={warningCount}
                selectedCategoryId={selectedCategoryId}
                categoryRulesByTransitionId={categoryRulesByTransitionId}
                roleRulesByTransitionId={roleRulesByTransitionId}
                managedRoles={managedRoles}
                actionByKey={actionByKey}
                configuredTransitions={categoryWorkflowTransitions}
                onOpenStatusForm={openStatusForm}
                onOpenTransitionForm={openTransitionForm}
                onRequestMetadataStateChange={requestMetadataStateChange}
                onRequestTransitionStateChange={requestTransitionStateChange}
                onRequestRuleChange={requestRuleChange}
                onRequestWorkflowModeChange={requestWorkflowModeChange}
                activationTargetConfig={activationTargetConfig}
                rollbackTargetConfig={rollbackTargetConfig}
                isSavingRule={isSavingRule}
                isSavingWorkflowMode={isSavingWorkflowMode}
              />
            </div>
          )}

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
                  <BodyCell>{categoryWorkflowTransitions.length} configured for selected category</BodyCell>
                  <BodyCell><Badge tone={categoryWorkflowTransitions.length > 0 ? "blue" : "slate"}>Category scoped</Badge></BodyCell>
                </tr>
                <tr>
                  <BodyCell><span className="font-bold text-blue-950">Statuses</span></BodyCell>
                  <BodyCell>{categoryWorkflowStatuses.length} configured for selected category</BodyCell>
                  <BodyCell><Badge tone={categoryWorkflowStatuses.length > 0 ? "blue" : "slate"}>Category scoped</Badge></BodyCell>
                </tr>
                <tr>
                  <BodyCell><span className="font-bold text-blue-950">Actions</span></BodyCell>
                  <BodyCell>{categoryWorkflowActions.length} configured for selected category</BodyCell>
                  <BodyCell><Badge tone={categoryWorkflowActions.length > 0 ? "blue" : "slate"}>Category scoped</Badge></BodyCell>
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
            <div className="space-y-3">
              <div className="flex flex-col gap-2 lg:flex-row lg:items-center lg:justify-between">
                <div className="flex flex-wrap gap-2">
                  <Badge tone="blue">Configured editable: {editableConfiguredTransitions.length}</Badge>
                  <Badge tone="slate">Safe options: {transitionOptions.length}</Badge>
                </div>
                <button
                  type="button"
                  onClick={() => openTransitionForm()}
                  className="inline-flex min-h-10 items-center justify-center rounded-lg bg-blue-950 px-4 py-2 text-sm font-bold text-white hover:bg-blue-900"
                >
                  Create Transition
                </button>
              </div>
              <TableShell minWidth="min-w-[1180px]">
                <thead>
                  <tr>
                    <HeaderCell>From Status</HeaderCell>
                    <HeaderCell>Action</HeaderCell>
                    <HeaderCell>To Status</HeaderCell>
                    <HeaderCell>Category Rule</HeaderCell>
                    <HeaderCell>Roles Enabled</HeaderCell>
                    <HeaderCell>Active</HeaderCell>
                    <HeaderCell>Protected/System</HeaderCell>
                    <HeaderCell>Sort Order</HeaderCell>
                    <HeaderCell>Actions</HeaderCell>
                  </tr>
                </thead>
                <tbody>
                  {(isLoading || isLoadingCategoryWorkflow) && <EmptyRows colSpan={9}>Loading workflow transitions for selected category...</EmptyRows>}
                  {!isLoading && !isLoadingCategoryWorkflow && categoryWorkflowTransitions.length === 0 && <EmptyRows colSpan={9}>No workflow transitions are configured for this category yet. Create transitions and enable category rules to build this category workflow.</EmptyRows>}
                  {!isLoading && !isLoadingCategoryWorkflow && categoryWorkflowTransitions.map((transition) => {
                    const from = getStatusLabel(transition, "from");
                    const to = getStatusLabel(transition, "to");
                    const categoryState = getCategoryRuleState(transition.id, selectedCategoryId, categoryRulesByTransitionId);
                    const roleRules = roleRulesByTransitionId[transition.id] || [];
                    const activeRoleRules = roleRules.filter((rule) => rule.active);
                    const protectedRecord = isProtectedTransition(transition);

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
                            <Badge tone={transition.systemTransition ? "blue" : "slate"}>{transition.systemTransition ? "System" : "Custom"}</Badge>
                            <Badge tone={protectedRecord ? "yellow" : "slate"}>{protectedRecord ? "Protected" : "Editable"}</Badge>
                          </div>
                        </BodyCell>
                        <BodyCell>{transition.sortOrder ?? "Not set"}</BodyCell>
                        <BodyCell>
                          <div className="flex flex-wrap gap-2">
                            <button
                              type="button"
                              onClick={(event) => {
                                event.stopPropagation();
                                openTransitionForm(transition);
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
                                requestTransitionStateChange(transition, !transition.active);
                              }}
                              disabled={protectedRecord}
                              className="inline-flex min-h-9 items-center justify-center rounded-lg border border-blue-200 px-3 py-2 text-xs font-extrabold text-blue-950 hover:bg-blue-50 disabled:opacity-50"
                            >
                              {transition.active ? "Disable" : "Enable"}
                            </button>
                          </div>
                        </BodyCell>
                      </tr>
                    );
                  })}
                </tbody>
              </TableShell>
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
                  Create Status
                </button>
              </div>
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
                  {!isLoading && !isLoadingCategoryWorkflow && categoryWorkflowStatuses.length === 0 && <EmptyRows colSpan={8}>No workflow statuses are used by the selected category workflow yet.</EmptyRows>}
                  {!isLoading && !isLoadingCategoryWorkflow && categoryWorkflowStatuses.map((status) => {
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
                <p className="text-sm font-semibold text-slate-600">Action key is the access key. Creating a custom action does not grant role access automatically.</p>
                <button
                  type="button"
                  onClick={() => openActionForm()}
                  className="inline-flex min-h-10 items-center justify-center rounded-lg bg-blue-950 px-4 py-2 text-sm font-bold text-white hover:bg-blue-900"
                >
                  Create Action
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
                  {!isLoading && !isLoadingCategoryWorkflow && categoryWorkflowActions.length === 0 && <EmptyRows colSpan={8}>No workflow actions are used by the selected category workflow yet.</EmptyRows>}
                  {!isLoading && !isLoadingCategoryWorkflow && categoryWorkflowActions.map((action) => {
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
                      {roles.map((role) => <HeaderCell key={role.id}>{role.displayName || role.roleKey}</HeaderCell>)}
                    </tr>
                  </thead>
                  <tbody>
                    {categoryWorkflowActions.map((action) => (
                      <tr key={action.id ?? action.actionKey}>
                        <BodyCell><BusinessKeyLabel label={action.displayName} technicalKey={action.actionKey} /></BodyCell>
                        {roles.map((role) => (
                          <BodyCell key={role.id}>
                            <ScopeBadge value={actionAccessState(action.actionKey, role, roleAccessByRoleId)} />
                          </BodyCell>
                        ))}
                      </tr>
                    ))}
                    {categoryWorkflowActions.length === 0 && <EmptyRows colSpan={roles.length + 1}>No selected-category workflow actions available for role access matrix.</EmptyRows>}
                  </tbody>
                </TableShell>
              </div>

              <div>
                <h2 className="mb-2 text-sm font-extrabold uppercase text-slate-600">Selected Category Transition Role Rules</h2>
                <TableShell minWidth="min-w-[1040px]">
                  <thead>
                    <tr>
                      <HeaderCell>Action / Transition</HeaderCell>
                      {roles.map((role) => <HeaderCell key={role.id}>{role.displayName || role.roleKey}</HeaderCell>)}
                    </tr>
                  </thead>
                  <tbody>
                    {categoryWorkflowTransitions.map((transition) => {
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
                    {categoryWorkflowTransitions.length === 0 && <EmptyRows colSpan={roles.length + 1}>No selected-category workflow transitions available for role rule matrix.</EmptyRows>}
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
                  {!selectedValidationResult && <EmptyRows colSpan={4}>Validation has not been run for the selected category.</EmptyRows>}
                  {selectedValidationResult && (
                    <tr>
                      <BodyCell>
                        <span className="inline-flex items-center gap-2 font-bold text-blue-950">
                          {(selectedValidationResult.readyToActivate || selectedValidationResult.valid) ? <CheckCircle2 size={17} className="text-green-600" aria-hidden="true" /> : <XCircle size={17} className="text-red-600" aria-hidden="true" />}
                          {(selectedValidationResult.readyToActivate || selectedValidationResult.valid) ? "Ready" : "Not Ready"}
                        </span>
                      </BodyCell>
                      <BodyCell>SUMMARY</BodyCell>
                      <BodyCell>
                        Blocking issues: {(selectedValidationResult.blockingIssues || []).length}; Warnings: {(selectedValidationResult.warnings || []).length}
                      </BodyCell>
                      <BodyCell>All</BodyCell>
                    </tr>
                  )}
                  {issueRows.map((issue, index) => {
                    const transition = transitions.find((item) => String(item.id) === String(issue.transitionId));
                    return (
                      <tr key={`${issue.code}-${issue.transitionId ?? "none"}-${index}`} className={transition ? "cursor-pointer hover:bg-blue-50/50" : ""} onClick={() => transition && openTransitionDrawer(transition)}>
                        <BodyCell><Badge tone={(selectedValidationResult?.warnings || []).some((warning) => warning === issue) ? "yellow" : "red"}>{(selectedValidationResult?.warnings || []).some((warning) => warning === issue) ? "Warning" : "Blocking"}</Badge></BodyCell>
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
        onCancel={() => setTransitionForm(null)}
        onChange={updateTransitionForm}
        onSubmit={submitTransitionForm}
        isSaving={isSavingTransition}
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
