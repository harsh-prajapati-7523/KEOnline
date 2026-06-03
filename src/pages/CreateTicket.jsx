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
  warrantyStatus: "",
  manufacturerComplaintNumber: "",
  manufacturerOrBrandName: "",
  productSerialNumber: "",
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
  if (!formData.warrantyStatus) errors.warrantyStatus = "Warranty status is required.";
  if (formData.warrantyStatus === "IN_WARRANTY") {
    if (!formData.manufacturerOrBrandName.trim()) {
      errors.manufacturerOrBrandName = "Brand name is required for in-warranty tickets.";
    }
    if (!formData.productSerialNumber.trim()) {
      errors.productSerialNumber = "Product serial number is required for in-warranty tickets.";
    }
  }

  return errors;
}

function FieldError({ message }) {
  return message ? <p className="mt-1 text-sm font-semibold text-red-600">{message}</p> : null;
}

function authHeaders() {
  return {
    Authorization: `Bearer ${localStorage.getItem("token")}`,
  };
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

  const handleChange = (event) => {
    const { name, value } = event.target;
    const nextValue = name === "mobileNumber" ? value.replace(/\D/g, "").slice(0, 10) : value;
    setFormData((current) => ({ ...current, [name]: nextValue }));
    setErrors((current) => ({ ...current, [name]: "" }));
    setMessage("");
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    const validationErrors = validate(formData);

    if (Object.keys(validationErrors).length > 0) {
      setErrors(validationErrors);
      setMessage("");
      return;
    }

    setIsSubmitting(true);
    setErrors({});
    setMessage("");

    try {
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
          warrantyStatus: formData.warrantyStatus,
          manufacturerComplaintNumber: formData.manufacturerComplaintNumber.trim(),
          manufacturerOrBrandName: formData.manufacturerOrBrandName.trim(),
          productSerialNumber: formData.productSerialNumber.trim(),
        }),
      });

      if (!response.ok) throw new Error("Ticket creation failed");

      const ticket = await response.json();
      navigate(`/tickets/${ticket.id}`);
    } catch {
      setMessage("Unable to create the ticket. Please try again.");
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

            <label className="font-semibold text-gray-700 sm:col-span-2">
              Warranty Status
              <select name="warrantyStatus" value={formData.warrantyStatus} onChange={handleChange} className="mt-2 w-full rounded-xl border border-gray-300 bg-white px-4 py-3 outline-none focus:border-blue-950">
                <option value="">Select warranty status</option>
                <option value="NOT_CHECKED">Not Checked</option>
                <option value="IN_WARRANTY">In Warranty</option>
                <option value="OUT_OF_WARRANTY">Out Of Warranty</option>
              </select>
              <FieldError message={errors.warrantyStatus} />
            </label>

            <label className="font-semibold text-gray-700">
              Manufacturer / Brand Name <span className="text-sm font-normal text-gray-500">(Required for in-warranty)</span>
              <SuggestionInput endpoint="/volt/suggestions/manufacturers" name="manufacturerOrBrandName" value={formData.manufacturerOrBrandName} onChange={handleChange} maxLength={80} className="mt-2 w-full rounded-xl border border-gray-300 px-4 py-3 outline-none focus:border-blue-950" />
              <FieldError message={errors.manufacturerOrBrandName} />
            </label>

            <label className="font-semibold text-gray-700">
              Product Serial Number <span className="text-sm font-normal text-gray-500">(Required for in-warranty)</span>
              <input name="productSerialNumber" value={formData.productSerialNumber} onChange={handleChange} maxLength={80} className="mt-2 w-full rounded-xl border border-gray-300 px-4 py-3 outline-none focus:border-blue-950" />
              <FieldError message={errors.productSerialNumber} />
            </label>

            <label className="font-semibold text-gray-700 sm:col-span-2">
              Manufacturer Complaint Number <span className="text-sm font-normal text-gray-500">(Optional)</span>
              <input name="manufacturerComplaintNumber" value={formData.manufacturerComplaintNumber} onChange={handleChange} maxLength={80} className="mt-2 w-full rounded-xl border border-gray-300 px-4 py-3 outline-none focus:border-blue-950" />
            </label>

            {message && (
              <p className={`sm:col-span-2 rounded-xl px-4 py-3 text-sm font-semibold ${message.startsWith("Unable") ? "bg-red-50 text-red-700" : "bg-green-50 text-green-700"}`}>
                {message}
              </p>
            )}

            <button type="submit" disabled={isSubmitting || isLoadingCategories || categories.length === 0} className="flex items-center justify-center gap-2 rounded-xl bg-yellow-400 px-5 py-3 font-bold text-black transition hover:bg-yellow-300 disabled:opacity-60 sm:col-span-2">
              <Send size={18} aria-hidden="true" />
              {isSubmitting ? "Creating Ticket..." : "Create Ticket"}
            </button>
          </form>
        </section>
      </div>
    </main>
  );
}
