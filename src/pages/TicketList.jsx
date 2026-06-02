import { useEffect, useState } from "react";
import { ArrowLeft, Eye, Filter, Phone } from "lucide-react";
import { useLocation, useNavigate, useSearchParams } from "react-router-dom";

const emptyFilters = {
  status: "",
  category: "",
  warrantyStatus: "",
  manufacturerStatus: "",
  createdFrom: "",
  createdTo: "",
  mine: false,
};

const filterOptions = {
  status: ["NEW", "PICKED", "IN_PROGRESS", "COMPLETED", "CANCELLED"],
  category: ["INSTALLATION", "BATTERY_RECHARGE", "ELECTRICAL_REPAIR", "OTHER"],
  warrantyStatus: ["NOT_CHECKED", "IN_WARRANTY", "OUT_OF_WARRANTY"],
  manufacturerStatus: ["NOT_REQUIRED", "RAISED", "IN_PROGRESS", "REPAIRED", "REPLACED", "WAITING_FOR_COMPANY_VISIT"],
};

function filtersFromSearchParams(searchParams) {
  return {
    status: searchParams.get("status") ?? "",
    category: searchParams.get("category") ?? "",
    warrantyStatus: searchParams.get("warrantyStatus") ?? "",
    manufacturerStatus: searchParams.get("manufacturerStatus") ?? "",
    createdFrom: searchParams.get("createdFrom") ?? "",
    createdTo: searchParams.get("createdTo") ?? "",
    mine: searchParams.get("mine") === "true",
  };
}

function countActiveFilters(filters) {
  return Object.values(filters).filter(Boolean).length;
}

function createUrlSearchParams(searchText, filters) {
  const params = new URLSearchParams();
  if (searchText) params.set("search", searchText);
  Object.entries(filters).forEach(([key, value]) => {
    if (value) params.set(key, String(value));
  });
  return params;
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

function TicketCard({ ticket, onViewDetails }) {
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
          <dt className="font-bold text-gray-500">Mobile Number</dt>
          <dd className="mt-1 flex items-center gap-2 text-gray-800">
            <Phone size={15} aria-hidden="true" /> {ticket.mobileNumber ?? "Not available"}
          </dd>
        </div>
        <div>
          <dt className="font-bold text-gray-500">Total Charge</dt>
          <dd className="mt-1 text-gray-800">{formatCurrency(ticket.totalCharge ?? 0)}</dd>
        </div>
        <div>
          <dt className="font-bold text-gray-500">Warranty</dt>
          <dd className="mt-1 text-gray-800">{formatLabel(ticket.warrantyStatus)}</dd>
        </div>
        <div>
          <dt className="font-bold text-gray-500">Mfg Status</dt>
          <dd className="mt-1 text-gray-800">{formatLabel(ticket.manufacturerStatus)}</dd>
        </div>
      </dl>

      <button
        type="button"
        onClick={() => onViewDetails(ticket.id)}
        className="mt-4 inline-flex items-center gap-2 rounded-2xl bg-blue-950 px-4 py-2 font-semibold text-white hover:bg-blue-900"
      >
        <Eye size={16} aria-hidden="true" /> View Details
      </button>
    </article>
  );
}

export default function TicketList() {
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams, setSearchParams] = useSearchParams();
  const [tickets, setTickets] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const [searchText, setSearchText] = useState(() => searchParams.get("search") ?? "");
  const [appliedFilters, setAppliedFilters] = useState(() => filtersFromSearchParams(searchParams));
  const [draftFilters, setDraftFilters] = useState(() => filtersFromSearchParams(searchParams));
  const [showFilters, setShowFilters] = useState(false);
  const trimmedSearchText = searchText.trim();
  const activeFilterCount = countActiveFilters(appliedFilters);
  const hasAppliedFilters = activeFilterCount > 0;
  const isSearchActive = trimmedSearchText.length >= 2;
  const requestParams = createUrlSearchParams(isSearchActive ? trimmedSearchText : "", appliedFilters);
  const requestUrl = hasAppliedFilters || isSearchActive
    ? `/volt/tickets/query?${requestParams.toString()}`
    : "/volt/tickets";

  useEffect(() => {
    const nextSearchParams = createUrlSearchParams(searchText, appliedFilters);
    if (nextSearchParams.toString() !== searchParams.toString()) {
      setSearchParams(nextSearchParams, { replace: true });
    }
  }, [appliedFilters, searchParams, searchText, setSearchParams]);

  useEffect(() => {
    const controller = new AbortController();
    setIsLoading(true);
    setError("");

    const timeoutId = setTimeout(async () => {
      try {
        const response = await fetch(requestUrl, {
          headers: {
            Authorization: `Bearer ${localStorage.getItem("token")}`,
          },
          signal: controller.signal,
        });

        if (!response.ok) throw new Error("Ticket request failed");

        const data = await response.json();
        setTickets(Array.isArray(data) ? data : []);
      } catch (requestError) {
        if (requestError.name !== "AbortError") {
          setTickets([]);
          setError("Unable to load tickets. Please try again.");
        }
      } finally {
        if (!controller.signal.aborted) {
          setIsLoading(false);
        }
      }
    }, isSearchActive ? 275 : 0);

    return () => {
      clearTimeout(timeoutId);
      controller.abort();
    };
  }, [isSearchActive, requestUrl]);

  const handleFilterInput = (event) => {
    const { checked, name, type, value } = event.target;
    setDraftFilters((current) => ({
      ...current,
      [name]: type === "checkbox" ? checked : value,
    }));
  };

  const toggleFilters = () => {
    if (!showFilters) setDraftFilters(appliedFilters);
    setShowFilters((current) => !current);
  };

  const applyFilters = () => {
    setAppliedFilters({ ...draftFilters });
    setShowFilters(false);
  };

  const clearFilters = () => {
    setDraftFilters({ ...emptyFilters });
    setAppliedFilters({ ...emptyFilters });
  };

  const loadingMessage = isSearchActive ? "Searching tickets..." : hasAppliedFilters ? "Applying filters..." : "Loading tickets...";
  const emptyMessage = isSearchActive && hasAppliedFilters
    ? "No tickets match your search and selected filters."
    : hasAppliedFilters
      ? "No tickets match the selected filters."
      : isSearchActive
        ? "No matching tickets found."
        : "No tickets found.";

  return (
    <main className="min-h-screen bg-gray-50 px-4 py-6 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-5xl">
        <button type="button" onClick={() => navigate("/employee-dashboard")} className="flex items-center gap-2 font-semibold text-blue-950">
          <ArrowLeft size={18} aria-hidden="true" /> Dashboard
        </button>

        <header className="mt-4 rounded-3xl bg-blue-950 p-5 text-white shadow-lg sm:p-7">
          <h1 className="text-2xl font-extrabold sm:text-3xl">Tickets</h1>
          <p className="mt-2 text-sm text-blue-100">Select a ticket to view details and available actions.</p>
        </header>

        <section className="mt-6 rounded-2xl border border-blue-100 bg-white p-4 shadow-sm">
          <div className="flex flex-col gap-3 sm:flex-row">
            <label htmlFor="ticket-search" className="sr-only">Search tickets</label>
            <input
              id="ticket-search"
              type="search"
              value={searchText}
              onChange={(event) => setSearchText(event.target.value)}
              placeholder="Search ticket, mobile, name, product, area"
              className="w-full rounded-xl border border-gray-300 px-4 py-3 text-sm text-gray-900 outline-none focus:border-blue-950 focus:ring-2 focus:ring-blue-100"
            />
            {searchText && (
              <button
                type="button"
                onClick={() => setSearchText("")}
                className="rounded-xl border border-blue-950 px-4 py-3 text-sm font-bold text-blue-950 hover:bg-blue-50"
              >
                Clear
              </button>
            )}
            <button
              type="button"
              onClick={toggleFilters}
              aria-expanded={showFilters}
              className="inline-flex items-center justify-center gap-2 rounded-xl border border-blue-950 px-4 py-3 text-sm font-bold text-blue-950 hover:bg-blue-50"
            >
              <Filter size={16} aria-hidden="true" /> Filters{activeFilterCount > 0 ? ` (${activeFilterCount})` : ""}
            </button>
          </div>

          {showFilters && (
            <div className="mt-4 border-t border-blue-100 pt-4">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <label className="text-sm font-semibold text-gray-700">
                  Status
                  <select name="status" value={draftFilters.status} onChange={handleFilterInput} className="mt-2 w-full rounded-xl border border-gray-300 bg-white px-4 py-3 outline-none focus:border-blue-950">
                    <option value="">All statuses</option>
                    {filterOptions.status.map((value) => <option key={value} value={value}>{formatLabel(value)}</option>)}
                  </select>
                </label>
                <label className="text-sm font-semibold text-gray-700">
                  Category
                  <select name="category" value={draftFilters.category} onChange={handleFilterInput} className="mt-2 w-full rounded-xl border border-gray-300 bg-white px-4 py-3 outline-none focus:border-blue-950">
                    <option value="">All categories</option>
                    {filterOptions.category.map((value) => <option key={value} value={value}>{formatLabel(value)}</option>)}
                  </select>
                </label>
                <label className="text-sm font-semibold text-gray-700">
                  Warranty Status
                  <select name="warrantyStatus" value={draftFilters.warrantyStatus} onChange={handleFilterInput} className="mt-2 w-full rounded-xl border border-gray-300 bg-white px-4 py-3 outline-none focus:border-blue-950">
                    <option value="">All warranty statuses</option>
                    {filterOptions.warrantyStatus.map((value) => <option key={value} value={value}>{formatLabel(value)}</option>)}
                  </select>
                </label>
                <label className="text-sm font-semibold text-gray-700">
                  Manufacturer Status
                  <select name="manufacturerStatus" value={draftFilters.manufacturerStatus} onChange={handleFilterInput} className="mt-2 w-full rounded-xl border border-gray-300 bg-white px-4 py-3 outline-none focus:border-blue-950">
                    <option value="">All manufacturer statuses</option>
                    {filterOptions.manufacturerStatus.map((value) => <option key={value} value={value}>{formatLabel(value)}</option>)}
                  </select>
                </label>
                <label className="text-sm font-semibold text-gray-700">
                  Created From
                  <input name="createdFrom" type="date" value={draftFilters.createdFrom} onChange={handleFilterInput} className="mt-2 w-full rounded-xl border border-gray-300 px-4 py-3 outline-none focus:border-blue-950" />
                </label>
                <label className="text-sm font-semibold text-gray-700">
                  Created To
                  <input name="createdTo" type="date" value={draftFilters.createdTo} onChange={handleFilterInput} className="mt-2 w-full rounded-xl border border-gray-300 px-4 py-3 outline-none focus:border-blue-950" />
                </label>
                <label className="flex items-center gap-3 text-sm font-semibold text-gray-700 sm:col-span-2">
                  <input name="mine" type="checkbox" checked={draftFilters.mine} onChange={handleFilterInput} className="h-4 w-4 rounded border-gray-300 text-blue-950 focus:ring-blue-950" />
                  My Tickets
                </label>
              </div>
              <div className="mt-4 flex flex-wrap gap-3">
                <button type="button" onClick={applyFilters} className="rounded-xl bg-blue-950 px-4 py-3 text-sm font-bold text-white hover:bg-blue-900">
                  Apply
                </button>
                <button type="button" onClick={clearFilters} className="rounded-xl border border-blue-950 px-4 py-3 text-sm font-bold text-blue-950 hover:bg-blue-50">
                  Clear Filters
                </button>
              </div>
            </div>
          )}
        </section>

        <section className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-2" aria-live="polite">
          {isLoading && <p className="text-sm font-semibold text-gray-600">{loadingMessage}</p>}
          {error && <p className="rounded-xl bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">{error}</p>}
          {!isLoading && !error && tickets.length === 0 && <p className="text-sm font-semibold text-gray-600">{emptyMessage}</p>}
          {!isLoading && !error && tickets.map((ticket) => (
            <TicketCard
              key={ticket.id ?? ticket.ticketNumber}
              ticket={ticket}
              onViewDetails={(ticketId) => navigate(`/tickets/${ticketId}${location.search}`)}
            />
          ))}
        </section>
      </div>
    </main>
  );
}
