import { useCallback, useEffect, useRef, useState } from "react";
import { ArrowLeft, ChevronDown, ClipboardList, MapPin, MessageCircle, Package, Phone, Send, User } from "lucide-react";
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

  if (!formData.categoryId) errors.categoryId = "Select ticket type.";
  if (!formData.mobileNumber.trim()) {
    errors.mobileNumber = "Enter a valid 10-digit mobile number.";
  } else if (!/^\d{10}$/.test(formData.mobileNumber)) {
    errors.mobileNumber = "Enter a valid 10-digit mobile number.";
  }
  if (!formData.customerName.trim()) errors.customerName = "Customer name is required.";
  if (!formData.villageOrArea.trim()) errors.villageOrArea = "Village / Area is required.";
  if (!formData.productType.trim()) errors.productType = "Product type is required.";

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
  return message ? <p id={id} className="field-error">{message}</p> : null;
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
  const fieldRefs = useRef({});
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

  const getFieldClassName = (fieldName, type = "input", extraClassName = "") => `form-${type} ${errors[fieldName] ? "ke-form-control-invalid" : ""} ${extraClassName}`.trim();
  const getDynamicFieldClassName = (fieldId, type = "input", extraClassName = "") => `form-${type} ${dynamicErrors[fieldId] ? "ke-form-control-invalid" : ""} ${extraClassName}`.trim();

  const setFieldRef = (fieldName) => (element) => {
    if (element) fieldRefs.current[fieldName] = element;
  };

  const loadCategories = useCallback(async () => {
    setIsLoadingCategories(true);
    setCategoryError("");
    try {
      const response = await fetch("/volt/ticket-categories", { headers: authHeaders() });
      if (!response.ok) throw new Error("Category request failed");
      const data = await response.json();
      const nextCategories = Array.isArray(data) ? data : Array.isArray(data?.categories) ? data.categories : [];
      setCategories(nextCategories.filter((category) => category.active));
    } catch {
      setCategories([]);
      setCategoryError("Unable to load ticket types. Please try again.");
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

  const applyQuickValue = (name, value) => {
    setFormData((current) => ({ ...current, [name]: value }));
    setErrors((current) => ({ ...current, [name]: "" }));
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
      const firstErrorKey = ["categoryId", "mobileNumber", "customerName", "villageOrArea", "productType"].find((key) => validationErrors[key]);
      const firstDynamicErrorKey = Object.keys(dynamicValidationErrors)[0];
      window.requestAnimationFrame(() => {
        const field = firstErrorKey ? fieldRefs.current[firstErrorKey] : document.getElementById(`dynamic-field-${firstDynamicErrorKey}`);
        field?.focus({ preventScroll: true });
        field?.scrollIntoView({ behavior: "smooth", block: "center" });
      });
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

  const productChips = ["Battery", "Inverter", "UPS", "Fan", "Stabilizer"];
  const problemChips = ["Not charging", "No backup", "Not working", "Noise issue"];

  return (
    <main id="main-content" className="create-ticket-compact-page create-ticket-page">
      <div className="create-ticket-shell">
        <section className="create-ticket-title-area" aria-labelledby="create-ticket-title">
          <div className="create-ticket-title-row">
            <button type="button" onClick={() => navigate("/employee-dashboard")} className="create-ticket-back-button" aria-label="Back to dashboard">
              <ArrowLeft aria-hidden="true" />
            </button>
            <h1 id="create-ticket-title" className="page-title">Create Ticket</h1>
          </div>
          <p className="page-helper">Fill customer and product details.</p>
        </section>

        <form id="create-ticket-form" onSubmit={handleSubmit} className="create-ticket-form">
          <section className="form-section ticket-type-section" aria-labelledby="ticket-type-heading">
            <div className="section-icon" aria-hidden="true">
              <ClipboardList size={28} />
            </div>
            <div className="section-content">
              <h2 id="ticket-type-heading">Ticket Type</h2>
              <p>What service is needed?</p>
              <label htmlFor="ticket-category" className="sr-only">Ticket Type</label>
              <div className="select-with-icon">
                <select ref={setFieldRef("categoryId")} id="ticket-category" name="categoryId" value={formData.categoryId} onChange={handleChange} disabled={isLoadingCategories || categories.length === 0} className={getFieldClassName("categoryId", "select")} aria-invalid={Boolean(errors.categoryId)} aria-describedby={errors.categoryId ? "ticket-category-error" : undefined}>
                  <option value="">{isLoadingCategories ? "Loading ticket types..." : "Select service type"}</option>
                  {categories.map((category) => <option key={category.id} value={category.id}>{formatCategoryLabel(category)}</option>)}
                </select>
                <ChevronDown aria-hidden="true" />
              </div>
              <FieldError id="ticket-category-error" message={errors.categoryId} />
              {categoryError && <p className="field-error">{categoryError}</p>}
              {!isLoadingCategories && !categoryError && categories.length === 0 && (
                <p className="mt-1 text-sm font-semibold text-yellow-700">No active ticket types are available.</p>
              )}
            </div>
          </section>

          <section className="form-section customer-section" aria-labelledby="customer-heading">
            <div className="section-icon" aria-hidden="true">
              <User size={28} />
            </div>
            <div className="section-content">
              <h2 id="customer-heading">Customer</h2>
              <div className="field-stack">
                <div>
                  <label htmlFor="mobile-number" className="sr-only">Mobile Number</label>
                  <div className="input-with-icon">
                    <Phone aria-hidden="true" />
                    <input ref={setFieldRef("mobileNumber")} id="mobile-number" name="mobileNumber" type="tel" inputMode="numeric" maxLength={10} value={formData.mobileNumber} onChange={handleChange} placeholder="Enter 10-digit mobile number" className={getFieldClassName("mobileNumber")} aria-invalid={Boolean(errors.mobileNumber)} aria-describedby={errors.mobileNumber ? "mobile-number-error" : undefined} />
                  </div>
                  <FieldError id="mobile-number-error" message={errors.mobileNumber} />
                </div>

                <div>
                  <label htmlFor="customer-name" className="sr-only">Customer Name</label>
                  <div className="input-with-icon">
                    <User aria-hidden="true" />
                    <input ref={setFieldRef("customerName")} id="customer-name" name="customerName" value={formData.customerName} onChange={handleChange} placeholder="Enter customer name" className={getFieldClassName("customerName")} aria-invalid={Boolean(errors.customerName)} aria-describedby={errors.customerName ? "customer-name-error" : undefined} />
                  </div>
                  <FieldError id="customer-name-error" message={errors.customerName} />
                </div>

                <div>
                  <label htmlFor="village-or-area" className="sr-only">Village / Area</label>
                  <div className="input-with-icon">
                    <MapPin aria-hidden="true" />
                    <SuggestionInput ref={setFieldRef("villageOrArea")} id="village-or-area" endpoint="/volt/suggestions/villages" name="villageOrArea" value={formData.villageOrArea} onChange={handleChange} placeholder="Enter village or area" className={getFieldClassName("villageOrArea")} aria-invalid={Boolean(errors.villageOrArea)} aria-describedby={errors.villageOrArea ? "village-or-area-error" : undefined} />
                  </div>
                  <FieldError id="village-or-area-error" message={errors.villageOrArea} />
                </div>
              </div>
            </div>
          </section>

          <section className="form-section product-problem-section" aria-labelledby="product-problem-heading">
            <div className="section-icon" aria-hidden="true">
              <Package size={28} />
            </div>
            <div className="section-content">
              <h2 id="product-problem-heading">Product &amp; Problem</h2>
              <div className="field-stack">
                <div>
                  <label htmlFor="product-type" className="form-label">Product Type</label>
                  <div className="input-with-icon">
                    <Package aria-hidden="true" />
                    <SuggestionInput ref={setFieldRef("productType")} id="product-type" endpoint="/volt/suggestions/product-types" name="productType" value={formData.productType} onChange={handleChange} placeholder="e.g., Inverter, Battery" className={getFieldClassName("productType")} aria-invalid={Boolean(errors.productType)} aria-describedby={errors.productType ? "product-type-error" : undefined} />
                  </div>
                  <FieldError id="product-type-error" message={errors.productType} />
                  <div className="quick-chip-row" aria-label="Product type shortcuts">
                    {productChips.map((chip) => (
                      <button key={chip} type="button" className="quick-chip" onClick={() => applyQuickValue("productType", chip)}>
                        {chip}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label htmlFor="complaint-description" className="form-label">
                    Problem Details <span className="optional-badge">Optional</span>
                  </label>
                  <div className="input-with-icon textarea">
                    <MessageCircle aria-hidden="true" />
                    <textarea id="complaint-description" name="complaintDescription" rows="3" value={formData.complaintDescription} onChange={handleChange} placeholder="Example: not charging" className={getFieldClassName("complaintDescription", "textarea")} />
                  </div>
                  <div className="quick-chip-row" aria-label="Problem detail shortcuts">
                    {problemChips.map((chip) => (
                      <button key={chip} type="button" className="quick-chip" onClick={() => applyQuickValue("complaintDescription", chip)}>
                        {chip}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {formData.categoryId && (isLoadingDynamicFields || dynamicConfigError) && (
                <div className="dynamic-field-status">
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
                  <label key={fieldId} htmlFor={inputId} className="form-label dynamic-field">
                    {field.displayName} {field.required && <span className="text-red-600">*</span>}
                    <textarea id={inputId} name={fieldId} rows="3" value={dynamicValues[fieldId] ?? ""} onChange={handleDynamicChange} maxLength={1000} className={getDynamicFieldClassName(fieldId, "textarea")} aria-invalid={Boolean(dynamicErrors[fieldId])} aria-describedby={dynamicErrors[fieldId] ? errorId : undefined} />
                    {field.helpText && <p className="mt-1 text-sm font-normal text-gray-500">{field.helpText}</p>}
                    <FieldError id={errorId} message={dynamicErrors[fieldId]} />
                  </label>
                );
              }

              if (field.fieldType === "DROPDOWN") {
                const options = getDropdownOptions(field);
                return (
                  <label key={fieldId} htmlFor={inputId} className="form-label dynamic-field">
                    {field.displayName} {field.required && <span className="text-red-600">*</span>}
                    <select
                      id={inputId}
                      name={fieldId}
                      value={dynamicValues[fieldId] ?? ""}
                      onChange={handleDynamicChange}
                      disabled={options.length === 0}
                      className={getDynamicFieldClassName(fieldId, "select", "disabled:opacity-60")}
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
                <label key={fieldId} htmlFor={inputId} className="form-label dynamic-field">
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
            </div>
          </section>

          <div aria-live="polite">
            {message && (
              <p role="status" className={`create-ticket-message ${message.startsWith("Unable") ? "create-ticket-message-error" : "create-ticket-message-success"}`}>
                {message}
              </p>
            )}
          </div>
        </form>
      </div>

      <div className="create-ticket-action-bar">
        <button type="submit" form="create-ticket-form" disabled={isSubmitting || isLoadingCategories || isLoadingDynamicFields || categories.length === 0} aria-busy={isSubmitting} className="create-ticket-submit">
          <Send aria-hidden="true" />
          {isSubmitting ? "Creating Ticket..." : "Create Ticket"}
        </button>
      </div>
    </main>
  );
}
