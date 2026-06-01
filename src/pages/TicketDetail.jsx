import { useEffect, useState } from "react";
import { ArrowLeft, Calendar, Eye, MapPin, Phone, Plus } from "lucide-react";
import { useNavigate, useParams } from "react-router-dom";

function formatDate(value) {
  if (!value) return "Not available";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleDateString();
}

function formatCurrency(value) {
  const amount = Number(value);
  if (!Number.isFinite(amount)) {
    return "₹0.00";
  }

  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}

function hasMaxTwoDecimals(value) {
  const match = String(value).match(/^(?:\d+)(?:\.(\d+))?$/);
  return match ? match[1] ? match[1].length <= 2 : true : false;
}

function InfoItem({ label, children, className = "" }) {
  return (
    <div className={className}>
      <dt className="font-bold text-gray-500">{label}</dt>
      <dd className="mt-1 text-gray-800">{children ?? "Not available"}</dd>
    </div>
  );
}

export default function TicketDetail() {
  const navigate = useNavigate();
  const { ticketId } = useParams();
  const [ticket, setTicket] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const [statusMessage, setStatusMessage] = useState("");
  const [processingKeys, setProcessingKeys] = useState({});
  const [showCharges, setShowCharges] = useState(false);
  const [chargeItems, setChargeItems] = useState([]);
  const [chargeTotal, setChargeTotal] = useState("0.00");
  const [chargeLoading, setChargeLoading] = useState(false);
  const [chargeError, setChargeError] = useState("");
  const [chargeForm, setChargeForm] = useState({ description: "", amount: "" });
  const [chargeFormErrors, setChargeFormErrors] = useState({});
  const [chargeActionMessage, setChargeActionMessage] = useState("");
  const currentRole = localStorage.getItem("role") ?? "";
  const currentEmployeeId = localStorage.getItem("employeeId") ?? "";

  const loadTicket = async () => {
    setIsLoading(true);
    setError("");
    try {
      const response = await fetch("/volt/tickets", {
        headers: {
          Authorization: `Bearer ${localStorage.getItem("token")}`,
        },
      });

      if (!response.ok) throw new Error("Ticket details failed");

      const data = await response.json();
      const selectedTicket = Array.isArray(data)
        ? data.find((item) => String(item.id) === String(ticketId))
        : null;

      if (!selectedTicket) {
        setTicket(null);
        setError("Ticket not found.");
        return;
      }

      setTicket(selectedTicket);
    } catch {
      setTicket(null);
      setError("Unable to load ticket details. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  const loadCharges = async () => {
    setChargeError("");
    setChargeLoading(true);
    setChargeActionMessage("");
    setChargeFormErrors({});
    try {
      const response = await fetch(`/volt/tickets/${ticketId}/charges`, {
        headers: {
          Authorization: `Bearer ${localStorage.getItem("token")}`,
        },
      });

      if (!response.ok) throw new Error("Unable to load charges");

      const data = await response.json();
      setChargeItems(Array.isArray(data.chargeItems) ? data.chargeItems : []);
      setChargeTotal(data.totalCharge ?? "0.00");
    } catch {
      setChargeError("Unable to load charges. Please try again.");
      setChargeItems([]);
      setChargeTotal("0.00");
    } finally {
      setChargeLoading(false);
    }
  };

  useEffect(() => {
    loadTicket();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ticketId]);

  const setProcessing = (key, value) => {
    setProcessingKeys((current) => ({ ...current, [key]: value }));
  };

  const ticketAction = async (path, body = null, successMessage) => {
    const response = await fetch(`/volt/tickets/${ticketId}/${path}`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${localStorage.getItem("token")}`,
        "Content-Type": "application/json",
      },
      body: body ? JSON.stringify(body) : null,
    });

    if (!response.ok) throw new Error("Ticket action failed");

    await loadTicket();
    if (showCharges) await loadCharges();
    setStatusMessage(successMessage);
  };

  const runTicketAction = async (key, path, body, successMessage, errorMessage) => {
    setProcessing(key, true);
    setStatusMessage("");
    try {
      await ticketAction(path, body, successMessage);
    } catch {
      setStatusMessage(errorMessage);
    } finally {
      setProcessing(key, false);
    }
  };

  const toggleCharges = async () => {
    if (showCharges) {
      setShowCharges(false);
      return;
    }

    setShowCharges(true);
    setChargeForm({ description: "", amount: "" });
    await loadCharges();
  };

  const validateChargeInput = (description, amountValue) => {
    const errors = {};
    const trimmedDescription = description.trim();

    if (!trimmedDescription) {
      errors.description = "Description is required.";
    } else if (trimmedDescription.length > 120) {
      errors.description = "Description cannot exceed 120 characters.";
    }

    if (amountValue === "" || amountValue === null) {
      errors.amount = "Amount is required.";
    } else {
      const amount = Number(amountValue);
      if (!Number.isFinite(amount)) errors.amount = "Amount must be a valid number.";
      else if (amount <= 0) errors.amount = "Amount must be greater than 0.";
      else if (amount > 999999.99) errors.amount = "Amount cannot exceed 999999.99.";
      else if (!hasMaxTwoDecimals(amountValue)) errors.amount = "Amount can have maximum 2 decimal places.";
    }

    return errors;
  };

  const addCharge = async () => {
    setChargeActionMessage("");
    const errors = validateChargeInput(chargeForm.description, chargeForm.amount);
    if (Object.keys(errors).length > 0) {
      setChargeFormErrors(errors);
      return;
    }

    const key = `add-charge-${ticketId}`;
    setProcessing(key, true);
    setChargeFormErrors({});
    try {
      const response = await fetch(`/volt/tickets/${ticketId}/charges`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${localStorage.getItem("token")}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          description: chargeForm.description.trim(),
          amount: Number(chargeForm.amount),
        }),
      });

      if (!response.ok) throw new Error("Unable to add charge");

      await loadCharges();
      await loadTicket();
      setChargeForm({ description: "", amount: "" });
      setChargeActionMessage("Charge added successfully.");
    } catch {
      setChargeActionMessage("Unable to add charge. Please check description and amount.");
    } finally {
      setProcessing(key, false);
    }
  };

  const deleteCharge = async (chargeItemId) => {
    const key = `delete-charge-${chargeItemId}`;
    setProcessing(key, true);
    try {
      const response = await fetch(`/volt/tickets/${ticketId}/charges/${chargeItemId}`, {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${localStorage.getItem("token")}`,
        },
      });

      if (!response.ok) throw new Error("Unable to delete charge");

      await loadCharges();
      await loadTicket();
      setChargeActionMessage("Charge deleted successfully.");
    } catch {
      setChargeActionMessage("Unable to delete charge. Please try again.");
    } finally {
      setProcessing(key, false);
    }
  };

  const handleChargeInput = (event) => {
    const { name, value } = event.target;
    setChargeForm((current) => ({ ...current, [name]: value }));
    setChargeFormErrors((current) => ({ ...current, [name]: "" }));
    setChargeActionMessage("");
  };

  const isTicketOwner = ticket?.pickedByEmployeeId
    && currentEmployeeId
    && String(ticket.pickedByEmployeeId) === currentEmployeeId;
  const canComplete = ticket?.status === "IN_PROGRESS"
    && (["SUPER_ADMIN", "ADMIN"].includes(currentRole) || isTicketOwner);
  const canCancel = ["SUPER_ADMIN", "ADMIN"].includes(currentRole)
    && ["NEW", "PICKED", "IN_PROGRESS"].includes(ticket?.status);
  const canAddCharge = ticket
    && !["NEW", "CANCELLED"].includes(ticket.status)
    && (["SUPER_ADMIN", "ADMIN"].includes(currentRole)
      ? ["PICKED", "IN_PROGRESS", "COMPLETED"].includes(ticket.status)
      : ["PICKED", "IN_PROGRESS"].includes(ticket.status) && isTicketOwner);
  const canDeleteCharge = ["SUPER_ADMIN", "ADMIN"].includes(currentRole);

  return (
    <main className="min-h-screen bg-gray-50 px-4 py-6 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-4xl">
        <button type="button" onClick={() => navigate("/tickets")} className="flex items-center gap-2 font-semibold text-blue-950">
          <ArrowLeft size={18} aria-hidden="true" /> Back to Tickets
        </button>

        {isLoading && <p className="mt-6 text-sm font-semibold text-gray-600">Loading ticket details...</p>}
        {error && <p className="mt-6 rounded-xl bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">{error}</p>}

        {!isLoading && !error && ticket && (
          <div className="mt-4 space-y-4">
            <header className="rounded-3xl bg-blue-950 p-5 text-white shadow-lg sm:p-7">
              <p className="text-xs font-bold uppercase tracking-wide text-blue-200">Ticket Number</p>
              <div className="mt-1 flex flex-wrap items-center justify-between gap-3">
                <h1 className="text-2xl font-extrabold sm:text-3xl">{ticket.ticketNumber ?? "Not available"}</h1>
                <span className="rounded-full bg-white/15 px-3 py-1 text-xs font-bold">{ticket.status ?? "Not available"}</span>
              </div>
            </header>

            {statusMessage && (
              <p className={`rounded-xl px-4 py-3 text-sm font-semibold ${statusMessage.startsWith("Unable") ? "bg-red-50 text-red-700" : "bg-green-50 text-green-700"}`}>
                {statusMessage}
              </p>
            )}

            <section className="rounded-2xl border border-blue-100 bg-white p-5 shadow-sm">
              <h2 className="text-lg font-bold text-blue-950">Customer Details</h2>
              <dl className="mt-4 grid grid-cols-1 gap-3 text-sm sm:grid-cols-2">
                <InfoItem label="Customer Name">{ticket.customerName}</InfoItem>
                <InfoItem label="Mobile Number"><span className="inline-flex items-center gap-2"><Phone size={15} aria-hidden="true" /> {ticket.mobileNumber ?? "Not available"}</span></InfoItem>
                <InfoItem label="Village / Area" className="sm:col-span-2"><span className="inline-flex items-center gap-2"><MapPin size={15} aria-hidden="true" /> {ticket.villageOrArea ?? "Not available"}</span></InfoItem>
              </dl>
            </section>

            <section className="rounded-2xl border border-blue-100 bg-white p-5 shadow-sm">
              <h2 className="text-lg font-bold text-blue-950">Product &amp; Complaint</h2>
              <dl className="mt-4 grid grid-cols-1 gap-3 text-sm sm:grid-cols-2">
                <InfoItem label="Product Type">{ticket.productType}</InfoItem>
                <InfoItem label="Category">{ticket.category}</InfoItem>
                <InfoItem label="Complaint Description" className="sm:col-span-2">{ticket.complaintDescription}</InfoItem>
              </dl>
            </section>

            <section className="rounded-2xl border border-blue-100 bg-white p-5 shadow-sm">
              <h2 className="text-lg font-bold text-blue-950">Status / Workflow Details</h2>
              <dl className="mt-4 grid grid-cols-1 gap-3 text-sm sm:grid-cols-2">
                <InfoItem label="Status">{ticket.status}</InfoItem>
                <InfoItem label="Picked By">{ticket.pickedByEmployeeId ?? "Not picked"}</InfoItem>
                <InfoItem label="Created Date"><span className="inline-flex items-center gap-2"><Calendar size={15} aria-hidden="true" /> {formatDate(ticket.createdAt ?? ticket.createdDate)}</span></InfoItem>
                {ticket.status === "COMPLETED" && <InfoItem label="Completed By">{ticket.completedByEmployeeId}</InfoItem>}
                {ticket.status === "COMPLETED" && <InfoItem label="Completed At">{formatDate(ticket.completedAt)}</InfoItem>}
                {ticket.status === "COMPLETED" && ticket.completionRemark && <InfoItem label="Completion Remark" className="sm:col-span-2">{ticket.completionRemark}</InfoItem>}
                {ticket.status === "CANCELLED" && <InfoItem label="Cancelled By">{ticket.cancelledByEmployeeId}</InfoItem>}
                {ticket.status === "CANCELLED" && <InfoItem label="Cancelled At">{formatDate(ticket.cancelledAt)}</InfoItem>}
                {ticket.status === "CANCELLED" && <InfoItem label="Cancellation Reason" className="sm:col-span-2">{ticket.cancellationReason}</InfoItem>}
              </dl>
            </section>

            <section className="rounded-2xl border border-blue-100 bg-white p-5 shadow-sm">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h2 className="text-lg font-bold text-blue-950">Charges</h2>
                  <p className="mt-1 text-sm text-gray-600">Total Charge: {formatCurrency(ticket.totalCharge ?? chargeTotal)}</p>
                </div>
                <button type="button" onClick={toggleCharges} className="rounded-2xl bg-blue-50 px-4 py-2 font-semibold text-blue-950 hover:bg-blue-100">
                  <span className="inline-flex items-center gap-2"><Eye size={16} aria-hidden="true" /> {showCharges ? "Hide Charges" : "View Charges"}</span>
                </button>
              </div>

              {showCharges && (
                <div className="mt-4 space-y-4">
                  {chargeLoading && <p className="text-sm font-semibold text-gray-600">Loading charges...</p>}
                  {chargeError && <p className="rounded-xl bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">{chargeError}</p>}
                  {!chargeLoading && !chargeError && (
                    <>
                      {chargeItems.length === 0 ? (
                        <p className="rounded-2xl border border-slate-200 bg-white p-4 text-sm text-slate-600">No charge items found.</p>
                      ) : (
                        <div className="space-y-2">
                          {chargeItems.map((item) => (
                            <div key={item.id} className="flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white p-4 sm:flex-row sm:items-center sm:justify-between">
                              <span className="text-slate-800">{item.description}</span>
                              <div className="flex items-center gap-3">
                                <span className="font-semibold text-slate-900">{formatCurrency(item.amount)}</span>
                                {canDeleteCharge && (
                                  <button type="button" onClick={() => deleteCharge(item.id)} disabled={processingKeys[`delete-charge-${item.id}`]} className="rounded-2xl bg-red-50 px-3 py-2 text-xs font-semibold text-red-700 hover:bg-red-100 disabled:opacity-60">
                                    {processingKeys[`delete-charge-${item.id}`] ? "Deleting..." : "Delete"}
                                  </button>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      )}

                      <div className="rounded-2xl border border-slate-200 bg-slate-100 p-4 text-sm font-semibold text-slate-800">
                        <div className="flex items-center justify-between"><span>Total Charge</span><span>{formatCurrency(chargeTotal)}</span></div>
                      </div>

                      {canAddCharge && (
                        <div className="rounded-2xl border border-slate-200 bg-white p-4">
                          <h3 className="text-sm font-bold text-slate-900">Add Charge</h3>
                          <div className="mt-4 grid gap-4 sm:grid-cols-2">
                            <label className="block text-sm font-semibold text-slate-700">
                              Description
                              <input name="description" value={chargeForm.description} onChange={handleChargeInput} maxLength={120} className="mt-2 w-full rounded-xl border border-slate-300 px-4 py-3 outline-none focus:border-blue-950" />
                              {chargeFormErrors.description && <span className="mt-1 block text-xs text-red-600">{chargeFormErrors.description}</span>}
                            </label>
                            <label className="block text-sm font-semibold text-slate-700">
                              Amount
                              <input name="amount" type="number" min="0.01" max="999999.99" step="0.01" value={chargeForm.amount} onChange={handleChargeInput} className="mt-2 w-full rounded-xl border border-slate-300 px-4 py-3 outline-none focus:border-blue-950" />
                              {chargeFormErrors.amount && <span className="mt-1 block text-xs text-red-600">{chargeFormErrors.amount}</span>}
                            </label>
                          </div>
                          <button type="button" onClick={addCharge} disabled={processingKeys[`add-charge-${ticketId}`]} className="mt-4 inline-flex items-center gap-2 rounded-2xl bg-yellow-400 px-4 py-2 font-semibold text-black disabled:opacity-60">
                            <Plus size={16} aria-hidden="true" /> {processingKeys[`add-charge-${ticketId}`] ? "Adding..." : "Add Charge"}
                          </button>
                        </div>
                      )}
                      {chargeActionMessage && <p className="rounded-xl bg-blue-50 px-4 py-3 text-sm font-semibold text-blue-950">{chargeActionMessage}</p>}
                    </>
                  )}
                </div>
              )}
            </section>

            <section className="rounded-2xl border border-blue-100 bg-white p-5 shadow-sm">
              <h2 className="text-lg font-bold text-blue-950">Actions</h2>
              <div className="mt-4 flex flex-wrap items-center gap-2">
                {ticket.status === "NEW" && <button type="button" onClick={() => runTicketAction(`pick-${ticketId}`, "pick", null, "Ticket picked successfully.", "Unable to update ticket. Please try again.")} disabled={processingKeys[`pick-${ticketId}`]} className="rounded-2xl bg-yellow-400 px-4 py-2 font-semibold text-black disabled:opacity-60">{processingKeys[`pick-${ticketId}`] ? "Picking..." : "Pick Ticket"}</button>}
                {ticket.status === "PICKED" && <button type="button" onClick={() => runTicketAction(`pick-${ticketId}`, "pick", null, "Ticket picked successfully.", "Unable to update ticket. Please try again.")} disabled={processingKeys[`pick-${ticketId}`]} className="rounded-2xl bg-yellow-400 px-4 py-2 font-semibold text-black disabled:opacity-60">{processingKeys[`pick-${ticketId}`] ? "Picking..." : "Pick Ticket"}</button>}
                {ticket.status === "PICKED" && <button type="button" onClick={() => runTicketAction(`start-${ticketId}`, "start-work", null, "Work started on ticket.", "Unable to update ticket. Please try again.")} disabled={processingKeys[`start-${ticketId}`]} className="rounded-2xl bg-blue-950 px-4 py-2 font-semibold text-white disabled:opacity-60">{processingKeys[`start-${ticketId}`] ? "Starting..." : "Start Work"}</button>}
                {canComplete && <button type="button" onClick={() => runTicketAction(`complete-${ticketId}`, "complete", { completionRemark: "Completed via UI." }, "Ticket completed successfully.", "Unable to update ticket. Please try again.")} disabled={processingKeys[`complete-${ticketId}`]} className="rounded-2xl bg-green-600 px-4 py-2 font-semibold text-white disabled:opacity-60">{processingKeys[`complete-${ticketId}`] ? "Completing..." : "Complete Ticket"}</button>}
                {canCancel && <button type="button" onClick={() => runTicketAction(`cancel-${ticketId}`, "cancel", { cancellationReason: "Cancelled via ticket detail." }, "Ticket cancelled successfully.", "Unable to update ticket. Please try again.")} disabled={processingKeys[`cancel-${ticketId}`]} className="rounded-2xl bg-red-500 px-4 py-2 font-semibold text-white disabled:opacity-60">{processingKeys[`cancel-${ticketId}`] ? "Cancelling..." : "Cancel Ticket"}</button>}
                {!["NEW", "PICKED"].includes(ticket.status) && !canComplete && !canCancel && <p className="text-sm text-gray-600">No workflow actions are available for this ticket.</p>}
              </div>
            </section>
          </div>
        )}
      </div>
    </main>
  );
}
