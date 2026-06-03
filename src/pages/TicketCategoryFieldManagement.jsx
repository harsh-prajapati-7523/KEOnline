import { useCallback, useEffect, useMemo, useState } from "react";
import { ArrowLeft, CheckCircle2, PlusCircle, RefreshCw, X } from "lucide-react";
import { useNavigate } from "react-router-dom";

const emptyAddForm = {
  fieldDefinitionId: "",
  required: false,
  visible: true,
  sortOrder: "",
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

function formatCategoryLabel(category) {
  const categoryKey = category.categoryKey ?? "";
  const label = category.displayName ? `${category.displayName} (${categoryKey})` : categoryKey || "Unnamed Category";
  return category.active ? label : `${label} - Inactive`;
}

function formatFieldLabel(field) {
  return `${field.displayName || "Unnamed Field"} (${field.fieldKey || "NO_KEY"}) · ${field.fieldType || "Not set"}`;
}

function validateAdd(form) {
  const errors = {};
  if (!form.fieldDefinitionId) errors.fieldDefinitionId = "Field is required.";
  if (form.sortOrder.trim() && !/^\d+$/.test(form.sortOrder.trim())) {
    errors.sortOrder = "Sort Order must be numeric.";
  }
  return errors;
}

function validateEdit(form) {
  const errors = {};
  if (form.sortOrder.trim() && !/^\d+$/.test(form.sortOrder.trim())) {
    errors.sortOrder = "Sort Order must be numeric.";
  }
  return errors;
}

function createEditForm(config) {
  return {
    required: Boolean(config.required),
    visible: Boolean(config.visible),
    sortOrder: config.sortOrder == null ? "" : String(config.sortOrder),
  };
}

export default function TicketCategoryFieldManagement() {
  const navigate = useNavigate();
  const [categories, setCategories] = useState([]);
  const [fields, setFields] = useState([]);
  const [configs, setConfigs] = useState([]);
  const [selectedCategoryId, setSelectedCategoryId] = useState("");
  const [isLoadingCategories, setIsLoadingCategories] = useState(true);
  const [isLoadingFields, setIsLoadingFields] = useState(true);
  const [isLoadingConfigs, setIsLoadingConfigs] = useState(false);
  const [categoryError, setCategoryError] = useState("");
  const [fieldError, setFieldError] = useState("");
  const [configError, setConfigError] = useState("");
  const [message, setMessage] = useState("");
  const [messageType, setMessageType] = useState("success");
  const [showAddForm, setShowAddForm] = useState(false);
  const [addForm, setAddForm] = useState(emptyAddForm);
  const [addErrors, setAddErrors] = useState({});
  const [isAdding, setIsAdding] = useState(false);
  const [editingConfigId, setEditingConfigId] = useState(null);
  const [editForm, setEditForm] = useState({ required: false, visible: true, sortOrder: "" });
  const [editErrors, setEditErrors] = useState({});
  const [processingConfigId, setProcessingConfigId] = useState(null);

  const activeFields = useMemo(() => fields.filter((field) => field.active), [fields]);
  const selectedCategory = useMemo(
    () => categories.find((category) => String(category.id) === String(selectedCategoryId)),
    [categories, selectedCategoryId]
  );

  const loadCategories = useCallback(async () => {
    setIsLoadingCategories(true);
    setCategoryError("");
    try {
      const response = await fetch("/volt/ticket-categories", { headers: authHeaders() });
      if (!response.ok) throw new Error("Category list request failed");
      const data = await response.json();
      setCategories(Array.isArray(data) ? data : []);
    } catch {
      setCategories([]);
      setCategoryError("Unable to load categories.");
    } finally {
      setIsLoadingCategories(false);
    }
  }, []);

  const loadFields = useCallback(async () => {
    setIsLoadingFields(true);
    setFieldError("");
    try {
      const response = await fetch("/volt/ticket-fields", { headers: authHeaders() });
      if (!response.ok) throw new Error("Field list request failed");
      const data = await response.json();
      setFields(Array.isArray(data) ? data : []);
    } catch {
      setFields([]);
      setFieldError("Unable to load fields.");
    } finally {
      setIsLoadingFields(false);
    }
  }, []);

  const loadConfigs = useCallback(async (categoryId) => {
    if (!categoryId) {
      setConfigs([]);
      setConfigError("");
      return;
    }

    setIsLoadingConfigs(true);
    setConfigError("");
    try {
      const response = await fetch(`/volt/ticket-categories/${categoryId}/field-configs`, { headers: authHeaders() });
      if (!response.ok) throw new Error("Mapped field list request failed");
      const data = await response.json();
      setConfigs(Array.isArray(data) ? data : []);
    } catch {
      setConfigs([]);
      setConfigError("Unable to load mapped fields. Please try again.");
    } finally {
      setIsLoadingConfigs(false);
    }
  }, []);

  useEffect(() => {
    loadCategories();
    loadFields();
  }, [loadCategories, loadFields]);

  useEffect(() => {
    closeAddForm();
    closeEditForm();
    loadConfigs(selectedCategoryId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedCategoryId, loadConfigs]);

  const refreshAll = async () => {
    setMessage("");
    await Promise.all([loadCategories(), loadFields()]);
    await loadConfigs(selectedCategoryId);
  };

  const closeAddForm = () => {
    setShowAddForm(false);
    setAddForm(emptyAddForm);
    setAddErrors({});
  };

  const closeEditForm = () => {
    setEditingConfigId(null);
    setEditForm({ required: false, visible: true, sortOrder: "" });
    setEditErrors({});
  };

  const handleAddChange = (event) => {
    const { checked, name, type, value } = event.target;
    if (name === "fieldDefinitionId") {
      const field = fields.find((item) => String(item.id) === String(value));
      setAddForm((current) => ({
        ...current,
        fieldDefinitionId: value,
        required: field ? Boolean(field.defaultRequired) : current.required,
      }));
    } else {
      setAddForm((current) => ({ ...current, [name]: type === "checkbox" ? checked : value }));
    }
    setAddErrors((current) => ({ ...current, [name]: "" }));
    setMessage("");
  };

  const handleEditChange = (event) => {
    const { checked, name, type, value } = event.target;
    setEditForm((current) => ({ ...current, [name]: type === "checkbox" ? checked : value }));
    setEditErrors((current) => ({ ...current, [name]: "" }));
    setMessage("");
  };

  const handleAddMapping = async (event) => {
    event.preventDefault();
    const errors = validateAdd(addForm);
    if (Object.keys(errors).length > 0) {
      setAddErrors(errors);
      return;
    }

    setIsAdding(true);
    setMessage("");
    try {
      const payload = {
        fieldDefinitionId: Number(addForm.fieldDefinitionId),
        required: addForm.required,
        visible: addForm.visible,
      };
      if (addForm.sortOrder.trim()) {
        payload.sortOrder = Number(addForm.sortOrder.trim());
      }

      const response = await fetch(`/volt/ticket-categories/${selectedCategoryId}/field-configs`, {
        method: "POST",
        headers: authHeaders(true),
        body: JSON.stringify(payload),
      });
      if (!response.ok) throw new Error(await readApiError(response, "Unable to add field mapping. Please check the details."));
      closeAddForm();
      setMessageType("success");
      setMessage("Field mapping added successfully.");
      await loadConfigs(selectedCategoryId);
    } catch (error) {
      setMessageType("error");
      setMessage(error.message || "Unable to add field mapping. Please check the details.");
    } finally {
      setIsAdding(false);
    }
  };

  const openEdit = (config) => {
    setEditingConfigId(config.id);
    setEditForm(createEditForm(config));
    setEditErrors({});
    setMessage("");
  };

  const handleUpdateMapping = async (event) => {
    event.preventDefault();
    const errors = validateEdit(editForm);
    if (Object.keys(errors).length > 0) {
      setEditErrors(errors);
      return;
    }

    setProcessingConfigId(editingConfigId);
    setMessage("");
    try {
      const payload = {
        required: editForm.required,
        visible: editForm.visible,
      };
      if (editForm.sortOrder.trim()) {
        payload.sortOrder = Number(editForm.sortOrder.trim());
      }

      const response = await fetch(`/volt/ticket-categories/${selectedCategoryId}/field-configs/${editingConfigId}`, {
        method: "PATCH",
        headers: authHeaders(true),
        body: JSON.stringify(payload),
      });
      if (!response.ok) throw new Error(await readApiError(response, "Unable to update field mapping. Please try again."));
      closeEditForm();
      setMessageType("success");
      setMessage("Field mapping updated successfully.");
      await loadConfigs(selectedCategoryId);
    } catch (error) {
      setMessageType("error");
      setMessage(error.message || "Unable to update field mapping. Please try again.");
    } finally {
      setProcessingConfigId(null);
    }
  };

  const updateVisibility = async (config) => {
    const visible = !config.visible;
    setProcessingConfigId(config.id);
    setMessage("");
    try {
      const response = await fetch(`/volt/ticket-categories/${selectedCategoryId}/field-configs/${config.id}/status`, {
        method: "PATCH",
        headers: authHeaders(true),
        body: JSON.stringify({ visible }),
      });
      if (!response.ok) throw new Error(await readApiError(response, "Unable to update field mapping. Please try again."));
      setMessageType("success");
      setMessage(`Field mapping ${visible ? "shown" : "hidden"} successfully.`);
      await loadConfigs(selectedCategoryId);
    } catch (error) {
      setMessageType("error");
      setMessage(error.message || "Unable to update field mapping. Please try again.");
    } finally {
      setProcessingConfigId(null);
    }
  };

  return (
    <main className="min-h-screen bg-gray-50 px-4 py-6 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-4xl">
        <button type="button" onClick={() => navigate("/employee-dashboard")} className="flex items-center gap-2 font-semibold text-blue-950">
          <ArrowLeft size={18} aria-hidden="true" /> Dashboard
        </button>

        <header className="mt-4 rounded-3xl bg-blue-950 p-5 text-white shadow-lg sm:p-7">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h1 className="text-2xl font-extrabold sm:text-3xl">Category Field Configuration</h1>
              <p className="mt-2 text-sm text-blue-100">Map reusable ticket fields to ticket categories.</p>
            </div>
            <div className="flex flex-col gap-2 min-[420px]:flex-row">
              <button
                type="button"
                onClick={() => showAddForm ? closeAddForm() : setShowAddForm(true)}
                disabled={!selectedCategoryId}
                className="flex min-h-11 items-center justify-center gap-2 rounded-2xl bg-yellow-400 px-4 py-2 font-bold text-black transition hover:bg-yellow-300 disabled:opacity-60"
              >
                {showAddForm ? <X size={18} aria-hidden="true" /> : <PlusCircle size={18} aria-hidden="true" />}
                {showAddForm ? "Close" : "Add Field Mapping"}
              </button>
              <button
                type="button"
                onClick={refreshAll}
                disabled={isLoadingCategories || isLoadingFields || isLoadingConfigs}
                className="flex min-h-11 items-center justify-center gap-2 rounded-2xl bg-white/10 px-4 py-2 font-bold text-white transition hover:bg-white/20 disabled:opacity-60"
              >
                <RefreshCw size={18} aria-hidden="true" />
                Refresh
              </button>
            </div>
          </div>
        </header>

        <Message type={messageType}>{message}</Message>

        <section className="mt-5 rounded-2xl border border-blue-100 bg-white p-5 shadow-sm">
          <label className="block font-semibold text-gray-700">
            Category
            <select
              value={selectedCategoryId}
              onChange={(event) => {
                setSelectedCategoryId(event.target.value);
                setMessage("");
              }}
              disabled={isLoadingCategories || categories.length === 0}
              className="mt-2 w-full rounded-xl border border-gray-300 bg-white px-4 py-3 outline-none focus:border-blue-950 disabled:opacity-60"
            >
              <option value="">{isLoadingCategories ? "Loading categories..." : "Select category"}</option>
              {categories.map((category) => <option key={category.id} value={category.id}>{formatCategoryLabel(category)}</option>)}
            </select>
          </label>
          {categoryError && <p className="mt-2 text-sm font-semibold text-red-600">{categoryError}</p>}
          {!isLoadingCategories && !categoryError && categories.length === 0 && (
            <p className="mt-2 text-sm font-semibold text-gray-600">No categories found.</p>
          )}
          {selectedCategory && !selectedCategory.active && (
            <p className="mt-2 text-sm font-semibold text-yellow-700">Selected category is inactive and shown for admin review.</p>
          )}
          {isLoadingFields && <p className="mt-2 text-sm font-semibold text-gray-600">Loading fields...</p>}
          {fieldError && <p className="mt-2 text-sm font-semibold text-red-600">{fieldError}</p>}
        </section>

        {showAddForm && selectedCategoryId && (
          <form onSubmit={handleAddMapping} className="mt-5 grid grid-cols-1 gap-4 rounded-2xl border border-blue-100 bg-white p-5 shadow-sm sm:grid-cols-2">
            <h2 className="text-lg font-extrabold text-blue-950 sm:col-span-2">Add Field Mapping</h2>

            <label className="font-semibold text-gray-700 sm:col-span-2">
              Field
              <select
                name="fieldDefinitionId"
                value={addForm.fieldDefinitionId}
                onChange={handleAddChange}
                disabled={activeFields.length === 0}
                className="mt-2 w-full rounded-xl border border-gray-300 bg-white px-4 py-3 outline-none focus:border-blue-950 disabled:opacity-60"
              >
                <option value="">{activeFields.length === 0 ? "No active fields available" : "Select active field"}</option>
                {activeFields.map((field) => <option key={field.id} value={field.id}>{formatFieldLabel(field)}</option>)}
              </select>
              <FieldError message={addErrors.fieldDefinitionId} />
            </label>

            <label className="font-semibold text-gray-700">
              Sort Order
              <input
                name="sortOrder"
                inputMode="numeric"
                value={addForm.sortOrder}
                onChange={handleAddChange}
                placeholder="10"
                className="mt-2 w-full rounded-xl border border-gray-300 px-4 py-3 outline-none focus:border-blue-950"
              />
              <FieldError message={addErrors.sortOrder} />
            </label>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <label className="flex items-center gap-3 rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 font-semibold text-gray-700">
                <input type="checkbox" name="required" checked={addForm.required} onChange={handleAddChange} className="h-5 w-5 accent-blue-950" />
                Required
              </label>
              <label className="flex items-center gap-3 rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 font-semibold text-gray-700">
                <input type="checkbox" name="visible" checked={addForm.visible} onChange={handleAddChange} className="h-5 w-5 accent-blue-950" />
                Visible
              </label>
            </div>

            <div className="flex flex-col gap-2 sm:col-span-2 min-[420px]:flex-row">
              <button
                type="submit"
                disabled={isAdding}
                className="flex min-h-11 items-center justify-center gap-2 rounded-2xl bg-blue-950 px-5 py-2 font-bold text-white transition hover:bg-blue-900 disabled:opacity-60"
              >
                <CheckCircle2 size={18} aria-hidden="true" />
                {isAdding ? "Adding..." : "Add Mapping"}
              </button>
              <button
                type="button"
                onClick={closeAddForm}
                className="flex min-h-11 items-center justify-center rounded-2xl border border-gray-300 px-5 py-2 font-bold text-gray-700 transition hover:bg-gray-50"
              >
                Cancel
              </button>
            </div>
          </form>
        )}

        <section className="mt-6" aria-labelledby="mapped-fields-title">
          <h2 id="mapped-fields-title" className="text-xl font-extrabold text-blue-950">Mapped Fields</h2>

          {!selectedCategoryId && <p className="mt-4 rounded-xl border border-blue-100 bg-white px-4 py-3 text-sm font-semibold text-gray-600">Select a category to manage fields.</p>}
          {selectedCategoryId && isLoadingConfigs && <p className="mt-4 rounded-xl border border-blue-100 bg-white px-4 py-3 text-sm font-semibold text-gray-600">Loading mapped fields...</p>}
          {selectedCategoryId && !isLoadingConfigs && configError && <p className="mt-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">{configError}</p>}
          {selectedCategoryId && !isLoadingConfigs && !configError && configs.length === 0 && <p className="mt-4 rounded-xl border border-blue-100 bg-white px-4 py-3 text-sm font-semibold text-gray-600">No fields mapped to this category.</p>}

          {selectedCategoryId && !isLoadingConfigs && !configError && configs.length > 0 && (
            <div className="mt-4 divide-y divide-blue-100 overflow-hidden rounded-2xl border border-blue-100 bg-white shadow-sm">
              {configs.map((config) => {
                const isEditing = editingConfigId === config.id;
                const isProcessing = processingConfigId === config.id;
                const sortLabel = config.sortOrder ?? "Not set";

                return (
                  <article key={config.id} className="px-4 py-4">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <h3 className="text-base font-extrabold text-blue-950">{config.fieldDisplayName || "Unnamed Field"}</h3>
                          <span className="rounded-full bg-blue-50 px-2.5 py-1 text-xs font-bold text-blue-950">{config.fieldType || "Not set"}</span>
                        </div>
                        <p className="mt-1 text-sm font-semibold text-gray-600">
                          {config.fieldKey} · {config.required ? "Required" : "Optional"} · {config.visible ? "Visible" : "Hidden"} · Sort {sortLabel} · Field {config.fieldActive ? "Active" : "Inactive"}
                        </p>
                        <p className="mt-1 text-xs font-medium text-gray-500">
                          Default Required: {config.defaultRequired ? "Yes" : "No"}
                        </p>
                        {config.helpText && <p className="mt-1 text-sm text-gray-600">{config.helpText}</p>}
                        <p className="mt-1 text-xs font-medium text-gray-500">
                          Created {formatDateTime(config.createdAt)} · Updated {formatDateTime(config.updatedAt)}
                        </p>
                      </div>

                      <div className="flex flex-col gap-2 min-[420px]:flex-row sm:shrink-0">
                        <button
                          type="button"
                          onClick={() => isEditing ? closeEditForm() : openEdit(config)}
                          disabled={isProcessing}
                          className="flex min-h-10 items-center justify-center rounded-xl border border-blue-200 bg-blue-50 px-4 py-2 text-sm font-bold text-blue-950 transition hover:bg-blue-100 disabled:opacity-60"
                        >
                          {isEditing ? "Close" : "Edit"}
                        </button>
                        <button
                          type="button"
                          onClick={() => updateVisibility(config)}
                          disabled={isProcessing}
                          className={`flex min-h-10 items-center justify-center rounded-xl px-4 py-2 text-sm font-bold transition disabled:opacity-60 ${
                            config.visible
                              ? "border border-red-200 bg-red-50 text-red-700 hover:bg-red-100"
                              : "border border-green-200 bg-green-50 text-green-700 hover:bg-green-100"
                          }`}
                        >
                          {isProcessing ? "Saving..." : config.visible ? "Hide" : "Show"}
                        </button>
                      </div>
                    </div>

                    {isEditing && (
                      <form onSubmit={handleUpdateMapping} className="mt-4 grid grid-cols-1 gap-4 rounded-xl border border-slate-200 bg-slate-50 p-4 sm:grid-cols-2">
                        <label className="font-semibold text-gray-700">
                          Sort Order
                          <input
                            name="sortOrder"
                            inputMode="numeric"
                            value={editForm.sortOrder}
                            onChange={handleEditChange}
                            placeholder="10"
                            className="mt-2 w-full rounded-xl border border-gray-300 px-4 py-3 outline-none focus:border-blue-950"
                          />
                          <FieldError message={editErrors.sortOrder} />
                        </label>

                        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                          <label className="flex items-center gap-3 rounded-xl border border-gray-200 bg-white px-4 py-3 font-semibold text-gray-700">
                            <input type="checkbox" name="required" checked={editForm.required} onChange={handleEditChange} className="h-5 w-5 accent-blue-950" />
                            Required
                          </label>
                          <label className="flex items-center gap-3 rounded-xl border border-gray-200 bg-white px-4 py-3 font-semibold text-gray-700">
                            <input type="checkbox" name="visible" checked={editForm.visible} onChange={handleEditChange} className="h-5 w-5 accent-blue-950" />
                            Visible
                          </label>
                        </div>

                        <div className="flex flex-col gap-2 sm:col-span-2 min-[420px]:flex-row">
                          <button
                            type="submit"
                            disabled={isProcessing}
                            className="flex min-h-10 items-center justify-center gap-2 rounded-xl bg-blue-950 px-4 py-2 text-sm font-bold text-white transition hover:bg-blue-900 disabled:opacity-60"
                          >
                            <CheckCircle2 size={16} aria-hidden="true" />
                            {isProcessing ? "Saving..." : "Save Mapping"}
                          </button>
                          <button
                            type="button"
                            onClick={closeEditForm}
                            disabled={isProcessing}
                            className="flex min-h-10 items-center justify-center rounded-xl border border-gray-300 px-4 py-2 text-sm font-bold text-gray-700 transition hover:bg-gray-50 disabled:opacity-60"
                          >
                            Cancel
                          </button>
                        </div>
                      </form>
                    )}
                  </article>
                );
              })}
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
