import { useState } from "react";
import { ArrowLeft, ListChecks, Send } from "lucide-react";
import { useNavigate } from "react-router-dom";

const emptyForm = {
  customerName: "",
  mobileNumber: "",
  villageOrArea: "",
  productType: "",
  category: "",
  complaintDescription: "",
};

const categories = [
  "INSTALLATION",
  "BATTERY_RECHARGE",
  "ELECTRICAL_REPAIR",
  "OTHER",
];

function validate(formData) {
  const errors = {};

  if (!formData.customerName.trim()) errors.customerName = "Customer name is required.";
  if (!formData.mobileNumber.trim()) {
    errors.mobileNumber = "Mobile number is required.";
  } else if (!/^\d{10}$/.test(formData.mobileNumber)) {
    errors.mobileNumber = "Mobile number must contain exactly 10 digits.";
  }
  if (!formData.productType.trim()) errors.productType = "Product type is required.";
  if (!formData.category) errors.category = "Category is required.";
  if (!formData.complaintDescription.trim()) {
    errors.complaintDescription = "Complaint description is required.";
  }

  return errors;
}

function FieldError({ message }) {
  return message ? <p className="mt-1 text-sm font-semibold text-red-600">{message}</p> : null;
}

export default function CreateTicket() {
  const navigate = useNavigate();
  const [formData, setFormData] = useState(emptyForm);
  const [errors, setErrors] = useState({});
  const [message, setMessage] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

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
          ...formData,
          customerName: formData.customerName.trim(),
          villageOrArea: formData.villageOrArea.trim(),
          productType: formData.productType.trim(),
          complaintDescription: formData.complaintDescription.trim(),
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
              <input name="villageOrArea" value={formData.villageOrArea} onChange={handleChange} className="mt-2 w-full rounded-xl border border-gray-300 px-4 py-3 outline-none focus:border-blue-950" />
            </label>

            <label className="font-semibold text-gray-700">
              Product Type
              <input name="productType" value={formData.productType} onChange={handleChange} className="mt-2 w-full rounded-xl border border-gray-300 px-4 py-3 outline-none focus:border-blue-950" />
              <FieldError message={errors.productType} />
            </label>

            <label className="font-semibold text-gray-700 sm:col-span-2">
              Category
              <select name="category" value={formData.category} onChange={handleChange} className="mt-2 w-full rounded-xl border border-gray-300 bg-white px-4 py-3 outline-none focus:border-blue-950">
                <option value="">Select category</option>
                {categories.map((category) => <option key={category}>{category}</option>)}
              </select>
              <FieldError message={errors.category} />
            </label>

            <label className="font-semibold text-gray-700 sm:col-span-2">
              Complaint Description
              <textarea name="complaintDescription" rows="4" value={formData.complaintDescription} onChange={handleChange} className="mt-2 w-full resize-y rounded-xl border border-gray-300 px-4 py-3 outline-none focus:border-blue-950" />
              <FieldError message={errors.complaintDescription} />
            </label>

            {message && (
              <p className={`sm:col-span-2 rounded-xl px-4 py-3 text-sm font-semibold ${message.startsWith("Unable") ? "bg-red-50 text-red-700" : "bg-green-50 text-green-700"}`}>
                {message}
              </p>
            )}

            <button type="submit" disabled={isSubmitting} className="flex items-center justify-center gap-2 rounded-xl bg-yellow-400 px-5 py-3 font-bold text-black transition hover:bg-yellow-300 disabled:opacity-60 sm:col-span-2">
              <Send size={18} aria-hidden="true" />
              {isSubmitting ? "Creating Ticket..." : "Create Ticket"}
            </button>
          </form>
        </section>
      </div>
    </main>
  );
}
