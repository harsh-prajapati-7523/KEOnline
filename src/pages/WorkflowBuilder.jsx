import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ArrowDown,
  ArrowLeft,
  CheckCircle2,
  Database,
  Flag,
  GitBranch,
  Info,
  ListChecks,
  Plus,
  Search,
  Trash2,
  Workflow,
  Zap,
} from "lucide-react";
import { useNavigate, useSearchParams } from "react-router-dom";

const customMetadataMessage = "Statuses and actions created from typed text can be customized later.";
const roleAccessMessage = "Category use is controlled by category rules. Role access is configured separately after creation.";
const reservedStatusKeys = new Set(["NEW", "PICKED", "IN_PROGRESS", "COMPLETED", "CANCELLED"]);
const protectedActionKeys = new Set([
  "VIEW_DASHBOARD",
  "VIEW_TICKETS",
  "CREATE_TICKET",
  "PICK_TICKET",
  "ASSIGN_TICKET",
  "START_WORK",
  "COMPLETE_TICKET",
  "CANCEL_TICKET",
  "UPDATE_WARRANTY",
  "VIEW_CUSTOMER_HISTORY",
  "VIEW_CHARGES",
  "ADD_CHARGE",
  "DELETE_CHARGE",
  "USE_TICKET_SEARCH",
  "USE_TICKET_FILTERS",
  "USE_SMART_SUGGESTIONS",
  "VIEW_EMPLOYEE_MANAGEMENT",
  "MANAGE_EMPLOYEES",
  "VIEW_ROLE_MANAGEMENT",
  "MANAGE_ROLES",
  "VIEW_TICKET_CATEGORY_MANAGEMENT",
  "MANAGE_TICKET_CATEGORIES",
  "VIEW_TICKET_FIELD_MANAGEMENT",
  "MANAGE_TICKET_FIELDS",
  "VIEW_CATEGORY_FIELD_CONFIGURATION",
  "MANAGE_CATEGORY_FIELD_CONFIGS",
  "VIEW_DROPDOWN_SOURCE_MANAGEMENT",
  "MANAGE_DROPDOWN_SOURCES",
]);

function authHeaders(includeContentType = false) {
  return {
    ...(includeContentType ? { "Content-Type": "application/json" } : {}),
    Authorization: `Bearer ${localStorage.getItem("token")}`,
  };
}

async function readApiError(response, fallback) {
  try {
    const body = await response.json();
    return typeof body.message === "string" && body.message.length <= 180 ? body.message : fallback;
  } catch {
    return fallback;
  }
}

function normalizeArray(data, key) {
  return Array.isArray(data) ? data : Array.isArray(data?.[key]) ? data[key] : [];
}

function formatLabel(value) {
  if (!value) return "Not available";
  return String(value).replaceAll("_", " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function normalizeText(value) {
  return String(value || "").trim();
}

function baseKeyFromText(value, maxLength) {
  return normalizeText(value)
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, maxLength)
    .replace(/^_+|_+$/g, "");
}

function uniqueGeneratedKey(value, existingKeys, reservedKeys, maxLength) {
  const base = baseKeyFromText(value, maxLength);
  if (base.length < 2) {
    return { key: "", error: "Generated key must contain at least 2 uppercase letters, digits, or underscores." };
  }

  for (let suffix = 0; suffix < 1000; suffix += 1) {
    const suffixText = suffix === 0 ? "" : `_${suffix + 1}`;
    const trimmedBase = base.slice(0, maxLength - suffixText.length).replace(/_+$/g, "");
    const candidate = `${trimmedBase}${suffixText}`;
    if (candidate.length >= 2 && !existingKeys.has(candidate) && !reservedKeys.has(candidate)) {
      return { key: candidate, error: "" };
    }
  }

  return { key: "", error: "Unable to generate a unique key for this value." };
}

function createRow(seed = {}) {
  return {
    id: window.crypto?.randomUUID?.() || `${Date.now()}-${Math.random()}`,
    fromStatus: seed.fromStatus || "",
    action: seed.action || "",
    toStatus: seed.toStatus || "",
    toStatusTerminal: Boolean(seed.toStatusTerminal),
  };
}

function createRowFromTransition(transition, actionByKey = {}) {
  const action = actionByKey[transition.actionKey];
  return createRow({
    fromStatus: transition.fromStatusDisplayName || formatLabel(transition.fromStatusKey || transition.fromStatus),
    action: action?.displayName || transition.displayName || formatLabel(transition.actionKey),
    toStatus: transition.toStatusDisplayName || formatLabel(transition.toStatusKey || transition.toStatus),
    toStatusTerminal: Boolean(transition.toStatusTerminal),
  });
}

const rowStateStyles = {
  Unsaved: "border-slate-200 bg-slate-100 text-slate-700",
  "Creating Status": "border-yellow-200 bg-yellow-50 text-yellow-800",
  "Creating Action": "border-yellow-200 bg-yellow-50 text-yellow-800",
  "Saving Transition": "border-blue-200 bg-blue-50 text-blue-950",
  Saved: "border-green-200 bg-green-50 text-green-700",
  "Already exists": "border-blue-200 bg-blue-50 text-blue-950",
  Failed: "border-red-200 bg-red-50 text-red-700",
};

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

function SummaryTile({ icon: Icon, label, value, tone = "text-blue-600" }) {
  return (
    <div className="flex min-h-20 items-center gap-4 rounded-lg border border-slate-200 bg-white px-5 py-4 shadow-sm">
      <Icon className={tone} size={28} aria-hidden="true" />
      <div className="min-w-0">
        <p className="text-xs font-bold uppercase text-slate-500">{label}</p>
        <p className="truncate text-sm font-extrabold text-slate-950">{value}</p>
      </div>
    </div>
  );
}

function SearchableInput({ label, value, onChange, options, listId, placeholder }) {
  const exactMatch = options.find((option) => option.label.toLowerCase() === value.trim().toLowerCase()
    || option.key.toLowerCase() === value.trim().toLowerCase());
  const showCreateHint = value.trim() && !exactMatch;

  return (
    <label className="block min-w-0">
      <span className="mb-1 flex items-center gap-1.5 text-xs font-extrabold uppercase text-slate-500">
        <Search size={13} aria-hidden="true" />
        {label}
      </span>
      <input
        className="min-h-11 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-blue-950 outline-none focus:border-blue-950"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        list={listId}
        placeholder={placeholder}
      />
      <datalist id={listId}>
        {options.map((option) => (
          <option key={option.key} value={option.label}>
            {option.key}
          </option>
        ))}
      </datalist>
      {showCreateHint && <p className="mt-1 text-xs font-semibold text-amber-700">Create new suggestion</p>}
    </label>
  );
}

function RowArrow() {
  return <span className="hidden pt-8 text-xl font-black text-slate-300 lg:inline">-&gt;</span>;
}

export default function WorkflowBuilder() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const requestedCategoryId = searchParams.get("categoryId") || "";
  const [categories, setCategories] = useState([]);
  const [categoryConfig, setCategoryConfig] = useState(null);
  const [statuses, setStatuses] = useState([]);
  const [actions, setActions] = useState([]);
  const [transitions, setTransitions] = useState([]);
  const [categoryRulesByTransitionId, setCategoryRulesByTransitionId] = useState({});
  const [rows, setRows] = useState([createRow()]);
  const [rowSaveStates, setRowSaveStates] = useState({});
  const [rowErrors, setRowErrors] = useState({});
  const [seededCategoryId, setSeededCategoryId] = useState("");
  const [startStatus, setStartStatus] = useState("New");
  const [terminalSelections, setTerminalSelections] = useState({});
  const [showDetails, setShowDetails] = useState(false);
  const [testResult, setTestResult] = useState(null);
  const [validationResult, setValidationResult] = useState(null);
  const [validationStale, setValidationStale] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState("");
  const [statusMessage, setStatusMessage] = useState("");

  const selectedCategory = useMemo(
    () => categories.find((category) => String(category.id) === String(requestedCategoryId)) || categories[0] || null,
    [categories, requestedCategoryId]
  );

  const selectedCategoryId = selectedCategory?.id || requestedCategoryId;
  const categoryName = selectedCategory?.displayName || formatLabel(selectedCategory?.categoryKey) || "Selected Category";
  const workflowMode = categoryConfig?.workflowMode
    ? categoryConfig.workflowMode === "DB_CONFIGURED" || categoryConfig.dbWorkflowEnabled
      ? "DB Configured"
      : formatLabel(categoryConfig.workflowMode)
    : "Not loaded";

  const statusOptions = useMemo(
    () => statuses.map((status) => ({
      key: status.statusKey || String(status.id),
      label: status.displayName || formatLabel(status.statusKey),
      terminal: Boolean(status.terminal),
      behaviorBucket: status.behaviorBucket,
    })),
    [statuses]
  );

  const actionOptions = useMemo(
    () => actions.map((action) => ({
      key: action.actionKey,
      label: action.displayName || formatLabel(action.actionKey),
    })),
    [actions]
  );

  const actionByKey = useMemo(() => {
    const next = {};
    actions.forEach((action) => {
      if (action.actionKey) next[action.actionKey] = action;
    });
    return next;
  }, [actions]);

  const selectedCategoryTransitions = useMemo(() => {
    if (!selectedCategoryId) return [];
    return transitions
      .filter((transition) => {
        const rules = categoryRulesByTransitionId[transition.id] || [];
        return rules.some((rule) => String(rule.categoryId) === String(selectedCategoryId) && rule.active);
      })
      .sort((first, second) => (first.sortOrder ?? 999) - (second.sortOrder ?? 999) || (first.id ?? 0) - (second.id ?? 0));
  }, [categoryRulesByTransitionId, selectedCategoryId, transitions]);

  const resolveStatus = useCallback((value) => {
    const lookup = value.trim().toLowerCase();
    if (!lookup) return null;
    return statuses.find((status) => {
      const displayName = status.displayName || formatLabel(status.statusKey);
      return String(status.statusKey || "").toLowerCase() === lookup
        || String(displayName || "").toLowerCase() === lookup;
    }) || null;
  }, [statuses]);

  const selectedStartStatus = useMemo(() => resolveStatus(startStatus), [resolveStatus, startStatus]);

  const statusMatchesStart = useCallback((value, status) => {
    const startLookup = normalizeText(startStatus).toLowerCase();
    if (!startLookup) return false;
    const valueLookup = normalizeText(value).toLowerCase();
    const displayName = status?.displayName || formatLabel(status?.statusKey);
    return valueLookup === startLookup
      || String(status?.statusKey || "").toLowerCase() === startLookup
      || String(displayName || "").toLowerCase() === startLookup;
  }, [startStatus]);

  const resolveAction = useCallback((value) => {
    const lookup = value.trim().toLowerCase();
    if (!lookup) return null;
    return actions.find((action) => {
      const displayName = action.displayName || formatLabel(action.actionKey);
      return String(action.actionKey || "").toLowerCase() === lookup
        || String(displayName || "").toLowerCase() === lookup;
    }) || null;
  }, [actions]);

  const resolvedRows = useMemo(() => rows.map((row) => ({
    row,
    fromStatus: resolveStatus(row.fromStatus),
    action: resolveAction(row.action),
    toStatus: resolveStatus(row.toStatus),
  })), [resolveAction, resolveStatus, rows]);

  const rowValidation = useMemo(() => {
    const duplicateKeys = new Map();
    const statusKeysInUse = new Set(statuses.map((status) => status.statusKey).filter(Boolean));
    const actionKeysInUse = new Set(actions.map((action) => action.actionKey).filter(Boolean));

    resolvedRows.forEach(({ row, fromStatus, action, toStatus }) => {
      const fromKey = fromStatus?.id || normalizeText(row.fromStatus).toLowerCase();
      const actionKey = action?.actionKey || normalizeText(row.action).toLowerCase();
      const toKey = toStatus?.id || normalizeText(row.toStatus).toLowerCase();
      if (!fromKey || !actionKey || !toKey) return;
      const key = `${fromKey}|${actionKey}|${toKey}`;
      duplicateKeys.set(key, (duplicateKeys.get(key) || 0) + 1);
    });

    const byRowId = {};
    resolvedRows.forEach(({ row, fromStatus, action, toStatus }) => {
      const issues = [];
      const fromValue = normalizeText(row.fromStatus);
      const actionValue = normalizeText(row.action);
      const toValue = normalizeText(row.toStatus);
      const generatedFromStatus = fromStatus ? null : uniqueGeneratedKey(fromValue, statusKeysInUse, reservedStatusKeys, 50);
      if (generatedFromStatus?.key) statusKeysInUse.add(generatedFromStatus.key);
      const generatedAction = action ? null : uniqueGeneratedKey(actionValue, actionKeysInUse, protectedActionKeys, 60);
      if (generatedAction?.key) actionKeysInUse.add(generatedAction.key);
      const generatedToStatus = toStatus ? null : uniqueGeneratedKey(toValue, statusKeysInUse, reservedStatusKeys, 50);
      if (generatedToStatus?.key) statusKeysInUse.add(generatedToStatus.key);

      if (!selectedCategory?.id) issues.push("Selected category is required.");
      if (!fromValue || !actionValue || !toValue) {
        issues.push("From Status, Action, and To Status are required.");
      }
      if (fromValue && !fromStatus && fromValue.length > 80) issues.push("From Status display name must be at most 80 characters.");
      if (actionValue && !action && actionValue.length > 80) issues.push("Action display name must be at most 80 characters.");
      if (toValue && !toStatus && toValue.length > 80) issues.push("To Status display name must be at most 80 characters.");
      if (fromValue && !fromStatus && generatedFromStatus?.error) issues.push(`From Status: ${generatedFromStatus.error}`);
      if (actionValue && !action && generatedAction?.error) issues.push(`Action: ${generatedAction.error}`);
      if (toValue && !toStatus && generatedToStatus?.error) issues.push(`To Status: ${generatedToStatus.error}`);
      if (fromStatus && !fromStatus.active) issues.push("From Status is inactive.");
      if (action && !action.active) issues.push("Action is inactive.");
      if (toStatus && !toStatus.active) issues.push("To Status is inactive.");
      if (fromStatus?.terminal) issues.push("Terminal status cannot be used as From Status.");
      const duplicateKey = `${fromStatus?.id || fromValue.toLowerCase()}|${action?.actionKey || actionValue.toLowerCase()}|${toStatus?.id || toValue.toLowerCase()}`;
      if (fromValue && actionValue && toValue && (duplicateKeys.get(duplicateKey) || 0) > 1) issues.push("Duplicate workflow line in builder.");
      const fromStatusIsStart = statusMatchesStart(fromValue, fromStatus);
      byRowId[row.id] = {
        ok: issues.length === 0,
        issues,
        fromStatus,
        action,
        toStatus,
        newFromStatus: fromStatus ? null : { displayName: fromValue, statusKey: generatedFromStatus?.key || "", terminal: false, behaviorBucket: fromStatusIsStart ? "NEW" : "IN_PROGRESS" },
        newAction: action ? null : { displayName: actionValue, actionKey: generatedAction?.key || "" },
        newToStatus: toStatus ? null : { displayName: toValue, statusKey: generatedToStatus?.key || "", terminal: Boolean(row.toStatusTerminal), behaviorBucket: row.toStatusTerminal ? "COMPLETED" : "IN_PROGRESS" },
      };
    });
    return byRowId;
  }, [actions, resolvedRows, selectedCategory?.id, statusMatchesStart, statuses]);

  const startStatusIssue = useMemo(() => {
    if (!normalizeText(startStatus)) return "Choose which status will be NEW.";
    if (selectedStartStatus?.terminal) return "The selected NEW status cannot be terminal.";
    if (
      selectedStartStatus
      && selectedStartStatus.behaviorBucket !== "NEW"
      && (selectedStartStatus.systemStatus || selectedStartStatus.protectedStatus)
    ) {
      return "The selected NEW status is protected. Choose an editable custom status or type a new one.";
    }
    if (rows.length > 0 && !resolvedRows.some(({ row, fromStatus }) => statusMatchesStart(row.fromStatus, fromStatus))) {
      return "No workflow line starts from the selected NEW status.";
    }
    return "";
  }, [resolvedRows, rows.length, selectedStartStatus, startStatus, statusMatchesStart]);

  const startStatusNotice = useMemo(() => {
    if (!selectedStartStatus || selectedStartStatus.behaviorBucket === "NEW" || startStatusIssue) return "";
    return `${selectedStartStatus.displayName || formatLabel(selectedStartStatus.statusKey)} will be saved with behavior bucket NEW.`;
  }, [selectedStartStatus, startStatusIssue]);

  const hasUnsavedRows = rows.some((row) => !["Saved", "Already exists"].includes(rowSaveStates[row.id]));
  const saveDisabled = isLoading || isSaving || rows.length === 0 || !hasUnsavedRows || Boolean(startStatusIssue) || rows.some((row) => !rowValidation[row.id]?.ok);

  const validationLabel = useMemo(() => {
    if (validationStale) return "Validation Stale";
    if (validationResult) return validationResult.readyToActivate || validationResult.valid ? "Ready" : "Not Ready";
    const completeRows = rows.filter((row) => row.fromStatus.trim() && row.action.trim() && row.toStatus.trim());
    if (completeRows.length === 0) return "Preview";
    return completeRows.length === rows.length ? "Ready to Test" : "Incomplete Rows";
  }, [rows, validationResult, validationStale]);

  const terminalNames = useMemo(() => (
    [
      ...statusOptions
      .filter((status) => status.terminal || terminalSelections[status.label])
      .map((status) => status.label),
      ...rows
        .filter((row) => row.toStatusTerminal && !resolveStatus(row.toStatus) && normalizeText(row.toStatus))
        .map((row) => normalizeText(row.toStatus)),
    ]
  ), [resolveStatus, rows, statusOptions, terminalSelections]);

  const previewStatuses = useMemo(() => {
    const list = [];
    rows.forEach((row) => {
      const from = row.fromStatus.trim();
      const to = row.toStatus.trim();
      if (from && !list.includes(from)) list.push(from);
      if (to && !list.includes(to)) list.push(to);
    });
    return list.length > 0 ? list : [startStatus || "New"];
  }, [rows, startStatus]);

  const loadTransitionRules = useCallback(async (nextTransitions) => {
    const entries = await Promise.all(
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
    const nextRules = Object.fromEntries(entries);
    setCategoryRulesByTransitionId(nextRules);
    return nextRules;
  }, []);

  const loadBuilderData = useCallback(async () => {
    setIsLoading(true);
    setError("");
    try {
      const [categoryResponse, statusResponse, actionResponse, transitionResponse] = await Promise.all([
        fetch("/volt/ticket-categories", { headers: authHeaders() }),
        fetch("/volt/workflow/statuses", { headers: authHeaders() }),
        fetch("/volt/workflow/actions", { headers: authHeaders() }),
        fetch("/volt/workflow/transitions", { headers: authHeaders() }),
      ]);

      if (!categoryResponse.ok || !statusResponse.ok || !actionResponse.ok || !transitionResponse.ok) {
        throw new Error("Unable to load workflow builder data.");
      }

      const [categoryData, statusData, actionData, transitionData] = await Promise.all([
        categoryResponse.json(),
        statusResponse.json(),
        actionResponse.json(),
        transitionResponse.json(),
      ]);

      const nextCategories = normalizeArray(categoryData, "categories");
      const nextStatuses = normalizeArray(statusData, "statuses");
      setCategories(nextCategories);
      setStatuses(nextStatuses);
      setActions(normalizeArray(actionData, "actions"));
      const nextTransitions = normalizeArray(transitionData, "transitions");
      setTransitions(nextTransitions);
      await loadTransitionRules(nextTransitions);

      const defaultStart = nextStatuses.find((status) => status.statusKey === "NEW") || nextStatuses[0];
      if (defaultStart) setStartStatus(defaultStart.displayName || formatLabel(defaultStart.statusKey));
    } catch (loadError) {
      setError(loadError.message || "Unable to load workflow builder data.");
    } finally {
      setIsLoading(false);
    }
  }, [loadTransitionRules]);

  useEffect(() => {
    loadBuilderData();
  }, [loadBuilderData]);

  useEffect(() => {
    if (isLoading || !selectedCategoryId || seededCategoryId === String(selectedCategoryId)) return;

    if (selectedCategoryTransitions.length === 0) {
      setRows([createRow()]);
      setRowSaveStates({});
      setRowErrors({});
      setSeededCategoryId(String(selectedCategoryId));
      return;
    }

    const nextRows = selectedCategoryTransitions.map((transition) => createRowFromTransition(transition, actionByKey));
    setRows(nextRows);
    setRowSaveStates(Object.fromEntries(nextRows.map((row) => [row.id, "Already exists"])));
    setRowErrors({});
    setStartStatus(nextRows[0]?.fromStatus || startStatus);
    setSeededCategoryId(String(selectedCategoryId));
  }, [actionByKey, isLoading, seededCategoryId, selectedCategoryId, selectedCategoryTransitions, startStatus]);

  useEffect(() => {
    if (!selectedCategoryId) {
      setCategoryConfig(null);
      return undefined;
    }

    let ignore = false;
    fetch(`/volt/ticket-categories/${selectedCategoryId}/workflow-config`, { headers: authHeaders() })
      .then((response) => response.ok ? response.json() : null)
      .then((config) => {
        if (!ignore) setCategoryConfig(config);
      })
      .catch(() => {
        if (!ignore) setCategoryConfig(null);
      });

    return () => {
      ignore = true;
    };
  }, [selectedCategoryId]);

  const updateRow = (rowId, field, value) => {
    setTestResult(null);
    setValidationResult(null);
    setValidationStale(false);
    setStatusMessage("");
    setRowErrors((current) => ({ ...current, [rowId]: "" }));
    setRowSaveStates((current) => ({ ...current, [rowId]: "Unsaved" }));
    setRows((current) => current.map((row) => row.id === rowId ? { ...row, [field]: value } : row));
  };

  const addRow = () => {
    const previous = rows[rows.length - 1];
    setStatusMessage("");
    setValidationResult(null);
    setValidationStale(false);
    setRows((current) => [...current, createRow({ fromStatus: previous?.toStatus || "" })]);
  };

  const deleteRow = (rowId) => {
    setTestResult(null);
    setRowSaveStates((current) => {
      const next = { ...current };
      delete next[rowId];
      return next;
    });
    setRowErrors((current) => {
      const next = { ...current };
      delete next[rowId];
      return next;
    });
    setRows((current) => current.length === 1 ? current : current.filter((row) => row.id !== rowId));
  };

  const findExistingTransition = (fromStatus, action, toStatus, transitionList = transitions) => transitionList.find((transition) => (
    String(transition.fromStatusId) === String(fromStatus.id)
      && transition.actionKey === action.actionKey
      && String(transition.toStatusId) === String(toStatus.id)
  ));

  const findSelectedCategoryRule = (transitionId, rulesByTransitionId = categoryRulesByTransitionId) => (
    rulesByTransitionId[transitionId] || []
  ).find((rule) => String(rule.categoryId) === String(selectedCategory?.id));

  const activateTransition = async (transitionId) => {
    const response = await fetch(`/volt/workflow/transitions/${transitionId}`, {
      method: "PATCH",
      headers: authHeaders(true),
      body: JSON.stringify({ active: true }),
    });
    if (!response.ok) {
      throw new Error(await readApiError(response, "Category rule was saved, but transition could not be activated."));
    }
    return response.json();
  };

  const createCategoryRule = async (transitionId) => {
    const response = await fetch(`/volt/workflow/transitions/${transitionId}/category-rules`, {
      method: "POST",
      headers: authHeaders(true),
      body: JSON.stringify({ categoryId: Number(selectedCategory.id), active: true }),
    });
    if (!response.ok) {
      throw new Error(await readApiError(response, "Unable to attach workflow line to selected category."));
    }
    return response.json();
  };

  const enableCategoryRule = async (transitionId, ruleId) => {
    const response = await fetch(`/volt/workflow/transitions/${transitionId}/category-rules/${ruleId}`, {
      method: "PATCH",
      headers: authHeaders(true),
      body: JSON.stringify({ active: true }),
    });
    if (!response.ok) {
      throw new Error(await readApiError(response, "Unable to enable selected-category workflow rule."));
    }
    return response.json();
  };

  const createWorkflowStatus = async (statusDraft, sortOrder) => {
    const behaviorBucket = statusDraft.behaviorBucket || (statusDraft.terminal ? "COMPLETED" : "IN_PROGRESS");
    const response = await fetch("/volt/workflow/statuses", {
      method: "POST",
      headers: authHeaders(true),
      body: JSON.stringify({
        statusKey: statusDraft.statusKey,
        displayName: statusDraft.displayName,
        active: true,
        terminal: Boolean(statusDraft.terminal),
        behaviorBucket,
        sortOrder,
      }),
    });
    if (!response.ok) {
      throw new Error(await readApiError(response, `Unable to create workflow status ${statusDraft.displayName}.`));
    }
    return response.json();
  };

  const updateWorkflowStatusBehavior = async (status, behaviorBucket) => {
    const response = await fetch(`/volt/workflow/statuses/${status.id}`, {
      method: "PATCH",
      headers: authHeaders(true),
      body: JSON.stringify({
        displayName: status.displayName,
        terminal: Boolean(status.terminal),
        behaviorBucket,
        sortOrder: status.sortOrder,
      }),
    });
    if (!response.ok) {
      throw new Error(await readApiError(response, `Unable to set ${status.displayName || formatLabel(status.statusKey)} as the NEW status.`));
    }
    return response.json();
  };

  const createWorkflowAction = async (actionDraft, sortOrder) => {
    const response = await fetch("/volt/workflow/actions", {
      method: "POST",
      headers: authHeaders(true),
      body: JSON.stringify({
        actionKey: actionDraft.actionKey,
        displayName: actionDraft.displayName,
        buttonLabel: actionDraft.displayName,
        description: null,
        active: true,
        sortOrder,
        requiresComment: false,
        confirmationRequired: false,
      }),
    });
    if (!response.ok) {
      throw new Error(await readApiError(response, `Unable to create workflow action ${actionDraft.displayName}.`));
    }
    return response.json();
  };

  const findStatusInContext = (value, metadataContext) => {
    const lookup = normalizeText(value).toLowerCase();
    return metadataContext.statuses.find((status) => {
      const displayName = status.displayName || formatLabel(status.statusKey);
      return String(status.statusKey || "").toLowerCase() === lookup
        || String(displayName || "").toLowerCase() === lookup;
    }) || null;
  };

  const findActionInContext = (value, metadataContext) => {
    const lookup = normalizeText(value).toLowerCase();
    return metadataContext.actions.find((action) => {
      const displayName = action.displayName || formatLabel(action.actionKey);
      return String(action.actionKey || "").toLowerCase() === lookup
        || String(displayName || "").toLowerCase() === lookup;
    }) || null;
  };

  const buildStatusDraft = (displayName, metadataContext, terminal, behaviorBucket) => {
    const keys = new Set(metadataContext.statuses.map((status) => status.statusKey).filter(Boolean));
    const generated = uniqueGeneratedKey(displayName, keys, reservedStatusKeys, 50);
    if (generated.error) throw new Error(generated.error);
    return {
      statusKey: generated.key,
      displayName,
      terminal,
      behaviorBucket: behaviorBucket || (terminal ? "COMPLETED" : "IN_PROGRESS"),
    };
  };

  const buildActionDraft = (displayName, metadataContext) => {
    const keys = new Set(metadataContext.actions.map((action) => action.actionKey).filter(Boolean));
    const generated = uniqueGeneratedKey(displayName, keys, protectedActionKeys, 60);
    if (generated.error) throw new Error(generated.error);
    return {
      actionKey: generated.key,
      displayName,
    };
  };

  const resolveOrCreateRowMetadata = async (row, rowIndex, metadataContext) => {
    let fromStatus = findStatusInContext(row.fromStatus, metadataContext);
    let action = findActionInContext(row.action, metadataContext);
    let toStatus = findStatusInContext(row.toStatus, metadataContext);
    const fromStatusBehaviorBucket = statusMatchesStart(row.fromStatus, fromStatus) ? "NEW" : "IN_PROGRESS";

    if (!fromStatus) {
      setRowSaveStates((current) => ({ ...current, [row.id]: "Creating Status" }));
      const draft = buildStatusDraft(normalizeText(row.fromStatus), metadataContext, false, fromStatusBehaviorBucket);
      fromStatus = await createWorkflowStatus(draft, (rowIndex + 1) * 10);
      metadataContext.statuses.push(fromStatus);
      setStatuses((current) => [...current, fromStatus]);
    }

    if (!toStatus) {
      setRowSaveStates((current) => ({ ...current, [row.id]: "Creating Status" }));
      const draft = buildStatusDraft(normalizeText(row.toStatus), metadataContext, Boolean(row.toStatusTerminal));
      toStatus = await createWorkflowStatus(draft, (rowIndex + 1) * 10 + 5);
      metadataContext.statuses.push(toStatus);
      setStatuses((current) => [...current, toStatus]);
    }

    if (!action) {
      setRowSaveStates((current) => ({ ...current, [row.id]: "Creating Action" }));
      const draft = buildActionDraft(normalizeText(row.action), metadataContext);
      action = await createWorkflowAction(draft, (rowIndex + 1) * 10);
      metadataContext.actions.push(action);
      setActions((current) => [...current, action]);
    }

    if (fromStatus?.terminal) {
      throw new Error("Terminal status cannot be used as From Status.");
    }
    if (!fromStatus?.active || !action?.active || !toStatus?.active) {
      throw new Error("Workflow line uses inactive metadata.");
    }

    return { fromStatus, action, toStatus };
  };

  const ensureSelectedStartStatusBehavior = async (metadataContext) => {
    const status = findStatusInContext(startStatus, metadataContext);
    if (!status || status.behaviorBucket === "NEW") return;
    if (status.terminal) throw new Error("The selected NEW status cannot be terminal.");
    if (status.systemStatus || status.protectedStatus) {
      throw new Error("The selected NEW status is protected. Choose an editable custom status or type a new one.");
    }
    const updated = await updateWorkflowStatusBehavior(status, "NEW");
    metadataContext.statuses = metadataContext.statuses.map((candidate) => (
      candidate.id === updated.id ? updated : candidate
    ));
    setStatuses((current) => current.map((candidate) => (
      candidate.id === updated.id ? updated : candidate
    )));
  };

  const saveExistingTransitionRow = async ({ fromStatus, action, toStatus }, rowIndex) => {
    let transition = findExistingTransition(fromStatus, action, toStatus);
    let createdTransition = false;

    if (!transition) {
      const response = await fetch("/volt/workflow/transitions", {
        method: "POST",
        headers: authHeaders(true),
        body: JSON.stringify({
          fromStatusId: Number(fromStatus.id),
          actionKey: action.actionKey,
          toStatusId: Number(toStatus.id),
          displayName: action.displayName || formatLabel(action.actionKey),
          active: false,
          sortOrder: (rowIndex + 1) * 10,
        }),
      });
      if (!response.ok) {
        throw new Error(await readApiError(response, "Unable to create workflow transition."));
      }
      transition = await response.json();
      createdTransition = true;
      setTransitions((current) => [...current, transition]);
    }

    let rule = findSelectedCategoryRule(transition.id);
    if (rule?.active && transition.active) {
      return "Already exists";
    }

    if (rule && !rule.active) {
      rule = await enableCategoryRule(transition.id, rule.id);
    } else if (!rule) {
      rule = await createCategoryRule(transition.id);
    }

    setCategoryRulesByTransitionId((current) => ({
      ...current,
      [transition.id]: [
        ...(current[transition.id] || []).filter((candidate) => candidate.id !== rule.id),
        rule,
      ],
    }));

    if (!transition.active) {
      await activateTransition(transition.id);
    }

    return createdTransition ? "Saved" : "Saved";
  };

  const refreshValidationAfterSave = async () => {
    const response = await fetch("/volt/workflow/validate-category-workflow", {
      method: "POST",
      headers: authHeaders(true),
      body: JSON.stringify({ categoryId: Number(selectedCategory.id) }),
    });
    if (!response.ok) {
      throw new Error(await readApiError(response, "Workflow saved, but validation could not be refreshed."));
    }
    const result = await response.json();
    setValidationResult(result);
    setValidationStale(false);
  };

  const refreshAfterSave = async () => {
    const [statusResponse, actionResponse, transitionResponse, configResponse] = await Promise.all([
      fetch("/volt/workflow/statuses", { headers: authHeaders() }),
      fetch("/volt/workflow/actions", { headers: authHeaders() }),
      fetch("/volt/workflow/transitions", { headers: authHeaders() }),
      selectedCategory?.id
        ? fetch(`/volt/ticket-categories/${selectedCategory.id}/workflow-config`, { headers: authHeaders() })
        : Promise.resolve(null),
    ]);
    if (statusResponse.ok) {
      setStatuses(normalizeArray(await statusResponse.json(), "statuses"));
    }
    if (actionResponse.ok) {
      setActions(normalizeArray(await actionResponse.json(), "actions"));
    }
    if (transitionResponse.ok) {
      const nextTransitions = normalizeArray(await transitionResponse.json(), "transitions");
      setTransitions(nextTransitions);
      await loadTransitionRules(nextTransitions);
    }
    if (configResponse?.ok) {
      setCategoryConfig(await configResponse.json());
    }
    await refreshValidationAfterSave();
  };

  const saveWorkflow = async () => {
    if (saveDisabled) return;

    setIsSaving(true);
    setError("");
    setStatusMessage("");
    setValidationStale(false);
    const targetRows = rows.filter((row) => !["Saved", "Already exists"].includes(rowSaveStates[row.id]));
    const metadataContext = {
      statuses: [...statuses],
      actions: [...actions],
    };
    let savedCount = 0;
    let alreadyCount = 0;
    let failedCount = 0;

    try {
      await ensureSelectedStartStatusBehavior(metadataContext);

      for (const row of targetRows) {
        const rowIndex = rows.findIndex((candidate) => candidate.id === row.id);
        const validation = rowValidation[row.id];
        if (!validation?.ok) {
          failedCount += 1;
          setRowSaveStates((current) => ({ ...current, [row.id]: "Failed" }));
          setRowErrors((current) => ({ ...current, [row.id]: validation?.issues?.[0] || "Workflow line is not valid." }));
          continue;
        }

        setRowErrors((current) => ({ ...current, [row.id]: "" }));

        try {
          const resolvedMetadata = await resolveOrCreateRowMetadata(row, rowIndex, metadataContext);
          setRowSaveStates((current) => ({ ...current, [row.id]: "Saving Transition" }));
          const result = await saveExistingTransitionRow(resolvedMetadata, rowIndex);
          if (result === "Already exists") {
            alreadyCount += 1;
          } else {
            savedCount += 1;
          }
          setRowSaveStates((current) => ({ ...current, [row.id]: result }));
        } catch (saveError) {
          failedCount += 1;
          setRowSaveStates((current) => ({ ...current, [row.id]: "Failed" }));
          setRowErrors((current) => ({ ...current, [row.id]: saveError.message || "Unable to save workflow line." }));
        }
      }

      try {
        await refreshAfterSave();
      } catch (validationError) {
        setValidationResult(null);
        setValidationStale(true);
        setError(validationError.message || "Workflow saved, but validation could not be refreshed.");
      }

      if (failedCount > 0) {
        setStatusMessage("Some workflow lines were saved, but some failed. Review failed rows and retry.");
      } else if (savedCount === 0 && alreadyCount > 0) {
        setStatusMessage("No changes needed. All workflow lines already exist for this category.");
      } else {
        setStatusMessage("All workflow lines saved successfully.");
      }
    } finally {
      setIsSaving(false);
    }
  };

  const runClientTest = () => {
    const issues = [];
    if (startStatusIssue) issues.push(startStatusIssue);
    rows.forEach((row, index) => {
      if (!row.fromStatus.trim() || !row.action.trim() || !row.toStatus.trim()) {
        issues.push(`Line ${index + 1} needs From Status, Action, and To Status.`);
      }
    });
    if (terminalNames.length === 0) issues.push("At least one terminal status should be selected.");
    setTestResult({
      ok: issues.length === 0,
      issues,
    });
  };

  const goBackToOverview = () => {
    navigate("/admin/workflow");
  };

  return (
    <main id="main-content" className="min-h-screen bg-slate-50">
      <div className="mx-auto max-w-[1500px] px-4 py-5 sm:px-6 lg:px-8">
        <header className="border-b border-slate-200 pb-4">
          <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
            <div>
              <h1 className="text-2xl font-extrabold text-slate-950 sm:text-3xl">Workflow Transitions</h1>
              <p className="mt-1 text-lg font-semibold text-slate-600">{categoryName}</p>
            </div>
            <div className="flex flex-col gap-3 lg:items-end">
              <div className="flex flex-wrap items-center gap-2 text-sm font-semibold text-slate-500">
                <Workflow size={16} aria-hidden="true" />
                <span>Workflows</span>
                <span>/</span>
                <span className="text-slate-700">{categoryName}</span>
                <span>/</span>
                <span className="text-slate-700">Transitions</span>
              </div>
              <button
                type="button"
                onClick={goBackToOverview}
                className="inline-flex min-h-10 items-center justify-center gap-2 rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-bold text-blue-950 hover:bg-blue-50"
              >
                <ArrowLeft size={16} aria-hidden="true" />
                Back to Workflow Overview
              </button>
            </div>
          </div>
        </header>

        {error && <p className="mt-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">{error}</p>}
        {statusMessage && <p className="mt-4 rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm font-semibold text-green-700">{statusMessage}</p>}

        <section className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-5" aria-label="Workflow builder summary">
          <SummaryTile icon={GitBranch} label="Selected Category" value={categoryName} tone="text-blue-600" />
          <SummaryTile icon={Database} label="Mode" value={workflowMode} tone="text-violet-600" />
          <SummaryTile icon={CheckCircle2} label="Validation" value={validationLabel} tone={validationLabel === "Ready to Test" ? "text-emerald-600" : "text-amber-600"} />
          <button
            type="button"
            onClick={() => setShowDetails((current) => !current)}
            className="flex min-h-20 items-center gap-4 rounded-lg border border-slate-200 bg-white px-5 py-4 text-left shadow-sm hover:bg-blue-50"
          >
            <Info className="text-slate-600" size={28} aria-hidden="true" />
            <span className="min-w-0">
              <span className="block text-xs font-bold uppercase text-slate-500">Show details</span>
              <span className="block text-sm font-extrabold text-slate-950">{showDetails ? "Hide context" : "View context"}</span>
            </span>
          </button>
          <button
            type="button"
            onClick={runClientTest}
            className="flex min-h-20 items-center gap-4 rounded-lg border border-slate-200 bg-white px-5 py-4 text-left shadow-sm hover:bg-blue-50"
          >
            <ListChecks className="text-orange-600" size={28} aria-hidden="true" />
            <span className="min-w-0">
              <span className="block text-xs font-bold uppercase text-slate-500">Test flow</span>
              <span className="block text-sm font-extrabold text-slate-950">Client preview</span>
            </span>
          </button>
        </section>

        {showDetails && (
          <section className="mt-4 grid gap-3 rounded-lg border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700 md:grid-cols-3">
            <p>Category Key: <span className="font-extrabold text-blue-950">{selectedCategory?.categoryKey || "Not available"}</span></p>
            <p>Status Metadata: <span className="font-extrabold text-blue-950">{statuses.length}</span></p>
            <p>Action Metadata: <span className="font-extrabold text-blue-950">{actions.length}</span></p>
          </section>
        )}

        {isLoading && <p className="mt-4 rounded-lg border border-blue-200 bg-blue-50 px-4 py-3 text-sm font-semibold text-blue-950">Loading workflow builder...</p>}

        <div className="mt-5 grid gap-5 xl:grid-cols-[minmax(0,1fr)_24rem]">
          <section className="min-w-0 rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
            <div className="flex flex-col gap-3 border-b border-slate-200 pb-4 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <h2 className="text-xl font-extrabold text-slate-950">Build Workflow Path</h2>
                <p className="mt-1 text-sm font-semibold text-slate-600">{customMetadataMessage}</p>
                <p className="mt-1 text-sm font-semibold text-slate-600">{roleAccessMessage}</p>
              </div>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={addRow}
                  className="inline-flex min-h-10 items-center justify-center gap-2 rounded-lg bg-blue-950 px-4 py-2 text-sm font-bold text-white hover:bg-blue-900"
                >
                  <Plus size={16} aria-hidden="true" />
                  Add Line
                </button>
                <button
                  type="button"
                  onClick={saveWorkflow}
                  disabled={saveDisabled}
                  title={saveDisabled ? "Complete all rows with valid statuses/actions before saving." : "Save selected-category workflow lines"}
                  className="inline-flex min-h-10 items-center justify-center rounded-lg bg-blue-950 px-4 py-2 text-sm font-bold text-white hover:bg-blue-900 disabled:cursor-not-allowed disabled:bg-slate-200 disabled:text-slate-500"
                >
                  {isSaving ? "Saving Workflow..." : "Save Workflow"}
                </button>
              </div>
            </div>

            <div className="mt-4 space-y-3">
              {rows.map((row, index) => (
                <div key={row.id} className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                  <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)_auto_minmax(0,1fr)_auto] lg:items-start">
                    <SearchableInput
                      label={`Line ${index + 1} From Status`}
                      value={row.fromStatus}
                      onChange={(value) => updateRow(row.id, "fromStatus", value)}
                      options={statusOptions}
                      listId={`from-status-${row.id}`}
                      placeholder="New"
                    />
                    <RowArrow />
                    <SearchableInput
                      label="Action"
                      value={row.action}
                      onChange={(value) => updateRow(row.id, "action", value)}
                      options={actionOptions}
                      listId={`action-${row.id}`}
                      placeholder="Start Repair Work"
                    />
                    <RowArrow />
                    <SearchableInput
                      label="To Status"
                      value={row.toStatus}
                      onChange={(value) => updateRow(row.id, "toStatus", value)}
                      options={statusOptions}
                      listId={`to-status-${row.id}`}
                      placeholder="In Progress"
                    />
                    <button
                      type="button"
                      onClick={() => deleteRow(row.id)}
                      disabled={rows.length === 1 || isSaving}
                      title={rows.length === 1 ? "At least one line is kept in the builder." : "Delete unsaved line"}
                      className="inline-flex min-h-11 items-center justify-center rounded-lg border border-red-200 bg-white px-3 text-red-700 hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      <Trash2 size={17} aria-hidden="true" />
                    </button>
                  </div>
                  <div className="mt-3 grid gap-2 text-xs font-semibold text-slate-600 md:grid-cols-3">
                    <div className="rounded-lg border border-slate-200 bg-white px-3 py-2">
                      <Badge tone={rowValidation[row.id]?.fromStatus ? "green" : "yellow"}>{rowValidation[row.id]?.fromStatus ? "Existing" : "New"}</Badge>
                      <p className="mt-1">From: <span className="font-extrabold text-blue-950">{rowValidation[row.id]?.fromStatus?.statusKey || rowValidation[row.id]?.newFromStatus?.statusKey || "Pending"}</span></p>
                      {!rowValidation[row.id]?.fromStatus && rowValidation[row.id]?.newFromStatus?.behaviorBucket && (
                        <p className="mt-1 text-slate-500">Bucket: {rowValidation[row.id].newFromStatus.behaviorBucket}</p>
                      )}
                    </div>
                    <div className="rounded-lg border border-slate-200 bg-white px-3 py-2">
                      <Badge tone={rowValidation[row.id]?.action ? "green" : "yellow"}>{rowValidation[row.id]?.action ? "Existing" : "New"}</Badge>
                      <p className="mt-1">Action: <span className="font-extrabold text-blue-950">{rowValidation[row.id]?.action?.actionKey || rowValidation[row.id]?.newAction?.actionKey || "Pending"}</span></p>
                    </div>
                    <div className="rounded-lg border border-slate-200 bg-white px-3 py-2">
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge tone={rowValidation[row.id]?.toStatus ? "green" : "yellow"}>{rowValidation[row.id]?.toStatus ? "Existing" : "New"}</Badge>
                        {!rowValidation[row.id]?.toStatus && normalizeText(row.toStatus) && (
                          <label className="inline-flex items-center gap-1 text-xs font-bold text-slate-700">
                            <input
                              type="checkbox"
                              checked={Boolean(row.toStatusTerminal)}
                              onChange={(event) => updateRow(row.id, "toStatusTerminal", event.target.checked)}
                              disabled={isSaving}
                            />
                            Terminal
                          </label>
                        )}
                      </div>
                      <p className="mt-1">To: <span className="font-extrabold text-blue-950">{rowValidation[row.id]?.toStatus?.statusKey || rowValidation[row.id]?.newToStatus?.statusKey || "Pending"}</span></p>
                      {!rowValidation[row.id]?.toStatus && normalizeText(row.toStatus) && (
                        <p className="mt-1 text-slate-500">Bucket: {row.toStatusTerminal ? "COMPLETED" : "IN_PROGRESS"}</p>
                      )}
                    </div>
                  </div>
                  <div className="mt-3 flex flex-col gap-2 text-xs font-semibold sm:flex-row sm:items-center sm:justify-between">
                    <span className={`inline-flex min-h-7 w-fit items-center rounded-full border px-2.5 py-1 font-bold ${rowStateStyles[rowSaveStates[row.id] || "Unsaved"]}`}>
                      {rowSaveStates[row.id] || "Unsaved"}
                    </span>
                    {(rowErrors[row.id] || rowValidation[row.id]?.issues?.[0]) && (
                      <span className="text-red-700">{rowErrors[row.id] || rowValidation[row.id].issues[0]}</span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </section>

          <aside className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
            <div className="flex items-center gap-2">
              <Flag className="text-orange-600" size={21} aria-hidden="true" />
              <h2 className="text-lg font-extrabold text-slate-950">Flow Test &amp; Status Rules</h2>
            </div>

            <label className="mt-4 block">
              <span className="mb-1 block text-xs font-extrabold uppercase text-slate-500">Which Status Will Be NEW</span>
              <input
                className={`min-h-11 w-full rounded-lg border bg-white px-3 py-2 text-sm font-semibold text-blue-950 outline-none focus:border-blue-950 ${startStatusIssue ? "border-amber-400" : "border-slate-300"}`}
                value={startStatus}
                onChange={(event) => setStartStatus(event.target.value)}
                list="builder-start-statuses"
              />
              <datalist id="builder-start-statuses">
                {statusOptions.map((status) => <option key={status.key} value={status.label}>{status.key}</option>)}
              </datalist>
              {startStatusIssue && <p className="mt-1 text-xs font-semibold text-amber-700">{startStatusIssue}</p>}
              {startStatusNotice && <p className="mt-1 text-xs font-semibold text-blue-700">{startStatusNotice}</p>}
            </label>

            <div className="mt-4">
              <p className="mb-2 text-xs font-extrabold uppercase text-slate-500">Terminal Statuses</p>
              <div className="max-h-44 space-y-2 overflow-auto rounded-lg border border-slate-200 bg-slate-50 p-3">
                {statusOptions.length === 0 && <p className="text-sm font-semibold text-slate-500">No statuses loaded.</p>}
                {statusOptions.map((status) => (
                  <label key={status.key} className="flex items-center gap-2 text-sm font-semibold text-slate-700">
                    <input
                      type="checkbox"
                      checked={Boolean(status.terminal || terminalSelections[status.label])}
                      disabled={status.terminal}
                      onChange={(event) => setTerminalSelections((current) => ({ ...current, [status.label]: event.target.checked }))}
                    />
                    <span className="min-w-0 truncate">{status.label}</span>
                    {status.terminal && <Badge tone="green">Terminal</Badge>}
                  </label>
                ))}
              </div>
            </div>

            <div className="mt-4 rounded-lg border border-slate-200 bg-slate-50 p-3">
              <p className="mb-3 text-xs font-extrabold uppercase text-slate-500">Flow Preview</p>
              <div className="space-y-2">
                {previewStatuses.map((status, index) => (
                  <div key={`${status}-${index}`} className="flex items-center gap-2 text-sm font-extrabold text-blue-950">
                    {index > 0 && <ArrowDown className="text-slate-400" size={16} aria-hidden="true" />}
                    <span className="rounded-lg border border-slate-200 bg-white px-3 py-2">{status}</span>
                  </div>
                ))}
              </div>
            </div>

            <button
              type="button"
              onClick={runClientTest}
              className="mt-4 inline-flex min-h-10 w-full items-center justify-center gap-2 rounded-lg bg-blue-950 px-4 py-2 text-sm font-bold text-white hover:bg-blue-900"
            >
              <Zap size={16} aria-hidden="true" />
              Test this flow
            </button>

            {testResult && (
              <div className={`mt-3 rounded-lg border px-3 py-2 text-sm font-semibold ${testResult.ok ? "border-green-200 bg-green-50 text-green-700" : "border-amber-200 bg-amber-50 text-amber-800"}`}>
                {testResult.ok ? "Preview flow passes the client checks." : testResult.issues.map((issue) => <p key={issue}>{issue}</p>)}
              </div>
            )}
          </aside>
        </div>

        <p className="mt-4 rounded-lg border border-yellow-200 bg-yellow-50 px-4 py-3 text-sm font-semibold text-yellow-900">
          Phase D can create missing statuses and actions from typed text. This builder does not create role rules, grant role access, activate category workflow mode, delete workflow metadata, or modify other category rules.
        </p>
      </div>
    </main>
  );
}
