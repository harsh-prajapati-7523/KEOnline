import { useCallback, useEffect, useState } from "react";
import { ArrowLeft, ListChecks, Send } from "lucide-react";
import { useNavigate } from "react-router-dom";
import SuggestionInput from "../components/SuggestionInput";

const emptyForm = {
  customerName: "",
  mobileNumber: "",
  villageOrArea: "",
  productType: "",
  categoryId: "",
  complaintDescription: "",
};

function validate(formData) {
  const errors = {};

  if (!formData.customerName.trim()) errors.customerName = "Customer name is required.";
  if (!formData.mobileNumber.trim()) {
    errors.mobileNumber = "Mobile number is required.";
  } else if (!/^\d{10}$/.test(formData.mobileNumber)) {
    errors.mobileNumber = "Mobile number must contain exactly 10 digits.";
  }
  if (!formData.productType.trim()) errors.productType = "Product type is required.";
  if (!formData.categoryId) errors.categoryId = "Ticket category is required.";
  if (!formData.complaintDescription.trim()) {
    errors.complaintDescription = "Complaint description is required.";
  }

  return errors;
}

function isRenderableDynamicField(field) {
  return field?.fieldType === "TEXT" || field?.fieldType === "NUMBER" || field?.fieldType === "TEXTAREA" || field?.fieldType === "DROPDOWN";
}

function getDropdownOptions(field) {
  return Array.isArray(field?.options)
    ? field.options.filter((option) => typeof option?.optionKey === "string" && option.optionKey.trim())
    : [];
}

function validateDynamicFields(dynamicFields, dynamicValues) {
  const errors = {};

  dynamicFields.filter(isRenderableDynamicField).forEach((field) => {
    const fieldId = String(field.categoryFieldConfigId);
    const value = dynamicValues[fieldId] ?? "";
    const trimmedValue = value.trim();

    if (field.required && !trimmedValue) {
      errors[fieldId] = field.fieldType === "DROPDOWN" ? `Please select ${field.displayName}.` : `${field.displayName} is required.`;
      return;
    }

    if (field.fieldType === "NUMBER" && trimmedValue && Number.isNaN(Number(trimmedValue))) {
      errors[fieldId] = `${field.displayName} must be a valid number.`;
    }
  });

  return errors;
}

function buildDynamicValuesPayload(dynamicFields, dynamicValues) {
  return dynamicFields
    .filter(isRenderableDynamicField)
    .map((field) => {
      const value = (dynamicValues[String(field.categoryFieldConfigId)] ?? "").trim();
      if (!value) return null;
      return {
        categoryFieldConfigId: field.categoryFieldConfigId,
        fieldDefinitionId: field.fieldDefinitionId,
        value,
      };
    })
    .filter(Boolean);
}

function FieldError({ message }) {
  return message ? <p className="mt-1 text-sm font-semibold text-red-600">{message}</p> : null;
}

function authHeaders() {
  return {
    Authorization: `Bearer ${localStorage.getItem("token")}`,
  };
}

async function readErrorMessage(response, fallback) {
  try {
    const data = await response.json();
    return typeof data.message === "string" && data.message.trim() ? data.message.trim() : fallback;
  } catch {
    return fallback;
  }
}

function formatCategoryLabel(category) {
  if (!category) return "Not available";
  const categoryKey = category.categoryKey ?? "";
  return category.displayName ? `${category.displayName} (${categoryKey})` : categoryKey || "Not available";
}

export default function CreateTicket() {
  const navigate = useNavigate();
  const [formData, setFormData] = useState(emptyForm);
  const [categories, setCategories] = useState([]);
  const [isLoadingCategories, setIsLoadingCategories] = useState(true);
  const [categoryError, setCategoryError] = useState("");
  const [errors, setErrors] = useState({});
  const [message, setMessage] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [dynamicFields, setDynamicFields] = useState([]);
  const [dynamicValues, setDynamicValues] = useState({});
  const [dynamicErrors, setDynamicErrors] = useState({});
  const [isLoadingDynamicFields, setIsLoadingDynamicFields] = useState(false);
  const [dynamicConfigError, setDynamicConfigError] = useState("");

  const loadCategories = useCallback(async () => {
    setIsLoadingCategories(true);
    setCategoryError("");
    try {
      const response = await fetch("/volt/ticket-categories", { headers: authHeaders() });
      if (!response.ok) throw new Error("Category request failed");
      const data = await response.json();
      setCategories(Array.isArray(data) ? data.filter((category) => category.active) : []);
    } catch {
      setCategories([]);
      setCategoryError("Unable to load ticket categories. Please try again.");
    } finally {
      setIsLoadingCategories(false);
    }
  }, []);

  useEffect(() => {
    loadCategories();
  }, [loadCategories]);

  useEffect(() => {
    const categoryId = formData.categoryId;
    setDynamicFields([]);
    setDynamicValues({});
    setDynamicErrors({});
    setDynamicConfigError("");

    if (!categoryId) {
      setIsLoadingDynamicFields(false);
      return;
    }

    let isCurrent = true;

    async function loadDynamicFields() {
      setIsLoadingDynamicFields(true);
      try {
        const response = await fetch(`/volt/ticket-categories/${categoryId}/form-fields`, { headers: authHeaders() });
        if (!response.ok) throw new Error("Dynamic form config request failed");
        const data = await response.json();
        if (!isCurrent) return;
        setDynamicFields(Array.isArray(data.fields) ? data.fields.filter(isRenderableDynamicField) : []);
      } catch {
        if (!isCurrent) return;
        setDynamicFields([]);
        setDynamicConfigError("Unable to load category fields. Please try again.");
      } finally {
        if (isCurrent) setIsLoadingDynamicFields(false);
      }
    }

    loadDynamicFields();

    return () => {
      isCurrent = false;
    };
  }, [formData.categoryId]);

  const handleChange = (event) => {
    const { name, value } = event.target;
    const nextValue = name === "mobileNumber" ? value.replace(/\D/g, "").slice(0, 10) : value;
    setFormData((current) => ({ ...current, [name]: nextValue }));
    setErrors((current) => ({ ...current, [name]: "" }));
    setMessage("");
  };

  const handleDynamicChange = (event) => {
    const { name, value } = event.target;
    setDynamicValues((current) => ({ ...current, [name]: value }));
    setDynamicErrors((current) => ({ ...current, [name]: "" }));
    setMessage("");
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    const validationErrors = validate(formData);
    const dynamicValidationErrors = validateDynamicFields(dynamicFields, dynamicValues);

    if (Object.keys(validationErrors).length > 0 || Object.keys(dynamicValidationErrors).length > 0) {
      setErrors(validationErrors);
      setDynamicErrors(dynamicValidationErrors);
      setMessage("");
      return;
    }

    if (dynamicConfigError) {
      setMessage("Unable to load category fields. Please try again.");
      return;
    }

    setIsSubmitting(true);
    setErrors({});
    setDynamicErrors({});
    setMessage("");

    try {
      const dynamicValuesPayload = buildDynamicValuesPayload(dynamicFields, dynamicValues);
      const response = await fetch("/volt/tickets", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${localStorage.getItem("token")}`,
        },
        body: JSON.stringify({
          customerName: formData.customerName.trim(),
          mobileNumber: formData.mobileNumber,
          villageOrArea: formData.villageOrArea.trim(),
          productType: formData.productType.trim(),
          categoryId: Number(formData.categoryId),
          complaintDescription: formData.complaintDescription.trim(),
          dynamicValues: dynamicValuesPayload,
        }),
      });

      if (!response.ok) {
        throw new Error(await readErrorMessage(response, "Unable to create the ticket. Please try again."));
      }

      const ticket = await response.json();
      navigate(`/tickets/${ticket.id}`);
    } catch (error) {
      setMessage(error.message || "Unable to create the ticket. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <main className="min-h-screen bg-gray-50 px-4 py-6 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-3xl">
        <div className="mb-4 flex flex-wrap gap-3">
          <button type="button" onClick={() => navigate("/employee-dashboard")} className="flex items-center gap-2 font-semibold text-blue-950">
            <ArrowLeft size={18} aria-hidden="true" /> Dashboard
          </button>
          <button type="button" onClick={() => navigate("/tickets")} className="ml-auto flex items-center gap-2 font-semibold text-blue-950">
            <ListChecks size={18} aria-hidden="true" /> View Tickets
          </button>
        </div>

        <section className="overflow-hidden rounded-3xl bg-white shadow-lg">
          <header className="bg-blue-950 px-5 py-6 text-white sm:px-7">
            <h1 className="text-2xl font-extrabold sm:text-3xl">Create Ticket</h1>
            <p className="mt-2 text-sm text-blue-100">Record a customer service request.</p>
          </header>

          <form onSubmit={handleSubmit} className="grid grid-cols-1 gap-5 p-5 sm:grid-cols-2 sm:p-7">
            <label className="font-semibold text-gray-700">
              Customer Name
              <input name="customerName" value={formData.customerName} onChange={handleChange} className="mt-2 w-full rounded-xl border border-gray-300 px-4 py-3 outline-none focus:border-blue-950" />
              <FieldError message={errors.customerName} />
            </label>

            <label className="font-semibold text-gray-700">
              Mobile Number
              <input name="mobileNumber" type="tel" inputMode="numeric" maxLength={10} value={formData.mobileNumber} onChange={handleChange} className="mt-2 w-full rounded-xl border border-gray-300 px-4 py-3 outline-none focus:border-blue-950" />
              <FieldError message={errors.mobileNumber} />
            </label>

            <label className="font-semibold text-gray-700">
              Village / Area <span className="text-sm font-normal text-gray-500">(Optional)</span>
              <SuggestionInput endpoint="/volt/suggestions/villages" name="villageOrArea" value={formData.villageOrArea} onChange={handleChange} className="mt-2 w-full rounded-xl border border-gray-300 px-4 py-3 outline-none focus:border-blue-950" />
            </label>

            <label className="font-semibold text-gray-700">
              Product Type
              <SuggestionInput endpoint="/volt/suggestions/product-types" name="productType" value={formData.productType} onChange={handleChange} className="mt-2 w-full rounded-xl border border-gray-300 px-4 py-3 outline-none focus:border-blue-950" />
              <FieldError message={errors.productType} />
            </label>

            <label className="font-semibold text-gray-700 sm:col-span-2">
              Ticket Category
              <select name="categoryId" value={formData.categoryId} onChange={handleChange} disabled={isLoadingCategories || categories.length === 0} className="mt-2 w-full rounded-xl border border-gray-300 bg-white px-4 py-3 outline-none focus:border-blue-950 disabled:opacity-60">
                <option value="">{isLoadingCategories ? "Loading ticket categories..." : "Select ticket category"}</option>
                {categories.map((category) => <option key={category.id} value={category.id}>{formatCategoryLabel(category)}</option>)}
              </select>
              <FieldError message={errors.categoryId} />
              {categoryError && <p className="mt-1 text-sm font-semibold text-red-600">{categoryError}</p>}
              {!isLoadingCategories && !categoryError && categories.length === 0 && (
                <p className="mt-1 text-sm font-semibold text-yellow-700">No active ticket categories are available.</p>
              )}
            </label>

            <label className="font-semibold text-gray-700 sm:col-span-2">
              Complaint Description
              <textarea name="complaintDescription" rows="4" value={formData.complaintDescription} onChange={handleChange} className="mt-2 w-full resize-y rounded-xl border border-gray-300 px-4 py-3 outline-none focus:border-blue-950" />
              <FieldError message={errors.complaintDescription} />
            </label>

            {formData.categoryId && (
              <div className="sm:col-span-2">
                {isLoadingDynamicFields && (
                  <p className="text-sm font-semibold text-gray-600">Loading category fields...</p>
                )}
                {dynamicConfigError && (
                  <p className="rounded-xl bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">{dynamicConfigError}</p>
                )}
                {!isLoadingDynamicFields && !dynamicConfigError && dynamicFields.length === 0 && (
                  <p className="rounded-xl bg-gray-50 px-4 py-3 text-sm font-semibold text-gray-600">No additional fields for this category.</p>
                )}
              </div>
            )}

            {!isLoadingDynamicFields && !dynamicConfigError && dynamicFields.map((field) => {
              const fieldId = String(field.categoryFieldConfigId);
              const commonClassName = "mt-2 w-full rounded-xl border border-gray-300 px-4 py-3 outline-none focus:border-blue-950";

              if (field.fieldType === "TEXTAREA") {
                return (
                  <label key={fieldId} className="font-semibold text-gray-700 sm:col-span-2">
                    {field.displayName} {field.required && <span className="text-red-600">*</span>}
                    <textarea name={fieldId} rows="3" value={dynamicValues[fieldId] ?? ""} onChange={handleDynamicChange} maxLength={1000} className={`${commonClassName} resize-y`} />
                    {field.helpText && <p className="mt-1 text-sm font-normal text-gray-500">{field.helpText}</p>}
                    <FieldError message={dynamicErrors[fieldId]} />
                  </label>
                );
              }

              if (field.fieldType === "DROPDOWN") {
                const options = getDropdownOptions(field);
                return (
                  <label key={fieldId} className="font-semibold text-gray-700">
                    {field.displayName} {field.required && <span className="text-red-600">*</span>}
                    <select
                      name={fieldId}
                      value={dynamicValues[fieldId] ?? ""}
                      onChange={handleDynamicChange}
                      disabled={options.length === 0}
                      className={`${commonClassName} bg-white disabled:opacity-60`}
                    >
                      <option value="">{options.length === 0 ? "No options available" : `Select ${field.displayName}`}</option>
                      {options.map((option) => (
                        <option key={option.optionKey} value={option.optionKey}>
                          {option.displayValue || option.optionKey}
                        </option>
                      ))}
                    </select>
                    {field.helpText && <p className="mt-1 text-sm font-normal text-gray-500">{field.helpText}</p>}
                    {options.length === 0 && <p className="mt-1 text-sm font-normal text-gray-500">No options are currently available for this field.</p>}
                    <FieldError message={dynamicErrors[fieldId]} />
                  </label>
                );
              }

              return (
                <label key={fieldId} className="font-semibold text-gray-700">
                  {field.displayName} {field.required && <span className="text-red-600">*</span>}
                  <input
                    name={fieldId}
                    type={field.fieldType === "NUMBER" ? "number" : "text"}
                    value={dynamicValues[fieldId] ?? ""}
                    onChange={handleDynamicChange}
                    maxLength={field.fieldType === "TEXT" ? 255 : undefined}
                    step={field.fieldType === "NUMBER" ? "0.01" : undefined}
                    className={commonClassName}
                  />
                  {field.helpText && <p className="mt-1 text-sm font-normal text-gray-500">{field.helpText}</p>}
                  <FieldError message={dynamicErrors[fieldId]} />
                </label>
              );
            })}

            {message && (
              <p className="sm:col-span-2 rounded-xl bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">
                {message}
              </p>
            )}

            <button type="submit" disabled={isSubmitting || isLoadingCategories || isLoadingDynamicFields || categories.length === 0} className="flex items-center justify-center gap-2 rounded-xl bg-yellow-400 px-5 py-3 font-bold text-black transition hover:bg-yellow-300 disabled:opacity-60 sm:col-span-2">
              <Send size={18} aria-hidden="true" />
              {isSubmitting ? "Creating Ticket..." : "Create Ticket"}
            </button>
          </form>
        </section>
      </div>
    </main>
  );
}
