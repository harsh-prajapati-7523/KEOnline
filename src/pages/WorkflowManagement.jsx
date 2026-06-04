import { useCallback, useEffect, useState } from "react";
import { ArrowLeft, Plus, RefreshCw, ToggleLeft, ToggleRight } from "lucide-react";
import { useNavigate } from "react-router-dom";

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
  return value ? value.replaceAll("_", " ").replace(/\b\w/g, (letter) => letter.toUpperCase()) : "Not available";
}

function formatDateTime(value) {
  if (!value) return "Not available";
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? "Not available"
    : date.toLocaleString([], { dateStyle: "medium", timeStyle: "short" });
}

function Message({ children, type = "success" }) {
  if (!children) return null;
  const className = type === "error"
    ? "border-red-200 bg-red-50 text-red-700"
    : "border-green-200 bg-green-50 text-green-700";
  return <p className={`mt-4 rounded-xl border px-4 py-3 text-sm font-semibold ${className}`}>{children}</p>;
}

function Badge({ children, tone = "slate" }) {
  const tones = {
    green: "bg-green-50 text-green-700",
    red: "bg-red-50 text-red-700",
    blue: "bg-blue-50 text-blue-950",
    yellow: "bg-yellow-100 text-yellow-800",
    slate: "bg-slate-100 text-slate-700",
  };
  return <span className={`rounded-full px-2.5 py-1 text-xs font-bold ${tones[tone]}`}>{children}</span>;
}

function normalizeTransitionOptions(data) {
  return Array.isArray(data?.options) ? data.options : [];
}

function normalizeWorkflowStatuses(data) {
  return Array.isArray(data) ? data : Array.isArray(data?.statuses) ? data.statuses : [];
}

function TransitionCard({ transition, isProcessing, onToggle }) {
  const active = Boolean(transition.active);
  const Icon = active ? ToggleRight : ToggleLeft;

  return (
    <article className="rounded-2xl border border-blue-100 bg-white p-4 shadow-sm">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <h2 className="break-words text-base font-extrabold text-blue-950">
            {transition.displayName || formatLabel(transition.actionKey)}
          </h2>
          <p className="mt-1 break-words text-xs font-bold uppercase text-gray-500">
            {transition.actionKey ?? "UNKNOWN"} · {transition.fromStatus ?? "UNKNOWN"} -&gt; {transition.toStatus ?? "UNKNOWN"}
          </p>
        </div>
        <button
          type="button"
          onClick={() => onToggle(transition)}
          disabled={isProcessing}
          className={`inline-flex min-h-11 items-center justify-center gap-2 rounded-2xl px-4 py-2 text-sm font-bold transition disabled:opacity-60 ${
            active
              ? "border border-red-200 bg-red-50 text-red-700 hover:bg-red-100"
              : "bg-blue-950 text-white hover:bg-blue-900"
          }`}
        >
          <Icon size={18} aria-hidden="true" />
          {isProcessing ? "Updating..." : active ? "Disable" : "Enable"}
        </button>
      </div>

      <div className="mt-3 flex flex-wrap gap-2">
        <Badge tone={active ? "green" : "red"}>{active ? "Active" : "Inactive"}</Badge>
        <Badge tone={transition.systemTransition ? "blue" : "slate"}>{transition.systemTransition ? "System" : "Custom"}</Badge>
        <Badge tone={transition.protectedTransition ? "yellow" : "slate"}>{transition.protectedTransition ? "Protected" : "Editable"}</Badge>
        <Badge>Sort {transition.sortOrder ?? "Not set"}</Badge>
      </div>

      <dl className="mt-4 grid grid-cols-1 gap-3 text-sm sm:grid-cols-2">
        <div>
          <dt className="font-bold text-gray-500">Created</dt>
          <dd className="mt-1 text-gray-800">{formatDateTime(transition.createdAt)}</dd>
        </div>
        <div>
          <dt className="font-bold text-gray-500">Updated</dt>
          <dd className="mt-1 text-gray-800">{formatDateTime(transition.updatedAt)}</dd>
        </div>
      </dl>
    </article>
  );
}

function WorkflowStatusCard({ status }) {
  const active = Boolean(status.active);
  const terminal = Boolean(status.terminal);

  return (
    <article className="rounded-2xl border border-blue-100 bg-white p-4 shadow-sm">
      <div className="min-w-0">
        <h3 className="break-words text-base font-extrabold text-blue-950">
          {status.displayName || formatLabel(status.statusKey)}
        </h3>
        <p className="mt-1 break-words text-xs font-bold uppercase text-gray-500">
          {status.statusKey ?? "UNKNOWN"}
        </p>
      </div>

      <div className="mt-3 flex flex-wrap gap-2">
        <Badge tone={active ? "green" : "red"}>{active ? "Active" : "Inactive"}</Badge>
        <Badge tone={status.systemStatus ? "blue" : "slate"}>{status.systemStatus ? "System" : "Custom"}</Badge>
        <Badge tone={status.protectedStatus ? "yellow" : "slate"}>{status.protectedStatus ? "Protected" : "Editable"}</Badge>
        <Badge tone={terminal ? "red" : "slate"}>{terminal ? "Terminal" : "Non-terminal"}</Badge>
        <Badge>Sort {status.sortOrder ?? "Not set"}</Badge>
      </div>
    </article>
  );
}

function TransitionOptionCard({ option, isProcessing, onCreate }) {
  const configured = Boolean(option.alreadyConfigured);

  return (
    <article className="rounded-2xl border border-blue-100 bg-white p-4 shadow-sm">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <h3 className="break-words text-base font-extrabold text-blue-950">
            {option.displayName || formatLabel(option.actionKey)}
          </h3>
          <p className="mt-1 break-words text-xs font-bold uppercase text-gray-500">
            {option.actionKey ?? "UNKNOWN"} · {option.fromStatus ?? "UNKNOWN"} -&gt; {option.toStatus ?? "UNKNOWN"}
          </p>
        </div>

        {!configured && (
          <button
            type="button"
            onClick={() => onCreate(option)}
            disabled={isProcessing}
            className="inline-flex min-h-11 items-center justify-center gap-2 rounded-2xl bg-yellow-400 px-4 py-2 text-sm font-bold text-black transition hover:bg-yellow-300 disabled:opacity-60"
          >
            <Plus size={18} aria-hidden="true" />
            {isProcessing ? "Creating..." : "Create"}
          </button>
        )}
      </div>

      <div className="mt-3 flex flex-wrap gap-2">
        <Badge tone={configured ? "green" : "yellow"}>{configured ? "Configured" : "Missing"}</Badge>
        {configured && <Badge tone={option.active ? "green" : "red"}>{option.active ? "Active" : "Inactive"}</Badge>}
        {configured && <Badge tone={option.systemTransition ? "blue" : "slate"}>{option.systemTransition ? "System" : "Custom"}</Badge>}
        {configured && <Badge tone={option.protectedTransition ? "yellow" : "slate"}>{option.protectedTransition ? "Protected" : "Editable"}</Badge>}
        <Badge>Sort {option.sortOrder ?? "Not set"}</Badge>
      </div>
    </article>
  );
}

export default function WorkflowManagement() {
  const navigate = useNavigate();
  const [transitions, setTransitions] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [message, setMessage] = useState("");
  const [messageType, setMessageType] = useState("success");
  const [processingId, setProcessingId] = useState(null);
  const [transitionOptions, setTransitionOptions] = useState([]);
  const [optionsLoading, setOptionsLoading] = useState(true);
  const [optionsError, setOptionsError] = useState("");
  const [createProcessingKey, setCreateProcessingKey] = useState("");
  const [workflowStatuses, setWorkflowStatuses] = useState([]);
  const [statusesLoading, setStatusesLoading] = useState(true);
  const [statusesError, setStatusesError] = useState("");

  const loadTransitions = useCallback(async () => {
    setIsLoading(true);
    setLoadError("");
    try {
      const response = await fetch("/volt/workflow/transitions", { headers: authHeaders() });
      if (!response.ok) throw new Error(await readApiError(response, "Unable to load workflow transitions. Please try again."));
      const data = await response.json();
      setTransitions(Array.isArray(data) ? data : []);
    } catch (error) {
      setTransitions([]);
      setLoadError(error.message || "Unable to load workflow transitions. Please try again.");
    } finally {
      setIsLoading(false);
    }
  }, []);

  const loadTransitionOptions = useCallback(async () => {
    setOptionsLoading(true);
    setOptionsError("");
    try {
      const response = await fetch("/volt/workflow/transition-options", { headers: authHeaders() });
      if (!response.ok) throw new Error("Unable to load workflow transition options. Please try again.");
      const data = await response.json();
      setTransitionOptions(normalizeTransitionOptions(data));
    } catch (error) {
      setTransitionOptions([]);
      setOptionsError(error.message || "Unable to load workflow transition options. Please try again.");
    } finally {
      setOptionsLoading(false);
    }
  }, []);

  const loadWorkflowStatuses = useCallback(async () => {
    setStatusesLoading(true);
    setStatusesError("");
    try {
      const response = await fetch("/volt/workflow/statuses", { headers: authHeaders() });
      if (!response.ok) throw new Error("Unable to load workflow statuses. Please try again.");
      const data = await response.json();
      setWorkflowStatuses(normalizeWorkflowStatuses(data));
    } catch (error) {
      setWorkflowStatuses([]);
      setStatusesError(error.message || "Unable to load workflow statuses. Please try again.");
    } finally {
      setStatusesLoading(false);
    }
  }, []);

  useEffect(() => {
    loadTransitions();
    loadTransitionOptions();
    loadWorkflowStatuses();
  }, [loadTransitions, loadTransitionOptions, loadWorkflowStatuses]);

  const refreshTransitions = async () => {
    setMessage("");
    await Promise.all([loadTransitions(), loadTransitionOptions(), loadWorkflowStatuses()]);
  };

  const toggleTransition = async (transition) => {
    setProcessingId(transition.id);
    setMessage("");
    setLoadError("");
    try {
      const response = await fetch(`/volt/workflow/transitions/${transition.id}`, {
        method: "PATCH",
        headers: authHeaders(true),
        body: JSON.stringify({ active: !transition.active }),
      });
      if (!response.ok) throw new Error(await readApiError(response, "Unable to update workflow transition. Please try again."));
      setMessageType("success");
      setMessage("Workflow transition updated successfully.");
      await Promise.all([loadTransitions(), loadTransitionOptions()]);
    } catch (error) {
      setMessageType("error");
      setMessage(error.message || "Unable to update workflow transition. Please try again.");
    } finally {
      setProcessingId(null);
    }
  };

  const createTransition = async (option) => {
    if (option.alreadyConfigured) {
      setMessageType("error");
      setMessage("This transition is already configured.");
      return;
    }

    const createKey = `${option.actionKey}-${option.fromStatus}-${option.toStatus}`;
    setCreateProcessingKey(createKey);
    setMessage("");
    setOptionsError("");
    try {
      const payload = {
        actionKey: option.actionKey,
        displayName: option.displayName,
        fromStatus: option.fromStatus,
        toStatus: option.toStatus,
        active: true,
      };

      if (option.sortOrder !== null && option.sortOrder !== undefined) {
        payload.sortOrder = option.sortOrder;
      }

      const response = await fetch("/volt/workflow/transitions", {
        method: "POST",
        headers: authHeaders(true),
        body: JSON.stringify(payload),
      });

      if (response.status === 409) {
        throw new Error("This transition is already configured.");
      }

      if (!response.ok) {
        throw new Error("Unable to create workflow transition. Please try again.");
      }

      setMessageType("success");
      setMessage("Workflow transition created successfully.");
      await Promise.all([loadTransitions(), loadTransitionOptions()]);
    } catch (error) {
      setMessageType("error");
      setMessage(error.message || "Unable to create workflow transition. Please try again.");
    } finally {
      setCreateProcessingKey("");
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
              <h1 className="text-2xl font-extrabold sm:text-3xl">Workflow Management</h1>
              <p className="mt-2 text-sm text-blue-100">Enable existing transitions or create missing backend-approved safe transitions.</p>
            </div>
            <button
              type="button"
              onClick={refreshTransitions}
              disabled={isLoading}
              className="flex min-h-11 items-center justify-center gap-2 rounded-2xl bg-white/10 px-4 py-2 font-bold text-white transition hover:bg-white/20 disabled:opacity-60"
            >
              <RefreshCw size={18} aria-hidden="true" />
              Refresh
            </button>
          </div>
        </header>

        <Message type={messageType}>{message}</Message>

        <section className="mt-5" aria-labelledby="workflow-status-list">
          <div className="mb-3 flex flex-wrap items-end justify-between gap-3">
            <div>
              <h2 id="workflow-status-list" className="text-xl font-extrabold text-blue-950">Workflow Statuses</h2>
              <p className="mt-1 text-sm text-gray-500">Current workflow status metadata.</p>
            </div>
            <span className="rounded-full bg-blue-50 px-3 py-1 text-xs font-bold text-blue-950">
              {workflowStatuses.length} statuses
            </span>
          </div>

          {statusesLoading && <p className="text-sm font-semibold text-gray-600">Loading workflow statuses...</p>}
          {statusesError && <p className="rounded-xl bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">{statusesError}</p>}
          {!statusesLoading && !statusesError && workflowStatuses.length === 0 && (
            <p className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-600">No workflow statuses found.</p>
          )}
          {!statusesLoading && !statusesError && workflowStatuses.length > 0 && (
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              {workflowStatuses.map((status) => (
                <WorkflowStatusCard key={status.id ?? status.statusKey} status={status} />
              ))}
            </div>
          )}
        </section>

        <section className="mt-5" aria-labelledby="workflow-transition-options">
          <div className="mb-3 flex flex-wrap items-end justify-between gap-3">
            <div>
              <h2 id="workflow-transition-options" className="text-xl font-extrabold text-blue-950">Create Missing Transition</h2>
              <p className="mt-1 text-sm text-gray-500">Backend-approved safe transition options.</p>
            </div>
            <span className="rounded-full bg-blue-50 px-3 py-1 text-xs font-bold text-blue-950">
              {transitionOptions.length} options
            </span>
          </div>

          {optionsLoading && <p className="text-sm font-semibold text-gray-600">Loading workflow transition options...</p>}
          {optionsError && <p className="rounded-xl bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">{optionsError}</p>}
          {!optionsLoading && !optionsError && transitionOptions.length === 0 && (
            <p className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-600">No workflow transition options found.</p>
          )}
          {!optionsLoading && !optionsError && transitionOptions.length > 0 && (
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              {transitionOptions.map((option) => {
                const optionKey = `${option.actionKey}-${option.fromStatus}-${option.toStatus}`;
                return (
                  <TransitionOptionCard
                    key={option.transitionId ?? optionKey}
                    option={option}
                    isProcessing={createProcessingKey === optionKey}
                    onCreate={createTransition}
                  />
                );
              })}
            </div>
          )}
        </section>

        <section className="mt-5" aria-labelledby="workflow-transition-list">
          <div className="mb-3 flex flex-wrap items-end justify-between gap-3">
            <div>
              <h2 id="workflow-transition-list" className="text-xl font-extrabold text-blue-950">Transition List</h2>
              <p className="mt-1 text-sm text-gray-500">Existing transitions only.</p>
            </div>
            <span className="rounded-full bg-blue-50 px-3 py-1 text-xs font-bold text-blue-950">
              {transitions.length} transitions
            </span>
          </div>

          {isLoading && <p className="text-sm font-semibold text-gray-600">Loading workflow transitions...</p>}
          {loadError && <p className="rounded-xl bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">{loadError}</p>}
          {!isLoading && !loadError && transitions.length === 0 && (
            <p className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-600">No workflow transitions found.</p>
          )}
          {!isLoading && !loadError && transitions.length > 0 && (
            <div className="grid grid-cols-1 gap-3">
              {transitions.map((transition) => (
                <TransitionCard
                  key={transition.id}
                  transition={transition}
                  isProcessing={String(processingId) === String(transition.id)}
                  onToggle={toggleTransition}
                />
              ))}
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
