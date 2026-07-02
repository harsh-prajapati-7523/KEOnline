import { useCallback, useEffect, useMemo, useState } from "react";
import { ArrowLeft, Phone, RefreshCw } from "lucide-react";
import { useNavigate } from "react-router-dom";

const TICKET_PAGE_SIZE = 30;
const loadingCardPlaceholders = [0, 1, 2];

function authHeaders() {
  return {
    Authorization: `Bearer ${localStorage.getItem("token")}`,
  };
}

function formatLabel(value) {
  return value ? value.replaceAll("_", " ").toLowerCase().replace(/\b\w/g, (letter) => letter.toUpperCase()) : "Not available";
}

function getTicketStatusLabel(ticket) {
  return ticket?.statusDisplayName || formatLabel(ticket?.status);
}

function getTicketCategoryLabel(ticket) {
  return ticket?.categoryDisplayName || ticket?.categoryKey || ticket?.category || "Not available";
}

function formatOptionalLabel(value) {
  if (!value) return "";
  return /_/.test(value) ? formatLabel(value) : value;
}

function formatTicketDate(value) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";

  const today = new Date();
  const time = new Intl.DateTimeFormat("en-IN", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  }).format(date);

  if (date.toDateString() === today.toDateString()) return `Today ${time}`;

  return new Intl.DateTimeFormat("en-IN", {
    day: "2-digit",
    month: "short",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  }).format(date);
}

function TicketCardSkeleton() {
  return (
    <article className="ke-ticket-card min-w-0 overflow-hidden p-3.5 sm:p-4" aria-hidden="true">
      <div className="flex items-start justify-between gap-3">
        <div className="h-5 w-32 rounded-full bg-blue-100" />
        <div className="h-6 w-20 rounded-full bg-blue-50" />
      </div>
      <div className="mt-3 h-4 w-40 rounded-full bg-gray-100" />
      <div className="mt-2 h-4 w-full rounded-full bg-gray-100" />
      <div className="mt-2 h-4 w-3/4 rounded-full bg-gray-100" />
      <div className="mt-4 h-10 rounded-xl bg-blue-100" />
    </article>
  );
}

function MyTicketCard({ ticket, onOpen }) {
  const updatedLabel = formatTicketDate(ticket.updatedAt);
  const customerName = ticket.customerName?.trim() || "Not available";
  const productType = formatOptionalLabel(ticket.productType) || "Not available";
  const villageOrArea = ticket.villageOrArea?.trim() || "Not available";
  const categoryLabel = getTicketCategoryLabel(ticket);

  return (
    <button
      type="button"
      onClick={() => onOpen(ticket.id)}
      className="ke-ticket-card min-w-0 overflow-hidden p-3.5 text-left transition hover:border-blue-300 hover:shadow-md sm:p-4"
    >
      <span className="flex min-w-0 items-start justify-between gap-3">
        <span className="min-w-0 overflow-wrap-anywhere text-[1.05rem] font-extrabold leading-tight text-blue-950 sm:text-lg">
          {ticket.ticketNumber ?? "Not available"}
        </span>
        <span className="ke-status-pill max-w-[45%] shrink-0 overflow-wrap-anywhere rounded-full px-2.5 py-1 text-xs font-bold leading-tight">
          {getTicketStatusLabel(ticket)}
        </span>
      </span>

      <span className="mt-2.5 block space-y-1 text-sm leading-snug">
        <span className="block min-w-0 overflow-wrap-anywhere text-gray-600">
          <span className="text-xs font-bold uppercase tracking-wide text-gray-400">Customer: </span>
          <span className="font-semibold text-gray-900">{customerName}</span>
        </span>
        <span className="block min-w-0 overflow-wrap-anywhere text-gray-600">
          <span className="text-xs font-bold uppercase tracking-wide text-gray-400">Product: </span>
          <span className="font-bold text-blue-950">{productType}</span>
        </span>
      </span>

      <span className="mt-2.5 grid min-w-0 grid-cols-1 gap-1.5 text-xs font-semibold text-gray-500 min-[380px]:grid-cols-2">
        <span className="flex min-w-0 items-center gap-1.5 overflow-wrap-anywhere">
          <Phone className="shrink-0" size={13} aria-hidden="true" /> {ticket.mobileNumber ?? "Not available"}
        </span>
        <span className="min-w-0 overflow-wrap-anywhere min-[380px]:text-right">Area: {villageOrArea}</span>
        <span className="min-w-0 overflow-wrap-anywhere min-[380px]:col-span-2">Category: {categoryLabel}</span>
      </span>
      <span className="mt-2.5 block border-t border-blue-50 pt-2.5 text-xs font-semibold text-gray-500">
        {updatedLabel ? `Updated: ${updatedLabel}` : "Updated time not available"}
      </span>
    </button>
  );
}

export default function MyTickets() {
  const navigate = useNavigate();
  const [tickets, setTickets] = useState([]);
  const [currentPage, setCurrentPage] = useState(0);
  const [hasMoreTickets, setHasMoreTickets] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  const [error, setError] = useState("");

  useEffect(() => {
    const controller = new AbortController();

    async function loadTickets() {
      try {
        const response = await fetch(`/volt/tickets/my?page=${currentPage}&size=${TICKET_PAGE_SIZE}`, {
          headers: authHeaders(),
          signal: controller.signal,
        });

        if (!response.ok) throw new Error("My tickets request failed");

        const data = await response.json();
        const nextTickets = Array.isArray(data) ? data : [];
        setTickets((current) => currentPage === 0 ? nextTickets : [...current, ...nextTickets]);
        setHasMoreTickets(nextTickets.length === TICKET_PAGE_SIZE);
      } catch (requestError) {
        if (requestError.name !== "AbortError") {
          if (currentPage === 0) setTickets([]);
          setError("Unable to load your tickets. Please try again.");
        }
      } finally {
        if (!controller.signal.aborted) {
          setIsLoading(false);
          setIsLoadingMore(false);
        }
      }
    }

    loadTickets();

    return () => {
      controller.abort();
    };
  }, [currentPage, refreshKey]);

  const refreshTickets = useCallback(() => {
    setIsLoading(true);
    setError("");
    setCurrentPage(0);
    setHasMoreTickets(false);
    setRefreshKey((current) => current + 1);
  }, []);

  const loadMoreTickets = useCallback(() => {
    if (isLoading || isLoadingMore || !hasMoreTickets) return;
    setIsLoadingMore(true);
    setError("");
    setCurrentPage((page) => page + 1);
  }, [hasMoreTickets, isLoading, isLoadingMore]);

  const openTicket = useCallback((ticketId) => {
    navigate(`/tickets/${ticketId}`);
  }, [navigate]);

  const summary = useMemo(() => {
    if (isLoading && tickets.length === 0) return "Loading your assigned tickets";
    return `${tickets.length} assigned ticket${tickets.length === 1 ? "" : "s"} loaded`;
  }, [isLoading, tickets.length]);

  return (
    <main id="main-content" className="ke-page-main lg:px-8">
      <div className="mx-auto w-full max-w-5xl">
        <div className="mb-3 flex min-w-0 items-center gap-2 sm:mb-5">
          <button type="button" onClick={() => navigate("/employee-dashboard")} className="flex min-h-10 shrink-0 items-center gap-1.5 rounded-xl px-1 py-1.5 font-semibold text-blue-950 sm:min-h-11 sm:gap-2 sm:py-2">
            <ArrowLeft size={18} aria-hidden="true" />
            <span className="sr-only sm:not-sr-only">Dashboard</span>
          </button>
          <div className="min-w-0 flex-1">
            <h1 className="break-words text-xl font-extrabold leading-tight text-blue-950 sm:text-2xl">My Tickets</h1>
            <p className="mt-0.5 text-xs font-semibold text-gray-500 sm:text-sm">{summary}</p>
          </div>
          <button
            type="button"
            onClick={refreshTickets}
            disabled={isLoading}
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-blue-950 bg-white text-blue-950 hover:bg-blue-50 disabled:opacity-60"
            aria-label="Refresh my tickets"
          >
            <RefreshCw size={17} aria-hidden="true" />
          </button>
        </div>

        <section className="mt-3.5 grid min-w-0 grid-cols-1 gap-3 sm:mt-5 sm:gap-4 lg:grid-cols-2" aria-live="polite">
          {isLoading && currentPage === 0 && (
            <>
              <p className="text-sm font-semibold text-gray-600 lg:col-span-2">Loading your tickets...</p>
              {loadingCardPlaceholders.map((placeholder) => (
                <TicketCardSkeleton key={placeholder} />
              ))}
            </>
          )}
          {error && <p className="rounded-xl bg-red-50 px-4 py-3 text-sm font-semibold text-red-700 lg:col-span-2">{error}</p>}
          {!isLoading && !error && tickets.length === 0 && (
            <div className="rounded-2xl border border-blue-100 bg-white px-4 py-5 shadow-sm lg:col-span-2">
              <p className="text-sm font-extrabold text-blue-950">No tickets currently assigned to you</p>
              <p className="mt-1 text-sm font-semibold text-gray-500">Refresh when you are assigned new work.</p>
            </div>
          )}
          {!isLoading && !error && tickets.map((ticket) => (
            <MyTicketCard key={ticket.id ?? ticket.ticketNumber} ticket={ticket} onOpen={openTicket} />
          ))}
        </section>

        {!isLoading && !error && tickets.length > 0 && (
          <section className="mt-4 rounded-2xl border border-blue-100 bg-white px-4 py-3 shadow-sm" aria-live="polite">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-sm font-semibold text-gray-600">{summary}</p>
              {hasMoreTickets ? (
                <button
                  type="button"
                  onClick={loadMoreTickets}
                  disabled={isLoadingMore}
                  className="min-h-12 rounded-xl bg-blue-950 px-4 py-3 text-sm font-bold text-white hover:bg-blue-900 disabled:opacity-60 sm:w-auto"
                >
                  {isLoadingMore ? "Loading..." : "Load More Tickets"}
                </button>
              ) : (
                <p className="text-sm font-semibold text-gray-500">End of results.</p>
              )}
            </div>
          </section>
        )}
      </div>
    </main>
  );
}
