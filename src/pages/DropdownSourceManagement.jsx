import { useCallback, useEffect, useMemo, useState } from "react";
import { ArrowLeft, CheckCircle2, ListChecks, PlusCircle, RefreshCw, X } from "lucide-react";
import { useNavigate } from "react-router-dom";

const sourceKeyPattern = /^[A-Z0-9_]{3,50}$/;
const optionKeyPattern = /^[A-Z0-9_]{2,50}$/;

const emptySourceForm = {
  sourceKey: "",
  displayName: "",
  active: true,
};

const emptyOptionForm = {
  optionKey: "",
  displayValue: "",
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

function formatDateTime(value) {
  if (!value) return "Not available";
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? "Not available"
    : date.toLocaleString([], { dateStyle: "medium", timeStyle: "short" });
}

function formatSourceLabel(source) {
  if (!source) return "None";
  const label = source.displayName || source.sourceKey || "Unnamed Source";
  return source.active ? label : `${label} - Inactive`;
}

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

function StatusBadge({ active }) {
  return (
    <span className={`rounded-full px-2.5 py-1 text-xs font-bold ${active ? "bg-green-50 text-green-700" : "bg-slate-100 text-slate-600"}`}>
      {active ? "Active" : "Inactive"}
    </span>
  );
}

function validateSource(form) {
  const errors = {};
  const sourceKey = form.sourceKey.trim();
  const displayName = form.displayName.trim();

  if (!sourceKey) {
    errors.sourceKey = "Source Key is required.";
  } else if (!sourceKeyPattern.test(sourceKey)) {
    errors.sourceKey = "Use 3 to 50 uppercase letters, numbers, or underscores.";
  }

  if (!displayName) {
    errors.displayName = "Display Name is required.";
  } else if (displayName.length > 80) {
    errors.displayName = "Display Name must be 80 characters or less.";
  }

  return errors;
}

function validateOption(form) {
  const errors = {};
  const optionKey = form.optionKey.trim();
  const displayValue = form.displayValue.trim();
  const sortOrder = form.sortOrder.trim();

  if (!optionKey) {
    errors.optionKey = "Option Key is required.";
  } else if (!optionKeyPattern.test(optionKey)) {
    errors.optionKey = "Use 2 to 50 uppercase letters, numbers, or underscores.";
  }

  if (!displayValue) {
    errors.displayValue = "Display Value is required.";
  } else if (displayValue.length > 120) {
    errors.displayValue = "Display Value must be 120 characters or less.";
  }

  if (sortOrder && !/^\d+$/.test(sortOrder)) {
    errors.sortOrder = "Sort Order must be numeric.";
  }

  return errors;
}

export default function DropdownSourceManagement() {
  const navigate = useNavigate();
  const [sources, setSources] = useState([]);
  const [options, setOptions] = useState([]);
  const [fields, setFields] = useState([]);
  const [selectedSourceId, setSelectedSourceId] = useState("");
  const [isLoadingSources, setIsLoadingSources] = useState(true);
  const [isLoadingOptions, setIsLoadingOptions] = useState(false);
  const [isLoadingFields, setIsLoadingFields] = useState(true);
  const [sourceError, setSourceError] = useState("");
  const [optionError, setOptionError] = useState("");
  const [fieldError, setFieldError] = useState("");
  const [message, setMessage] = useState("");
  const [messageType, setMessageType] = useState("success");
  const [showSourceForm, setShowSourceForm] = useState(false);
  const [sourceForm, setSourceForm] = useState(emptySourceForm);
  const [sourceErrors, setSourceErrors] = useState({});
  const [isCreatingSource, setIsCreatingSource] = useState(false);
  const [processingSourceId, setProcessingSourceId] = useState(null);
  const [showOptionForm, setShowOptionForm] = useState(false);
  const [optionForm, setOptionForm] = useState(emptyOptionForm);
  const [optionErrors, setOptionErrors] = useState({});
  const [isCreatingOption, setIsCreatingOption] = useState(false);
  const [processingOptionId, setProcessingOptionId] = useState(null);
  const [assignmentSelections, setAssignmentSelections] = useState({});
  const [assignmentErrors, setAssignmentErrors] = useState({});
  const [processingFieldId, setProcessingFieldId] = useState(null);

  const selectedSource = useMemo(
    () => sources.find((source) => String(source.id) === String(selectedSourceId)),
    [sources, selectedSourceId]
  );
  const dropdownFields = useMemo(
    () => fields.filter((field) => field.fieldType === "DROPDOWN"),
    [fields]
  );

  const loadSources = useCallback(async () => {
    setIsLoadingSources(true);
    setSourceError("");
    try {
      const response = await fetch("/volt/dropdown-sources", { headers: authHeaders() });
      if (!response.ok) throw new Error("Dropdown source list request failed");
      const data = await response.json();
      setSources(Array.isArray(data) ? data : []);
    } catch {
      setSources([]);
      setSourceError("Unable to load dropdown sources. Please try again.");
    } finally {
      setIsLoadingSources(false);
    }
  }, []);

  const loadFields = useCallback(async () => {
    setIsLoadingFields(true);
    setFieldError("");
    try {
      const response = await fetch("/volt/ticket-fields", { headers: authHeaders() });
      if (!response.ok) throw new Error("Ticket field list request failed");
      const data = await response.json();
      const nextFields = Array.isArray(data) ? data : [];
      setFields(nextFields);
      setAssignmentSelections(
        Object.fromEntries(
          nextFields
            .filter((field) => field.fieldType === "DROPDOWN")
            .map((field) => [field.id, field.dropdownSourceId == null ? "" : String(field.dropdownSourceId)])
        )
      );
    } catch {
      setFields([]);
      setAssignmentSelections({});
      setFieldError("Unable to load DROPDOWN fields. Please try again.");
    } finally {
      setIsLoadingFields(false);
    }
  }, []);

  const loadOptions = useCallback(async (sourceId) => {
    if (!sourceId) {
      setOptions([]);
      setOptionError("");
      return;
    }

    setIsLoadingOptions(true);
    setOptionError("");
    try {
      const response = await fetch(`/volt/dropdown-sources/${sourceId}/options`, { headers: authHeaders() });
      if (!response.ok) throw new Error("Dropdown option list request failed");
      const data = await response.json();
      setOptions(Array.isArray(data) ? data : []);
    } catch {
      setOptions([]);
      setOptionError("Unable to load dropdown options. Please try again.");
    } finally {
      setIsLoadingOptions(false);
    }
  }, []);

  useEffect(() => {
    loadSources();
    loadFields();
  }, [loadSources, loadFields]);

  useEffect(() => {
    closeOptionForm();
    loadOptions(selectedSourceId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedSourceId, loadOptions]);

  const refreshAll = async () => {
    setMessage("");
    await Promise.all([loadSources(), loadFields()]);
    await loadOptions(selectedSourceId);
  };

  const closeSourceForm = () => {
    setShowSourceForm(false);
    setSourceForm(emptySourceForm);
    setSourceErrors({});
  };

  function closeOptionForm() {
    setShowOptionForm(false);
    setOptionForm(emptyOptionForm);
    setOptionErrors({});
  }

  const handleSourceChange = (event) => {
    const { checked, name, type, value } = event.target;
    setSourceForm((current) => ({ ...current, [name]: type === "checkbox" ? checked : value }));
    setSourceErrors((current) => ({ ...current, [name]: "" }));
    setMessage("");
  };

  const handleOptionChange = (event) => {
    const { checked, name, type, value } = event.target;
    setOptionForm((current) => ({ ...current, [name]: type === "checkbox" ? checked : value }));
    setOptionErrors((current) => ({ ...current, [name]: "" }));
    setMessage("");
  };

  const handleCreateSource = async (event) => {
    event.preventDefault();
    const errors = validateSource(sourceForm);
    if (Object.keys(errors).length > 0) {
      setSourceErrors(errors);
      return;
    }

    setIsCreatingSource(true);
    setMessage("");
    try {
      const response = await fetch("/volt/dropdown-sources", {
        method: "POST",
        headers: authHeaders(true),
        body: JSON.stringify({
          sourceKey: sourceForm.sourceKey.trim(),
          displayName: sourceForm.displayName.trim(),
          active: sourceForm.active,
          sourceType: "MANUAL",
        }),
      });
      if (!response.ok) throw new Error(await readApiError(response, "Unable to create dropdown source. Please check the details."));
      closeSourceForm();
      setMessageType("success");
      setMessage("Dropdown source created successfully.");
      await loadSources();
    } catch (error) {
      setMessageType("error");
      setMessage(error.message || "Unable to create dropdown source. Please check the details.");
    } finally {
      setIsCreatingSource(false);
    }
  };

  const updateSourceStatus = async (source) => {
    const active = !source.active;
    setProcessingSourceId(source.id);
    setMessage("");
    try {
      const response = await fetch(`/volt/dropdown-sources/${source.id}/status`, {
        method: "PATCH",
        headers: authHeaders(true),
        body: JSON.stringify({ active }),
      });
      if (!response.ok) throw new Error(await readApiError(response, "Unable to update dropdown source. Please try again."));
      setMessageType("success");
      setMessage(`Dropdown source ${active ? "enabled" : "disabled"} successfully.`);
      await loadSources();
    } catch (error) {
      setMessageType("error");
      setMessage(error.message || "Unable to update dropdown source. Please try again.");
    } finally {
      setProcessingSourceId(null);
    }
  };

  const handleCreateOption = async (event) => {
    event.preventDefault();
    const errors = validateOption(optionForm);
    if (Object.keys(errors).length > 0) {
      setOptionErrors(errors);
      return;
    }

    if (!selectedSourceId) {
      setMessageType("error");
      setMessage("Select a dropdown source before adding options.");
      return;
    }

    setIsCreatingOption(true);
    setMessage("");
    try {
      const payload = {
        optionKey: optionForm.optionKey.trim(),
        displayValue: optionForm.displayValue.trim(),
        active: optionForm.active,
      };
      if (optionForm.sortOrder.trim()) {
        payload.sortOrder = Number(optionForm.sortOrder.trim());
      }

      const response = await fetch(`/volt/dropdown-sources/${selectedSourceId}/options`, {
        method: "POST",
        headers: authHeaders(true),
        body: JSON.stringify(payload),
      });
      if (!response.ok) throw new Error(await readApiError(response, "Unable to add dropdown option. Please check the details."));
      closeOptionForm();
      setMessageType("success");
      setMessage("Dropdown option added successfully.");
      await loadOptions(selectedSourceId);
    } catch (error) {
      setMessageType("error");
      setMessage(error.message || "Unable to add dropdown option. Please check the details.");
    } finally {
      setIsCreatingOption(false);
    }
  };

  const updateOptionStatus = async (option) => {
    const active = !option.active;
    setProcessingOptionId(option.id);
    setMessage("");
    try {
      const response = await fetch(`/volt/dropdown-sources/${selectedSourceId}/options/${option.id}/status`, {
        method: "PATCH",
        headers: authHeaders(true),
        body: JSON.stringify({ active }),
      });
      if (!response.ok) throw new Error(await readApiError(response, "Unable to update dropdown option. Please try again."));
      setMessageType("success");
      setMessage(`Dropdown option ${active ? "enabled" : "disabled"} successfully.`);
      await loadOptions(selectedSourceId);
    } catch (error) {
      setMessageType("error");
      setMessage(error.message || "Unable to update dropdown option. Please try again.");
    } finally {
      setProcessingOptionId(null);
    }
  };

  const updateAssignmentSelection = (fieldId, value) => {
    setAssignmentSelections((current) => ({ ...current, [fieldId]: value }));
    setAssignmentErrors((current) => ({ ...current, [fieldId]: "" }));
    setMessage("");
  };

  const assignSource = async (field) => {
    const selectedValue = assignmentSelections[field.id] ?? "";
    if (!selectedValue) {
      setAssignmentErrors((current) => ({ ...current, [field.id]: "Select a dropdown source before assigning." }));
      return;
    }

    await updateFieldSource(field, Number(selectedValue), "Dropdown source assigned successfully.");
  };

  const clearAssignment = async (field) => {
    await updateFieldSource(field, null, "Dropdown source cleared successfully.");
  };

  const updateFieldSource = async (field, dropdownSourceId, successMessage) => {
    setProcessingFieldId(field.id);
    setMessage("");
    setAssignmentErrors((current) => ({ ...current, [field.id]: "" }));
    try {
      const response = await fetch(`/volt/ticket-fields/${field.id}/dropdown-source`, {
        method: "PATCH",
        headers: authHeaders(true),
        body: JSON.stringify({ dropdownSourceId }),
      });
      if (!response.ok) throw new Error(await readApiError(response, "Unable to assign dropdown source. Please try again."));
      setMessageType("success");
      setMessage(successMessage);
      await loadFields();
    } catch (error) {
      setMessageType("error");
      setMessage(error.message || "Unable to assign dropdown source. Please try again.");
    } finally {
      setProcessingFieldId(null);
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
              <h1 className="text-2xl font-extrabold sm:text-3xl">Dropdown Sources</h1>
              <p className="mt-2 text-sm text-blue-100">Create and manage manual dropdown option lists for DROPDOWN ticket fields.</p>
            </div>
            <div className="flex flex-col gap-2 min-[420px]:flex-row">
              <button
                type="button"
                onClick={() => showSourceForm ? closeSourceForm() : setShowSourceForm(true)}
                className="flex min-h-11 items-center justify-center gap-2 rounded-2xl bg-yellow-400 px-4 py-2 font-bold text-black transition hover:bg-yellow-300"
              >
                {showSourceForm ? <X size={18} aria-hidden="true" /> : <PlusCircle size={18} aria-hidden="true" />}
                {showSourceForm ? "Close" : "Add Source"}
              </button>
              <button
                type="button"
                onClick={refreshAll}
                disabled={isLoadingSources || isLoadingFields || isLoadingOptions}
                className="flex min-h-11 items-center justify-center gap-2 rounded-2xl bg-white/10 px-4 py-2 font-bold text-white transition hover:bg-white/20 disabled:opacity-60"
              >
                <RefreshCw size={18} aria-hidden="true" />
                Refresh
              </button>
            </div>
          </div>
        </header>

        <Message type={messageType}>{message}</Message>

        {showSourceForm && (
          <form onSubmit={handleCreateSource} className="mt-5 grid grid-cols-1 gap-4 rounded-2xl border border-blue-100 bg-white p-5 shadow-sm sm:grid-cols-2">
            <h2 className="text-lg font-extrabold text-blue-950 sm:col-span-2">Add Source</h2>
            <label className="font-semibold text-gray-700">
              Source Key
              <input name="sourceKey" value={sourceForm.sourceKey} onChange={handleSourceChange} placeholder="COMPLAINT_TYPE" className="mt-2 w-full rounded-xl border border-gray-300 px-4 py-3 outline-none focus:border-blue-950" />
              <span className="mt-1 block text-xs font-semibold text-gray-500">Use uppercase letters, numbers, and underscore only. Example: COMPLAINT_TYPE</span>
              <FieldError message={sourceErrors.sourceKey} />
            </label>
            <label className="font-semibold text-gray-700">
              Display Name
              <input name="displayName" value={sourceForm.displayName} onChange={handleSourceChange} placeholder="Complaint Type" maxLength={80} className="mt-2 w-full rounded-xl border border-gray-300 px-4 py-3 outline-none focus:border-blue-950" />
              <FieldError message={sourceErrors.displayName} />
            </label>
            <label className="flex items-center gap-3 rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 font-semibold text-gray-700">
              <input type="checkbox" name="active" checked={sourceForm.active} onChange={handleSourceChange} className="h-5 w-5 accent-blue-950" />
              Active
            </label>
            <div className="flex flex-col gap-2 sm:col-span-2 min-[420px]:flex-row">
              <button type="submit" disabled={isCreatingSource} className="flex min-h-11 items-center justify-center gap-2 rounded-2xl bg-blue-950 px-5 py-2 font-bold text-white transition hover:bg-blue-900 disabled:opacity-60">
                <CheckCircle2 size={18} aria-hidden="true" />
                {isCreatingSource ? "Creating..." : "Create Source"}
              </button>
              <button type="button" onClick={closeSourceForm} className="flex min-h-11 items-center justify-center rounded-2xl border border-gray-300 px-5 py-2 font-bold text-gray-700 transition hover:bg-gray-50">
                Cancel
              </button>
            </div>
          </form>
        )}

        <section className="mt-6" aria-labelledby="source-list-title">
          <h2 id="source-list-title" className="text-xl font-extrabold text-blue-950">Source List</h2>
          {isLoadingSources && <p className="mt-4 text-sm font-semibold text-gray-600">Loading dropdown sources...</p>}
          {sourceError && <p className="mt-4 rounded-xl bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">{sourceError}</p>}
          {!isLoadingSources && !sourceError && sources.length === 0 && (
            <p className="mt-4 rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm font-semibold text-gray-600">No dropdown sources found.</p>
          )}
          <div className="mt-4 space-y-3">
            {sources.map((source) => (
              <article key={source.id} className={`rounded-2xl border bg-white p-4 shadow-sm ${String(selectedSourceId) === String(source.id) ? "border-blue-300" : "border-blue-100"}`}>
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div className="min-w-0">
                    <h3 className="break-words text-lg font-extrabold text-blue-950">{source.displayName || "Unnamed Source"}</h3>
                    <p className="mt-1 break-words text-sm font-semibold text-gray-600">
                      {source.sourceKey || "NO_KEY"} - {source.sourceType || "MANUAL"} - {source.systemSource ? "System" : "Custom"}
                    </p>
                    <p className="mt-1 text-xs font-semibold text-gray-500">
                      Created {formatDateTime(source.createdAt)} - Updated {formatDateTime(source.updatedAt)}
                    </p>
                    <div className="mt-2"><StatusBadge active={source.active} /></div>
                  </div>
                  <div className="flex flex-col gap-2 min-[420px]:flex-row sm:shrink-0">
                    <button type="button" onClick={() => setSelectedSourceId(String(source.id))} className="rounded-xl bg-blue-50 px-3 py-2 text-sm font-bold text-blue-950 hover:bg-blue-100">
                      Manage Options
                    </button>
                    <button type="button" onClick={() => updateSourceStatus(source)} disabled={processingSourceId === source.id} className="rounded-xl bg-slate-100 px-3 py-2 text-sm font-bold text-slate-800 hover:bg-slate-200 disabled:opacity-60">
                      {processingSourceId === source.id ? "Saving..." : source.active ? "Disable" : "Enable"}
                    </button>
                  </div>
                </div>
              </article>
            ))}
          </div>
        </section>

        <section className="mt-8 rounded-2xl border border-blue-100 bg-white p-5 shadow-sm" aria-labelledby="options-title">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 id="options-title" className="text-xl font-extrabold text-blue-950">Selected Source Options</h2>
              <p className="mt-1 text-sm font-semibold text-gray-600">
                {selectedSource ? `Options for: ${selectedSource.displayName} (${selectedSource.sourceKey})` : "Select a source to manage options."}
              </p>
            </div>
            <button type="button" onClick={() => showOptionForm ? closeOptionForm() : setShowOptionForm(true)} disabled={!selectedSourceId} className="flex min-h-11 items-center justify-center gap-2 rounded-2xl bg-yellow-400 px-4 py-2 font-bold text-black transition hover:bg-yellow-300 disabled:opacity-60">
              {showOptionForm ? <X size={18} aria-hidden="true" /> : <PlusCircle size={18} aria-hidden="true" />}
              {showOptionForm ? "Close" : "Add Option"}
            </button>
          </div>

          {showOptionForm && selectedSourceId && (
            <form onSubmit={handleCreateOption} className="mt-5 grid grid-cols-1 gap-4 rounded-2xl border border-slate-200 bg-slate-50 p-4 sm:grid-cols-2">
              <label className="font-semibold text-gray-700">
                Option Key
                <input name="optionKey" value={optionForm.optionKey} onChange={handleOptionChange} placeholder="LOW_BACKUP" className="mt-2 w-full rounded-xl border border-gray-300 px-4 py-3 outline-none focus:border-blue-950" />
                <span className="mt-1 block text-xs font-semibold text-gray-500">Use uppercase letters, numbers, and underscore only. Example: LOW_BACKUP</span>
                <FieldError message={optionErrors.optionKey} />
              </label>
              <label className="font-semibold text-gray-700">
                Display Value
                <input name="displayValue" value={optionForm.displayValue} onChange={handleOptionChange} placeholder="Low Backup" maxLength={120} className="mt-2 w-full rounded-xl border border-gray-300 px-4 py-3 outline-none focus:border-blue-950" />
                <FieldError message={optionErrors.displayValue} />
              </label>
              <label className="font-semibold text-gray-700">
                Sort Order
                <input name="sortOrder" inputMode="numeric" value={optionForm.sortOrder} onChange={handleOptionChange} placeholder="10" className="mt-2 w-full rounded-xl border border-gray-300 px-4 py-3 outline-none focus:border-blue-950" />
                <FieldError message={optionErrors.sortOrder} />
              </label>
              <label className="flex items-center gap-3 rounded-xl border border-gray-200 bg-white px-4 py-3 font-semibold text-gray-700">
                <input type="checkbox" name="active" checked={optionForm.active} onChange={handleOptionChange} className="h-5 w-5 accent-blue-950" />
                Active
              </label>
              <div className="flex flex-col gap-2 sm:col-span-2 min-[420px]:flex-row">
                <button type="submit" disabled={isCreatingOption} className="flex min-h-11 items-center justify-center gap-2 rounded-2xl bg-blue-950 px-5 py-2 font-bold text-white transition hover:bg-blue-900 disabled:opacity-60">
                  <CheckCircle2 size={18} aria-hidden="true" />
                  {isCreatingOption ? "Adding..." : "Add Option"}
                </button>
                <button type="button" onClick={closeOptionForm} className="flex min-h-11 items-center justify-center rounded-2xl border border-gray-300 px-5 py-2 font-bold text-gray-700 transition hover:bg-white">
                  Cancel
                </button>
              </div>
            </form>
          )}

          {isLoadingOptions && <p className="mt-4 text-sm font-semibold text-gray-600">Loading dropdown options...</p>}
          {optionError && <p className="mt-4 rounded-xl bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">{optionError}</p>}
          {selectedSourceId && !isLoadingOptions && !optionError && options.length === 0 && (
            <p className="mt-4 rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm font-semibold text-gray-600">No options found for this source.</p>
          )}
          <div className="mt-4 space-y-3">
            {options.map((option) => (
              <article key={option.id} className="rounded-xl border border-slate-200 bg-white p-4">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div className="min-w-0">
                    <h3 className="break-words font-extrabold text-blue-950">{option.displayValue || "Unnamed Option"}</h3>
                    <p className="mt-1 break-words text-sm font-semibold text-gray-600">
                      {option.optionKey || "NO_KEY"} - Sort {option.sortOrder ?? "Not set"}
                    </p>
                    <p className="mt-1 text-xs font-semibold text-gray-500">
                      Created {formatDateTime(option.createdAt)} - Updated {formatDateTime(option.updatedAt)}
                    </p>
                    <div className="mt-2"><StatusBadge active={option.active} /></div>
                  </div>
                  <button type="button" onClick={() => updateOptionStatus(option)} disabled={processingOptionId === option.id} className="rounded-xl bg-slate-100 px-3 py-2 text-sm font-bold text-slate-800 hover:bg-slate-200 disabled:opacity-60 sm:shrink-0">
                    {processingOptionId === option.id ? "Saving..." : option.active ? "Disable" : "Enable"}
                  </button>
                </div>
              </article>
            ))}
          </div>
        </section>

        <section className="mt-8 rounded-2xl border border-blue-100 bg-white p-5 shadow-sm" aria-labelledby="assignment-title">
          <div className="flex items-center gap-2">
            <ListChecks size={20} className="text-blue-950" aria-hidden="true" />
            <h2 id="assignment-title" className="text-xl font-extrabold text-blue-950">DROPDOWN Field Source Assignment</h2>
          </div>
          <p className="mt-1 text-sm font-semibold text-gray-600">Assign manual sources to DROPDOWN ticket fields.</p>

          {isLoadingFields && <p className="mt-4 text-sm font-semibold text-gray-600">Loading DROPDOWN fields...</p>}
          {fieldError && <p className="mt-4 rounded-xl bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">{fieldError}</p>}
          {!isLoadingFields && !fieldError && dropdownFields.length === 0 && (
            <p className="mt-4 rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm font-semibold text-gray-600">No DROPDOWN fields found.</p>
          )}

          <div className="mt-4 space-y-3">
            {dropdownFields.map((field) => (
              <article key={field.id} className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                <div className="grid gap-3 lg:grid-cols-[1fr_1fr_auto] lg:items-end">
                  <div className="min-w-0">
                    <h3 className="break-words font-extrabold text-blue-950">{field.displayName || "Unnamed Field"}</h3>
                    <p className="mt-1 break-words text-sm font-semibold text-gray-600">
                      {field.fieldKey || "NO_KEY"} - DROPDOWN - Assigned: {field.dropdownSourceDisplayName || "None"}
                    </p>
                    {!field.active && <p className="mt-1 text-xs font-bold text-yellow-700">Field is inactive.</p>}
                  </div>
                  <label className="font-semibold text-gray-700">
                    Select Source
                    <select value={assignmentSelections[field.id] ?? ""} onChange={(event) => updateAssignmentSelection(field.id, event.target.value)} className="mt-2 w-full rounded-xl border border-gray-300 bg-white px-4 py-3 outline-none focus:border-blue-950">
                      <option value="">Select dropdown source</option>
                      {sources.map((source) => <option key={source.id} value={source.id}>{formatSourceLabel(source)}</option>)}
                    </select>
                    <FieldError message={assignmentErrors[field.id]} />
                  </label>
                  <div className="flex flex-col gap-2 min-[420px]:flex-row lg:flex-col">
                    <button type="button" onClick={() => assignSource(field)} disabled={processingFieldId === field.id || sources.length === 0} className="rounded-xl bg-blue-950 px-4 py-3 text-sm font-bold text-white hover:bg-blue-900 disabled:opacity-60">
                      {processingFieldId === field.id ? "Saving..." : "Assign"}
                    </button>
                    <button type="button" onClick={() => clearAssignment(field)} disabled={processingFieldId === field.id || !field.dropdownSourceId} className="rounded-xl bg-slate-200 px-4 py-3 text-sm font-bold text-slate-800 hover:bg-slate-300 disabled:opacity-60">
                      Clear
                    </button>
                  </div>
                </div>
              </article>
            ))}
          </div>
        </section>
      </div>
    </main>
  );
}
