import { useCallback, useEffect, useState } from "react";
import { ArrowLeft, Send } from "lucide-react";
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
    errors.mobileNumber = "Please enter a valid 10-digit mobile number.";
  }
  if (!formData.villageOrArea.trim()) errors.villageOrArea = "Village / Area is required.";
  if (!formData.productType.trim()) errors.productType = "Product type is required.";
  if (!formData.categoryId) errors.categoryId = "Ticket category is required.";

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

function FieldError({ id, message }) {
  return message ? <p id={id} className="mt-1 text-sm font-semibold text-red-600">{message}</p> : null;
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

function formatEnumLabel(value) {
  return value
    .toLowerCase()
    .split("_")
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

function formatCategoryLabel(category) {
  if (!category) return "Not available";
  const categoryKey = category.categoryKey ?? "";
  return category.displayName || (categoryKey ? formatEnumLabel(categoryKey) : "Not available");
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

  const getFieldClassName = (fieldName, extraClassName = "") => `ke-form-control mt-1 ${errors[fieldName] ? "ke-form-control-invalid" : ""} ${extraClassName}`.trim();
  const getDynamicFieldClassName = (fieldId, extraClassName = "") => `ke-form-control mt-1 ${dynamicErrors[fieldId] ? "ke-form-control-invalid" : ""} ${extraClassName}`.trim();

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
    if (isSubmitting) return;

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

      if (!response.ok) throw new Error(await readErrorMessage(response, "Unable to create ticket. Please check the details and try again."));

      const ticket = await response.json();
      setMessage("Ticket created successfully.");
      navigate(`/tickets/${ticket.id}`);
    } catch {
      setMessage("Unable to create ticket. Please check the details and try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <main id="main-content" className="ke-page-main lg:px-8">
      <div className="mx-auto w-full max-w-3xl">
        <div className="mb-2.5 flex min-w-0 items-center gap-2 sm:mb-4">
          <button type="button" onClick={() => navigate("/employee-dashboard")} className="flex min-h-10 shrink-0 items-center gap-1.5 rounded-xl px-1 py-1.5 font-semibold text-blue-950 sm:min-h-11 sm:gap-2 sm:py-2">
            <ArrowLeft size={18} aria-hidden="true" />
            <span className="sr-only sm:not-sr-only">Dashboard</span>
          </button>
          <h1 className="ke-create-title min-w-0 flex-1 break-words text-xl font-extrabold leading-tight text-blue-950 sm:text-2xl">Create Ticket</h1>
        </div>

        <section className="ke-create-card min-w-0 overflow-hidden">
          <form onSubmit={handleSubmit} className="ke-create-form grid min-w-0 grid-cols-1 gap-2.5 p-3 sm:grid-cols-2 sm:gap-4 sm:p-6">
            <label htmlFor="customer-name" className="ke-form-label">
              Customer Name
              <input id="customer-name" name="customerName" value={formData.customerName} onChange={handleChange} placeholder="Enter customer name" className={getFieldClassName("customerName")} aria-invalid={Boolean(errors.customerName)} aria-describedby={errors.customerName ? "customer-name-error" : undefined} />
              <FieldError id="customer-name-error" message={errors.customerName} />
            </label>

            <label htmlFor="mobile-number" className="ke-form-label">
              Mobile Number
              <input id="mobile-number" name="mobileNumber" type="tel" inputMode="numeric" maxLength={10} value={formData.mobileNumber} onChange={handleChange} placeholder="Enter 10-digit mobile number" className={getFieldClassName("mobileNumber")} aria-invalid={Boolean(errors.mobileNumber)} aria-describedby={errors.mobileNumber ? "mobile-number-error" : undefined} />
              <FieldError id="mobile-number-error" message={errors.mobileNumber} />
            </label>

            <label htmlFor="village-or-area" className="ke-form-label">
              Village / Area
              <SuggestionInput id="village-or-area" endpoint="/volt/suggestions/villages" name="villageOrArea" value={formData.villageOrArea} onChange={handleChange} placeholder="Enter village or area" className={getFieldClassName("villageOrArea")} aria-invalid={Boolean(errors.villageOrArea)} aria-describedby={errors.villageOrArea ? "village-or-area-error" : undefined} />
              <FieldError id="village-or-area-error" message={errors.villageOrArea} />
            </label>

            <label htmlFor="product-type" className="ke-form-label">
              Product Type
              <SuggestionInput id="product-type" endpoint="/volt/suggestions/product-types" name="productType" value={formData.productType} onChange={handleChange} placeholder="e.g., Battery, Inverter, UPS, Stabilizer" className={getFieldClassName("productType")} aria-invalid={Boolean(errors.productType)} aria-describedby={errors.productType ? "product-type-error" : undefined} />
              <FieldError id="product-type-error" message={errors.productType} />
            </label>

            <label htmlFor="ticket-category" className="ke-form-label sm:col-span-2">
              Ticket Category
              <select id="ticket-category" name="categoryId" value={formData.categoryId} onChange={handleChange} disabled={isLoadingCategories || categories.length === 0} className={getFieldClassName("categoryId", "bg-white")} aria-invalid={Boolean(errors.categoryId)} aria-describedby={errors.categoryId ? "ticket-category-error" : undefined}>
                <option value="">{isLoadingCategories ? "Loading ticket categories..." : "Select ticket category"}</option>
                {categories.map((category) => <option key={category.id} value={category.id}>{formatCategoryLabel(category)}</option>)}
              </select>
              <FieldError id="ticket-category-error" message={errors.categoryId} />
              {categoryError && <p className="mt-1 text-sm font-semibold text-red-600">{categoryError}</p>}
              {!isLoadingCategories && !categoryError && categories.length === 0 && (
                <p className="mt-1 text-sm font-semibold text-yellow-700">No active ticket categories are available.</p>
              )}
            </label>

            <label htmlFor="complaint-description" className="ke-form-label sm:col-span-2">
              Complaint Description <span className="text-sm font-normal text-gray-500">(Optional)</span>
              <textarea id="complaint-description" name="complaintDescription" rows="3" value={formData.complaintDescription} onChange={handleChange} placeholder="Describe the customer complaint" className={getFieldClassName("complaintDescription", "min-h-24 resize-y sm:min-h-28")} />
            </label>

            {formData.categoryId && (isLoadingDynamicFields || dynamicConfigError) && (
              <div className="sm:col-span-2">
                {isLoadingDynamicFields && (
                  <p className="text-sm font-semibold text-gray-600">Loading category fields...</p>
                )}
                {dynamicConfigError && (
                  <p className="rounded-xl bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">{dynamicConfigError}</p>
                )}
              </div>
            )}

            {!isLoadingDynamicFields && !dynamicConfigError && dynamicFields.map((field) => {
              const fieldId = String(field.categoryFieldConfigId);
              const inputId = `dynamic-field-${fieldId}`;
              const errorId = `dynamic-field-${fieldId}-error`;

              if (field.fieldType === "TEXTAREA") {
                return (
                  <label key={fieldId} htmlFor={inputId} className="ke-form-label sm:col-span-2">
                    {field.displayName} {field.required && <span className="text-red-600">*</span>}
                    <textarea id={inputId} name={fieldId} rows="3" value={dynamicValues[fieldId] ?? ""} onChange={handleDynamicChange} maxLength={1000} className={getDynamicFieldClassName(fieldId, "min-h-24 resize-y")} aria-invalid={Boolean(dynamicErrors[fieldId])} aria-describedby={dynamicErrors[fieldId] ? errorId : undefined} />
                    {field.helpText && <p className="mt-1 text-sm font-normal text-gray-500">{field.helpText}</p>}
                    <FieldError id={errorId} message={dynamicErrors[fieldId]} />
                  </label>
                );
              }

              if (field.fieldType === "DROPDOWN") {
                const options = getDropdownOptions(field);
                return (
                  <label key={fieldId} htmlFor={inputId} className="ke-form-label">
                    {field.displayName} {field.required && <span className="text-red-600">*</span>}
                    <select
                      id={inputId}
                      name={fieldId}
                      value={dynamicValues[fieldId] ?? ""}
                      onChange={handleDynamicChange}
                      disabled={options.length === 0}
                      className={getDynamicFieldClassName(fieldId, "bg-white disabled:opacity-60")}
                      aria-invalid={Boolean(dynamicErrors[fieldId])}
                      aria-describedby={dynamicErrors[fieldId] ? errorId : undefined}
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
                    <FieldError id={errorId} message={dynamicErrors[fieldId]} />
                  </label>
                );
              }

              return (
                <label key={fieldId} htmlFor={inputId} className="ke-form-label">
                  {field.displayName} {field.required && <span className="text-red-600">*</span>}
                  <input
                    id={inputId}
                    name={fieldId}
                    type={field.fieldType === "NUMBER" ? "number" : "text"}
                    value={dynamicValues[fieldId] ?? ""}
                    onChange={handleDynamicChange}
                    maxLength={field.fieldType === "TEXT" ? 255 : undefined}
                    step={field.fieldType === "NUMBER" ? "0.01" : undefined}
                    className={getDynamicFieldClassName(fieldId)}
                    aria-invalid={Boolean(dynamicErrors[fieldId])}
                    aria-describedby={dynamicErrors[fieldId] ? errorId : undefined}
                  />
                  {field.helpText && <p className="mt-1 text-sm font-normal text-gray-500">{field.helpText}</p>}
                  <FieldError id={errorId} message={dynamicErrors[fieldId]} />
                </label>
              );
            })}

            <div aria-live="polite" className="sm:col-span-2">
              {message && (
                <p role="status" className={`rounded-xl px-4 py-3 text-sm font-semibold ${message.startsWith("Unable") ? "bg-red-50 text-red-700" : "bg-green-50 text-green-700"}`}>
                  {message}
                </p>
              )}
            </div>

            <button type="submit" disabled={isSubmitting || isLoadingCategories || isLoadingDynamicFields || categories.length === 0} aria-busy={isSubmitting} className="ke-accent-action mt-1 flex min-h-12 items-center justify-center gap-2 rounded-xl px-5 py-3 font-bold transition disabled:cursor-not-allowed disabled:opacity-60 sm:col-span-2">
              <Send size={18} aria-hidden="true" />
              {isSubmitting ? "Creating Ticket..." : "Create Ticket"}
            </button>
          </form>
        </section>
      </div>
    </main>
  );
}
