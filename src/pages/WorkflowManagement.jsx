import { useCallback, useEffect, useMemo, useState } from "react";
import { ArrowLeft, CheckCircle2, RefreshCw, XCircle } from "lucide-react";
import { useNavigate } from "react-router-dom";

const tabs = [
  { id: "map", label: "Map" },
  { id: "overview", label: "Overview" },
  { id: "transitions", label: "Transitions" },
  { id: "statuses", label: "Statuses" },
  { id: "actions", label: "Actions" },
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

function getStatusTone(status) {
  if (!status?.active) return "border-slate-300 bg-slate-100 text-slate-500";
  if (status.terminal) return "border-green-400 bg-green-50 text-green-900";
  if (status.behaviorBucket === "COMPLETED") return "border-violet-300 bg-violet-50 text-violet-950";
  if (status.behaviorBucket === "CANCELLED") return "border-red-300 bg-red-50 text-red-900";
  if (status.behaviorBucket === "IN_PROGRESS") return "border-blue-300 bg-blue-50 text-blue-950";
  return "border-yellow-300 bg-yellow-50 text-yellow-900";
}

function getEdgeTone(transition, selected) {
  if (selected) return "stroke-blue-700";
  if (!transition.active) return "stroke-slate-300";
  if (isProtectedTransition(transition)) return "stroke-slate-700";
  return "stroke-slate-500";
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

function EntityFormModal({ formState, onCancel, onChange, onSubmit, isSaving }) {
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

function compactActionLabel(transition, actionByKey) {
  return transition.displayName || actionByKey[transition.actionKey]?.displayName || formatLabel(transition.actionKey);
}

function WorkflowMapView({
  statuses,
  transitions,
  selectedItem,
  onSelectItem,
  actionByKey,
}) {
  const sortedStatuses = [...statuses].sort((first, second) => (first.sortOrder ?? 999) - (second.sortOrder ?? 999) || String(first.statusKey).localeCompare(String(second.statusKey)));
  const nodeWidth = 176;
  const nodeHeight = 68;
  const mainY = 260;
  const upperY = 88;
  const lowerY = 430;

  const findStatus = (terms) => sortedStatuses.find((status) => matchesStatus(status, terms));
  const preferredMainPath = [
    findStatus(["NEW"]),
    findStatus(["IN_PROGRESS", "IN PROGRESS"]),
    findStatus(["REPAIR_COMPLETED", "REPAIR COMPLETED", "READY_FOR_DELIVERY", "READY FOR DELIVERY", "COMPLETED"]),
    findStatus(["DELIVERED_TO_CUSTOMER", "DELIVERED TO CUSTOMER", "DELIVERED"]),
  ].filter(Boolean);
  const mainPath = preferredMainPath.length >= 2 ? [...new Map(preferredMainPath.map((status) => [String(status.id), status])).values()] : sortedStatuses.slice(0, 4);
  const mainIds = new Set(mainPath.map((status) => String(status.id)));
  const branches = sortedStatuses.filter((status) => !mainIds.has(String(status.id)));
  const upperBranches = branches.filter((status) => !status.terminal && !matchesStatus(status, ["CANCEL", "DECLINED", "DELIVERED"]));
  const lowerBranches = branches.filter((status) => !upperBranches.includes(status));
  const laneCount = Math.max(mainPath.length, upperBranches.length + 1, lowerBranches.length + 1, 4);
  const stepX = 238;
  const mapWidth = Math.max(1040, 80 + (laneCount - 1) * stepX + nodeWidth + 80);
  const mapHeight = 560;
  const statusPositions = {};

  mainPath.forEach((status, index) => {
    statusPositions[String(status.id)] = { x: 72 + index * stepX, y: mainY, lane: "main" };
  });
  upperBranches.forEach((status, index) => {
    statusPositions[String(status.id)] = { x: 188 + index * stepX, y: upperY, lane: "branch" };
  });
  lowerBranches.forEach((status, index) => {
    statusPositions[String(status.id)] = { x: 188 + index * stepX, y: lowerY, lane: "branch" };
  });

  const visibleTransitions = transitions.filter((transition) => statusPositions[String(transition.fromStatusId)] && statusPositions[String(transition.toStatusId)]);
  const mainEdges = new Set(mainPath.slice(0, -1).map((status, index) => `${status.id}:${mainPath[index + 1]?.id}`));
  const actionLabelSlots = new Map();

  return (
    <div className="overflow-auto rounded-lg border border-slate-200 bg-white">
      <div
        className="relative bg-[radial-gradient(circle,#e2e8f0_1px,transparent_1px)]"
        style={{ width: mapWidth, minHeight: mapHeight, backgroundSize: "28px 28px" }}
      >
        <div className="absolute left-6 top-5 rounded-full border border-slate-200 bg-white/95 px-3 py-1 text-xs font-extrabold uppercase text-slate-500 shadow-sm">
          Branches / Exceptions
        </div>
        <div className="absolute left-6 top-[244px] rounded-full border border-blue-200 bg-blue-50 px-3 py-1 text-xs font-extrabold uppercase text-blue-950">
          Primary Flow
        </div>
        <div className="absolute left-6 top-[386px] rounded-full border border-slate-200 bg-white/95 px-3 py-1 text-xs font-extrabold uppercase text-slate-500 shadow-sm">
          Alternate Outcomes
        </div>

        <svg className="absolute inset-0" width={mapWidth} height={mapHeight} aria-hidden="true">
          <defs>
            <marker id="workflow-arrow" markerWidth="10" markerHeight="10" refX="8" refY="3" orient="auto" markerUnits="strokeWidth">
              <path d="M0,0 L0,6 L9,3 z" fill="#64748b" />
            </marker>
            <marker id="workflow-arrow-selected" markerWidth="10" markerHeight="10" refX="8" refY="3" orient="auto" markerUnits="strokeWidth">
              <path d="M0,0 L0,6 L9,3 z" fill="#1d4ed8" />
            </marker>
            <marker id="workflow-arrow-main" markerWidth="10" markerHeight="10" refX="8" refY="3" orient="auto" markerUnits="strokeWidth">
              <path d="M0,0 L0,6 L9,3 z" fill="#0f172a" />
            </marker>
          </defs>
          {visibleTransitions.map((transition) => {
            const from = statusPositions[String(transition.fromStatusId)];
            const to = statusPositions[String(transition.toStatusId)];
            const selected = selectedItem?.type === "transition" && String(selectedItem.data.id) === String(transition.id);
            const isMainEdge = mainEdges.has(`${transition.fromStatusId}:${transition.toStatusId}`);
            const startX = from.x + nodeWidth;
            const startY = from.y + nodeHeight / 2;
            const endX = to.x;
            const endY = to.y + nodeHeight / 2;
            const midX = (startX + endX) / 2;
            const sweep = isMainEdge ? 0 : Math.max(48, Math.min(110, Math.abs(endY - startY) * 0.65));
            const path = isMainEdge
              ? `M ${startX} ${startY} L ${endX} ${endY}`
              : `M ${startX} ${startY} C ${midX} ${startY + (endY > startY ? sweep : -sweep)}, ${midX} ${endY - (endY > startY ? sweep : -sweep)}, ${endX} ${endY}`;
            return (
              <path
                key={transition.id}
                d={path}
                className={`${selected ? "stroke-blue-700" : isMainEdge ? "stroke-slate-900" : getEdgeTone(transition, selected)} fill-none`}
                strokeWidth={selected ? 3.5 : isMainEdge ? 3 : 1.7}
                strokeDasharray={transition.active ? (isMainEdge ? "0" : "7 7") : "4 8"}
                opacity={selected || isMainEdge ? 1 : 0.62}
                markerEnd={selected ? "url(#workflow-arrow-selected)" : isMainEdge ? "url(#workflow-arrow-main)" : "url(#workflow-arrow)"}
              />
            );
          })}
        </svg>

        {visibleTransitions.map((transition) => {
          const from = statusPositions[String(transition.fromStatusId)];
          const to = statusPositions[String(transition.toStatusId)];
          const selected = selectedItem?.type === "transition" && String(selectedItem.data.id) === String(transition.id);
          const isMainEdge = mainEdges.has(`${transition.fromStatusId}:${transition.toStatusId}`);
          const slotKey = `${Math.round((from.x + to.x) / 2)}:${Math.round((from.y + to.y) / 2)}`;
          const slotOffset = actionLabelSlots.get(slotKey) || 0;
          actionLabelSlots.set(slotKey, slotOffset + 1);
          const left = (from.x + nodeWidth + to.x) / 2 - (isMainEdge ? 72 : 62);
          const top = (from.y + to.y) / 2 + nodeHeight / 2 - 16 + slotOffset * 28;
          return (
            <button
              key={`label-${transition.id}`}
              type="button"
              title={`${compactActionLabel(transition, actionByKey)} (${transition.actionKey})`}
              onClick={() => onSelectItem({ type: "transition", data: transition })}
              className={`absolute z-20 truncate rounded-full border bg-white px-3 py-1 text-center text-[0.68rem] font-extrabold shadow-sm transition hover:border-blue-400 hover:text-blue-950 ${selected ? "border-blue-500 text-blue-950 ring-2 ring-blue-200" : isMainEdge ? "border-slate-300 text-slate-800" : "border-slate-200 text-slate-500"} ${transition.active ? "" : "opacity-60"}`}
              style={{ left, top, width: isMainEdge ? 144 : 124 }}
            >
              {compactActionLabel(transition, actionByKey)}
            </button>
          );
        })}

        {sortedStatuses.map((status) => {
          const position = statusPositions[String(status.id)];
          if (!position) return null;
          const selected = selectedItem?.type === "status" && String(selectedItem.data.id) === String(status.id);
          const protectedRecord = isProtectedStatus(status);
          const isMain = position.lane === "main";
          return (
            <button
              key={status.id ?? status.statusKey}
              type="button"
              title={`${status.displayName || formatLabel(status.statusKey)} (${status.statusKey})`}
              onClick={() => onSelectItem({ type: "status", data: status })}
              className={`absolute z-30 rounded-lg border-2 px-3 py-3 text-left shadow-sm transition hover:shadow-md ${getStatusTone(status)} ${selected ? "ring-4 ring-blue-200" : ""} ${isMain ? "shadow-md" : "opacity-95"}`}
              style={{ left: position.x, top: position.y, width: nodeWidth, minHeight: nodeHeight }}
            >
              <span className="line-clamp-2 block text-sm font-extrabold leading-snug">{status.displayName || formatLabel(status.statusKey)}</span>
              <span className="mt-2 flex items-center gap-1.5">
                {status.terminal && <span className="h-2.5 w-2.5 rounded-full bg-green-500" aria-label="Terminal status" />}
                {protectedRecord && <span className="h-2.5 w-2.5 rounded-full bg-yellow-500" aria-label="Protected status" />}
                {!protectedRecord && !status.terminal && <span className="h-2.5 w-2.5 rounded-full bg-blue-500" aria-label="Custom status" />}
                {!status.active && <span className="text-[0.64rem] font-extrabold uppercase text-slate-500">Inactive</span>}
              </span>
            </button>
          );
        })}
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
  validationForSelectedCategory,
  readyToActivate,
  blockingIssueCount,
  warningCount,
  selectedCategoryId,
  categoryRulesByTransitionId,
  roleRulesByTransitionId,
  managedRoles,
  actionByKey,
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
  if (!selectedItem) {
    return (
      <aside className="sticky top-4 rounded-lg border border-slate-200 bg-white px-4 py-4">
        <MapPanelSection title="Selected Item">
          <BusinessKeyLabel label={selectedCategory?.displayName || "Selected Category"} technicalKey={selectedCategory?.categoryKey} />
          <p className="mt-2 text-sm font-semibold text-slate-600">Select a status or transition on the map to view rules and controls.</p>
        </MapPanelSection>

        <MapPanelSection title="Basic Details">
          <dl className="space-y-1">
            <DetailRow label="Workflow Mode" value={categoryWorkflowConfig?.workflowMode} />
            <DetailRow label="DB Workflow" value={categoryWorkflowConfig?.dbWorkflowEnabled ? "Enabled" : "Disabled"} />
            <DetailRow label="Fixed Actions" value={categoryWorkflowConfig?.fixedActionsEnabled ? "Enabled" : "Disabled"} />
          </dl>
        </MapPanelSection>

        <MapPanelSection title="Rules Summary">
          <div className="flex flex-wrap gap-2">
            <Badge tone={readyToActivate ? "green" : "yellow"}>{readyToActivate ? "Ready to Activate" : "Validation Needed"}</Badge>
            <Badge tone={blockingIssueCount > 0 ? "red" : "green"}>{blockingIssueCount} Blockers</Badge>
            <Badge tone={warningCount > 0 ? "yellow" : "slate"}>{warningCount} Warnings</Badge>
          </div>
          {!validationForSelectedCategory && <p className="mt-3 text-sm font-bold text-yellow-800">Run Validation before activation.</p>}
        </MapPanelSection>

        <MapPanelSection title="Actions Available">
          <p className="text-sm font-semibold text-slate-600">Use the map for quick selection, or switch to the management tabs for full tables.</p>
        </MapPanelSection>

        <MapPanelSection title="Advanced Controls">
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
        </MapPanelSection>
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
  const [isLoadingCategory, setIsLoadingCategory] = useState(false);
  const [isValidating, setIsValidating] = useState(false);
  const [isSavingRule, setIsSavingRule] = useState(false);
  const [isSavingMetadata, setIsSavingMetadata] = useState(false);
  const [isSavingTransition, setIsSavingTransition] = useState(false);
  const [isSavingWorkflowMode, setIsSavingWorkflowMode] = useState(false);
  const [error, setError] = useState("");
  const [statusMessage, setStatusMessage] = useState("");
  const [drawerItem, setDrawerItem] = useState(null);
  const [pendingRuleChange, setPendingRuleChange] = useState(null);
  const [metadataForm, setMetadataForm] = useState(null);
  const [pendingMetadataChange, setPendingMetadataChange] = useState(null);
  const [transitionForm, setTransitionForm] = useState(null);
  const [pendingTransitionChange, setPendingTransitionChange] = useState(null);
  const [pendingWorkflowModeChange, setPendingWorkflowModeChange] = useState(null);
  const [selectedMapItem, setSelectedMapItem] = useState(null);

  const selectedCategory = useMemo(
    () => categories.find((category) => String(category.id) === String(selectedCategoryId)),
    [categories, selectedCategoryId]
  );

  const activeTransitions = useMemo(
    () => transitions.filter((transition) => transition.active),
    [transitions]
  );

  const editableTransitions = useMemo(
    () => transitions.filter((transition) => !isProtectedTransition(transition)),
    [transitions]
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

  const validationForSelectedCategory = validationResult && String(validationResult.categoryId) === String(selectedCategoryId);
  const blockingIssueCount = validationForSelectedCategory ? (validationResult.blockingIssues || validationResult.issues || []).length : 0;
  const warningCount = validationForSelectedCategory ? (validationResult.warnings || []).length : 0;
  const readyToActivate = Boolean(validationForSelectedCategory && validationResult.readyToActivate && blockingIssueCount === 0);
  const activationTargetConfig = { workflowMode: "DB_CONFIGURED", dbWorkflowEnabled: true, fixedActionsEnabled: false };
  const rollbackTargetConfig = { workflowMode: "LEGACY_FIXED", dbWorkflowEnabled: false, fixedActionsEnabled: true };

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
      setPendingWorkflowModeChange(null);
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
      await Promise.all([loadBaseData(), loadCategoryConfig(categoryId), loadTransitionsAndRules()]);
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

  const saveMetadataForm = async (change = metadataForm) => {
    if (!change) return;
    const isStatus = change.entityType === "status";
    const isCreate = change.mode === "create";
    const endpoint = isStatus ? "/volt/workflow/statuses" : "/volt/workflow/actions";
    const payload = isStatus
      ? buildStatusPayload(change.values, isCreate)
      : buildActionPayload(change.values, isCreate);

    setIsSavingMetadata(true);
    setError("");
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
      setError(saveError.message || `Unable to save workflow ${isStatus ? "status" : "action"}.`);
    } finally {
      setIsSavingMetadata(false);
    }
  };

  const submitMetadataForm = (event) => {
    event.preventDefault();
    if (!metadataForm) return;

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
          <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
            <div>
              <p className="text-xs font-extrabold uppercase text-slate-500">Administration</p>
              <h1 className="mt-1 text-2xl font-extrabold text-blue-950 sm:text-3xl">Workflow Management</h1>
            </div>
            <div className="flex flex-col gap-2 lg:flex-row lg:items-center">
              <label className="flex items-center gap-2 text-sm font-bold text-slate-700">
                Category
                <select
                  value={selectedCategoryId}
                  onChange={(event) => setSelectedCategoryId(event.target.value)}
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
              <Badge tone="blue">{categoryWorkflowConfig?.workflowMode || "Not loaded"}</Badge>
              <Badge tone={readyToActivate ? "green" : "yellow"}>{readyToActivate ? "Ready to Activate" : "Validation Needed"}</Badge>
              <button
                type="button"
                onClick={refreshData}
                disabled={isLoading}
                className="inline-flex min-h-10 items-center justify-center gap-2 rounded-lg border border-blue-950 px-4 py-2 text-sm font-bold text-blue-950 hover:bg-blue-50 disabled:opacity-60"
              >
                <RefreshCw size={16} aria-hidden="true" />
                {isLoading ? "Refreshing..." : "Refresh"}
              </button>
            </div>
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

        <section className="mt-4 border border-slate-200 bg-white px-4 py-3" aria-label="Activation readiness">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
            <div className="min-w-0">
              <p className="text-xs font-extrabold uppercase text-slate-500">Activation Readiness</p>
              <div className="mt-2 flex flex-wrap gap-2">
                <Badge tone="blue">Category: {selectedCategory?.displayName || "Select category"}</Badge>
                <Badge tone="slate">Key: {selectedCategory?.categoryKey || "Not selected"}</Badge>
                <Badge tone="blue">Mode: {categoryWorkflowConfig?.workflowMode || "Not loaded"}</Badge>
                {isLoadingCategory && <Badge tone="yellow">Loading config</Badge>}
                <StateBadge enabled={Boolean(categoryWorkflowConfig?.dbWorkflowEnabled)} trueLabel="DB enabled" falseLabel="DB disabled" />
                <StateBadge enabled={Boolean(categoryWorkflowConfig?.fixedActionsEnabled)} trueLabel="Fixed enabled" falseLabel="Fixed disabled" />
                <Badge tone={readyToActivate ? "green" : "yellow"}>readyToActivate: {readyToActivate ? "true" : "false"}</Badge>
                <Badge tone={blockingIssueCount > 0 ? "red" : "green"}>Blockers: {blockingIssueCount}</Badge>
                <Badge tone={warningCount > 0 ? "yellow" : "slate"}>Warnings: {warningCount}</Badge>
              </div>
              <p className="mt-2 text-xs font-semibold text-slate-600">
                Updated: {formatDateTime(categoryWorkflowConfig?.workflowModeUpdatedAt)} / {categoryWorkflowConfig?.workflowModeUpdatedByEmployeeId || "Unknown"}
              </p>
              {!validationForSelectedCategory && (
                <p className="mt-2 text-sm font-bold text-yellow-800">Run Validation before activation.</p>
              )}
            </div>
            <div className="flex flex-col gap-2 sm:flex-row lg:flex-col xl:flex-row">
              <button
                type="button"
                onClick={() => requestWorkflowModeChange(activationTargetConfig)}
                disabled={!selectedCategoryId || !readyToActivate || categoryWorkflowConfig?.workflowMode === "DB_CONFIGURED" || isSavingWorkflowMode}
                className="inline-flex min-h-10 items-center justify-center rounded-lg bg-blue-950 px-4 py-2 text-sm font-bold text-white hover:bg-blue-900 disabled:opacity-50"
              >
                Activate DB Workflow
              </button>
              <button
                type="button"
                onClick={() => requestWorkflowModeChange(rollbackTargetConfig)}
                disabled={!selectedCategoryId || !categoryWorkflowConfig || categoryWorkflowConfig.workflowMode === "LEGACY_FIXED" || isSavingWorkflowMode}
                className="inline-flex min-h-10 items-center justify-center rounded-lg border border-red-200 px-4 py-2 text-sm font-bold text-red-700 hover:bg-red-50 disabled:opacity-50"
              >
                Rollback to Legacy
              </button>
            </div>
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
          {activeTab === "map" && (
            <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_22rem]">
              <div className="min-w-0 space-y-3">
                <div className="flex flex-col gap-3 rounded-lg border border-slate-200 bg-white px-4 py-3 lg:flex-row lg:items-center lg:justify-between">
                  <div className="flex flex-wrap gap-2">
                    <Badge tone="blue">{statuses.length} Statuses</Badge>
                    <Badge tone="green">{actions.length} Actions</Badge>
                    <Badge tone="yellow">{transitions.length} Transitions</Badge>
                    <Badge tone="slate">{roles.length} Roles</Badge>
                    <Badge tone={blockingIssueCount > 0 ? "red" : "green"}>{blockingIssueCount} Blockers</Badge>
                    <Badge tone={warningCount > 0 ? "yellow" : "green"}>{warningCount} Warnings</Badge>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => setActiveTab("transitions")}
                      className="inline-flex min-h-9 items-center justify-center rounded-lg border border-slate-300 px-3 py-2 text-xs font-extrabold text-blue-950 hover:bg-blue-50"
                    >
                      Manage Transitions
                    </button>
                    <button
                      type="button"
                      onClick={() => setActiveTab("statuses")}
                      className="inline-flex min-h-9 items-center justify-center rounded-lg border border-slate-300 px-3 py-2 text-xs font-extrabold text-blue-950 hover:bg-blue-50"
                    >
                      Manage Statuses
                    </button>
                    <button
                      type="button"
                      onClick={() => setActiveTab("actions")}
                      className="inline-flex min-h-9 items-center justify-center rounded-lg border border-slate-300 px-3 py-2 text-xs font-extrabold text-blue-950 hover:bg-blue-50"
                    >
                      Manage Actions
                    </button>
                    <button
                      type="button"
                      onClick={() => setActiveTab("validation")}
                      className="inline-flex min-h-9 items-center justify-center rounded-lg border border-slate-300 px-3 py-2 text-xs font-extrabold text-blue-950 hover:bg-blue-50"
                    >
                      Validation
                    </button>
                  </div>
                </div>

                <WorkflowMapView
                  statuses={statuses}
                  transitions={transitions}
                  selectedItem={selectedMapItem}
                  onSelectItem={setSelectedMapItem}
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
                validationForSelectedCategory={validationForSelectedCategory}
                readyToActivate={readyToActivate}
                blockingIssueCount={blockingIssueCount}
                warningCount={warningCount}
                selectedCategoryId={selectedCategoryId}
                categoryRulesByTransitionId={categoryRulesByTransitionId}
                roleRulesByTransitionId={roleRulesByTransitionId}
                managedRoles={managedRoles}
                actionByKey={actionByKey}
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
                  <BodyCell>{transitions.length} total, {activeTransitions.length} active</BodyCell>
                  <BodyCell><Badge tone="blue">Transition management</Badge></BodyCell>
                </tr>
                <tr>
                  <BodyCell><span className="font-bold text-blue-950">Statuses</span></BodyCell>
                  <BodyCell>{statuses.length} status records</BodyCell>
                  <BodyCell><Badge tone="blue">Custom management</Badge></BodyCell>
                </tr>
                <tr>
                  <BodyCell><span className="font-bold text-blue-950">Actions</span></BodyCell>
                  <BodyCell>{actions.length} action records</BodyCell>
                  <BodyCell><Badge tone="blue">Custom management</Badge></BodyCell>
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
                  <Badge tone="blue">Custom editable: {editableTransitions.length}</Badge>
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
                  {isLoading && <EmptyRows colSpan={9}>Loading workflow transitions...</EmptyRows>}
                  {!isLoading && transitions.length === 0 && <EmptyRows colSpan={9}>No workflow transitions found.</EmptyRows>}
                  {!isLoading && transitions.map((transition) => {
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
                  {isLoading && <EmptyRows colSpan={8}>Loading workflow statuses...</EmptyRows>}
                  {!isLoading && statuses.length === 0 && <EmptyRows colSpan={8}>No workflow statuses found.</EmptyRows>}
                  {!isLoading && statuses.map((status) => {
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
                  {isLoading && <EmptyRows colSpan={8}>Loading workflow actions...</EmptyRows>}
                  {!isLoading && actions.length === 0 && <EmptyRows colSpan={8}>No workflow actions found.</EmptyRows>}
                  {!isLoading && actions.map((action) => {
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
            </div>
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
      <EntityFormModal
        formState={metadataForm}
        onCancel={() => setMetadataForm(null)}
        onChange={updateMetadataForm}
        onSubmit={submitMetadataForm}
        isSaving={isSavingMetadata}
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
