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

function authHeaders() {
  return {
    Authorization: `Bearer ${localStorage.getItem("token")}`,
  };
}

function normalizeArray(data, key) {
  return Array.isArray(data) ? data : Array.isArray(data?.[key]) ? data[key] : [];
}

function formatLabel(value) {
  if (!value) return "Not available";
  return String(value).replaceAll("_", " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function createRow(seed = {}) {
  return {
    id: window.crypto?.randomUUID?.() || `${Date.now()}-${Math.random()}`,
    fromStatus: seed.fromStatus || "",
    action: seed.action || "",
    toStatus: seed.toStatus || "",
  };
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
  const [rows, setRows] = useState([createRow()]);
  const [startStatus, setStartStatus] = useState("New");
  const [terminalSelections, setTerminalSelections] = useState({});
  const [showDetails, setShowDetails] = useState(false);
  const [testResult, setTestResult] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");

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

  const validationLabel = useMemo(() => {
    const completeRows = rows.filter((row) => row.fromStatus.trim() && row.action.trim() && row.toStatus.trim());
    if (completeRows.length === 0) return "Preview";
    return completeRows.length === rows.length ? "Ready to Test" : "Incomplete Rows";
  }, [rows]);

  const terminalNames = useMemo(() => (
    statusOptions
      .filter((status) => status.terminal || terminalSelections[status.label])
      .map((status) => status.label)
  ), [statusOptions, terminalSelections]);

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
      setTransitions(normalizeArray(transitionData, "transitions"));

      const defaultStart = nextStatuses.find((status) => status.statusKey === "NEW") || nextStatuses[0];
      if (defaultStart) setStartStatus(defaultStart.displayName || formatLabel(defaultStart.statusKey));
    } catch (loadError) {
      setError(loadError.message || "Unable to load workflow builder data.");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadBuilderData();
  }, [loadBuilderData]);

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
    setRows((current) => current.map((row) => row.id === rowId ? { ...row, [field]: value } : row));
  };

  const addRow = () => {
    const previous = rows[rows.length - 1];
    setRows((current) => [...current, createRow({ fromStatus: previous?.toStatus || "" })]);
  };

  const deleteRow = (rowId) => {
    setTestResult(null);
    setRows((current) => current.length === 1 ? current : current.filter((row) => row.id !== rowId));
  };

  const runClientTest = () => {
    const issues = [];
    if (!startStatus.trim()) issues.push("Start status is required.");
    rows.forEach((row, index) => {
      if (!row.fromStatus.trim() || !row.action.trim() || !row.toStatus.trim()) {
        issues.push(`Line ${index + 1} needs From Status, Action, and To Status.`);
      }
    });
    if (terminalNames.length === 0) issues.push("At least one terminal status should be selected.");
    if (rows.length > 0 && !rows.some((row) => row.fromStatus.trim().toLowerCase() === startStatus.trim().toLowerCase())) {
      issues.push("No line starts from the selected start status.");
    }
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
                <p className="mt-1 text-sm font-semibold text-slate-600">Statuses and actions created from typed text can be customized later.</p>
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
                  disabled
                  className="inline-flex min-h-10 items-center justify-center rounded-lg bg-slate-200 px-4 py-2 text-sm font-bold text-slate-500"
                >
                  Save Workflow - Coming Soon
                </button>
              </div>
            </div>

            <div className="mt-4 space-y-3">
              {rows.map((row, index) => (
                <div key={row.id} className="grid gap-3 rounded-lg border border-slate-200 bg-slate-50 p-3 lg:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)_auto_minmax(0,1fr)_auto] lg:items-start">
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
                    disabled={rows.length === 1}
                    title={rows.length === 1 ? "At least one line is kept in the builder." : "Delete unsaved line"}
                    className="inline-flex min-h-11 items-center justify-center rounded-lg border border-red-200 bg-white px-3 text-red-700 hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    <Trash2 size={17} aria-hidden="true" />
                  </button>
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
              <span className="mb-1 block text-xs font-extrabold uppercase text-slate-500">Start Status</span>
              <input
                className="min-h-11 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-blue-950 outline-none focus:border-blue-950"
                value={startStatus}
                onChange={(event) => setStartStatus(event.target.value)}
                list="builder-start-statuses"
              />
              <datalist id="builder-start-statuses">
                {statusOptions.map((status) => <option key={status.key} value={status.label}>{status.key}</option>)}
              </datalist>
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
                {testResult.ok ? "Preview flow passes the Phase B client checks." : testResult.issues.map((issue) => <p key={issue}>{issue}</p>)}
              </div>
            )}
          </aside>
        </div>

        <p className="mt-4 rounded-lg border border-yellow-200 bg-yellow-50 px-4 py-3 text-sm font-semibold text-yellow-900">
          Save is disabled in this preview phase. This builder does not create statuses, actions, transitions, category rules, role rules, or category workflow mode changes.
        </p>
      </div>
    </main>
  );
}
