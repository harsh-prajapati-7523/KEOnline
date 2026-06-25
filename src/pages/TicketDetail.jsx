import { lazy, Suspense, useEffect, useRef, useState } from "react";
import { ArrowLeft, Calendar, ChevronDown, ChevronRight, Eye, MapPin, Phone, PhoneCall, Plus } from "lucide-react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import { hasAccess } from "../utils/access";

const SuggestionInput = lazy(() => import("../components/SuggestionInput"));

function formatDate(value) {
  if (!value) return "Not available";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(date);
}

function formatDateTime(value) {
  if (!value) return "Not available";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;

  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  }).format(date).replace(/\b(am|pm)\b/i, (match) => match.toUpperCase());
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

function formatEnumDisplay(value) {
  if (typeof value !== "string" || !value.trim()) return "Not available";
  return /_/.test(value) || value === value.toUpperCase() ? formatLabel(value) : value;
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

const workflowActionKeys = ["PICK_TICKET", "START_WORK", "COMPLETE_TICKET", "CANCEL_TICKET"];

function scheduleSecondaryWork(callback) {
  let idleId;
  let timeoutId;
  let frameId;
  let cancelled = false;

  const run = () => {
    if (cancelled) return;
    callback();
  };

  frameId = window.requestAnimationFrame(() => {
    if ("requestIdleCallback" in window) {
      idleId = window.requestIdleCallback(run, { timeout: 1200 });
      return;
    }

    timeoutId = window.setTimeout(run, 350);
  });

  return () => {
    cancelled = true;
    window.cancelAnimationFrame(frameId);
    if (idleId) window.cancelIdleCallback?.(idleId);
    if (timeoutId) window.clearTimeout(timeoutId);
  };
}

function normalizeDynamicActions(data) {
  return Array.isArray(data?.dynamicActions)
    ? data.dynamicActions
      .filter((action) => action?.allowed === true && action?.transitionId && action?.displayName)
      .map((action) => ({
        transitionId: action.transitionId,
        actionKey: action.actionKey ?? "",
        displayName: action.displayName,
        fromStatus: action.fromStatus ?? "",
        toStatus: action.toStatus ?? "",
        allowed: true,
      }))
    : [];
}

function normalizeAvailableActions(data) {
  const responseActions = data?.actions ?? data;
  const source = Array.isArray(responseActions)
    ? responseActions.map((action) => [action?.actionKey ?? action?.key ?? action?.action, action])
    : Object.entries(responseActions ?? {}).map(([actionKey, action]) => [action?.actionKey ?? action?.key ?? action?.action ?? actionKey, action]);

  const fixedActions = source.reduce((actions, [key, action]) => {
    if (!workflowActionKeys.includes(key) || typeof action !== "object" || action === null) return actions;
    return {
      ...actions,
      [key]: {
        ...action,
        available: action?.available === true,
      },
    };
  }, {});

  return {
    ...fixedActions,
    dynamicActions: normalizeDynamicActions(data),
  };
}

function isWorkflowActionAvailable(availableActions, actionKey) {
  return availableActions?.[actionKey]?.available === true;
}

function hasMaxTwoDecimals(value) {
  const match = String(value).match(/^(?:\d+)(?:\.(\d+))?$/);
  return match ? match[1] ? match[1].length <= 2 : true : false;
}

function InfoItem({ label, children, className = "" }) {
  return (
    <div className={`min-w-0 ${className}`}>
      <dt className="font-bold text-gray-500">{label}</dt>
      <dd className="mt-1 break-words text-gray-800">{children ?? "Not available"}</dd>
    </div>
  );
}

function TicketDetailSkeleton() {
  return (
    <div className="mt-4 min-w-0 space-y-4" aria-hidden="true">
      <section className="min-h-36 rounded-2xl bg-blue-950 p-4 shadow-lg sm:rounded-3xl sm:p-7">
        <div className="flex items-start justify-between gap-3">
          <div className="h-8 w-40 rounded-full bg-white/20" />
          <div className="h-6 w-24 rounded-full bg-white/15" />
        </div>
        <div className="mt-5 h-4 w-32 rounded-full bg-white/15" />
        <div className="mt-3 h-5 w-48 rounded-full bg-white/20" />
      </section>
      <section className="min-h-28 rounded-2xl border border-blue-100 bg-white p-4 shadow-sm sm:p-5">
        <div className="h-6 w-40 rounded-full bg-blue-100" />
        <div className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="h-12 rounded-xl bg-gray-100" />
          <div className="h-12 rounded-xl bg-gray-100" />
        </div>
      </section>
      <section className="min-h-48 rounded-2xl border border-blue-100 bg-white p-4 shadow-sm sm:p-5">
        <div className="h-6 w-44 rounded-full bg-blue-100" />
        <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div className="h-10 rounded-xl bg-gray-100" />
          <div className="h-10 rounded-xl bg-gray-100" />
          <div className="h-10 rounded-xl bg-gray-100 sm:col-span-2" />
        </div>
      </section>
      <section className="min-h-20 rounded-2xl border border-blue-100 bg-white p-4 shadow-sm sm:p-5">
        <div className="h-6 w-48 rounded-full bg-blue-100" />
        <div className="mt-3 h-4 w-56 rounded-full bg-gray-100" />
      </section>
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
  const [hasLoadedWorkflowHistory, setHasLoadedWorkflowHistory] = useState(false);
  const [workflowHistoryLoading, setWorkflowHistoryLoading] = useState(false);
  const [workflowHistoryLoadingMore, setWorkflowHistoryLoadingMore] = useState(false);
  const [workflowHistoryError, setWorkflowHistoryError] = useState("");
  const [showStatusDetails, setShowStatusDetails] = useState(false);
  const [showWorkflowHistory, setShowWorkflowHistory] = useState(false);
  const [expandedWorkflowHistoryId, setExpandedWorkflowHistoryId] = useState(null);
  const [showCancelConfirmation, setShowCancelConfirmation] = useState(false);
  const [pendingDeleteChargeId, setPendingDeleteChargeId] = useState(null);
  const availableActionsTicketIdRef = useRef(ticketId);
  const customerHistoryTicketIdRef = useRef(ticketId);
  const dynamicValuesTicketIdRef = useRef(ticketId);
  const ticketDetailTicketIdRef = useRef(ticketId);
  const workflowHistoryTicketIdRef = useRef(ticketId);
  const currentRole = localStorage.getItem("role") ?? "";
  const currentEmployeeId = localStorage.getItem("employeeId") ?? "";

  const loadTicket = async () => {
    const requestedTicketId = ticketId;
    setIsLoading(true);
    setError("");
    try {
      const response = await fetch(`/volt/tickets/${ticketId}`, {
        headers: {
          Authorization: `Bearer ${localStorage.getItem("token")}`,
        },
      });

      if (!response.ok) throw new Error("Ticket details failed");

      const data = await response.json();
      if (String(ticketDetailTicketIdRef.current) !== String(requestedTicketId)) return;
      if (!data || String(data.id) !== String(ticketId)) {
        setTicket(null);
        setError("Ticket not found.");
        return;
      }

      setTicket(data);
    } catch {
      if (String(ticketDetailTicketIdRef.current) !== String(requestedTicketId)) return;
      setTicket(null);
      setError("Unable to load ticket details. Please try again.");
    } finally {
      if (String(ticketDetailTicketIdRef.current) === String(requestedTicketId)) {
        setIsLoading(false);
      }
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

    const requestedTicketId = ticketId;
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
      if (String(availableActionsTicketIdRef.current) !== String(requestedTicketId)) return;
      setAvailableActions(normalizeAvailableActions(data));
    } catch {
      if (String(availableActionsTicketIdRef.current) !== String(requestedTicketId)) return;
      setAvailableActions(null);
      setAvailableActionsError("Unable to load available workflow actions. Please refresh the ticket.");
    } finally {
      if (String(availableActionsTicketIdRef.current) === String(requestedTicketId)) {
        setAvailableActionsLoading(false);
      }
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
      setHasLoadedWorkflowHistory(true);
    } catch {
      if (String(workflowHistoryTicketIdRef.current) !== String(requestedTicketId)) return;
      if (replace) {
        setWorkflowHistory([]);
        setWorkflowHistoryPage(0);
        setWorkflowHistoryLast(true);
      }
      setWorkflowHistoryError("Unable to load workflow history.");
      setHasLoadedWorkflowHistory(true);
    } finally {
      if (String(workflowHistoryTicketIdRef.current) === String(requestedTicketId)) {
        setWorkflowHistoryLoading(false);
        setWorkflowHistoryLoadingMore(false);
      }
    }
  };

  useEffect(() => {
    availableActionsTicketIdRef.current = ticketId;
    dynamicValuesTicketIdRef.current = ticketId;
    ticketDetailTicketIdRef.current = ticketId;
    workflowHistoryTicketIdRef.current = ticketId;
    setWorkflowHistory([]);
    setWorkflowHistoryPage(0);
    setWorkflowHistoryLast(true);
    setHasLoadedWorkflowHistory(false);
    setWorkflowHistoryLoading(false);
    setWorkflowHistoryLoadingMore(false);
    setWorkflowHistoryError("");
    setShowStatusDetails(false);
    setShowWorkflowHistory(false);
    setExpandedWorkflowHistoryId(null);
    setShowCancelConfirmation(false);
    setPendingDeleteChargeId(null);
    setAvailableActions(null);
    setAvailableActionsLoading(false);
    setAvailableActionsError("");
    setDynamicValues([]);
    setDynamicValuesLoading(false);
    setDynamicValuesError("");
    loadTicket();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ticketId]);

  useEffect(() => {
    if (!chargeActionMessage || chargeActionMessage.startsWith("Unable")) return undefined;

    const timeoutId = window.setTimeout(() => {
      setChargeActionMessage("");
    }, 3000);

    return () => window.clearTimeout(timeoutId);
  }, [chargeActionMessage]);

  useEffect(() => {
    customerHistoryTicketIdRef.current = ticketId;
    setShowCustomerHistory(false);
    setCustomerHistory([]);
    setCustomerHistoryCount(0);
    setCustomerHistoryLoading(false);
    setCustomerHistoryError("");
    setHasLoadedCustomerHistory(false);
  }, [ticketId]);

  const loadDynamicValues = async () => {
    if (!ticketId) return;

    const requestedTicketId = ticketId;
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
      if (String(dynamicValuesTicketIdRef.current) !== String(requestedTicketId)) return;
      setDynamicValues(Array.isArray(data.dynamicValues) ? data.dynamicValues : []);
    } catch {
      if (String(dynamicValuesTicketIdRef.current) !== String(requestedTicketId)) return;
      setDynamicValues([]);
      setDynamicValuesError("Unable to load additional details.");
    } finally {
      if (String(dynamicValuesTicketIdRef.current) === String(requestedTicketId)) {
        setDynamicValuesLoading(false);
      }
    }
  };

  useEffect(() => {
    if (!ticket?.id || String(ticket.id) !== String(ticketId)) return undefined;

    return scheduleSecondaryWork(() => {
      loadAvailableActions();
      loadDynamicValues();
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ticket?.id, ticketId]);

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

  const toggleWorkflowHistory = () => {
    const nextShowWorkflowHistory = !showWorkflowHistory;
    setShowWorkflowHistory(nextShowWorkflowHistory);
    if (nextShowWorkflowHistory && !hasLoadedWorkflowHistory && !workflowHistoryLoading) {
      loadWorkflowHistory(0, true);
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
      setStatusMessage(errorMessage);
    } finally {
      setProcessing(key, false);
    }
  };

  const confirmCancelTicket = async () => {
    setShowCancelConfirmation(false);
    await runTicketAction(`cancel-${ticketId}`, "cancel", { cancellationReason: "Cancelled via ticket detail." }, "Ticket cancelled successfully.", "Unable to update ticket. Please try again.");
  };

  const runDynamicWorkflowAction = async (action) => {
    const transitionId = action?.transitionId;
    if (!transitionId) return;

    const key = `dynamic-${transitionId}`;
    setProcessing(key, true);
    setStatusMessage("");
    try {
      const response = await fetch(`/volt/tickets/${ticketId}/workflow-transitions/${transitionId}/execute`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${localStorage.getItem("token")}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          comment: "",
          reason: "",
        }),
      });

      if (!response.ok) throw new Error("Dynamic workflow action failed");

      await loadTicket();
      await loadAvailableActions();
      await loadWorkflowHistory(0, true);
      setStatusMessage("Workflow action completed successfully.");
    } catch {
      setStatusMessage("Unable to execute workflow action. Please refresh and try again.");
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

  const confirmDeleteCharge = async () => {
    if (!pendingDeleteChargeId) return;
    const chargeItemId = pendingDeleteChargeId;
    setPendingDeleteChargeId(null);
    await deleteCharge(chargeItemId);
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
  const hasVisibleWorkflowAction = (canPickTicket && ["NEW", "PICKED"].includes(ticket?.status))
    || (canStartWork && ticket?.status === "PICKED")
    || canComplete
    || canCancel;
  const dynamicActions = Array.isArray(availableActions?.dynamicActions) ? availableActions.dynamicActions : [];
  const hasDynamicActions = dynamicActions.length > 0;
  const hasLoadedAvailableActions = Boolean(availableActions) && !availableActionsLoading && !availableActionsError;
  const renderWorkflowActions = (prominent = false) => {
    const hasNoActions = hasLoadedAvailableActions && !hasVisibleWorkflowAction && !hasDynamicActions;
    const isCompletedNoActions = hasNoActions && ticket?.status === "COMPLETED";
    const actionSectionClassName = prominent && !isCompletedNoActions
      ? "rounded-2xl border-2 border-yellow-300 bg-yellow-50 p-4 shadow-sm sm:p-5"
      : "rounded-2xl border border-blue-100 bg-white p-4 shadow-sm sm:p-5";

    return (
    <section className={`min-w-0 ${actionSectionClassName}`}>
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <h2 className="text-lg font-bold text-blue-950">{isCompletedNoActions ? "No Actions Available" : prominent ? "Available Actions" : "More Actions"}</h2>
          {prominent && !isCompletedNoActions && (
            <p className="mt-1 text-sm font-semibold text-yellow-800">Use these workflow actions for this ticket.</p>
          )}
          {isCompletedNoActions && (
            <p className="mt-1 text-sm font-semibold text-gray-600">This ticket is already completed.</p>
          )}
        </div>
        {prominent && !isCompletedNoActions && <span className="rounded-full bg-white px-3 py-1 text-xs font-bold text-yellow-900">Workflow</span>}
      </div>
      {availableActionsError && (
        <p className="mt-4 rounded-xl bg-yellow-100 px-4 py-3 text-sm font-semibold text-yellow-900">
          {availableActionsError}
        </p>
      )}
      <div className={`mt-4 flex flex-col gap-2 ${prominent ? "sm:gap-3" : ""}`}>
        {(availableActionsLoading || (!availableActions && !availableActionsError)) && <p className="text-sm font-semibold text-gray-600">Loading available workflow actions...</p>}
        {canStartWork && ticket.status === "PICKED" && <button type="button" onClick={() => runTicketAction(`start-${ticketId}`, "start-work", null, "Work started on ticket.", "Unable to update ticket. Please try again.")} disabled={processingKeys[`start-${ticketId}`]} className="ke-primary-action min-h-12 rounded-2xl px-4 py-3 font-bold disabled:opacity-60">{processingKeys[`start-${ticketId}`] ? "Starting..." : "Start Work"}</button>}
        {canPickTicket && ticket.status === "NEW" && <button type="button" onClick={() => runTicketAction(`pick-${ticketId}`, "pick", null, "Ticket picked successfully.", "Unable to update ticket. Please try again.")} disabled={processingKeys[`pick-${ticketId}`]} className={`${canStartWork ? "min-h-11 border border-blue-950 bg-white text-blue-950" : "ke-accent-action min-h-12"} rounded-2xl px-4 py-2 font-semibold disabled:opacity-60`}>{processingKeys[`pick-${ticketId}`] ? "Picking..." : "Pick Ticket"}</button>}
        {canPickTicket && ticket.status === "PICKED" && <button type="button" onClick={() => runTicketAction(`pick-${ticketId}`, "pick", null, "Ticket picked successfully.", "Unable to update ticket. Please try again.")} disabled={processingKeys[`pick-${ticketId}`]} className="min-h-11 rounded-2xl border border-blue-950 bg-white px-4 py-2 font-semibold text-blue-950 disabled:opacity-60">{processingKeys[`pick-${ticketId}`] ? "Taking..." : "Take Ownership"}</button>}
        {canComplete && <button type="button" onClick={() => runTicketAction(`complete-${ticketId}`, "complete", { completionRemark: "Completed via UI." }, "Ticket completed successfully.", "Unable to update ticket. Please try again.")} disabled={processingKeys[`complete-${ticketId}`]} className="min-h-11 rounded-2xl bg-green-600 px-4 py-2 font-semibold text-white disabled:opacity-60">{processingKeys[`complete-${ticketId}`] ? "Completing..." : "Complete Ticket"}</button>}
        {hasNoActions && !isCompletedNoActions && (
          <p className="text-sm text-gray-600">No workflow actions are currently available for this ticket.</p>
        )}
        {canCancel && (
          <div className="mt-2 border-t border-red-100 pt-3">
            <p className="mb-2 text-xs font-bold uppercase text-red-700">Danger zone</p>
            <button type="button" onClick={() => setShowCancelConfirmation(true)} disabled={processingKeys[`cancel-${ticketId}`]} className="min-h-11 w-full rounded-2xl border border-red-500 bg-white px-4 py-2 font-semibold text-red-700 disabled:opacity-60">{processingKeys[`cancel-${ticketId}`] ? "Cancelling..." : "Cancel Ticket"}</button>
          </div>
        )}
      </div>
      {hasDynamicActions && (
        <div className="mt-5 border-t border-slate-200 pt-4">
          <h3 className="text-sm font-bold text-slate-700">Additional Workflow Actions</h3>
          <div className="mobile-full-width-actions mt-3 flex flex-wrap items-center gap-2">
            {dynamicActions.map((action) => (
              <button
                key={`${action.transitionId}-${action.actionKey}-${prominent ? "top" : "bottom"}`}
                type="button"
                data-transition-id={action.transitionId}
                onClick={() => runDynamicWorkflowAction(action)}
                disabled={processingKeys[`dynamic-${action.transitionId}`]}
                className="min-h-11 rounded-2xl border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-blue-950 hover:bg-slate-50 disabled:opacity-60"
              >
                {processingKeys[`dynamic-${action.transitionId}`] ? "Processing..." : action.displayName}
              </button>
            ))}
          </div>
        </div>
      )}
    </section>
    );
  };

  return (
    <main className="ke-page-main ticket-detail-page bg-gray-50 lg:px-8">
      <div className="mx-auto w-full max-w-4xl">
        <button type="button" onClick={() => navigate(`/tickets${location.search}`)} className="flex min-h-10 items-center gap-2 rounded-xl px-1 py-1.5 font-semibold text-blue-950">
          <ArrowLeft size={18} aria-hidden="true" /> Back to Tickets
        </button>

        {isLoading && <TicketDetailSkeleton />}
        {error && <p className="mt-6 rounded-xl bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">{error}</p>}

        {!isLoading && !error && ticket && (
          <div className="mt-4 min-w-0 space-y-4">
            <header className="rounded-2xl bg-blue-950 p-4 text-white shadow-lg sm:rounded-3xl sm:p-7">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <h1 className="min-w-0 break-words text-2xl font-extrabold sm:text-3xl">{ticket.ticketNumber ?? "Not available"}</h1>
                <span className="max-w-full break-words rounded-full bg-white/15 px-3 py-1 text-xs font-bold">{getTicketStatusLabel(ticket)}</span>
              </div>
              <p className="mt-3 break-words text-sm font-bold text-blue-100">{formatEnumDisplay(ticket.category)}</p>
              <p className="mt-1 break-words text-base font-semibold">{ticket.customerName ?? "Customer not available"}</p>
            </header>

            {statusMessage && (
              <p className={`rounded-xl px-4 py-3 text-sm font-semibold ${statusMessage.startsWith("Unable") || statusMessage.startsWith("Please") ? "bg-red-50 text-red-700" : "bg-green-50 text-green-700"}`}>
                {statusMessage}
              </p>
            )}

            {renderWorkflowActions(true)}

            <section className="min-w-0 rounded-2xl border border-blue-100 bg-white p-4 shadow-sm sm:p-5">
              <h2 className="text-lg font-bold text-blue-950">Ticket Information</h2>
              <dl className="mt-4 grid grid-cols-1 gap-3 text-sm sm:grid-cols-2">
                <InfoItem label="Customer Name">{ticket.customerName}</InfoItem>
                <InfoItem label="Mobile Number">
                  {ticket.mobileNumber ? (
                    <span className="flex min-w-0 flex-wrap items-center gap-2">
                      <a href={`tel:${String(ticket.mobileNumber).replace(/[^\d+]/g, "")}`} className="inline-flex min-w-0 items-center gap-2 break-words font-semibold text-blue-950 hover:underline">
                        <Phone size={15} aria-hidden="true" /> {ticket.mobileNumber}
                      </a>
                      <a href={`tel:${String(ticket.mobileNumber).replace(/[^\d+]/g, "")}`} className="inline-flex min-h-9 items-center gap-1.5 rounded-xl bg-blue-950 px-3 py-1.5 text-xs font-bold text-white hover:bg-blue-900">
                        <PhoneCall size={14} aria-hidden="true" /> Call
                      </a>
                    </span>
                  ) : "Not available"}
                </InfoItem>
                <InfoItem label="Village / Area" className="sm:col-span-2"><span className="inline-flex min-w-0 items-center gap-2 break-words"><MapPin size={15} aria-hidden="true" /> {ticket.villageOrArea ?? "Not available"}</span></InfoItem>
                <InfoItem label="Product Type">{ticket.productType}</InfoItem>
                <InfoItem label="Category">{formatEnumDisplay(ticket.category)}</InfoItem>
                <InfoItem label="Complaint Description" className="sm:col-span-2">{ticket.complaintDescription}</InfoItem>
              </dl>
            </section>

            {canViewCustomerHistory && <section className="min-w-0 rounded-2xl border border-blue-100 bg-white p-4 shadow-sm sm:p-5">
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
                    <article key={historyTicket.id ?? historyTicket.ticketNumber} className="min-w-0 rounded-xl border border-slate-200 bg-slate-50 p-4">
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
                      </dl>
                      <button type="button" onClick={() => navigate(`/tickets/${historyTicket.id}${location.search}`)} className="mt-4 inline-flex items-center gap-2 rounded-xl bg-blue-950 px-3 py-2 text-sm font-semibold text-white hover:bg-blue-900">
                        <Eye size={15} aria-hidden="true" /> View Details
                      </button>
                    </article>
                  ))}
                </div>
              )}
            </section>}

            <section className="min-w-0 rounded-2xl border border-blue-100 bg-white p-4 shadow-sm sm:p-5">
              <button type="button" onClick={() => setShowStatusDetails((current) => !current)} className="flex w-full items-center justify-between gap-3 text-left">
                <span>
                  <span className="block text-lg font-bold text-blue-950">Status / Workflow Details</span>
                  <span className="mt-1 block text-sm font-semibold text-gray-600">
                    {getTicketStatusLabel(ticket)}
                    {ticket.status === "COMPLETED" && ticket.completedByEmployeeId ? ` by ${ticket.completedByEmployeeId}` : ""}
                  </span>
                </span>
                {showStatusDetails ? <ChevronDown className="shrink-0 text-blue-950" size={20} aria-hidden="true" /> : <ChevronRight className="shrink-0 text-blue-950" size={20} aria-hidden="true" />}
              </button>
              {showStatusDetails && (
                <dl className="mt-4 grid grid-cols-1 gap-3 border-t border-blue-100 pt-4 text-sm sm:grid-cols-2">
                  <InfoItem label="Status">{getTicketStatusLabel(ticket)}</InfoItem>
                  <InfoItem label="Picked By">{ticket.pickedByEmployeeId ?? "Not picked"}</InfoItem>
                  <InfoItem label="Created Date"><span className="inline-flex min-w-0 items-center gap-2 break-words"><Calendar size={15} aria-hidden="true" /> {formatDate(ticket.createdAt ?? ticket.createdDate)}</span></InfoItem>
                  {ticket.status === "COMPLETED" && <InfoItem label="Completed By">{ticket.completedByEmployeeId}</InfoItem>}
                  {ticket.status === "COMPLETED" && <InfoItem label="Completed At">{formatDateTime(ticket.completedAt)}</InfoItem>}
                  {ticket.status === "COMPLETED" && ticket.completionRemark && <InfoItem label="Completion Remark" className="sm:col-span-2">{ticket.completionRemark}</InfoItem>}
                  {ticket.status === "CANCELLED" && <InfoItem label="Cancelled By">{ticket.cancelledByEmployeeId}</InfoItem>}
                  {ticket.status === "CANCELLED" && <InfoItem label="Cancelled At">{formatDateTime(ticket.cancelledAt)}</InfoItem>}
                  {ticket.status === "CANCELLED" && <InfoItem label="Cancellation Reason" className="sm:col-span-2">{ticket.cancellationReason}</InfoItem>}
                </dl>
              )}
            </section>

            <section className="min-w-0 rounded-2xl border border-blue-100 bg-white p-4 shadow-sm sm:p-5">
              <button type="button" onClick={toggleWorkflowHistory} className="flex w-full items-center justify-between gap-3 text-left">
                <span>
                  <span className="block text-lg font-bold text-blue-950">Workflow History</span>
                  <span className="mt-1 block text-sm font-semibold text-gray-600">
                    {workflowHistory.length > 0 ? `${workflowHistory.length} event${workflowHistory.length === 1 ? "" : "s"} loaded` : "Tap to view timeline"}
                  </span>
                </span>
                {showWorkflowHistory ? <ChevronDown className="shrink-0 text-blue-950" size={20} aria-hidden="true" /> : <ChevronRight className="shrink-0 text-blue-950" size={20} aria-hidden="true" />}
              </button>

              {showWorkflowHistory && <div className="mt-4 space-y-3 border-t border-blue-100 pt-4">
                {workflowHistoryLoading && <p className="text-sm font-semibold text-gray-600">Loading workflow history...</p>}
                {workflowHistoryError && <p className="rounded-xl bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">{workflowHistoryError}</p>}
                {!workflowHistoryLoading && !workflowHistoryError && workflowHistory.length === 0 && (
                  <p className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-600">No workflow history yet.</p>
                )}
                {!workflowHistoryLoading && workflowHistory.length > 0 && (
                  <>
                    <div className="space-y-0">
                      {workflowHistory.map((historyItem) => (
                        <article key={historyItem.id ?? `${historyItem.actionKey}-${historyItem.createdAt}`} className="relative min-w-0 border-l-2 border-blue-100 pb-4 pl-4 last:pb-0">
                          <span className="absolute -left-[7px] top-1 h-3 w-3 rounded-full bg-blue-950" aria-hidden="true" />
                          <button
                            type="button"
                            onClick={() => setExpandedWorkflowHistoryId((current) => current === (historyItem.id ?? `${historyItem.actionKey}-${historyItem.createdAt}`) ? null : (historyItem.id ?? `${historyItem.actionKey}-${historyItem.createdAt}`))}
                            className="w-full text-left"
                          >
                            <div className="flex min-w-0 items-start justify-between gap-3">
                              <div className="min-w-0">
                                <h3 className="break-words font-extrabold leading-tight text-blue-950">{historyItem.actionDisplayName || formatLabel(historyItem.actionKey)}</h3>
                                <p className="mt-1 text-sm font-semibold text-slate-700">
                                  {(historyItem.fromStatusDisplayName || formatLabel(historyItem.fromStatus))} to {(historyItem.toStatusDisplayName || formatLabel(historyItem.toStatus))}
                                </p>
                                <p className="mt-1 text-xs font-semibold text-slate-500">
                                  {formatDateTime(historyItem.createdAt)} - {getHistoryActor(historyItem)}
                                </p>
                              </div>
                              {expandedWorkflowHistoryId === (historyItem.id ?? `${historyItem.actionKey}-${historyItem.createdAt}`) ? <ChevronDown className="shrink-0 text-blue-950" size={18} aria-hidden="true" /> : <ChevronRight className="shrink-0 text-blue-950" size={18} aria-hidden="true" />}
                            </div>
                          </button>

                          {expandedWorkflowHistoryId === (historyItem.id ?? `${historyItem.actionKey}-${historyItem.createdAt}`) && <dl className="mt-3 grid grid-cols-1 gap-2 rounded-xl bg-slate-50 p-3 text-sm sm:grid-cols-2">
                            <InfoItem label="Executed By">{getHistoryActor(historyItem)}</InfoItem>
                            {hasOwnerChange(historyItem) && (
                              <InfoItem label="Owner Change">
                                {(historyItem.previousOwnerEmployeeId || "Unassigned")} to {(historyItem.newOwnerEmployeeId || "Unassigned")}
                              </InfoItem>
                            )}
                            {historyItem.comment && <InfoItem label="Comment" className="sm:col-span-2">{historyItem.comment}</InfoItem>}
                            {historyItem.reason && <InfoItem label="Reason" className="sm:col-span-2">{historyItem.reason}</InfoItem>}
                          </dl>}
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
              </div>}
            </section>

            {dynamicValues.length > 0 && (
              <section className="min-w-0 rounded-2xl border border-blue-100 bg-white p-4 shadow-sm sm:p-5">
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

            {canViewCharges && <section className="min-w-0 rounded-2xl border border-blue-100 bg-white p-4 shadow-sm sm:p-5">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h2 className="text-lg font-bold text-blue-950">Charges</h2>
                  <p className="mt-1 text-xl font-extrabold text-blue-950">{formatCurrency(ticket.totalCharge ?? chargeTotal)}</p>
                </div>
                <button type="button" onClick={toggleCharges} className="rounded-xl bg-blue-50 px-3 py-2 text-sm font-bold text-blue-950 hover:bg-blue-100">
                  <span className="inline-flex items-center gap-2"><Eye size={15} aria-hidden="true" /> {showCharges ? "Hide" : "View"}</span>
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
                                <Suspense fallback={<input name="description" value={chargeForm.description} onChange={handleChargeInput} maxLength={120} className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2 outline-none focus:border-blue-950" autoComplete="off" />}>
                                  <SuggestionInput endpoint="/volt/suggestions/charge-descriptions" name="description" value={chargeForm.description} onChange={handleChargeInput} maxLength={120} className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2 outline-none focus:border-blue-950" />
                                </Suspense>
                                {chargeFormErrors.description && <span className="mt-1 block text-xs text-red-600">{chargeFormErrors.description}</span>}
                              </label>
                              <label className="block text-sm font-semibold text-slate-700">
                                Amount
                                <input name="amount" type="number" min="0.01" max="999999.99" step="0.01" value={chargeForm.amount} onChange={handleChargeInput} className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2 outline-none focus:border-blue-950" />
                                {chargeFormErrors.amount && <span className="mt-1 block text-xs text-red-600">{chargeFormErrors.amount}</span>}
                              </label>
                            </div>
                            <div className="mobile-full-width-actions mt-3 flex flex-wrap gap-2">
                              <button type="button" onClick={addCharge} disabled={processingKeys[`add-charge-${ticketId}`]} className="ke-accent-action rounded-xl px-3 py-2 text-sm font-semibold disabled:opacity-60">
                                {processingKeys[`add-charge-${ticketId}`] ? "Saving..." : "Save"}
                              </button>
                              <button type="button" onClick={cancelAddCharge} disabled={processingKeys[`add-charge-${ticketId}`]} className="rounded-xl bg-slate-200 px-3 py-2 text-sm font-semibold text-slate-800 hover:bg-slate-300 disabled:opacity-60">
                                Cancel
                              </button>
                            </div>
                          </div>
                        ) : (
                          <button type="button" onClick={openAddCharge} className="ke-accent-action inline-flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-semibold">
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
                                  <button type="button" onClick={() => setPendingDeleteChargeId(item.id)} disabled={processingKeys[`delete-charge-${item.id}`]} className="rounded-lg border border-red-100 px-3 py-1.5 text-xs font-bold text-red-700 hover:bg-red-50 disabled:opacity-60">
                                    {processingKeys[`delete-charge-${item.id}`] ? "Deleting..." : "Delete"}
                                  </button>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                      {chargeActionMessage && chargeActionMessage.startsWith("Unable") && <p className="rounded-xl bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">{chargeActionMessage}</p>}
                    </>
                  )}
                </div>
              )}
            </section>}

            {chargeActionMessage && !chargeActionMessage.startsWith("Unable") && (
              <div className="fixed inset-x-3 bottom-24 z-50 mx-auto max-w-md rounded-xl bg-blue-950 px-4 py-3 text-sm font-bold text-white shadow-2xl sm:bottom-4" role="status">
                {chargeActionMessage}
              </div>
            )}

            {showCancelConfirmation && (
              <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 px-3 py-4 sm:items-center" role="dialog" aria-modal="true" aria-labelledby="cancel-ticket-title">
                <div className="w-full max-w-md rounded-2xl bg-white p-4 shadow-2xl">
                  <h2 id="cancel-ticket-title" className="text-lg font-extrabold text-blue-950">Cancel this ticket?</h2>
                  <p className="mt-2 text-sm font-semibold text-gray-600">This will mark the ticket as cancelled.</p>
                  <div className="mt-4 grid grid-cols-2 gap-2">
                    <button type="button" onClick={() => setShowCancelConfirmation(false)} className="min-h-11 rounded-xl border border-blue-950 px-4 py-2 text-sm font-bold text-blue-950 hover:bg-blue-50">
                      Keep Ticket
                    </button>
                    <button type="button" onClick={confirmCancelTicket} disabled={processingKeys[`cancel-${ticketId}`]} className="ke-danger-action min-h-11 rounded-xl px-4 py-2 text-sm font-bold disabled:opacity-60">
                      Cancel Ticket
                    </button>
                  </div>
                </div>
              </div>
            )}

            {pendingDeleteChargeId !== null && (
              <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 px-3 py-4 sm:items-center" role="dialog" aria-modal="true" aria-labelledby="delete-charge-title">
                <div className="w-full max-w-md rounded-2xl bg-white p-4 shadow-2xl">
                  <h2 id="delete-charge-title" className="text-lg font-extrabold text-blue-950">Delete this charge?</h2>
                  <p className="mt-2 text-sm font-semibold text-gray-600">This cannot be undone.</p>
                  <div className="mt-4 grid grid-cols-2 gap-2">
                    <button type="button" onClick={() => setPendingDeleteChargeId(null)} className="min-h-11 rounded-xl border border-blue-950 px-4 py-2 text-sm font-bold text-blue-950 hover:bg-blue-50">
                      Cancel
                    </button>
                    <button type="button" onClick={confirmDeleteCharge} disabled={processingKeys[`delete-charge-${pendingDeleteChargeId}`]} className="ke-danger-action min-h-11 rounded-xl px-4 py-2 text-sm font-bold disabled:opacity-60">
                      Delete
                    </button>
                  </div>
                </div>
              </div>
            )}

          </div>
        )}
      </div>
    </main>
  );
}
