import { lazy, Suspense, useEffect, useRef, useState } from "react";
import {
  ArrowLeft,
  Box,
  Calendar,
  Check,
  CheckCircle2,
  ChevronRight,
  ClipboardCheck,
  Clock3,
  FileText,
  History,
  IndianRupee,
  ListChecks,
  MapPin,
  MessageCircle,
  Phone,
  PhoneCall,
  Play,
  Plus,
  ShieldCheck,
  SlidersHorizontal,
  Trash2,
  User,
  Users,
  Wrench,
} from "lucide-react";
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

function formatCompactCurrency(value) {
  const amount = Number(value);
  if (!Number.isFinite(amount)) return "₹0";
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: amount % 1 === 0 ? 0 : 2,
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

function getCurrentOwnerLabel(ticket) {
  return ticket?.currentOwnerEmployeeName
    || ticket?.currentOwnerEmployeeId
    || ticket?.pickedByEmployeeId
    || "Unassigned";
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

function IconBubble({ icon: Icon, tone = "slate", className = "" }) {
  const toneClassName = {
    blue: "bg-blue-50 text-blue-950",
    green: "bg-green-50 text-green-700",
    red: "bg-red-50 text-red-700",
    yellow: "bg-yellow-100 text-yellow-900",
    slate: "bg-slate-100 text-slate-900",
  }[tone] || "bg-slate-100 text-slate-900";

  return (
    <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${toneClassName} ${className}`}>
      <Icon size={20} aria-hidden="true" />
    </span>
  );
}

function StatusPill({ status, label }) {
  const normalizedStatus = String(status || "").toUpperCase();
  const statusClassName = normalizedStatus === "COMPLETED"
    ? "bg-green-600 text-white"
    : normalizedStatus === "CANCELLED"
      ? "bg-red-600 text-white"
      : normalizedStatus === "PICKED"
        ? "bg-violet-600 text-white"
        : normalizedStatus === "IN_PROGRESS"
          ? "bg-blue-600 text-white"
          : "bg-white/15 text-white";

  return (
    <span className={`inline-flex max-w-full items-center gap-1.5 rounded-full px-3 py-1 text-xs font-extrabold ${statusClassName}`}>
      {normalizedStatus === "COMPLETED" && <CheckCircle2 size={14} aria-hidden="true" />}
      {normalizedStatus === "CANCELLED" && <Trash2 size={14} aria-hidden="true" />}
      {normalizedStatus === "PICKED" && <span className="h-2 w-2 rounded-full bg-white" aria-hidden="true" />}
      {label}
    </span>
  );
}

function DetailRow({ icon: Icon, label, value, actionLabel, onClick, tone = "slate" }) {
  const content = (
    <>
      <IconBubble icon={Icon} tone={tone} />
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-semibold text-slate-900">{label}</span>
      </span>
      <span className="min-w-0 max-w-[45%] break-words text-right text-sm font-bold text-blue-950">
        {actionLabel || value || "Not available"}
      </span>
      {onClick && <ChevronRight className="shrink-0 text-blue-700" size={20} aria-hidden="true" />}
    </>
  );

  if (onClick) {
    return (
      <button type="button" onClick={onClick} className="flex min-h-12 w-full items-center gap-3 border-t border-blue-100 py-2 text-left first:border-t-0">
        {content}
      </button>
    );
  }

  return (
    <div className="flex min-h-12 items-center gap-3 border-t border-blue-100 py-2 first:border-t-0">
      {content}
    </div>
  );
}

function TicketDetailSkeleton() {
  return (
    <div className="mt-4 min-w-0 space-y-4" aria-hidden="true">
      <section className="min-h-40 rounded-2xl bg-blue-950 p-4 shadow-lg sm:min-h-44 sm:rounded-3xl sm:p-7">
        <div className="flex items-start justify-between gap-3">
          <div className="h-8 w-40 rounded-full bg-white/20" />
          <div className="h-6 w-24 rounded-full bg-white/15" />
        </div>
        <div className="mt-5 h-4 w-32 rounded-full bg-white/15" />
        <div className="mt-3 h-5 w-48 rounded-full bg-white/20" />
      </section>
      <section className="min-h-32 rounded-2xl border border-blue-100 bg-white p-4 shadow-sm sm:p-5">
        <div className="h-6 w-40 rounded-full bg-blue-100" />
        <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div className="h-11 rounded-xl bg-gray-100" />
          <div className="h-11 rounded-xl bg-gray-100" />
        </div>
      </section>
      <section className="min-h-64 rounded-2xl border border-blue-100 bg-white p-4 shadow-sm sm:p-5">
        <div className="h-6 w-44 rounded-full bg-blue-100" />
        <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div className="h-10 rounded-xl bg-gray-100" />
          <div className="h-10 rounded-xl bg-gray-100" />
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
  const backTarget = location.state?.from === "myTickets" ? "/tickets/my" : `/tickets/find${location.search}`;
  const backLabel = location.state?.from === "myTickets" ? "Back to My Tickets" : "Back to Find Tickets";
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
  const [showCompleteConfirmation, setShowCompleteConfirmation] = useState(false);
  const [showAssignDialog, setShowAssignDialog] = useState(false);
  const [activeDetailView, setActiveDetailView] = useState("ticket");
  const [assignableEmployees, setAssignableEmployees] = useState([]);
  const [assignableEmployeesLoading, setAssignableEmployeesLoading] = useState(false);
  const [assignableEmployeesError, setAssignableEmployeesError] = useState("");
  const [assignForm, setAssignForm] = useState({ employeeId: "", note: "" });
  const [assignError, setAssignError] = useState("");
  const [pendingDeleteChargeId, setPendingDeleteChargeId] = useState(null);
  const availableActionsTicketIdRef = useRef(ticketId);
  const customerHistoryTicketIdRef = useRef(ticketId);
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
    setShowCompleteConfirmation(false);
    setShowAssignDialog(false);
    setActiveDetailView("ticket");
    setAssignForm({ employeeId: "", note: "" });
    setAssignError("");
    setPendingDeleteChargeId(null);
    setAvailableActions(null);
    setAvailableActionsLoading(false);
    setAvailableActionsError("");
    loadTicket();
    loadAvailableActions();
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

  const confirmCompleteTicket = async () => {
    setShowCompleteConfirmation(false);
    await runTicketAction(`complete-${ticketId}`, "complete", { completionRemark: "Completed via UI." }, "Ticket completed successfully.", "Unable to update ticket. Please try again.");
  };

  const loadAssignableEmployees = async () => {
    setAssignableEmployeesLoading(true);
    setAssignableEmployeesError("");
    try {
      const response = await fetch("/volt/tickets/assignable-employees", {
        headers: {
          Authorization: `Bearer ${localStorage.getItem("token")}`,
        },
      });

      if (!response.ok) throw new Error("Unable to load assignable employees");

      const data = await response.json();
      setAssignableEmployees(Array.isArray(data) ? data : []);
    } catch {
      setAssignableEmployees([]);
      setAssignableEmployeesError("Unable to load employees. Please try again.");
    } finally {
      setAssignableEmployeesLoading(false);
    }
  };

  const openAssignDialog = async () => {
    setShowAssignDialog(true);
    setAssignError("");
    setAssignForm({ employeeId: "", note: "" });
    if (assignableEmployees.length === 0 && !assignableEmployeesLoading) {
      await loadAssignableEmployees();
    }
  };

  const closeAssignDialog = () => {
    if (processingKeys[`assign-${ticketId}`]) return;
    setShowAssignDialog(false);
    setAssignError("");
    setAssignForm({ employeeId: "", note: "" });
  };

  const handleAssignInput = (event) => {
    const { name, value } = event.target;
    setAssignForm((current) => ({ ...current, [name]: value }));
    setAssignError("");
  };

  const assignTicket = async () => {
    const targetEmployeeId = assignForm.employeeId.trim();
    if (!targetEmployeeId) {
      setAssignError("Select an employee to assign this ticket.");
      return;
    }
    if (ticket?.currentOwnerEmployeeId && targetEmployeeId.toLowerCase() === String(ticket.currentOwnerEmployeeId).toLowerCase()) {
      setAssignError("This employee is already the current owner.");
      return;
    }
    if (ticket?.pickedByEmployeeId && targetEmployeeId.toLowerCase() === String(ticket.pickedByEmployeeId).toLowerCase()) {
      setAssignError("This employee is already the current owner.");
      return;
    }

    const key = `assign-${ticketId}`;
    setProcessing(key, true);
    setAssignError("");
    setStatusMessage("");
    try {
      const response = await fetch(`/volt/tickets/${ticketId}/assign`, {
        method: "PATCH",
        headers: {
          Authorization: `Bearer ${localStorage.getItem("token")}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          employeeId: targetEmployeeId,
          note: assignForm.note.trim(),
        }),
      });

      if (!response.ok) {
        let message = "Unable to assign ticket. Please try again.";
        try {
          const data = await response.json();
          if (typeof data.message === "string" && data.message.trim()) {
            message = data.message.trim();
          }
        } catch {
          // Keep fallback message.
        }
        throw new Error(message);
      }

      await loadTicket();
      if (showWorkflowHistory) await loadWorkflowHistory(0, true);
      setShowAssignDialog(false);
      setAssignForm({ employeeId: "", note: "" });
      setStatusMessage("Ticket assigned successfully.");
    } catch (assignRequestError) {
      setAssignError(assignRequestError.message || "Unable to assign ticket. Please try again.");
    } finally {
      setProcessing(key, false);
    }
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
  const canAssignTicket = hasAccess("ASSIGN_TICKET");
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
  const ticketStatusLabel = ticket ? getTicketStatusLabel(ticket) : "Not available";
  const totalAmount = ticket?.totalCharge ?? chargeTotal;
  const chargesTotalAmount = showCharges ? chargeTotal : totalAmount;
  const sanitizedMobileNumber = ticket?.mobileNumber ? String(ticket.mobileNumber).replace(/[^\d+]/g, "") : "";
  const customerSummaryLabel = `${ticket?.customerName || "Not available"}${ticket?.villageOrArea ? ` (${ticket.villageOrArea})` : ""}`;
  const mobileSummaryLabel = ticket?.mobileNumber || "Not available";
  const problemSummary = ticket?.complaintDescription || formatEnumDisplay(ticket?.category);
  const historySummary = hasLoadedWorkflowHistory
    ? `${workflowHistory.length} event${workflowHistory.length === 1 ? "" : "s"}`
    : "View";
  const previousTicketSummary = hasLoadedCustomerHistory
    ? customerHistoryCount > 0 ? `${customerHistoryCount} ticket${customerHistoryCount === 1 ? "" : "s"}` : "No previous tickets"
    : "View";

  const openChargesView = async () => {
    setActiveDetailView("charges");
    setShowCharges(true);
    setShowAddChargeForm(true);
    if (canViewCharges) await loadCharges();
  };

  const openCustomerHistoryView = async () => {
    setActiveDetailView("customerHistory");
    setShowCustomerHistory(true);
    if (!hasLoadedCustomerHistory) await loadCustomerHistory();
  };

  const openTimelineView = async () => {
    setActiveDetailView("timeline");
    setShowWorkflowHistory(true);
    if (!hasLoadedWorkflowHistory && !workflowHistoryLoading) await loadWorkflowHistory(0, true);
  };

  const openStatusView = () => {
    setActiveDetailView("status");
    setShowStatusDetails(true);
  };

  const getActionLabel = (label, actionKey = "") => {
    if (actionKey === "PICK_TICKET" || label === "Pick Ticket") return "Take This Ticket";
    if (actionKey === "COMPLETE_TICKET" || label === "Complete Ticket") return "Mark Completed";
    return label;
  };

  const renderActionButton = ({ key, label, icon: Icon, onClick, disabled, tone = "primary", full = false }) => {
    const toneClassName = tone === "yellow"
      ? "ke-accent-action text-black"
      : tone === "danger"
        ? "border border-red-500 bg-white text-red-700"
        : tone === "outline"
          ? "border border-blue-200 bg-white text-blue-950"
          : "ke-primary-action text-white";

    return (
      <button
        key={key}
        type="button"
        onClick={onClick}
        disabled={disabled}
        className={`${toneClassName} inline-flex min-h-11 items-center justify-center gap-2 rounded-xl px-4 py-2 text-sm font-bold disabled:opacity-60 ${full ? "w-full" : "w-full sm:w-auto sm:flex-1"}`}
      >
        {Icon && <Icon size={20} aria-hidden="true" />}
        {label}
      </button>
    );
  };

  const getWorkflowActionGroups = () => {
    const primaryActions = [];
    const secondaryActions = [];
    const dangerActions = [];

    if (canStartWork && ticket.status === "PICKED") {
      primaryActions.push({
        key: `start-${ticketId}`,
        label: processingKeys[`start-${ticketId}`] ? "Starting..." : "Start Work",
        icon: Play,
        onClick: () => runTicketAction(`start-${ticketId}`, "start-work", null, "Work started on ticket.", "Unable to update ticket. Please try again."),
        disabled: processingKeys[`start-${ticketId}`],
      });
    }

    if (canComplete) {
      primaryActions.push({
        key: `complete-${ticketId}`,
        label: processingKeys[`complete-${ticketId}`] ? "Completing..." : "Mark Completed",
        icon: Check,
        onClick: () => setShowCompleteConfirmation(true),
        disabled: processingKeys[`complete-${ticketId}`],
      });
    }

    if (canPickTicket && ticket.status === "NEW") {
      secondaryActions.push({
        key: `pick-${ticketId}`,
        label: processingKeys[`pick-${ticketId}`] ? "Taking..." : "Take This Ticket",
        icon: User,
        onClick: () => runTicketAction(`pick-${ticketId}`, "pick", null, "Ticket picked successfully.", "Unable to update ticket. Please try again."),
        disabled: processingKeys[`pick-${ticketId}`],
        tone: primaryActions.length > 0 ? "outline" : "primary",
      });
    }

    if (canPickTicket && ticket.status === "PICKED") {
      secondaryActions.push({
        key: `pick-${ticketId}`,
        label: processingKeys[`pick-${ticketId}`] ? "Taking..." : "Take This Ticket",
        icon: User,
        onClick: () => runTicketAction(`pick-${ticketId}`, "pick", null, "Ticket picked successfully.", "Unable to update ticket. Please try again."),
        disabled: processingKeys[`pick-${ticketId}`],
        tone: "outline",
      });
    }

    dynamicActions.forEach((action) => {
      secondaryActions.push({
        key: `dynamic-${action.transitionId}`,
        label: processingKeys[`dynamic-${action.transitionId}`] ? "Processing..." : getActionLabel(action.displayName, action.actionKey),
        icon: ClipboardCheck,
        onClick: () => runDynamicWorkflowAction(action),
        disabled: processingKeys[`dynamic-${action.transitionId}`],
        tone: "outline",
      });
    });

    if (canCancel) {
      dangerActions.push({
        key: `cancel-${ticketId}`,
        label: processingKeys[`cancel-${ticketId}`] ? "Cancelling..." : "Cancel Ticket",
        icon: Trash2,
        onClick: () => setShowCancelConfirmation(true),
        disabled: processingKeys[`cancel-${ticketId}`],
        tone: "danger",
        full: true,
      });
    }

    return { primaryActions, secondaryActions, dangerActions };
  };

  const renderWorkflowActions = () => {
    const hasNoActions = hasLoadedAvailableActions && !hasVisibleWorkflowAction && !hasDynamicActions;
    const actionsPending = availableActionsLoading || (!availableActions && !availableActionsError);
    const { primaryActions, secondaryActions, dangerActions } = getWorkflowActionGroups();

    return (
      <section className="min-w-0 rounded-2xl border border-blue-100 bg-white p-3.5 shadow-sm" aria-busy={actionsPending}>
        <h2 className="text-lg font-extrabold leading-tight text-blue-950">Next Action</h2>
        {availableActionsError && (
          <p className="mt-3 rounded-xl bg-yellow-100 px-4 py-3 text-sm font-semibold text-yellow-900">
            {availableActionsError}
          </p>
        )}
        {actionsPending && (
          <p className="mt-3 rounded-xl bg-blue-50 px-4 py-3 text-sm font-semibold text-slate-600">Loading actions...</p>
        )}
        {hasNoActions && ticket?.status === "COMPLETED" && (
          <div className="mt-3 flex items-center gap-3">
            <IconBubble icon={CheckCircle2} tone="green" className="h-12 w-12" />
            <div>
              <p className="text-base font-extrabold text-green-700">No Action Needed</p>
              <p className="mt-0.5 text-sm font-semibold text-slate-700">This ticket is completed.</p>
            </div>
          </div>
        )}
        {hasNoActions && ticket?.status !== "COMPLETED" && !actionsPending && (
          <p className="mt-3 rounded-xl bg-slate-50 px-4 py-3 text-sm font-semibold text-slate-600">No workflow actions are currently available.</p>
        )}
        {primaryActions.length > 0 && (
          <div className="mt-4 grid gap-2">
            {primaryActions.map((action) => renderActionButton({ ...action, full: true }))}
          </div>
        )}
        {secondaryActions.length > 0 && (
          <div className="mt-3 grid grid-cols-2 gap-2">
            {secondaryActions.map((action) => renderActionButton(action))}
          </div>
        )}
        {dangerActions.length > 0 && (
          <div className="mt-3 border-t border-red-100 pt-3">
            {dangerActions.map((action) => renderActionButton(action))}
          </div>
        )}
      </section>
    );
  };

  const renderTicketSummary = () => (
    <header className="rounded-2xl bg-blue-950 p-3.5 text-white shadow-lg">
      <div className="flex items-start justify-between gap-3">
        <h1 className="min-w-0 break-words text-3xl font-extrabold leading-none">{ticket.ticketNumber ?? "Not available"}</h1>
        <StatusPill status={ticket.status} label={ticketStatusLabel} />
      </div>
      <dl className="ticket-summary-fields mt-3 text-sm font-semibold leading-snug">
        <div className="min-w-0 break-words">
          <dt className="inline text-blue-100">Customer: </dt>
          <dd className="inline font-extrabold text-white">{customerSummaryLabel}</dd>
        </div>
        <div className="min-w-0 break-words">
          <dt className="inline text-blue-100">Product: </dt>
          <dd className="inline font-extrabold text-white">{ticket.productType ?? "Not available"}</dd>
        </div>
        <div className="min-w-0 break-words">
          <dt className="inline text-blue-100">Total Charge: </dt>
          <dd className="inline font-extrabold text-white">{formatCurrency(totalAmount)}</dd>
        </div>
        <div className="min-w-0 break-words">
          <dt className="inline text-blue-100">Mobile: </dt>
          <dd className="inline font-extrabold text-white">{mobileSummaryLabel}</dd>
        </div>
      </dl>
    </header>
  );

  const renderProblemSection = () => (
    <section className="min-w-0 rounded-2xl border border-blue-100 bg-white p-3.5 shadow-sm">
      <h2 className="flex items-center gap-2 text-lg font-extrabold leading-tight text-blue-950">
        <MessageCircle size={18} aria-hidden="true" /> Problem
      </h2>
      <p className="mt-2 line-clamp-4 break-words text-sm font-semibold leading-relaxed text-slate-700">
        {problemSummary || "No problem details added."}
      </p>
    </section>
  );

  const renderCustomerSection = () => (
    <section className="min-w-0 rounded-2xl border border-blue-100 bg-white p-3.5 shadow-sm">
      <h2 className="text-lg font-extrabold leading-tight text-blue-950">Customer</h2>
      <div className="mt-3 divide-y divide-blue-100">
        <div className="flex min-h-14 flex-wrap items-center gap-3 py-2">
          <IconBubble icon={Phone} />
          <div className="min-w-[8.5rem] flex-1">
            <p className="text-xs font-semibold text-slate-700">Mobile Number</p>
            <p className="whitespace-nowrap text-base font-extrabold text-blue-950">{ticket.mobileNumber ?? "Not available"}</p>
          </div>
          {sanitizedMobileNumber && (
            <a href={`tel:${sanitizedMobileNumber}`} aria-label="Call Customer" title="Call Customer" className="ke-primary-action ml-auto inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-xl">
              <PhoneCall size={21} aria-hidden="true" />
            </a>
          )}
        </div>
        <div className="flex min-h-12 items-center gap-3 py-2">
          <IconBubble icon={MapPin} />
          <div className="min-w-0">
            <p className="text-xs font-semibold text-slate-700">Area</p>
            <p className="break-words text-base font-extrabold text-blue-950">{ticket.villageOrArea ?? "Not available"}</p>
          </div>
        </div>
        <div className="flex min-h-12 items-center gap-3 py-2">
          <IconBubble icon={Box} />
          <div className="min-w-0">
            <p className="text-xs font-semibold text-slate-700">Product</p>
            <p className="break-words text-base font-extrabold text-blue-950">{ticket.productType ?? "Not available"}</p>
          </div>
        </div>
        <div className="flex min-h-12 items-center gap-3 py-2">
          <IconBubble icon={MessageCircle} />
          <div className="min-w-0">
            <p className="text-xs font-semibold text-slate-700">Complaint</p>
            <p className="break-words text-base font-extrabold text-blue-950">{ticket.complaintDescription ?? "Not available"}</p>
          </div>
        </div>
      </div>
    </section>
  );

  const renderWorkItemsSection = () => (
    <section className="min-w-0 rounded-2xl border border-blue-100 bg-white p-3.5 shadow-sm">
      <h2 className="text-lg font-extrabold leading-tight text-blue-950">Work Items</h2>
      <div className="mt-3">
        {canViewCharges && <DetailRow icon={IndianRupee} label="Charges" value={formatCompactCurrency(totalAmount)} actionLabel="View" onClick={openChargesView} tone={Number(totalAmount) > 0 ? "green" : "slate"} />}
        {canAssignTicket && !["COMPLETED", "CANCELLED"].includes(ticket.status) && <DetailRow icon={Users} label="Assign Ticket" actionLabel="Assign" onClick={openAssignDialog} />}
      </div>
    </section>
  );

  const renderMoreDetailsSection = () => (
    <section className="min-w-0 rounded-2xl border border-blue-100 bg-white p-3.5 shadow-sm">
      <h2 className="text-lg font-extrabold leading-tight text-blue-950">More Details</h2>
      <div className="mt-3">
        {canViewCustomerHistory && <DetailRow icon={ListChecks} label="Previous Tickets" value={previousTicketSummary} onClick={openCustomerHistoryView} />}
        <DetailRow icon={History} label="Ticket Timeline" value={historySummary} onClick={openTimelineView} />
        <DetailRow icon={ClipboardCheck} label="Status Details" value={ticketStatusLabel} onClick={openStatusView} tone={ticket?.status === "COMPLETED" ? "green" : "slate"} />
      </div>
    </section>
  );

  const renderStickyActions = () => {
    const { primaryActions } = getWorkflowActionGroups();
    const mainAction = primaryActions[0];

    if (!sanitizedMobileNumber && !mainAction && !canAddCharge) return null;

    return (
      <div className="fixed inset-x-0 bottom-[calc(54px+env(safe-area-inset-bottom))] z-30 border-t border-blue-100 bg-white/95 px-3 py-2.5 shadow-[0_-8px_24px_rgba(15,23,42,0.08)] backdrop-blur sm:hidden">
        <div className="mx-auto grid max-w-md grid-cols-2 gap-2">
          {sanitizedMobileNumber && (
            <a href={`tel:${sanitizedMobileNumber}`} className="ke-primary-action inline-flex min-h-11 items-center justify-center gap-2 rounded-xl px-3 py-2 text-sm font-bold">
              <PhoneCall size={20} aria-hidden="true" /> Call Customer
            </a>
          )}
          {mainAction
            ? renderActionButton({ ...mainAction, tone: "yellow", full: true })
            : canAddCharge && renderActionButton({ key: "sticky-add-charge", label: "Add Charge", icon: Plus, tone: "yellow", full: true, onClick: openChargesView })}
        </div>
      </div>
    );
  };

  const renderChargeSummary = () => (
    <section className="min-w-0 rounded-2xl border border-blue-100 bg-white p-3.5 shadow-sm">
      <div className="grid grid-cols-[1fr_1fr_0.9fr] divide-x divide-blue-100">
        <div className="flex min-w-0 items-center gap-1.5 pr-2">
          <IconBubble icon={FileText} className="h-9 w-9" />
          <div className="min-w-0">
            <p className="text-xs font-semibold text-slate-600">Ticket ID</p>
            <p className="truncate text-base font-extrabold text-blue-950">{ticket.ticketNumber ?? "Not available"}</p>
          </div>
        </div>
        <div className="flex min-w-0 items-center gap-1.5 px-2">
          <IconBubble icon={User} className="h-9 w-9" />
          <div className="min-w-0">
            <p className="text-xs font-semibold text-slate-600">Customer</p>
            <p className="truncate text-base font-extrabold text-blue-950">{ticket.customerName ?? "Not available"}</p>
          </div>
        </div>
        <div className="min-w-0 pl-2 text-center">
          <p className="text-xs font-semibold text-slate-600">Total</p>
          <p className="mt-1 rounded-xl bg-green-100 px-2 py-1 text-base font-extrabold text-green-700">{formatCompactCurrency(chargesTotalAmount)}</p>
        </div>
      </div>
    </section>
  );

  const renderChargeBreakdown = () => (
    <section className="min-w-0 rounded-2xl border border-blue-100 bg-white p-3.5 shadow-sm">
      <h2 className="text-lg font-extrabold text-blue-950">Charge Breakdown</h2>
      <div className="mt-3 overflow-hidden rounded-xl border border-blue-100">
        <div className="grid grid-cols-[1fr_auto] bg-slate-50 px-3 py-2 text-sm font-bold text-slate-600">
          <span>Description</span>
          <span>Amount (₹)</span>
        </div>
        {chargeLoading && <p className="px-3 py-3 text-sm font-semibold text-slate-600">Loading charges...</p>}
        {chargeError && <p className="px-3 py-3 text-sm font-semibold text-red-700">{chargeError}</p>}
        {!chargeLoading && !chargeError && chargeItems.length === 0 && (
          <p className="px-3 py-3 text-sm font-semibold text-slate-600">No charge items found.</p>
        )}
        {!chargeLoading && !chargeError && chargeItems.map((item) => (
          <div key={item.id} className="grid min-h-11 grid-cols-[1fr_auto] items-center border-t border-blue-100 px-3 py-2 text-sm">
            <span className="min-w-0 break-words text-slate-900">{item.description}</span>
            <span className="font-semibold text-slate-900">{formatCompactCurrency(item.amount)}</span>
          </div>
        ))}
        <div className="grid min-h-11 grid-cols-[1fr_auto] items-center border-t border-blue-100 bg-slate-50 px-3 py-2 text-base font-extrabold text-blue-950">
          <span>Total</span>
          <span>{formatCompactCurrency(chargesTotalAmount)}</span>
        </div>
      </div>
    </section>
  );

  const renderAddChargeForm = () => (
    <section className="min-w-0 rounded-2xl border border-blue-100 bg-white p-3.5 shadow-sm">
      <h2 className="text-lg font-extrabold text-blue-950">Add Charge</h2>
      <div className="mt-3 space-y-3">
        <label className="block text-sm font-semibold text-slate-600">
          Charge Name
          <Suspense fallback={<input name="description" value={chargeForm.description} onChange={handleChargeInput} maxLength={120} placeholder="Example: Service charge" className="mt-1.5 min-h-12 w-full rounded-xl border border-slate-300 px-3 py-2 text-base outline-none focus:border-blue-950" autoComplete="off" />}>
            <SuggestionInput endpoint="/volt/suggestions/charge-descriptions" name="description" value={chargeForm.description} onChange={handleChargeInput} maxLength={120} placeholder="Example: Service charge" className="mt-1.5 min-h-12 w-full rounded-xl border border-slate-300 px-3 py-2 text-base outline-none focus:border-blue-950" />
          </Suspense>
          {chargeFormErrors.description && <span className="mt-1 block text-xs text-red-600">{chargeFormErrors.description}</span>}
        </label>
        <label className="block text-sm font-semibold text-slate-600">
          Amount (₹)
          <input name="amount" type="number" min="0.01" max="999999.99" step="0.01" value={chargeForm.amount} onChange={handleChargeInput} placeholder="Enter amount" className="mt-1.5 min-h-12 w-full rounded-xl border border-slate-300 px-3 py-2 text-base outline-none focus:border-blue-950" />
          {chargeFormErrors.amount && <span className="mt-1 block text-xs text-red-600">{chargeFormErrors.amount}</span>}
        </label>
        <div className="grid grid-cols-2 gap-3 pt-1">
          <button type="button" onClick={cancelAddCharge} disabled={processingKeys[`add-charge-${ticketId}`]} className="min-h-12 rounded-xl border border-blue-950 px-3 py-2 text-sm font-bold text-blue-950 disabled:opacity-60">
            Cancel
          </button>
          <button type="button" onClick={addCharge} disabled={processingKeys[`add-charge-${ticketId}`]} className="ke-accent-action min-h-12 rounded-xl px-3 py-2 text-sm font-bold disabled:opacity-60">
            {processingKeys[`add-charge-${ticketId}`] ? "Saving..." : "Save Charge"}
          </button>
        </div>
        {chargeActionMessage && chargeActionMessage.startsWith("Unable") && (
          <p className="rounded-xl bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">{chargeActionMessage}</p>
        )}
      </div>
    </section>
  );

  const renderDetailHeader = (title, subtitle = "") => (
    <>
      <button type="button" onClick={() => setActiveDetailView("ticket")} className="flex min-h-10 items-center gap-2 rounded-xl px-1 py-1.5 text-base font-semibold text-blue-950">
        <ArrowLeft size={18} aria-hidden="true" /> Back to Ticket
      </button>
      <div className="mt-5">
        <h1 className="break-words text-3xl font-extrabold leading-tight text-blue-950 sm:text-4xl">{title}</h1>
        {subtitle && <p className="mt-1.5 break-words text-base font-semibold text-slate-600">{subtitle}</p>}
      </div>
    </>
  );

  const renderChargesHeader = () => (
    <>
      <button type="button" onClick={() => setActiveDetailView("ticket")} className="flex min-h-10 items-center gap-2 rounded-xl px-1 py-1.5 text-base font-semibold text-blue-950">
        <ArrowLeft size={18} aria-hidden="true" /> Back to Work Items
      </button>
      <div className="mt-5">
        <h1 className="break-words text-3xl font-extrabold leading-tight text-blue-950 sm:text-4xl">Charges</h1>
        <p className="mt-1.5 break-words text-base font-semibold text-slate-600">Add and review ticket charges.</p>
      </div>
    </>
  );

  const renderCustomerHistoryView = () => (
    <div className="min-w-0 space-y-5">
      {renderDetailHeader("Previous Tickets", `${ticket.customerName ?? "Customer"}${ticket.mobileNumber ? ` • ${ticket.mobileNumber}` : ""}`)}
      <section className="rounded-2xl border border-blue-100 bg-white p-3.5 shadow-sm">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <ListChecks className="text-blue-700" size={24} aria-hidden="true" />
            <p className="font-semibold text-slate-700">{customerHistoryLoading ? "Loading..." : `${customerHistoryCount} ticket${customerHistoryCount === 1 ? "" : "s"} found`}</p>
          </div>
          <button type="button" className="inline-flex items-center gap-2 rounded-xl px-2 py-1.5 text-sm font-semibold text-blue-700">
            <SlidersHorizontal size={20} aria-hidden="true" /> Filter
          </button>
        </div>
      </section>
      {customerHistoryError && <p className="rounded-xl bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">{customerHistoryError}</p>}
      {!customerHistoryLoading && !customerHistoryError && customerHistory.length === 0 && (
        <p className="rounded-xl border border-blue-100 bg-white px-4 py-3 text-sm font-semibold text-slate-600">No previous tickets found.</p>
      )}
      <div className="divide-y divide-blue-100">
        {customerHistory.map((historyTicket) => (
          <button key={historyTicket.id ?? historyTicket.ticketNumber} type="button" onClick={() => navigate(`/tickets/${historyTicket.id}${location.search}`)} className="flex min-h-20 w-full items-center gap-4 py-3 text-left">
            <IconBubble icon={Box} className="h-12 w-12" />
            <span className="min-w-0 flex-1">
              <span className="flex flex-wrap items-center gap-2">
                <span className="text-xl font-extrabold text-blue-950">{historyTicket.ticketNumber ?? "Not available"}</span>
                <span className={`rounded-full px-2.5 py-1 text-xs font-bold ${historyTicket.status === "COMPLETED" ? "bg-green-100 text-green-700" : historyTicket.status === "CANCELLED" ? "bg-red-100 text-red-700" : "bg-blue-100 text-blue-700"}`}>
                  {formatLabel(historyTicket.status)}
                </span>
              </span>
              <span className="mt-1 block break-words text-sm font-semibold text-slate-900">{historyTicket.complaintDescription || formatLabel(historyTicket.category)}</span>
              <span className="mt-1 block text-sm font-semibold text-slate-600">{formatDate(historyTicket.createdAt)}</span>
            </span>
            <span className="shrink-0 text-xl font-extrabold text-blue-950">{formatCompactCurrency(historyTicket.totalCharge)}</span>
            <ChevronRight className="shrink-0 text-blue-700" size={22} aria-hidden="true" />
          </button>
        ))}
      </div>
    </div>
  );

  const renderTimelineView = () => (
    <div className="min-w-0 space-y-5">
      {renderDetailHeader("Ticket Timeline", `${ticket.ticketNumber ?? "Ticket"} • ${workflowHistory.length} event${workflowHistory.length === 1 ? "" : "s"}`)}
      <span className="inline-flex items-center gap-2 rounded-full bg-green-50 px-3.5 py-2 text-sm font-extrabold text-green-700">
        <CheckCircle2 size={18} aria-hidden="true" /> {workflowHistoryLoading ? "Loading events..." : `${workflowHistory.length} events loaded`}
      </span>
      {workflowHistoryError && <p className="rounded-xl bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">{workflowHistoryError}</p>}
      {!workflowHistoryLoading && !workflowHistoryError && workflowHistory.length === 0 && (
        <p className="rounded-xl border border-blue-100 bg-white px-4 py-3 text-sm font-semibold text-slate-600">No workflow history yet.</p>
      )}
      <div className="ml-5 space-y-0">
        {workflowHistory.map((historyItem, index) => {
          const itemId = historyItem.id ?? `${historyItem.actionKey}-${historyItem.createdAt}`;
          const isLast = index === workflowHistory.length - 1;
          return (
            <article key={itemId} className={`relative min-w-0 border-l-2 ${isLast ? "border-transparent" : "border-blue-200"} pb-7 pl-7 last:pb-0`}>
              <span className={`absolute -left-[13px] top-0 flex h-6 w-6 items-center justify-center rounded-full ${isLast && ticket.status === "COMPLETED" ? "bg-green-600 text-white" : "bg-blue-100 text-blue-600"}`} aria-hidden="true">
                {isLast && ticket.status === "COMPLETED" ? <Check size={16} /> : <span className="h-3 w-3 rounded-full bg-blue-500" />}
              </span>
              <h2 className={`break-words text-xl font-extrabold ${isLast && ticket.status === "COMPLETED" ? "text-green-700" : "text-blue-950"}`}>{historyItem.actionDisplayName || formatLabel(historyItem.actionKey)}</h2>
              <p className="mt-1.5 text-sm font-semibold text-slate-600">{formatDateTime(historyItem.createdAt)}</p>
              <p className="mt-2 flex items-center gap-2 text-sm font-semibold text-slate-900"><User size={18} aria-hidden="true" /> {getHistoryActor(historyItem)}</p>
              {historyItem.comment && <p className="mt-4 rounded-xl border border-blue-100 bg-white px-4 py-3 text-sm text-slate-800"><span className="font-bold text-green-700">Comment:</span> {historyItem.comment}</p>}
            </article>
          );
        })}
      </div>
      {!workflowHistoryLast && (
        <button type="button" onClick={() => loadWorkflowHistory(workflowHistoryPage + 1, false)} disabled={workflowHistoryLoadingMore} className="rounded-xl bg-blue-50 px-4 py-2 font-semibold text-blue-950 hover:bg-blue-100 disabled:opacity-60">
          {workflowHistoryLoadingMore ? "Loading..." : "Load More"}
        </button>
      )}
    </div>
  );

  const renderStatusView = () => (
    <div className="min-w-0 space-y-5">
      {renderDetailHeader("Status Details")}
      <section className="rounded-2xl border border-green-100 bg-green-50 p-3.5">
        <div className="flex items-center gap-4">
          <IconBubble icon={CheckCircle2} tone={ticket.status === "COMPLETED" ? "green" : "blue"} className="h-12 w-12" />
          <div>
            <p className="text-sm font-semibold text-slate-900">{ticket.status === "COMPLETED" ? "Completed by" : "Current status"}</p>
            <p className="mt-1 break-words text-xl font-extrabold text-green-700">{ticket.status === "COMPLETED" ? ticket.completedByEmployeeId || "Not available" : ticketStatusLabel}</p>
          </div>
        </div>
      </section>
      <section className="space-y-3">
        <p className="text-sm font-extrabold uppercase tracking-wide text-slate-600">Ticket Status</p>
        <DetailRow icon={ClipboardCheck} label="Status" value={ticketStatusLabel} tone={ticket.status === "COMPLETED" ? "green" : "slate"} />
        <p className="pt-3 text-sm font-extrabold uppercase tracking-wide text-slate-600">Ownership</p>
        <DetailRow icon={User} label="Current Owner" value={getCurrentOwnerLabel(ticket)} />
        <DetailRow icon={Calendar} label="Created Date" value={formatDate(ticket.createdAt ?? ticket.createdDate)} />
        {ticket.status === "COMPLETED" && (
          <>
            <p className="pt-3 text-sm font-extrabold uppercase tracking-wide text-slate-600">Completion</p>
            <DetailRow icon={User} label="Completed By" value={ticket.completedByEmployeeId} />
            <DetailRow icon={Clock3} label="Completed At" value={formatDateTime(ticket.completedAt)} />
            <DetailRow icon={MessageCircle} label="Completion Remark" value={ticket.completionRemark} />
          </>
        )}
        {ticket.status === "CANCELLED" && (
          <>
            <p className="pt-3 text-sm font-extrabold uppercase tracking-wide text-slate-600">Cancellation</p>
            <DetailRow icon={User} label="Cancelled By" value={ticket.cancelledByEmployeeId} />
            <DetailRow icon={Clock3} label="Cancelled At" value={formatDateTime(ticket.cancelledAt)} />
            <DetailRow icon={MessageCircle} label="Cancellation Reason" value={ticket.cancellationReason} />
          </>
        )}
      </section>
    </div>
  );

  const renderChargesView = () => (
    <div className="min-w-0 space-y-4 pb-4">
      {renderChargesHeader()}
      {renderChargeSummary()}
      {renderChargeBreakdown()}
      {canAddCharge && renderAddChargeForm()}
      {!chargeLoading && !chargeError && chargeItems.length === 0 && (
        <p className="flex items-center gap-2 px-2 text-sm font-semibold text-slate-600">
          <span className="flex h-6 w-6 items-center justify-center rounded-full border border-blue-200 text-blue-500" aria-hidden="true">i</span>
          No charges added yet.
        </p>
      )}
    </div>
  );

  const renderTicketHome = () => (
    <div className="mt-3.5 min-w-0 space-y-3.5 pb-24 sm:pb-0">
      {renderTicketSummary()}
      {renderProblemSection()}
      {statusMessage && (
        <p className={`rounded-xl px-4 py-3 text-sm font-semibold ${statusMessage.startsWith("Unable") || statusMessage.startsWith("Please") ? "bg-red-50 text-red-700" : "bg-green-50 text-green-700"}`}>
          {statusMessage}
        </p>
      )}
      {renderWorkflowActions()}
      {renderWorkItemsSection()}
      {renderMoreDetailsSection()}
      {renderStickyActions()}
    </div>
  );

  return (
    <main className="ke-page-main ticket-detail-page bg-gray-50 lg:px-8">
      <div className="mx-auto w-full max-w-4xl">
        {activeDetailView === "ticket" && (
          <button type="button" onClick={() => navigate(backTarget)} className="flex min-h-10 items-center gap-2 rounded-xl px-1 py-1.5 text-base font-semibold text-blue-950">
            <ArrowLeft size={18} aria-hidden="true" /> {backLabel}
          </button>
        )}

        {isLoading && <TicketDetailSkeleton />}
        {error && <p className="mt-6 rounded-xl bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">{error}</p>}

        {!isLoading && !error && ticket && (
          <div className="mt-4 min-w-0">
            {activeDetailView === "ticket" && renderTicketHome()}
            {activeDetailView === "customerHistory" && renderCustomerHistoryView()}
            {activeDetailView === "timeline" && renderTimelineView()}
            {activeDetailView === "status" && renderStatusView()}
            {activeDetailView === "charges" && renderChargesView()}

            {chargeActionMessage && !chargeActionMessage.startsWith("Unable") && (
              <div className="fixed inset-x-3 bottom-24 z-50 mx-auto max-w-md rounded-xl bg-blue-950 px-4 py-3 text-sm font-bold text-white shadow-2xl sm:bottom-4" role="status">
                {chargeActionMessage}
              </div>
            )}

            {showCompleteConfirmation && (
              <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 px-3 py-4 sm:items-center" role="dialog" aria-modal="true" aria-labelledby="complete-ticket-title">
                <div className="w-full max-w-md rounded-2xl bg-white p-4 shadow-2xl">
                  <h2 id="complete-ticket-title" className="text-lg font-extrabold text-blue-950">Mark this ticket completed?</h2>
                  <p className="mt-2 text-sm font-semibold text-gray-600">Use this only after the customer work is finished.</p>
                  <div className="mt-4 grid grid-cols-2 gap-2">
                    <button type="button" onClick={() => setShowCompleteConfirmation(false)} className="min-h-11 rounded-xl border border-blue-950 px-4 py-2 text-sm font-bold text-blue-950 hover:bg-blue-50">
                      Go Back
                    </button>
                    <button type="button" onClick={confirmCompleteTicket} disabled={processingKeys[`complete-${ticketId}`]} className="ke-primary-action min-h-11 rounded-xl px-4 py-2 text-sm font-bold disabled:opacity-60">
                      Mark Completed
                    </button>
                  </div>
                </div>
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

            {showAssignDialog && (
              <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 px-3 py-4 sm:items-center" role="dialog" aria-modal="true" aria-labelledby="assign-ticket-title">
                <div className="w-full max-w-md rounded-2xl bg-white p-4 shadow-2xl">
                  <h2 id="assign-ticket-title" className="text-lg font-extrabold text-blue-950">Assign Ticket</h2>
                  <dl className="mt-3 grid grid-cols-1 gap-2 rounded-xl bg-blue-50 p-3 text-sm">
                    <InfoItem label="Ticket Number">{ticket.ticketNumber}</InfoItem>
                    <InfoItem label="Current Owner">{getCurrentOwnerLabel(ticket)}</InfoItem>
                  </dl>

                  <label className="mt-4 block text-sm font-bold text-gray-700">
                    Assign To
                    <select
                      name="employeeId"
                      value={assignForm.employeeId}
                      onChange={handleAssignInput}
                      disabled={assignableEmployeesLoading || processingKeys[`assign-${ticketId}`]}
                      className="mt-2 min-h-12 w-full rounded-xl border border-gray-300 bg-white px-4 py-3 text-base outline-none focus:border-blue-950 disabled:opacity-70"
                    >
                      <option value="">{assignableEmployeesLoading ? "Loading employees..." : "Select employee"}</option>
                      {assignableEmployees.map((employee) => (
                        <option key={employee.employeeId} value={employee.employeeId}>
                          {employee.name ? `${employee.name} (${employee.employeeId})` : employee.employeeId}
                        </option>
                      ))}
                    </select>
                  </label>
                  {assignableEmployeesError && (
                    <p className="mt-2 rounded-xl bg-red-50 px-3 py-2 text-sm font-semibold text-red-700">{assignableEmployeesError}</p>
                  )}

                  <label className="mt-4 block text-sm font-bold text-gray-700">
                    Optional Note
                    <textarea
                      name="note"
                      value={assignForm.note}
                      onChange={handleAssignInput}
                      disabled={processingKeys[`assign-${ticketId}`]}
                      maxLength={1000}
                      rows={3}
                      className="mt-2 w-full resize-none rounded-xl border border-gray-300 px-4 py-3 text-base outline-none focus:border-blue-950 disabled:opacity-70"
                    />
                  </label>

                  {assignError && (
                    <p className="mt-3 rounded-xl bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">{assignError}</p>
                  )}

                  <div className="mt-4 grid grid-cols-2 gap-2">
                    <button type="button" onClick={closeAssignDialog} disabled={processingKeys[`assign-${ticketId}`]} className="min-h-11 rounded-xl border border-blue-950 px-4 py-2 text-sm font-bold text-blue-950 hover:bg-blue-50 disabled:opacity-60">
                      Cancel
                    </button>
                    <button
                      type="button"
                      onClick={assignTicket}
                      disabled={processingKeys[`assign-${ticketId}`] || assignableEmployeesLoading || Boolean(assignableEmployeesError)}
                      className="ke-primary-action min-h-11 rounded-xl px-4 py-2 text-sm font-bold disabled:opacity-60"
                    >
                      {processingKeys[`assign-${ticketId}`] ? "Assigning..." : "Assign Ticket"}
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
