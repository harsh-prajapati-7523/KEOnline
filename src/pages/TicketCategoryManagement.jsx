import { useCallback, useEffect, useState } from "react";
import { ArrowLeft, CheckCircle2, PlusCircle, RefreshCw, ShieldCheck, X } from "lucide-react";
import { useNavigate } from "react-router-dom";

const categoryKeyPattern = /^[A-Z0-9_]{3,40}$/;
const emptyCreateForm = {
  categoryKey: "",
  displayName: "",
  active: true,
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

function validateCreate(form) {
  const errors = {};
  const categoryKey = form.categoryKey.trim();
  const displayName = form.displayName.trim();
  const sortOrder = form.sortOrder.trim();

  if (!categoryKey) {
    errors.categoryKey = "Category Key is required.";
  } else if (!categoryKeyPattern.test(categoryKey)) {
    errors.categoryKey = "Use 3 to 40 uppercase letters, numbers, or underscores.";
  }

  if (!displayName) {
    errors.displayName = "Display Name is required.";
  } else if (displayName.length > 80) {
    errors.displayName = "Display Name must be 80 characters or less.";
  }

  if (sortOrder && !/^\d+$/.test(sortOrder)) {
    errors.sortOrder = "Sort Order must be numeric.";
  }

  return errors;
}

function categoryKind(category) {
  if (category.categoryKey === "OTHER") return "Protected";
  return category.systemCategory ? "System" : "Custom";
}

export default function TicketCategoryManagement() {
  const navigate = useNavigate();
  const [categories, setCategories] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [listError, setListError] = useState("");
  const [message, setMessage] = useState("");
  const [messageType, setMessageType] = useState("success");
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [createForm, setCreateForm] = useState(emptyCreateForm);
  const [createErrors, setCreateErrors] = useState({});
  const [isCreating, setIsCreating] = useState(false);
  const [processingCategoryId, setProcessingCategoryId] = useState(null);

  const loadCategories = useCallback(async () => {
    setIsLoading(true);
    setListError("");
    try {
      const response = await fetch("/volt/ticket-categories", { headers: authHeaders() });
      if (!response.ok) throw new Error("Category list request failed");
      const data = await response.json();
      setCategories(Array.isArray(data) ? data : []);
    } catch {
      setCategories([]);
      setListError("Unable to load ticket categories. Please try again.");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadCategories();
  }, [loadCategories]);

  const closeCreateForm = () => {
    setShowCreateForm(false);
    setCreateForm(emptyCreateForm);
    setCreateErrors({});
  };

  const handleCreateChange = (event) => {
    const { checked, name, type, value } = event.target;
    setCreateForm((current) => ({ ...current, [name]: type === "checkbox" ? checked : value }));
    setCreateErrors((current) => ({ ...current, [name]: "" }));
    setMessage("");
  };

  const handleCreate = async (event) => {
    event.preventDefault();
    const errors = validateCreate(createForm);
    if (Object.keys(errors).length > 0) {
      setCreateErrors(errors);
      return;
    }

    setIsCreating(true);
    setMessage("");
    try {
      const payload = {
        categoryKey: createForm.categoryKey.trim(),
        displayName: createForm.displayName.trim(),
        active: createForm.active,
      };
      if (createForm.sortOrder.trim()) {
        payload.sortOrder = Number(createForm.sortOrder.trim());
      }

      const response = await fetch("/volt/ticket-categories", {
        method: "POST",
        headers: authHeaders(true),
        body: JSON.stringify(payload),
      });
      if (!response.ok) throw new Error(await readApiError(response, "Unable to create ticket category. Please check the details."));
      closeCreateForm();
      setMessageType("success");
      setMessage("Ticket category created successfully.");
      await loadCategories();
    } catch (error) {
      setMessageType("error");
      setMessage(error.message || "Unable to create ticket category. Please check the details.");
    } finally {
      setIsCreating(false);
    }
  };

  const updateStatus = async (category) => {
    const active = !category.active;
    setProcessingCategoryId(category.id);
    setMessage("");
    try {
      const response = await fetch(`/volt/ticket-categories/${category.id}/status`, {
        method: "PATCH",
        headers: authHeaders(true),
        body: JSON.stringify({ active }),
      });
      if (!response.ok) throw new Error(await readApiError(response, "Unable to update category status. Please try again."));
      setMessageType("success");
      setMessage(`Ticket category ${active ? "enabled" : "disabled"} successfully.`);
      await loadCategories();
    } catch (error) {
      setMessageType("error");
      setMessage(error.message || "Unable to update category status. Please try again.");
    } finally {
      setProcessingCategoryId(null);
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
              <h1 className="text-2xl font-extrabold sm:text-3xl">Ticket Categories</h1>
              <p className="mt-2 text-sm text-blue-100">Create and manage ticket categories used in the system.</p>
            </div>
            <div className="flex flex-col gap-2 min-[420px]:flex-row">
              <button
                type="button"
                onClick={() => showCreateForm ? closeCreateForm() : setShowCreateForm(true)}
                className="flex min-h-11 items-center justify-center gap-2 rounded-2xl bg-yellow-400 px-4 py-2 font-bold text-black transition hover:bg-yellow-300"
              >
                {showCreateForm ? <X size={18} aria-hidden="true" /> : <PlusCircle size={18} aria-hidden="true" />}
                {showCreateForm ? "Close" : "Add Category"}
              </button>
              <button
                type="button"
                onClick={loadCategories}
                disabled={isLoading}
                className="flex min-h-11 items-center justify-center gap-2 rounded-2xl bg-white/10 px-4 py-2 font-bold text-white transition hover:bg-white/20 disabled:opacity-60"
              >
                <RefreshCw size={18} aria-hidden="true" />
                Refresh
              </button>
            </div>
          </div>
        </header>

        <Message type={messageType}>{message}</Message>

        {showCreateForm && (
          <form onSubmit={handleCreate} className="mt-5 grid grid-cols-1 gap-4 rounded-2xl border border-blue-100 bg-white p-5 shadow-sm sm:grid-cols-2">
            <h2 className="text-lg font-extrabold text-blue-950 sm:col-span-2">Add Category</h2>

            <label className="font-semibold text-gray-700">
              Category Key
              <input
                name="categoryKey"
                value={createForm.categoryKey}
                onChange={handleCreateChange}
                placeholder="SOLAR_VISIT"
                className="mt-2 w-full rounded-xl border border-gray-300 px-4 py-3 outline-none focus:border-blue-950"
              />
              <span className="mt-1 block text-xs font-semibold text-gray-500">
                Use uppercase letters, numbers, and underscore only. Example: SOLAR_VISIT
              </span>
              <FieldError message={createErrors.categoryKey} />
            </label>

            <label className="font-semibold text-gray-700">
              Display Name
              <input
                name="displayName"
                value={createForm.displayName}
                onChange={handleCreateChange}
                placeholder="Solar Visit"
                className="mt-2 w-full rounded-xl border border-gray-300 px-4 py-3 outline-none focus:border-blue-950"
              />
              <FieldError message={createErrors.displayName} />
            </label>

            <label className="font-semibold text-gray-700">
              Sort Order
              <input
                name="sortOrder"
                inputMode="numeric"
                value={createForm.sortOrder}
                onChange={handleCreateChange}
                placeholder="20"
                className="mt-2 w-full rounded-xl border border-gray-300 px-4 py-3 outline-none focus:border-blue-950"
              />
              <FieldError message={createErrors.sortOrder} />
            </label>

            <label className="flex items-center gap-3 rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 font-semibold text-gray-700">
              <input
                type="checkbox"
                name="active"
                checked={createForm.active}
                onChange={handleCreateChange}
                className="h-5 w-5 accent-blue-950"
              />
              Active
            </label>

            <div className="flex flex-col gap-2 sm:col-span-2 min-[420px]:flex-row">
              <button
                type="submit"
                disabled={isCreating}
                className="flex min-h-11 items-center justify-center gap-2 rounded-2xl bg-blue-950 px-5 py-2 font-bold text-white transition hover:bg-blue-900 disabled:opacity-60"
              >
                <CheckCircle2 size={18} aria-hidden="true" />
                {isCreating ? "Creating..." : "Create Category"}
              </button>
              <button
                type="button"
                onClick={closeCreateForm}
                className="flex min-h-11 items-center justify-center rounded-2xl border border-gray-300 px-5 py-2 font-bold text-gray-700 transition hover:bg-gray-50"
              >
                Cancel
              </button>
            </div>
          </form>
        )}

        <section className="mt-6" aria-labelledby="category-list-title">
          <h2 id="category-list-title" className="text-xl font-extrabold text-blue-950">Category List</h2>

          {isLoading && <p className="mt-4 rounded-xl border border-blue-100 bg-white px-4 py-3 text-sm font-semibold text-gray-600">Loading ticket categories...</p>}
          {!isLoading && listError && <p className="mt-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">{listError}</p>}
          {!isLoading && !listError && categories.length === 0 && <p className="mt-4 rounded-xl border border-blue-100 bg-white px-4 py-3 text-sm font-semibold text-gray-600">No ticket categories found.</p>}

          {!isLoading && !listError && categories.length > 0 && (
            <div className="mt-4 divide-y divide-blue-100 overflow-hidden rounded-2xl border border-blue-100 bg-white shadow-sm">
              {categories.map((category) => {
                const protectedCategory = category.categoryKey === "OTHER";
                const statusLabel = category.active ? "Active" : "Inactive";
                const kindLabel = categoryKind(category);
                const isProcessing = processingCategoryId === category.id;
                const sortLabel = category.sortOrder ?? "Not set";

                return (
                  <article key={category.id} className="flex flex-col gap-3 px-4 py-4 sm:flex-row sm:items-center sm:justify-between">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="text-base font-extrabold text-blue-950">{category.displayName || "Unnamed Category"}</h3>
                        {protectedCategory && (
                          <span className="inline-flex items-center gap-1 rounded-full bg-yellow-100 px-2.5 py-1 text-xs font-bold text-yellow-800">
                            <ShieldCheck size={13} aria-hidden="true" />
                            Protected
                          </span>
                        )}
                      </div>
                      <p className="mt-1 text-sm font-semibold text-gray-600">
                        {category.categoryKey} · {statusLabel} · {kindLabel} · Sort {sortLabel}
                      </p>
                      <p className="mt-1 text-xs font-medium text-gray-500">
                        Created {formatDateTime(category.createdAt)} · Updated {formatDateTime(category.updatedAt)}
                      </p>
                    </div>

                    {!protectedCategory && (
                      <button
                        type="button"
                        onClick={() => updateStatus(category)}
                        disabled={isProcessing}
                        className={`flex min-h-10 items-center justify-center rounded-xl px-4 py-2 text-sm font-bold transition disabled:opacity-60 ${
                          category.active
                            ? "border border-red-200 bg-red-50 text-red-700 hover:bg-red-100"
                            : "border border-green-200 bg-green-50 text-green-700 hover:bg-green-100"
                        }`}
                      >
                        {isProcessing ? "Saving..." : category.active ? "Disable" : "Enable"}
                      </button>
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
