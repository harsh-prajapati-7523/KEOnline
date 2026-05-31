import { useEffect, useState } from "react";
import { ArrowLeft, Calendar, MapPin, Phone, Eye, Plus, Trash2 } from "lucide-react";
import { useNavigate } from "react-router-dom";

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
  const text = String(value);
  const match = text.match(/^(?:\d+)(?:\.(\d+))?$/);
  return match ? match[1] ? match[1].length <= 2 : true : false;
}

function TicketCard({
  ticket,
  currentRole,
  currentEmployeeId,
  onPick,
  onStart,
  onComplete,
  onCancel,
  onToggleCharges,
  canAddCharge,
  processingKeys,
}) {
  const pickedBy = ticket.pickedByEmployeeId ?? "Not picked";
  const isCurrentOwner = currentEmployeeId && String(ticket.pickedByEmployeeId) === currentEmployeeId;
  const canShowComplete = ticket.status === "IN_PROGRESS" && (currentRole === "SUPER_ADMIN" || currentRole === "ADMIN" || isCurrentOwner);
  const canShowCancel = ["SUPER_ADMIN", "ADMIN"].includes(currentRole) && ["NEW", "PICKED", "IN_PROGRESS"].includes(ticket.status);
  const totalCharge = formatCurrency(ticket.totalCharge ?? 0);

  return (
    <article className="rounded-2xl border border-blue-100 bg-white p-5 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-bold uppercase tracking-wide text-gray-500">Ticket Number</p>
          <h2 className="mt-1 text-lg font-extrabold text-blue-950">{ticket.ticketNumber ?? "Not available"}</h2>
        </div>
        <span className="rounded-full bg-blue-50 px-3 py-1 text-xs font-bold text-blue-950">
          {ticket.status ?? "Not available"}
        </span>
      </div>

      <dl className="mt-4 grid grid-cols-1 gap-3 text-sm sm:grid-cols-2">
        <div>
          <dt className="font-bold text-gray-500">Customer Name</dt>
          <dd className="mt-1 text-gray-800">{ticket.customerName ?? "Not available"}</dd>
        </div>
        <div>
          <dt className="font-bold text-gray-500">Product Type</dt>
          <dd className="mt-1 text-gray-800">{ticket.productType ?? "Not available"}</dd>
        </div>
        <div>
          <dt className="font-bold text-gray-500">Category</dt>
          <dd className="mt-1 text-gray-800">{ticket.category ?? "Not available"}</dd>
        </div>
        <div>
          <dt className="font-bold text-gray-500">Mobile Number</dt>
          <dd className="mt-1 flex items-center gap-2 text-gray-800">
            <Phone size={15} aria-hidden="true" />{ticket.mobileNumber ?? "Not available"}
          </dd>
        </div>
        {ticket.villageOrArea && (
          <div>
            <dt className="font-bold text-gray-500">Village / Area</dt>
            <dd className="mt-1 flex items-center gap-2 text-gray-800">
              <MapPin size={15} aria-hidden="true" />{ticket.villageOrArea}
            </dd>
          </div>
        )}
        <div>
          <dt className="font-bold text-gray-500">Created Date</dt>
          <dd className="mt-1 flex items-center gap-2 text-gray-800">
            <Calendar size={15} aria-hidden="true" />{formatDate(ticket.createdAt ?? ticket.createdDate)}
          </dd>
        </div>
        <div>
          <dt className="font-bold text-gray-500">Total Charge</dt>
          <dd className="mt-1 text-gray-800">{totalCharge}</dd>
        </div>

        <div>
          <dt className="font-bold text-gray-500">Picked By</dt>
          <dd className="mt-1 text-gray-800">{pickedBy}</dd>
        </div>

        {ticket.status === "COMPLETED" && (
          <>
            <div>
              <dt className="font-bold text-gray-500">Completed By</dt>
              <dd className="mt-1 text-gray-800">{ticket.completedByEmployeeId ?? "Not available"}</dd>
            </div>
            <div>
              <dt className="font-bold text-gray-500">Completed At</dt>
              <dd className="mt-1 text-gray-800">{formatDate(ticket.completedAt)}</dd>
            </div>
          </>
        )}

        {ticket.status === "CANCELLED" && (
          <>
            <div>
              <dt className="font-bold text-gray-500">Cancelled By</dt>
              <dd className="mt-1 text-gray-800">{ticket.cancelledByEmployeeId ?? "Not available"}</dd>
            </div>
            <div>
              <dt className="font-bold text-gray-500">Cancelled At</dt>
              <dd className="mt-1 text-gray-800">{formatDate(ticket.cancelledAt)}</dd>
            </div>
            <div className="sm:col-span-2">
              <dt className="font-bold text-gray-500">Cancellation Reason</dt>
              <dd className="mt-1 text-gray-800">{ticket.cancellationReason ?? "Not available"}</dd>
            </div>
          </>
        )}
      </dl>

      <div className="mt-4 flex flex-wrap items-center gap-2">
        {ticket.status === "NEW" && (
          <button
            type="button"
            onClick={() => onPick(ticket.id)}
            disabled={processingKeys[`pick-${ticket.id}`]}
            className="rounded-2xl bg-yellow-400 px-4 py-2 font-semibold text-black disabled:opacity-60"
          >
            {processingKeys[`pick-${ticket.id}`] ? "Picking…" : "Pick Ticket"}
          </button>
        )}

        {ticket.status === "PICKED" && (
          <>
            <button
              type="button"
              onClick={() => onPick(ticket.id)}
              disabled={processingKeys[`pick-${ticket.id}`]}
              className="rounded-2xl bg-yellow-400 px-4 py-2 font-semibold text-black disabled:opacity-60"
            >
              {processingKeys[`pick-${ticket.id}`] ? "Picking…" : "Pick Ticket"}
            </button>

            <button
              type="button"
              onClick={() => onStart(ticket.id)}
              disabled={processingKeys[`start-${ticket.id}`]}
              className="rounded-2xl bg-blue-950 px-4 py-2 font-semibold text-white disabled:opacity-60"
            >
              {processingKeys[`start-${ticket.id}`] ? "Starting…" : "Start Work"}
            </button>
          </>
        )}

        {ticket.status === "IN_PROGRESS" && (
          <>
            {canShowComplete && (
              <button
                type="button"
                onClick={() => onComplete(ticket.id)}
                disabled={processingKeys[`complete-${ticket.id}`]}
                className="rounded-2xl bg-green-600 px-4 py-2 font-semibold text-white disabled:opacity-60"
              >
                {processingKeys[`complete-${ticket.id}`] ? "Completing…" : "Complete Ticket"}
              </button>
            )}
            {!canShowComplete && (
              <span className="rounded-full bg-blue-100 px-3 py-1 text-xs font-bold text-blue-950">In Progress</span>
            )}
          </>
        )}

        {canShowCancel && (
          <button
            type="button"
            onClick={() => onCancel(ticket.id)}
            disabled={processingKeys[`cancel-${ticket.id}`]}
            className="rounded-2xl bg-red-500 px-4 py-2 font-semibold text-white disabled:opacity-60"
          >
            {processingKeys[`cancel-${ticket.id}`] ? "Cancelling…" : "Cancel Ticket"}
          </button>
        )}

        <button
          type="button"
          onClick={() => onToggleCharges(ticket.id)}
          className="rounded-2xl bg-blue-50 px-4 py-2 font-semibold text-blue-950 hover:bg-blue-100"
        >
          <span className="inline-flex items-center gap-2">
            <Eye size={16} aria-hidden="true" /> View Charges
          </span>
        </button>

        {canAddCharge && (
          <button
            type="button"
            onClick={() => onToggleCharges(ticket.id)}
            className="rounded-2xl bg-yellow-100 px-4 py-2 font-semibold text-black hover:bg-yellow-200"
          >
            <span className="inline-flex items-center gap-2">
              <Plus size={16} aria-hidden="true" /> Add Charge
            </span>
          </button>
        )}
      </div>
    </article>
  );
}

export default function TicketList() {
  const navigate = useNavigate();
  const [tickets, setTickets] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const [statusMessage, setStatusMessage] = useState("");
  const [processingKeys, setProcessingKeys] = useState({});
  const [activeTicketId, setActiveTicketId] = useState(null);
  const [chargeItems, setChargeItems] = useState([]);
  const [chargeTotal, setChargeTotal] = useState("0.00");
  const [chargeLoading, setChargeLoading] = useState(false);
  const [chargeError, setChargeError] = useState("");
  const [chargeForm, setChargeForm] = useState({ description: "", amount: "" });
  const [chargeFormErrors, setChargeFormErrors] = useState({});
  const [chargeActionMessage, setChargeActionMessage] = useState("");
  const currentRole = localStorage.getItem("role") ?? "";
  const currentEmployeeId = localStorage.getItem("employeeId") ?? "";

  const loadTickets = async () => {
    setIsLoading(true);
    setError("");
    setStatusMessage("");
    try {
      const response = await fetch("/volt/tickets", {
        headers: {
          Authorization: `Bearer ${localStorage.getItem("token")}`,
        },
      });

      if (!response.ok) throw new Error("Ticket list failed");

      const data = await response.json();
      setTickets(Array.isArray(data) ? data : []);
    } catch {
      setError("Unable to load tickets. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  const loadCharges = async (ticketId) => {
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
    loadTickets();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const setProcessing = (key, value) => {
    setProcessingKeys((prev) => ({ ...prev, [key]: value }));
  };

  const openChargePanel = async (ticketId) => {
    if (activeTicketId === ticketId) {
      setActiveTicketId(null);
      return;
    }

    setActiveTicketId(ticketId);
    setChargeForm({ description: "", amount: "" });
    setChargeFormErrors({});
    setChargeActionMessage("");
    await loadCharges(ticketId);
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
      const amountNumber = Number(amountValue);
      if (!Number.isFinite(amountNumber)) {
        errors.amount = "Amount must be a valid number.";
      } else if (amountNumber <= 0) {
        errors.amount = "Amount must be greater than 0.";
      } else if (amountNumber > 999999.99) {
        errors.amount = "Amount cannot exceed 999999.99.";
      } else if (!hasMaxTwoDecimals(amountValue)) {
        errors.amount = "Amount can have maximum 2 decimal places.";
      }
    }

    return errors;
  };

  const addCharge = async (ticketId) => {
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

      if (!response.ok) {
        if (response.status === 400) {
          setChargeActionMessage("Unable to add charge. Please check description and amount.");
          return;
        }
        throw new Error("Unable to add charge.");
      }

      await loadCharges(ticketId);
      await loadTickets();
      setChargeForm({ description: "", amount: "" });
      setChargeActionMessage("Charge added successfully.");
    } catch {
      if (!chargeActionMessage) {
        setChargeActionMessage("Unable to add charge. Please try again.");
      }
    } finally {
      setProcessing(key, false);
    }
  };

  const deleteCharge = async (ticketId, chargeItemId) => {
    const key = `delete-charge-${chargeItemId}`;
    setProcessing(key, true);
    try {
      const response = await fetch(`/volt/tickets/${ticketId}/charges/${chargeItemId}`, {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${localStorage.getItem("token")}`,
        },
      });

      if (!response.ok) {
        throw new Error("Unable to delete charge.");
      }

      await loadCharges(ticketId);
      await loadTickets();
      setChargeActionMessage("Charge deleted successfully.");
    } catch {
      setChargeActionMessage("Unable to delete charge. Please try again.");
    } finally {
      setProcessing(key, false);
    }
  };

  const handleChargeInput = (event) => {
    const { name, value } = event.target;
    setChargeForm((prev) => ({ ...prev, [name]: value }));
    setChargeFormErrors((prev) => ({ ...prev, [name]: "" }));
    setChargeActionMessage("");
  };

  const isTicketOwner = (ticket) => {
    return ticket.pickedByEmployeeId && currentEmployeeId && String(ticket.pickedByEmployeeId) === currentEmployeeId;
  };

  const canAddCharge = (ticket) => {
    if (["NEW", "CANCELLED"].includes(ticket.status)) return false;
    if (["SUPER_ADMIN", "ADMIN"].includes(currentRole)) return ["PICKED", "IN_PROGRESS", "COMPLETED"].includes(ticket.status);
    if (ticket.status === "PICKED" || ticket.status === "IN_PROGRESS") {
      return isTicketOwner(ticket);
    }
    return false;
  };

  const canDeleteCharge = () => {
    return ["SUPER_ADMIN", "ADMIN"].includes(currentRole);
  };

  return (
    <main className="min-h-screen bg-gray-50 px-4 py-6 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-5xl">
        <button type="button" onClick={() => navigate("/employee-dashboard")} className="flex items-center gap-2 font-semibold text-blue-950">
          <ArrowLeft size={18} aria-hidden="true" /> Dashboard
        </button>

        <header className="mt-4 rounded-3xl bg-blue-950 p-5 text-white shadow-lg sm:p-7">
          <h1 className="text-2xl font-extrabold sm:text-3xl">Tickets</h1>
          <p className="mt-2 text-sm text-blue-100">Customer service ticket list.</p>
        </header>

        {statusMessage && (
          <p className="mt-4 rounded-xl bg-green-50 px-4 py-3 text-sm font-semibold text-green-700">{statusMessage}</p>
        )}

        <section className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-2" aria-live="polite">
          {isLoading && <p className="text-sm font-semibold text-gray-600">Loading tickets...</p>}
          {error && <p className="rounded-xl bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">{error}</p>}
          {!isLoading && !error && tickets.length === 0 && <p className="text-sm font-semibold text-gray-600">No tickets found.</p>}
          {tickets.map((ticket) => {
            const active = activeTicketId === ticket.id;
            const showAdd = canAddCharge(ticket);
            const deleteAllowed = canDeleteCharge();

            return (
              <div key={ticket.id ?? ticket.ticketNumber} className="space-y-4">
                <TicketCard
                  ticket={{ ...ticket, chargeItems, chargeForm, chargeFormErrors, chargeFormErrorMessage: chargeActionMessage, onChargeFormChange: handleChargeInput, onAddCharge: addCharge }}
                  currentRole={currentRole}
                  currentEmployeeId={currentEmployeeId}
                  onPick={pickTicket}
                  onStart={startWork}
                  onComplete={completeTicket}
                  onCancel={cancelTicket}
                  onToggleCharges={openChargePanel}
                  isChargePanelOpen={active}
                  canAddCharge={showAdd}
                  canDeleteCharge={deleteAllowed}
                  processingKeys={processingKeys}
                />
                {active && (
                  <div className="rounded-2xl border border-blue-100 bg-white p-5 shadow-sm">
                    <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                      <div>
                        <h2 className="text-lg font-bold text-blue-950">Charges</h2>
                        <p className="text-sm text-gray-500">Manage line item charges for this ticket.</p>
                      </div>
                      <button
                        type="button"
                        onClick={() => setActiveTicketId(null)}
                        className="rounded-2xl bg-slate-100 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-200"
                      >
                        Close
                      </button>
                    </div>

                    {chargeLoading && <p className="text-sm font-semibold text-gray-600">Loading charges...</p>}
                    {chargeError && <p className="rounded-xl bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">{chargeError}</p>}

                    {!chargeLoading && !chargeError && (
                      <div className="space-y-4">
                        <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                          <div className="grid grid-cols-[1fr_auto] gap-2 text-sm font-semibold text-slate-700">
                            <span>Description</span>
                            <span className="text-right">Amount</span>
                          </div>
                        </div>

                        {chargeItems.length === 0 ? (
                          <p className="rounded-2xl border border-slate-200 bg-white p-4 text-sm text-slate-600">No charge items found.</p>
                        ) : (
                          <div className="space-y-2">
                            {chargeItems.map((item) => (
                              <div key={item.id} className="flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white p-4 sm:flex-row sm:items-center sm:justify-between">
                                <span className="text-slate-800">{item.description}</span>
                                <div className="flex items-center gap-3">
                                  <span className="font-semibold text-slate-900">{formatCurrency(item.amount)}</span>
                                  {deleteAllowed && (
                                    <button
                                      type="button"
                                      onClick={() => deleteCharge(ticket.id, item.id)}
                                      disabled={processingKeys[`delete-charge-${item.id}`]}
                                      className="rounded-2xl bg-red-50 px-3 py-2 text-xs font-semibold text-red-700 hover:bg-red-100 disabled:opacity-60"
                                    >
                                      {processingKeys[`delete-charge-${item.id}`] ? "Deleting…" : "Delete"}
                                    </button>
                                  )}
                                </div>
                              </div>
                            ))}
                          </div>
                        )}

                        <div className="rounded-2xl border border-slate-200 bg-slate-100 p-4 text-sm font-semibold text-slate-800">
                          <div className="flex items-center justify-between">
                            <span>Total Charge</span>
                            <span>{formatCurrency(chargeTotal)}</span>
                          </div>
                        </div>

                        {showAdd && (
                          <div className="rounded-2xl border border-slate-200 bg-white p-4">
                            <h3 className="text-sm font-bold text-slate-900">Add Charge</h3>
                            <div className="mt-4 grid gap-4 sm:grid-cols-2">
                              <label className="block text-sm font-semibold text-slate-700">
                                Description
                                <input
                                  name="description"
                                  value={chargeForm.description}
                                  onChange={handleChargeInput}
                                  className="mt-2 w-full rounded-xl border border-slate-300 px-4 py-3 outline-none focus:border-blue-950"
                                  maxLength={120}
                                />
                                {chargeFormErrors.description && (
                                  <p className="mt-1 text-xs font-semibold text-red-600">{chargeFormErrors.description}</p>
                                )}
                              </label>
                              <label className="block text-sm font-semibold text-slate-700">
                                Amount
                                <input
                                  name="amount"
                                  type="number"
                                  min="0"
                                  step="0.01"
                                  value={chargeForm.amount}
                                  onChange={handleChargeInput}
                                  className="mt-2 w-full rounded-xl border border-slate-300 px-4 py-3 outline-none focus:border-blue-950"
                                />
                                {chargeFormErrors.amount && (
                                  <p className="mt-1 text-xs font-semibold text-red-600">{chargeFormErrors.amount}</p>
                                )}
                              </label>
                            </div>
                            {chargeActionMessage && (
                              <p className={`mt-4 text-sm font-semibold ${chargeActionMessage.includes("Unable") ? "text-red-600" : "text-green-700"}`}>
                                {chargeActionMessage}
                              </p>
                            )}
                            <button
                              type="button"
                              onClick={() => addCharge(ticket.id)}
                              disabled={processingKeys[`add-charge-${ticket.id}`]}
                              className="mt-4 inline-flex items-center justify-center gap-2 rounded-2xl bg-blue-950 px-5 py-3 text-sm font-semibold text-white hover:bg-blue-900 disabled:opacity-60"
                            >
                              {processingKeys[`add-charge-${ticket.id}`] ? "Adding…" : "Add Charge"}
                            </button>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </section>
      </div>
    </main>
  );
}
