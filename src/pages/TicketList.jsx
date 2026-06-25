import { useCallback, useEffect, useState } from "react";
import { ArrowLeft, Eye, Filter, Phone } from "lucide-react";
import { useLocation, useNavigate, useSearchParams } from "react-router-dom";
import { hasAccess } from "../utils/access";

const emptyFilters = {
  status: "",
  category: "",
  createdFrom: "",
  createdTo: "",
  mine: false,
};

const fallbackStatusFilterOptions = [
  { statusKey: "NEW", displayName: "New" },
  { statusKey: "PICKED", displayName: "Picked" },
  { statusKey: "IN_PROGRESS", displayName: "In Progress" },
  { statusKey: "COMPLETED", displayName: "Completed" },
  { statusKey: "CANCELLED", displayName: "Cancelled" },
];

const TICKET_PAGE_SIZE = 100;

function filtersFromSearchParams(searchParams) {
  return {
    status: searchParams.get("status") ?? "",
    category: searchParams.get("category") ?? "",
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

function appendPagingParams(params, page) {
  const nextParams = new URLSearchParams(params);
  nextParams.set("page", String(page));
  nextParams.set("size", String(TICKET_PAGE_SIZE));
  return nextParams;
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

function normalizeStatusFilterOptions(data) {
  const source = Array.isArray(data) ? data : Array.isArray(data?.options) ? data.options : [];
  return source
    .filter((option) => option?.statusKey)
    .map((option) => ({
      statusKey: option.statusKey,
      displayName: option.displayName || formatLabel(option.statusKey),
    }));
}

function formatCategoryOption(category) {
  if (!category?.categoryKey) return "Not available";
  return category.displayName ? `${category.displayName} (${category.categoryKey})` : category.categoryKey;
}

function formatStatusOption(option) {
  return option?.displayName ? `${option.displayName}` : formatLabel(option?.statusKey);
}

function formatLegacyCategory(value) {
  return value ? `${formatLabel(value)} (${value})` : "Not available";
}

function TicketCard({ ticket, onViewDetails }) {
  return (
    <article className="min-w-0 overflow-hidden rounded-2xl border border-blue-100 bg-white p-4 shadow-sm sm:p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs font-bold uppercase text-gray-500">Ticket Number</p>
          <h2 className="mt-1 overflow-wrap-anywhere text-lg font-extrabold text-blue-950">{ticket.ticketNumber ?? "Not available"}</h2>
        </div>
        <span className="max-w-full overflow-wrap-anywhere rounded-full bg-blue-50 px-3 py-1 text-xs font-bold text-blue-950">
          {getTicketStatusLabel(ticket)}
        </span>
      </div>

      <dl className="mt-4 grid min-w-0 grid-cols-1 gap-3 text-sm sm:grid-cols-2">
        <div className="min-w-0">
          <dt className="font-bold text-gray-500">Customer Name</dt>
          <dd className="mt-1 overflow-wrap-anywhere text-gray-800">{ticket.customerName ?? "Not available"}</dd>
        </div>
        <div className="min-w-0">
          <dt className="font-bold text-gray-500">Mobile Number</dt>
          <dd className="mt-1 flex min-w-0 items-center gap-2 overflow-wrap-anywhere text-gray-800">
            <Phone className="shrink-0" size={15} aria-hidden="true" /> {ticket.mobileNumber ?? "Not available"}
          </dd>
        </div>
        <div className="min-w-0">
          <dt className="font-bold text-gray-500">Total Charge</dt>
          <dd className="mt-1 text-gray-800">{formatCurrency(ticket.totalCharge ?? 0)}</dd>
        </div>
      </dl>

      <button
        type="button"
        onClick={() => onViewDetails(ticket.id)}
        className="mt-4 inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-2xl bg-blue-950 px-4 py-2 font-semibold text-white hover:bg-blue-900 sm:w-auto"
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
  const [currentPage, setCurrentPage] = useState(0);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [hasMoreTickets, setHasMoreTickets] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const [searchText, setSearchText] = useState(() => searchParams.get("search") ?? "");
  const [appliedFilters, setAppliedFilters] = useState(() => filtersFromSearchParams(searchParams));
  const [draftFilters, setDraftFilters] = useState(() => filtersFromSearchParams(searchParams));
  const [showFilters, setShowFilters] = useState(false);
  const [statusFilterOptions, setStatusFilterOptions] = useState(fallbackStatusFilterOptions);
  const [isLoadingStatusOptions, setIsLoadingStatusOptions] = useState(true);
  const [statusOptionsError, setStatusOptionsError] = useState("");
  const [categories, setCategories] = useState([]);
  const [isLoadingCategories, setIsLoadingCategories] = useState(true);
  const [categoryError, setCategoryError] = useState("");
  const canUseSearch = hasAccess("USE_TICKET_SEARCH");
  const canUseFilters = hasAccess("USE_TICKET_FILTERS");
  const trimmedSearchText = searchText.trim();
  const effectiveSearchText = canUseSearch ? trimmedSearchText : "";
  const effectiveFilters = canUseFilters ? appliedFilters : emptyFilters;
  const activeFilterCount = countActiveFilters(effectiveFilters);
  const hasAppliedFilters = activeFilterCount > 0;
  const isSearchActive = effectiveSearchText.length >= 2;
  const requestParams = createUrlSearchParams(isSearchActive ? effectiveSearchText : "", effectiveFilters);
  const requestKey = `${hasAppliedFilters || isSearchActive ? "query" : "list"}:${requestParams.toString()}`;
  const pagedRequestParams = appendPagingParams(requestParams, currentPage);
  const requestUrl = hasAppliedFilters || isSearchActive
    ? `/volt/tickets/query?${pagedRequestParams.toString()}`
    : `/volt/tickets?${pagedRequestParams.toString()}`;
  const selectedStatus = draftFilters.status;
  const selectedStatusInOptions = !selectedStatus || statusFilterOptions.some((option) => option.statusKey === selectedStatus);
  const selectedCategory = draftFilters.category;
  const selectedCategoryInOptions = !selectedCategory || categories.some((category) => category.categoryKey === selectedCategory);

  const loadStatusFilterOptions = useCallback(async () => {
    if (!canUseFilters) {
      setStatusFilterOptions(fallbackStatusFilterOptions);
      setStatusOptionsError("");
      setIsLoadingStatusOptions(false);
      return;
    }

    setIsLoadingStatusOptions(true);
    setStatusOptionsError("");

    try {
      const response = await fetch("/volt/tickets/status-filter-options", {
        headers: {
          Authorization: `Bearer ${localStorage.getItem("token")}`,
        },
      });

      if (!response.ok) throw new Error("Status filter options request failed");

      const data = await response.json();
      const options = normalizeStatusFilterOptions(data);
      setStatusFilterOptions(options.length > 0 ? options : fallbackStatusFilterOptions);
    } catch {
      setStatusFilterOptions(fallbackStatusFilterOptions);
      setStatusOptionsError("Unable to load status filter options. Showing default statuses.");
    } finally {
      setIsLoadingStatusOptions(false);
    }
  }, [canUseFilters]);

  const loadCategories = useCallback(async () => {
    if (!canUseFilters) {
      setCategories([]);
      setCategoryError("");
      setIsLoadingCategories(false);
      return;
    }

    setIsLoadingCategories(true);
    setCategoryError("");

    try {
      const response = await fetch("/volt/ticket-categories", {
        headers: {
          Authorization: `Bearer ${localStorage.getItem("token")}`,
        },
      });

      if (!response.ok) throw new Error("Category request failed");

      const data = await response.json();
      setCategories(Array.isArray(data) ? data.filter((category) => category.active) : []);
    } catch {
      setCategories([]);
      setCategoryError("Unable to load categories.");
    } finally {
      setIsLoadingCategories(false);
    }
  }, [canUseFilters]);

  useEffect(() => {
    const nextSearchParams = createUrlSearchParams(canUseSearch ? searchText : "", canUseFilters ? appliedFilters : emptyFilters);
    if (nextSearchParams.toString() !== searchParams.toString()) {
      setSearchParams(nextSearchParams, { replace: true });
    }
  }, [appliedFilters, canUseFilters, canUseSearch, searchParams, searchText, setSearchParams]);

  useEffect(() => {
    setCurrentPage(0);
    setHasMoreTickets(false);
  }, [requestKey]);

  useEffect(() => {
    loadStatusFilterOptions();
    loadCategories();
  }, [loadCategories, loadStatusFilterOptions]);

  useEffect(() => {
    const controller = new AbortController();
    if (currentPage === 0) {
      setIsLoading(true);
    } else {
      setIsLoadingMore(true);
    }
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
        const nextTickets = Array.isArray(data) ? data : [];
        setTickets((current) => currentPage === 0 ? nextTickets : [...current, ...nextTickets]);
        setHasMoreTickets(nextTickets.length === TICKET_PAGE_SIZE);
      } catch (requestError) {
        if (requestError.name !== "AbortError") {
          if (currentPage === 0) setTickets([]);
          setError("Unable to load tickets. Please try again.");
        }
      } finally {
        if (!controller.signal.aborted) {
          setIsLoading(false);
          setIsLoadingMore(false);
        }
      }
    }, isSearchActive ? 275 : 0);

    return () => {
      clearTimeout(timeoutId);
      controller.abort();
    };
  }, [currentPage, isSearchActive, requestUrl]);

  const handleFilterInput = (event) => {
    const { checked, name, type, value } = event.target;
    setDraftFilters((current) => ({
      ...current,
      [name]: type === "checkbox" ? checked : value,
    }));
  };

  const toggleFilters = () => {
    if (!canUseFilters) return;
    if (!showFilters) setDraftFilters(appliedFilters);
    setShowFilters((current) => !current);
  };

  const applyFilters = () => {
    if (!canUseFilters) return;
    setAppliedFilters({ ...draftFilters });
    setShowFilters(false);
  };

  const clearFilters = () => {
    setDraftFilters({ ...emptyFilters });
    setAppliedFilters({ ...emptyFilters });
  };

  const loadMoreTickets = () => {
    if (isLoading || isLoadingMore || !hasMoreTickets) return;
    setCurrentPage((page) => page + 1);
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
    <main className="min-h-screen w-full overflow-x-hidden bg-gray-50 px-3 py-6 sm:px-6 lg:px-8">
      <div className="mx-auto w-full max-w-5xl">
        <button type="button" onClick={() => navigate("/employee-dashboard")} className="flex min-h-11 items-center gap-2 rounded-xl px-1 py-2 font-semibold text-blue-950">
          <ArrowLeft size={18} aria-hidden="true" /> Dashboard
        </button>

        <header className="mt-4 rounded-2xl bg-blue-950 p-5 text-white shadow-lg sm:rounded-3xl sm:p-7">
          <h1 className="break-words text-2xl font-extrabold sm:text-3xl">Tickets</h1>
          <p className="mt-2 text-sm text-blue-100">Select a ticket to view details and available actions.</p>
        </header>

        {(canUseSearch || canUseFilters) && <section className="mt-6 min-w-0 rounded-2xl border border-blue-100 bg-white p-4 shadow-sm">
          <div className="mobile-full-width-actions flex flex-col gap-3 sm:flex-row">
            {canUseSearch && (
              <>
                <label htmlFor="ticket-search" className="sr-only">Search tickets</label>
                <input
                  id="ticket-search"
                  type="search"
                  value={searchText}
                  onChange={(event) => setSearchText(event.target.value)}
                  placeholder="Search ticket, mobile, name, product, area"
                  className="min-h-12 w-full min-w-0 rounded-xl border border-gray-300 px-4 py-3 text-base text-gray-900 outline-none focus:border-blue-950 focus:ring-2 focus:ring-blue-100 sm:text-sm"
                />
              </>
            )}
            {canUseSearch && searchText && (
              <button
                type="button"
                onClick={() => setSearchText("")}
                className="min-h-12 rounded-xl border border-blue-950 px-4 py-3 text-sm font-bold text-blue-950 hover:bg-blue-50"
              >
                Clear
              </button>
            )}
            {canUseFilters && (
              <button
                type="button"
                onClick={toggleFilters}
                aria-expanded={showFilters}
                className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl border border-blue-950 px-4 py-3 text-sm font-bold text-blue-950 hover:bg-blue-50"
              >
                <Filter size={16} aria-hidden="true" /> Filters{activeFilterCount > 0 ? ` (${activeFilterCount})` : ""}
              </button>
            )}
          </div>

          {canUseFilters && showFilters && (
            <div className="mt-4 border-t border-blue-100 pt-4">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <label className="text-sm font-semibold text-gray-700">
                  Status
                  <select name="status" value={draftFilters.status} onChange={handleFilterInput} className="mt-2 min-h-12 w-full rounded-xl border border-gray-300 bg-white px-4 py-3 text-base outline-none focus:border-blue-950">
                    <option value="">All statuses</option>
                    {!selectedStatusInOptions && <option value={selectedStatus}>{formatLabel(selectedStatus)}</option>}
                    {statusFilterOptions.map((option) => (
                      <option key={option.statusKey} value={option.statusKey}>{formatStatusOption(option)}</option>
                    ))}
                  </select>
                  {isLoadingStatusOptions && <p className="mt-1 text-xs font-semibold text-gray-500">Loading status options...</p>}
                  {statusOptionsError && <p className="mt-1 text-xs font-semibold text-yellow-700">{statusOptionsError}</p>}
                </label>
                <label className="text-sm font-semibold text-gray-700">
                  Category
                  <select name="category" value={draftFilters.category} onChange={handleFilterInput} className="mt-2 min-h-12 w-full rounded-xl border border-gray-300 bg-white px-4 py-3 text-base outline-none focus:border-blue-950">
                    <option value="">All categories</option>
                    {!selectedCategoryInOptions && <option value={selectedCategory}>{formatLegacyCategory(selectedCategory)}</option>}
                    {categories.map((category) => (
                      <option key={category.id ?? category.categoryKey} value={category.categoryKey}>
                        {formatCategoryOption(category)}
                      </option>
                    ))}
                  </select>
                  {isLoadingCategories && <p className="mt-1 text-xs font-semibold text-gray-500">Loading categories...</p>}
                  {categoryError && <p className="mt-1 text-xs font-semibold text-red-600">{categoryError}</p>}
                  {!isLoadingCategories && !categoryError && categories.length === 0 && (
                    <p className="mt-1 text-xs font-semibold text-yellow-700">No active categories available.</p>
                  )}
                </label>
                <label className="text-sm font-semibold text-gray-700">
                  Created From
                  <input name="createdFrom" type="date" value={draftFilters.createdFrom} onChange={handleFilterInput} className="mt-2 min-h-12 w-full rounded-xl border border-gray-300 px-4 py-3 text-base outline-none focus:border-blue-950" />
                </label>
                <label className="text-sm font-semibold text-gray-700">
                  Created To
                  <input name="createdTo" type="date" value={draftFilters.createdTo} onChange={handleFilterInput} className="mt-2 min-h-12 w-full rounded-xl border border-gray-300 px-4 py-3 text-base outline-none focus:border-blue-950" />
                </label>
                <label className="flex min-h-11 items-center gap-3 text-sm font-semibold text-gray-700 sm:col-span-2">
                  <input name="mine" type="checkbox" checked={draftFilters.mine} onChange={handleFilterInput} className="h-5 w-5 rounded border-gray-300 text-blue-950 focus:ring-blue-950" />
                  My Tickets
                </label>
              </div>
              <div className="mobile-full-width-actions mt-4 flex flex-wrap gap-3">
                <button type="button" onClick={applyFilters} className="min-h-12 rounded-xl bg-blue-950 px-4 py-3 text-sm font-bold text-white hover:bg-blue-900">
                  Apply
                </button>
                <button type="button" onClick={clearFilters} className="min-h-12 rounded-xl border border-blue-950 px-4 py-3 text-sm font-bold text-blue-950 hover:bg-blue-50">
                  Clear Filters
                </button>
              </div>
            </div>
          )}
        </section>}

        <section className="mt-6 grid min-w-0 grid-cols-1 gap-4 lg:grid-cols-2" aria-live="polite">
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
        {!isLoading && !error && tickets.length > 0 && (
          <section className="mt-5 rounded-2xl border border-blue-100 bg-white px-4 py-3 shadow-sm" aria-live="polite">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-sm font-semibold text-gray-600">
                Showing {tickets.length} ticket{tickets.length === 1 ? "" : "s"} in pages of up to {TICKET_PAGE_SIZE}. Newest matching tickets appear first.
              </p>
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
