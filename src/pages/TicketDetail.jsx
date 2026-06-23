import { useEffect, useRef, useState } from "react";
import { ArrowLeft, Calendar, Eye, MapPin, Phone, Plus } from "lucide-react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import SuggestionInput from "../components/SuggestionInput";
import { hasAccess } from "../utils/access";

function formatDate(value) {
  if (!value) return "Not available";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleDateString();
}

function formatDateTime(value) {
  if (!value) return "Not available";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString();
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

function formatLabel(value) {
  return value ? value.replaceAll("_", " ").replace(/\b\w/g, (letter) => letter.toUpperCase()) : "Not available";
}

function getTicketStatusLabel(ticket) {
  return ticket?.statusDisplayName || formatLabel(ticket?.status);
}

function getHistoryActor(historyItem) {
  return historyItem?.executedByEmployeeNameSnapshot
    || historyItem?.executedByEmployeeId
    || "Not available";
}

function hasOwnerChange(historyItem) {
  const previousOwner = historyItem?.previousOwnerEmployeeId ?? "";
  const newOwner = historyItem?.newOwnerEmployeeId ?? "";
  return (previousOwner || newOwner) && String(previousOwner) !== String(newOwner);
}

const warrantyStatuses = ["NOT_CHECKED", "IN_WARRANTY", "OUT_OF_WARRANTY"];
const manufacturerStatuses = ["NOT_REQUIRED", "RAISED", "IN_PROGRESS", "REPAIRED", "REPLACED", "WAITING_FOR_COMPANY_VISIT"];
const workflowActionKeys = ["PICK_TICKET", "START_WORK", "COMPLETE_TICKET", "CANCEL_TICKET"];

function normalizeAvailableActions(data) {
  const responseActions = data?.actions ?? data;
  const source = Array.isArray(responseActions)
    ? responseActions.map((action) => [action?.actionKey ?? action?.key ?? action?.action, action])
    : Object.entries(responseActions ?? {}).map(([actionKey, action]) => [action?.actionKey ?? action?.key ?? action?.action ?? actionKey, action]);

  return source.reduce((actions, [key, action]) => {
    if (!workflowActionKeys.includes(key) || typeof action !== "object" || action === null) return actions;
    return {
      ...actions,
      [key]: {
        ...action,
        available: action?.available === true,
      },
    };
  }, {});
}

function isWorkflowActionAvailable(availableActions, actionKey) {
  return availableActions?.[actionKey]?.available === true;
}

function createWarrantyForm(ticket = {}) {
  return {
    warrantyStatus: ticket.warrantyStatus ?? "",
    manufacturerStatus: ticket.manufacturerStatus ?? "NOT_REQUIRED",
    manufacturerComplaintNumber: ticket.manufacturerComplaintNumber ?? "",
    manufacturerOrBrandName: ticket.manufacturerOrBrandName ?? "",
    productSerialNumber: ticket.productSerialNumber ?? "",
  };
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
  const location = useLocation();
  const { ticketId } = useParams();
  const [ticket, setTicket] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const [statusMessage, setStatusMessage] = useState("");
  const [availableActions, setAvailableActions] = useState(null);
  const [availableActionsLoading, setAvailableActionsLoading] = useState(false);
  const [availableActionsError, setAvailableActionsError] = useState("");
  const [processingKeys, setProcessingKeys] = useState({});
  const [showCharges, setShowCharges] = useState(false);
  const [showAddChargeForm, setShowAddChargeForm] = useState(false);
  const [chargeItems, setChargeItems] = useState([]);
  const [chargeTotal, setChargeTotal] = useState("0.00");
  const [chargeLoading, setChargeLoading] = useState(false);
  const [chargeError, setChargeError] = useState("");
  const [chargeForm, setChargeForm] = useState({ description: "", amount: "" });
  const [chargeFormErrors, setChargeFormErrors] = useState({});
  const [chargeActionMessage, setChargeActionMessage] = useState("");
  const [warrantyForm, setWarrantyForm] = useState(createWarrantyForm());
  const [warrantyFormErrors, setWarrantyFormErrors] = useState({});
  const [warrantyMessage, setWarrantyMessage] = useState("");
  const [isUpdatingWarranty, setIsUpdatingWarranty] = useState(false);
  const [showCustomerHistory, setShowCustomerHistory] = useState(false);
  const [customerHistory, setCustomerHistory] = useState([]);
  const [customerHistoryCount, setCustomerHistoryCount] = useState(0);
  const [customerHistoryLoading, setCustomerHistoryLoading] = useState(false);
  const [customerHistoryError, setCustomerHistoryError] = useState("");
  const [hasLoadedCustomerHistory, setHasLoadedCustomerHistory] = useState(false);
  const [dynamicValues, setDynamicValues] = useState([]);
  const [dynamicValuesLoading, setDynamicValuesLoading] = useState(false);
  const [dynamicValuesError, setDynamicValuesError] = useState("");
  const [workflowHistory, setWorkflowHistory] = useState([]);
  const [workflowHistoryPage, setWorkflowHistoryPage] = useState(0);
  const [workflowHistoryLast, setWorkflowHistoryLast] = useState(true);
  const [workflowHistoryLoading, setWorkflowHistoryLoading] = useState(false);
  const [workflowHistoryLoadingMore, setWorkflowHistoryLoadingMore] = useState(false);
  const [workflowHistoryError, setWorkflowHistoryError] = useState("");
  const customerHistoryTicketIdRef = useRef(ticketId);
  const workflowHistoryTicketIdRef = useRef(ticketId);
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
      setWarrantyForm(createWarrantyForm(selectedTicket));
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

  const loadAvailableActions = async () => {
    if (!ticketId) return;

    setAvailableActionsLoading(true);
    setAvailableActionsError("");
    try {
      const response = await fetch(`/volt/tickets/${ticketId}/available-actions`, {
        headers: {
          Authorization: `Bearer ${localStorage.getItem("token")}`,
        },
      });

      if (!response.ok) throw new Error("Unable to load available actions");

      const data = await response.json();
      setAvailableActions(normalizeAvailableActions(data));
    } catch {
      setAvailableActions(null);
      setAvailableActionsError("Unable to load available workflow actions. Please refresh the ticket.");
    } finally {
      setAvailableActionsLoading(false);
    }
  };

  const loadWorkflowHistory = async (page = 0, replace = page === 0) => {
    if (!ticketId) return;

    const requestedTicketId = ticketId;
    if (replace) {
      setWorkflowHistoryLoading(true);
    } else {
      setWorkflowHistoryLoadingMore(true);
    }
    setWorkflowHistoryError("");

    try {
      const response = await fetch(`/volt/tickets/${ticketId}/workflow-history?page=${page}&size=20`, {
        headers: {
          Authorization: `Bearer ${localStorage.getItem("token")}`,
        },
      });

      if (!response.ok) throw new Error("Unable to load workflow history");

      const data = await response.json();
      if (String(workflowHistoryTicketIdRef.current) !== String(requestedTicketId)) return;

      const rows = Array.isArray(data.history) ? data.history : [];
      setWorkflowHistory((current) => replace ? rows : [...current, ...rows]);
      setWorkflowHistoryPage(Number.isInteger(data.page) ? data.page : page);
      setWorkflowHistoryLast(data.last !== false);
    } catch {
      if (String(workflowHistoryTicketIdRef.current) !== String(requestedTicketId)) return;
      if (replace) {
        setWorkflowHistory([]);
        setWorkflowHistoryPage(0);
        setWorkflowHistoryLast(true);
      }
      setWorkflowHistoryError("Unable to load workflow history.");
    } finally {
      if (String(workflowHistoryTicketIdRef.current) === String(requestedTicketId)) {
        setWorkflowHistoryLoading(false);
        setWorkflowHistoryLoadingMore(false);
      }
    }
  };

  useEffect(() => {
    workflowHistoryTicketIdRef.current = ticketId;
    setWorkflowHistory([]);
    setWorkflowHistoryPage(0);
    setWorkflowHistoryLast(true);
    setWorkflowHistoryLoading(false);
    setWorkflowHistoryLoadingMore(false);
    setWorkflowHistoryError("");
    loadTicket();
    loadAvailableActions();
    loadWorkflowHistory(0, true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ticketId]);

  useEffect(() => {
    customerHistoryTicketIdRef.current = ticketId;
    setShowCustomerHistory(false);
    setCustomerHistory([]);
    setCustomerHistoryCount(0);
    setCustomerHistoryLoading(false);
    setCustomerHistoryError("");
    setHasLoadedCustomerHistory(false);
  }, [ticketId]);

  useEffect(() => {
    let isCurrent = true;

    async function loadDynamicValues() {
      setDynamicValues([]);
      setDynamicValuesError("");
      setDynamicValuesLoading(true);

      try {
        const response = await fetch(`/volt/tickets/${ticketId}/dynamic-values`, {
          headers: {
            Authorization: `Bearer ${localStorage.getItem("token")}`,
          },
        });

        if (!response.ok) throw new Error("Unable to load dynamic values");

        const data = await response.json();
        if (!isCurrent) return;
        setDynamicValues(Array.isArray(data.dynamicValues) ? data.dynamicValues : []);
      } catch {
        if (!isCurrent) return;
        setDynamicValues([]);
        setDynamicValuesError("Unable to load additional details.");
      } finally {
        if (isCurrent) {
          setDynamicValuesLoading(false);
        }
      }
    }

    if (ticketId) {
      loadDynamicValues();
    }

    return () => {
      isCurrent = false;
    };
  }, [ticketId]);

  const loadCustomerHistory = async () => {
    const requestedTicketId = ticketId;
    setCustomerHistoryLoading(true);
    setCustomerHistoryError("");
    try {
      const response = await fetch(`/volt/tickets/${ticketId}/customer-history`, {
        headers: {
          Authorization: `Bearer ${localStorage.getItem("token")}`,
        },
      });

      if (!response.ok) throw new Error("Unable to load customer history");

      const data = await response.json();
      if (String(customerHistoryTicketIdRef.current) !== String(requestedTicketId)) return;

      const tickets = Array.isArray(data.tickets) ? data.tickets : [];
      setCustomerHistory(tickets);
      setCustomerHistoryCount(Number.isInteger(data.previousTicketCount) ? data.previousTicketCount : tickets.length);
      setHasLoadedCustomerHistory(true);
    } catch {
      if (String(customerHistoryTicketIdRef.current) !== String(requestedTicketId)) return;

      setCustomerHistory([]);
      setCustomerHistoryCount(0);
      setCustomerHistoryError("Unable to load customer history. Please try again.");
    } finally {
      if (String(customerHistoryTicketIdRef.current) === String(requestedTicketId)) {
        setCustomerHistoryLoading(false);
      }
    }
  };

  const toggleCustomerHistory = async () => {
    if (showCustomerHistory) {
      setShowCustomerHistory(false);
      return;
    }

    setShowCustomerHistory(true);
    if (!hasLoadedCustomerHistory) {
      await loadCustomerHistory();
    }
  };

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
    await loadAvailableActions();
    await loadWorkflowHistory(0, true);
    if (showCharges) await loadCharges();
    setStatusMessage(successMessage);
  };

  const runTicketAction = async (key, path, body, successMessage, errorMessage) => {
    setProcessing(key, true);
    setStatusMessage("");
    try {
      await ticketAction(path, body, successMessage);
    } catch {
      setStatusMessage(path === "complete" && ticket?.warrantyStatus === "NOT_CHECKED"
        ? "Please confirm warranty status before completing this ticket."
        : errorMessage);
    } finally {
      setProcessing(key, false);
    }
  };

  const toggleCharges = async () => {
    if (showCharges) {
      setShowCharges(false);
      setShowAddChargeForm(false);
      setChargeForm({ description: "", amount: "" });
      setChargeFormErrors({});
      return;
    }

    setShowCharges(true);
    setShowAddChargeForm(false);
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
      setShowAddChargeForm(false);
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

  const cancelAddCharge = () => {
    setShowAddChargeForm(false);
    setChargeForm({ description: "", amount: "" });
    setChargeFormErrors({});
    setChargeActionMessage("");
  };

  const openAddCharge = () => {
    setShowAddChargeForm(true);
    setChargeFormErrors({});
    setChargeActionMessage("");
  };

  const handleWarrantyInput = (event) => {
    const { name, value } = event.target;
    setWarrantyForm((current) => ({ ...current, [name]: value }));
    setWarrantyFormErrors((current) => ({ ...current, [name]: "" }));
    setWarrantyMessage("");
  };

  const validateWarrantyForm = () => {
    const errors = {};

    if (!warrantyForm.warrantyStatus) errors.warrantyStatus = "Warranty status is required.";
    if (!warrantyForm.manufacturerStatus) errors.manufacturerStatus = "Manufacturer status is required.";
    if (warrantyForm.warrantyStatus === "IN_WARRANTY") {
      if (!warrantyForm.manufacturerOrBrandName.trim()) {
        errors.manufacturerOrBrandName = "Brand name is required for in-warranty tickets.";
      }
      if (!warrantyForm.productSerialNumber.trim()) {
        errors.productSerialNumber = "Product serial number is required for in-warranty tickets.";
      }
    }

    return errors;
  };

  const updateWarranty = async (event) => {
    event.preventDefault();
    const errors = validateWarrantyForm();
    if (Object.keys(errors).length > 0) {
      setWarrantyFormErrors(errors);
      return;
    }

    setIsUpdatingWarranty(true);
    setWarrantyFormErrors({});
    setWarrantyMessage("");
    try {
      const response = await fetch(`/volt/tickets/${ticketId}/warranty`, {
        method: "PATCH",
        headers: {
          Authorization: `Bearer ${localStorage.getItem("token")}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          warrantyStatus: warrantyForm.warrantyStatus,
          manufacturerStatus: warrantyForm.manufacturerStatus,
          manufacturerComplaintNumber: warrantyForm.manufacturerComplaintNumber.trim(),
          manufacturerOrBrandName: warrantyForm.manufacturerOrBrandName.trim(),
          productSerialNumber: warrantyForm.productSerialNumber.trim(),
        }),
      });

      if (!response.ok) throw new Error("Warranty update failed");

      await loadTicket();
      setWarrantyMessage("Warranty details updated successfully.");
    } catch {
      setWarrantyMessage(ticket?.status === "CANCELLED"
        ? "Cancelled tickets cannot be updated."
        : "Unable to update warranty details. Please try again.");
    } finally {
      setIsUpdatingWarranty(false);
    }
  };

  const isTicketOwner = ticket?.pickedByEmployeeId
    && currentEmployeeId
    && String(ticket.pickedByEmployeeId) === currentEmployeeId;
  const canPickTicket = isWorkflowActionAvailable(availableActions, "PICK_TICKET")
    && hasAccess("PICK_TICKET");
  const canStartWork = isWorkflowActionAvailable(availableActions, "START_WORK")
    && hasAccess("START_WORK");
  const canComplete = ticket?.status === "IN_PROGRESS"
    && isWorkflowActionAvailable(availableActions, "COMPLETE_TICKET")
    && hasAccess("COMPLETE_TICKET")
    && (["SUPER_ADMIN", "ADMIN"].includes(currentRole) || isTicketOwner);
  const canCancel = ["SUPER_ADMIN", "ADMIN"].includes(currentRole)
    && isWorkflowActionAvailable(availableActions, "CANCEL_TICKET")
    && hasAccess("CANCEL_TICKET")
    && ["NEW", "PICKED", "IN_PROGRESS"].includes(ticket?.status);
  const canViewCustomerHistory = hasAccess("VIEW_CUSTOMER_HISTORY");
  const canViewCharges = hasAccess("VIEW_CHARGES");
  const canAddCharge = ticket
    && hasAccess("ADD_CHARGE")
    && !["NEW", "CANCELLED"].includes(ticket.status)
    && (["SUPER_ADMIN", "ADMIN"].includes(currentRole)
      ? ["PICKED", "IN_PROGRESS", "COMPLETED"].includes(ticket.status)
      : ["PICKED", "IN_PROGRESS"].includes(ticket.status) && isTicketOwner);
  const canDeleteCharge = hasAccess("DELETE_CHARGE") && ["SUPER_ADMIN", "ADMIN"].includes(currentRole);
  const canUpdateWarranty = ["SUPER_ADMIN", "ADMIN", "EMPLOYEE", "TECHNICIAN"].includes(currentRole)
    && hasAccess("UPDATE_WARRANTY")
    && ticket?.status !== "CANCELLED";
  const hasVisibleWorkflowAction = (canPickTicket && ["NEW", "PICKED"].includes(ticket?.status))
    || (canStartWork && ticket?.status === "PICKED")
    || canComplete
    || canCancel;
  const hasLoadedAvailableActions = Boolean(availableActions) && !availableActionsLoading && !availableActionsError;
  const availableWarrantyStatuses = currentRole === "SUPER_ADMIN" || ticket?.warrantyStatus === "NOT_CHECKED"
    ? warrantyStatuses
    : warrantyStatuses.filter((status) => status === ticket?.warrantyStatus);

  return (
    <main className="min-h-screen bg-gray-50 px-4 py-6 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-4xl">
        <button type="button" onClick={() => navigate(`/tickets${location.search}`)} className="flex items-center gap-2 font-semibold text-blue-950">
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
                <span className="rounded-full bg-white/15 px-3 py-1 text-xs font-bold">{getTicketStatusLabel(ticket)}</span>
              </div>
            </header>

            {statusMessage && (
              <p className={`rounded-xl px-4 py-3 text-sm font-semibold ${statusMessage.startsWith("Unable") || statusMessage.startsWith("Please") ? "bg-red-50 text-red-700" : "bg-green-50 text-green-700"}`}>
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

            {canViewCustomerHistory && <section className="rounded-2xl border border-blue-100 bg-white p-5 shadow-sm">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <h2 className="text-lg font-bold text-blue-950">
                  Customer History{hasLoadedCustomerHistory ? ` (${customerHistoryCount})` : ""}
                </h2>
                <button type="button" onClick={toggleCustomerHistory} className="rounded-2xl bg-blue-50 px-4 py-2 font-semibold text-blue-950 hover:bg-blue-100">
                  <span className="inline-flex items-center gap-2"><Eye size={16} aria-hidden="true" /> {showCustomerHistory ? "Hide" : "View"}</span>
                </button>
              </div>

              {showCustomerHistory && (
                <div className="mt-4 space-y-3">
                  {customerHistoryLoading && <p className="text-sm font-semibold text-gray-600">Loading customer history...</p>}
                  {customerHistoryError && <p className="rounded-xl bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">{customerHistoryError}</p>}
                  {!customerHistoryLoading && !customerHistoryError && customerHistory.length === 0 && (
                    <p className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-600">No previous tickets found.</p>
                  )}
                  {!customerHistoryLoading && !customerHistoryError && customerHistory.map((historyTicket) => (
                    <article key={historyTicket.id ?? historyTicket.ticketNumber} className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                      <div className="flex flex-wrap items-start justify-between gap-2">
                        <div>
                          <h3 className="font-extrabold text-blue-950">{historyTicket.ticketNumber ?? "Not available"}</h3>
                          <p className="mt-1 text-sm text-slate-700">{historyTicket.customerName ?? "Not available"}</p>
                        </div>
                        <span className="rounded-full bg-blue-100 px-3 py-1 text-xs font-bold text-blue-950">{formatLabel(historyTicket.status)}</span>
                      </div>
                      <dl className="mt-3 grid grid-cols-1 gap-2 text-sm sm:grid-cols-2">
                        <InfoItem label="Product">{historyTicket.productType}</InfoItem>
                        <InfoItem label="Category">{formatLabel(historyTicket.category)}</InfoItem>
                        <InfoItem label="Created">{formatDate(historyTicket.createdAt)}</InfoItem>
                        <InfoItem label="Total Charge">{formatCurrency(historyTicket.totalCharge)}</InfoItem>
                        <InfoItem label="Warranty">{formatLabel(historyTicket.warrantyStatus)}</InfoItem>
                        <InfoItem label="Mfg Status">{formatLabel(historyTicket.manufacturerStatus)}</InfoItem>
                        {historyTicket.manufacturerOrBrandName && <InfoItem label="Manufacturer / Brand">{historyTicket.manufacturerOrBrandName}</InfoItem>}
                      </dl>
                      <button type="button" onClick={() => navigate(`/tickets/${historyTicket.id}${location.search}`)} className="mt-4 inline-flex items-center gap-2 rounded-xl bg-blue-950 px-3 py-2 text-sm font-semibold text-white hover:bg-blue-900">
                        <Eye size={15} aria-hidden="true" /> View Details
                      </button>
                    </article>
                  ))}
                </div>
              )}
            </section>}

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
                <InfoItem label="Status">{getTicketStatusLabel(ticket)}</InfoItem>
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
              <h2 className="text-lg font-bold text-blue-950">Workflow History</h2>

              <div className="mt-4 space-y-3">
                {workflowHistoryLoading && <p className="text-sm font-semibold text-gray-600">Loading workflow history...</p>}
                {workflowHistoryError && <p className="rounded-xl bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">{workflowHistoryError}</p>}
                {!workflowHistoryLoading && !workflowHistoryError && workflowHistory.length === 0 && (
                  <p className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-600">No workflow history yet.</p>
                )}
                {!workflowHistoryLoading && workflowHistory.length > 0 && (
                  <>
                    <div className="space-y-3">
                      {workflowHistory.map((historyItem) => (
                        <article key={historyItem.id ?? `${historyItem.actionKey}-${historyItem.createdAt}`} className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                          <div className="flex flex-wrap items-start justify-between gap-2">
                            <div>
                              <h3 className="font-extrabold text-blue-950">{historyItem.actionDisplayName || formatLabel(historyItem.actionKey)}</h3>
                              <p className="mt-1 text-sm font-semibold text-slate-700">
                                {(historyItem.fromStatusDisplayName || formatLabel(historyItem.fromStatus))} &rarr; {(historyItem.toStatusDisplayName || formatLabel(historyItem.toStatus))}
                              </p>
                            </div>
                            <span className="rounded-full bg-blue-100 px-3 py-1 text-xs font-bold text-blue-950">{formatDateTime(historyItem.createdAt)}</span>
                          </div>

                          <dl className="mt-3 grid grid-cols-1 gap-2 text-sm sm:grid-cols-2">
                            <InfoItem label="Executed By">{getHistoryActor(historyItem)}</InfoItem>
                            {hasOwnerChange(historyItem) && (
                              <InfoItem label="Owner Change">
                                {(historyItem.previousOwnerEmployeeId || "Unassigned")} &rarr; {(historyItem.newOwnerEmployeeId || "Unassigned")}
                              </InfoItem>
                            )}
                            {historyItem.comment && <InfoItem label="Comment" className="sm:col-span-2">{historyItem.comment}</InfoItem>}
                            {historyItem.reason && <InfoItem label="Reason" className="sm:col-span-2">{historyItem.reason}</InfoItem>}
                          </dl>
                        </article>
                      ))}
                    </div>

                    {!workflowHistoryLast && (
                      <button
                        type="button"
                        onClick={() => loadWorkflowHistory(workflowHistoryPage + 1, false)}
                        disabled={workflowHistoryLoadingMore}
                        className="rounded-2xl bg-blue-50 px-4 py-2 font-semibold text-blue-950 hover:bg-blue-100 disabled:opacity-60"
                      >
                        {workflowHistoryLoadingMore ? "Loading..." : "Load More"}
                      </button>
                    )}
                  </>
                )}
              </div>
            </section>

            <section className="rounded-2xl border border-blue-100 bg-white p-5 shadow-sm">
              <h2 className="text-lg font-bold text-blue-950">Warranty / Manufacturer</h2>
              <dl className="mt-4 grid grid-cols-1 gap-3 text-sm sm:grid-cols-2">
                <InfoItem label="Warranty Status">{formatLabel(ticket.warrantyStatus)}</InfoItem>
                <InfoItem label="Manufacturer Status">{formatLabel(ticket.manufacturerStatus)}</InfoItem>
                <InfoItem label="Manufacturer / Brand Name">{ticket.manufacturerOrBrandName}</InfoItem>
                <InfoItem label="Manufacturer Complaint Number">{ticket.manufacturerComplaintNumber}</InfoItem>
                <InfoItem label="Product Serial Number">{ticket.productSerialNumber}</InfoItem>
                <InfoItem label="Last Updated By">{ticket.warrantyUpdatedByEmployeeId}</InfoItem>
                <InfoItem label="Last Updated At">{formatDate(ticket.warrantyUpdatedAt)}</InfoItem>
              </dl>

              {ticket.status === "CANCELLED" && (
                <p className="mt-4 rounded-xl bg-slate-100 px-4 py-3 text-sm font-semibold text-slate-700">
                  Warranty details are read-only because this ticket is cancelled.
                </p>
              )}

              {canUpdateWarranty && (
                <form onSubmit={updateWarranty} className="mt-5 rounded-2xl border border-slate-200 bg-slate-50 p-4">
                  <h3 className="text-sm font-bold text-slate-900">Update Warranty Details</h3>
                  <div className="mt-4 grid gap-4 sm:grid-cols-2">
                    <label className="block text-sm font-semibold text-slate-700">
                      Warranty Status
                      <select name="warrantyStatus" value={warrantyForm.warrantyStatus} onChange={handleWarrantyInput} className="mt-2 w-full rounded-xl border border-slate-300 bg-white px-4 py-3 outline-none focus:border-blue-950">
                        <option value="">Select warranty status</option>
                        {availableWarrantyStatuses.map((status) => <option key={status} value={status}>{formatLabel(status)}</option>)}
                      </select>
                      {warrantyFormErrors.warrantyStatus && <span className="mt-1 block text-xs text-red-600">{warrantyFormErrors.warrantyStatus}</span>}
                    </label>
                    <label className="block text-sm font-semibold text-slate-700">
                      Manufacturer Status
                      <select name="manufacturerStatus" value={warrantyForm.manufacturerStatus} onChange={handleWarrantyInput} className="mt-2 w-full rounded-xl border border-slate-300 bg-white px-4 py-3 outline-none focus:border-blue-950">
                        {manufacturerStatuses.map((status) => <option key={status} value={status}>{formatLabel(status)}</option>)}
                      </select>
                      {warrantyFormErrors.manufacturerStatus && <span className="mt-1 block text-xs text-red-600">{warrantyFormErrors.manufacturerStatus}</span>}
                    </label>
                    <label className="block text-sm font-semibold text-slate-700">
                      Manufacturer / Brand Name
                      <SuggestionInput endpoint="/volt/suggestions/manufacturers" name="manufacturerOrBrandName" value={warrantyForm.manufacturerOrBrandName} onChange={handleWarrantyInput} maxLength={80} className="mt-2 w-full rounded-xl border border-slate-300 px-4 py-3 outline-none focus:border-blue-950" />
                      {warrantyFormErrors.manufacturerOrBrandName && <span className="mt-1 block text-xs text-red-600">{warrantyFormErrors.manufacturerOrBrandName}</span>}
                    </label>
                    <label className="block text-sm font-semibold text-slate-700">
                      Product Serial Number
                      <input name="productSerialNumber" value={warrantyForm.productSerialNumber} onChange={handleWarrantyInput} maxLength={80} className="mt-2 w-full rounded-xl border border-slate-300 px-4 py-3 outline-none focus:border-blue-950" />
                      {warrantyFormErrors.productSerialNumber && <span className="mt-1 block text-xs text-red-600">{warrantyFormErrors.productSerialNumber}</span>}
                    </label>
                    <label className="block text-sm font-semibold text-slate-700 sm:col-span-2">
                      Manufacturer Complaint Number <span className="font-normal text-slate-500">(Optional)</span>
                      <input name="manufacturerComplaintNumber" value={warrantyForm.manufacturerComplaintNumber} onChange={handleWarrantyInput} maxLength={80} className="mt-2 w-full rounded-xl border border-slate-300 px-4 py-3 outline-none focus:border-blue-950" />
                    </label>
                  </div>
                  <button type="submit" disabled={isUpdatingWarranty} className="mt-4 rounded-2xl bg-yellow-400 px-4 py-2 font-semibold text-black disabled:opacity-60">
                    {isUpdatingWarranty ? "Updating..." : "Update Warranty Details"}
                  </button>
                  {warrantyMessage && (
                    <p className={`mt-4 rounded-xl px-4 py-3 text-sm font-semibold ${warrantyMessage.startsWith("Warranty details updated") ? "bg-green-50 text-green-700" : "bg-red-50 text-red-700"}`}>
                      {warrantyMessage}
                    </p>
                  )}
                </form>
              )}
            </section>

            {dynamicValues.length > 0 && (
              <section className="rounded-2xl border border-blue-100 bg-white p-5 shadow-sm">
                <h2 className="text-lg font-bold text-blue-950">Additional Details</h2>
                <dl className="mt-4 grid grid-cols-1 gap-3 text-sm sm:grid-cols-2">
                  {dynamicValues.map((dynamicValue) => (
                    <InfoItem key={dynamicValue.id ?? `${dynamicValue.fieldLabel}-${dynamicValue.displayValue}`} label={dynamicValue.fieldLabel || "Additional Detail"}>
                      {dynamicValue.displayValue || "-"}
                    </InfoItem>
                  ))}
                </dl>
              </section>
            )}

            {!dynamicValuesLoading && dynamicValuesError && (
              <p className="rounded-xl bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">
                {dynamicValuesError}
              </p>
            )}

            {canViewCharges && <section className="rounded-2xl border border-blue-100 bg-white p-5 shadow-sm">
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
                      {canAddCharge && (
                        showAddChargeForm ? (
                          <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                            <h3 className="text-sm font-bold text-slate-900">Add Charge</h3>
                            <div className="mt-3 grid gap-3 sm:grid-cols-2">
                              <label className="block text-sm font-semibold text-slate-700">
                                Description
                                <SuggestionInput endpoint="/volt/suggestions/charge-descriptions" name="description" value={chargeForm.description} onChange={handleChargeInput} maxLength={120} className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2 outline-none focus:border-blue-950" />
                                {chargeFormErrors.description && <span className="mt-1 block text-xs text-red-600">{chargeFormErrors.description}</span>}
                              </label>
                              <label className="block text-sm font-semibold text-slate-700">
                                Amount
                                <input name="amount" type="number" min="0.01" max="999999.99" step="0.01" value={chargeForm.amount} onChange={handleChargeInput} className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2 outline-none focus:border-blue-950" />
                                {chargeFormErrors.amount && <span className="mt-1 block text-xs text-red-600">{chargeFormErrors.amount}</span>}
                              </label>
                            </div>
                            <div className="mt-3 flex flex-wrap gap-2">
                              <button type="button" onClick={addCharge} disabled={processingKeys[`add-charge-${ticketId}`]} className="rounded-xl bg-yellow-400 px-3 py-2 text-sm font-semibold text-black disabled:opacity-60">
                                {processingKeys[`add-charge-${ticketId}`] ? "Saving..." : "Save"}
                              </button>
                              <button type="button" onClick={cancelAddCharge} disabled={processingKeys[`add-charge-${ticketId}`]} className="rounded-xl bg-slate-200 px-3 py-2 text-sm font-semibold text-slate-800 hover:bg-slate-300 disabled:opacity-60">
                                Cancel
                              </button>
                            </div>
                          </div>
                        ) : (
                          <button type="button" onClick={openAddCharge} className="inline-flex items-center gap-2 rounded-xl bg-yellow-400 px-3 py-2 text-sm font-semibold text-black hover:bg-yellow-300">
                            <Plus size={16} aria-hidden="true" /> Add Charge
                          </button>
                        )
                      )}

                      {chargeItems.length === 0 ? (
                        <p className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-600">No charge items found.</p>
                      ) : (
                        <div className="divide-y divide-slate-200 border-y border-slate-200">
                          {chargeItems.map((item) => (
                            <div key={item.id} className="py-2 sm:flex sm:items-center sm:justify-between sm:gap-4">
                              <p className="min-w-0 break-words text-sm text-slate-800">{item.description}</p>
                              <div className="mt-1 flex shrink-0 items-center justify-between gap-3 sm:mt-0">
                                <span className="text-sm font-semibold text-slate-900">{formatCurrency(item.amount)}</span>
                                {canDeleteCharge && ticket.status !== "CANCELLED" && (
                                  <button type="button" onClick={() => deleteCharge(item.id)} disabled={processingKeys[`delete-charge-${item.id}`]} className="rounded-lg px-2 py-1 text-xs font-semibold text-red-700 hover:bg-red-50 disabled:opacity-60">
                                    {processingKeys[`delete-charge-${item.id}`] ? "Deleting..." : "Delete"}
                                  </button>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                      {chargeActionMessage && <p className="rounded-xl bg-blue-50 px-4 py-3 text-sm font-semibold text-blue-950">{chargeActionMessage}</p>}
                    </>
                  )}
                </div>
              )}
            </section>}

            <section className="rounded-2xl border border-blue-100 bg-white p-5 shadow-sm">
              <h2 className="text-lg font-bold text-blue-950">Actions</h2>
              {availableActionsError && (
                <p className="mt-4 rounded-xl bg-yellow-50 px-4 py-3 text-sm font-semibold text-yellow-800">
                  {availableActionsError}
                </p>
              )}
              <div className="mt-4 flex flex-wrap items-center gap-2">
                {availableActionsLoading && <p className="text-sm font-semibold text-gray-600">Loading available workflow actions...</p>}
                {canPickTicket && ticket.status === "NEW" && <button type="button" onClick={() => runTicketAction(`pick-${ticketId}`, "pick", null, "Ticket picked successfully.", "Unable to update ticket. Please try again.")} disabled={processingKeys[`pick-${ticketId}`]} className="rounded-2xl bg-yellow-400 px-4 py-2 font-semibold text-black disabled:opacity-60">{processingKeys[`pick-${ticketId}`] ? "Picking..." : "Pick Ticket"}</button>}
                {canPickTicket && ticket.status === "PICKED" && <button type="button" onClick={() => runTicketAction(`pick-${ticketId}`, "pick", null, "Ticket picked successfully.", "Unable to update ticket. Please try again.")} disabled={processingKeys[`pick-${ticketId}`]} className="rounded-2xl bg-yellow-400 px-4 py-2 font-semibold text-black disabled:opacity-60">{processingKeys[`pick-${ticketId}`] ? "Picking..." : "Pick Ticket"}</button>}
                {canStartWork && ticket.status === "PICKED" && <button type="button" onClick={() => runTicketAction(`start-${ticketId}`, "start-work", null, "Work started on ticket.", "Unable to update ticket. Please try again.")} disabled={processingKeys[`start-${ticketId}`]} className="rounded-2xl bg-blue-950 px-4 py-2 font-semibold text-white disabled:opacity-60">{processingKeys[`start-${ticketId}`] ? "Starting..." : "Start Work"}</button>}
                {canComplete && <button type="button" onClick={() => runTicketAction(`complete-${ticketId}`, "complete", { completionRemark: "Completed via UI." }, "Ticket completed successfully.", "Unable to update ticket. Please try again.")} disabled={processingKeys[`complete-${ticketId}`]} className="rounded-2xl bg-green-600 px-4 py-2 font-semibold text-white disabled:opacity-60">{processingKeys[`complete-${ticketId}`] ? "Completing..." : "Complete Ticket"}</button>}
                {canCancel && <button type="button" onClick={() => runTicketAction(`cancel-${ticketId}`, "cancel", { cancellationReason: "Cancelled via ticket detail." }, "Ticket cancelled successfully.", "Unable to update ticket. Please try again.")} disabled={processingKeys[`cancel-${ticketId}`]} className="rounded-2xl bg-red-500 px-4 py-2 font-semibold text-white disabled:opacity-60">{processingKeys[`cancel-${ticketId}`] ? "Cancelling..." : "Cancel Ticket"}</button>}
                {hasLoadedAvailableActions && !hasVisibleWorkflowAction && (
                  <p className="text-sm text-gray-600">No workflow actions are currently available for this ticket.</p>
                )}
              </div>
            </section>
          </div>
        )}
      </div>
    </main>
  );
}
