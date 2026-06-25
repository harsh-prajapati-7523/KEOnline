import { useCallback, useEffect, useState } from "react";
import { ArrowLeft, Eye, Filter, Phone, X } from "lucide-react";
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
  const normalizedValue = typeof value === "string"
    ? (value.replace(/[₹,\s]/g, "").match(/^-?\d+(?:\.\d+)?/)?.[0] ?? "")
    : value;
  const amount = Number(normalizedValue);
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
  return value ? value.replaceAll("_", " ").toLowerCase().replace(/\b\w/g, (letter) => letter.toUpperCase()) : "Not available";
}

function formatOptionalLabel(value) {
  if (!value) return "";
  return /_/.test(value) ? formatLabel(value) : value;
}

function getTicketStatusLabel(ticket) {
  return ticket?.statusDisplayName || formatLabel(ticket?.status);
}

function formatTicketDate(value) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";

  const today = new Date();
  const isToday = date.toDateString() === today.toDateString();
  const time = new Intl.DateTimeFormat("en-IN", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  }).format(date);

  if (isToday) return `Today ${time}`;

  return new Intl.DateTimeFormat("en-IN", {
    day: "2-digit",
    month: "short",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  }).format(date);
}

function getTicketOwner(ticket) {
  return ticket?.pickedByEmployeeName
    || ticket?.pickedByEmployeeNameSnapshot
    || ticket?.assignedEmployeeName
    || ticket?.ownerEmployeeName
    || ticket?.technicianName
    || ticket?.pickedByEmployeeId
    || "";
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

function formatLocalDate(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function getTodayDate() {
  return formatLocalDate(new Date());
}

function getDateDaysAgo(days) {
  const date = new Date();
  date.setDate(date.getDate() - days);
  return formatLocalDate(date);
}

function getMonthStartDate() {
  const date = new Date();
  date.setDate(1);
  return formatLocalDate(date);
}

function TicketCard({ ticket, onViewDetails }) {
  const productType = formatOptionalLabel(ticket.productType);
  const complaintPreview = ticket.complaintDescription?.trim() ?? "";
  const villageOrArea = ticket.villageOrArea?.trim() ?? "";
  const createdLabel = formatTicketDate(ticket.createdAt ?? ticket.createdDate);
  const ownerLabel = getTicketOwner(ticket);
  const hasIssueLine = productType || complaintPreview;

  return (
    <article className="ke-ticket-card min-w-0 overflow-hidden p-3.5 sm:p-4">
      <div className="flex min-w-0 items-start justify-between gap-3">
        <h2 className="min-w-0 overflow-wrap-anywhere text-[1.05rem] font-extrabold leading-tight text-blue-950 sm:text-lg">{ticket.ticketNumber ?? "Not available"}</h2>
        <span className="ke-status-pill max-w-[45%] shrink-0 overflow-wrap-anywhere rounded-full px-2.5 py-1 text-xs font-bold leading-tight">
          {getTicketStatusLabel(ticket)}
        </span>
      </div>

      <p className="mt-2.5 overflow-wrap-anywhere text-sm font-semibold leading-snug text-gray-800">{ticket.customerName ?? "Not available"}</p>
      {hasIssueLine && (
        <p className="mt-1.5 line-clamp-2 min-w-0 overflow-hidden text-sm leading-snug text-gray-700">
          {productType && <span className="font-bold text-blue-950">{productType}</span>}
          {productType && complaintPreview && <span className="text-gray-400"> - </span>}
          {complaintPreview && <span>{complaintPreview}</span>}
        </p>
      )}
      <div className="mt-2.5 grid min-w-0 grid-cols-1 gap-1.5 text-xs font-semibold text-gray-500 min-[380px]:grid-cols-2">
        <span className="flex min-w-0 items-center gap-1.5 overflow-wrap-anywhere">
          <Phone className="shrink-0" size={13} aria-hidden="true" /> {ticket.mobileNumber ?? "Not available"}
        </span>
        {villageOrArea && <span className="min-w-0 overflow-wrap-anywhere min-[380px]:text-right">Area: {villageOrArea}</span>}
        {ownerLabel && <span className="min-w-0 overflow-wrap-anywhere min-[380px]:col-span-2">Owner: {ownerLabel}</span>}
      </div>
      <div className="mt-2.5 flex min-w-0 items-center justify-between gap-3 border-t border-blue-50 pt-2.5">
        <span className="min-w-0 overflow-wrap-anywhere text-xs font-semibold text-gray-500">
          {createdLabel ? `Created: ${createdLabel}` : "Newest first"}
        </span>
        <span className="shrink-0 text-base font-extrabold text-blue-950">{formatCurrency(ticket.totalCharge)}</span>
      </div>

      <button
        type="button"
        onClick={() => onViewDetails(ticket.id)}
        className="ke-primary-action mt-3.5 inline-flex min-h-10 w-full items-center justify-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold sm:w-auto"
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
    ? `No tickets found for "${effectiveSearchText}"`
    : hasAppliedFilters
      ? "No tickets match the selected filters."
      : isSearchActive
        ? `No tickets found for "${effectiveSearchText}"`
        : "No tickets yet";
  const emptyHint = isSearchActive
    ? "Try searching by ticket number, customer name, mobile number, or area."
    : hasAppliedFilters
      ? "Try clearing filters or changing the selected options."
      : "Create a ticket to get started.";
  const resultSummary = isSearchActive
    ? `Showing ${tickets.length} result${tickets.length === 1 ? "" : "s"} for "${effectiveSearchText}"`
    : hasAppliedFilters
      ? `Showing ${tickets.length} filtered ticket${tickets.length === 1 ? "" : "s"}`
      : "Showing newest tickets first";
  const appliedFilterChips = [
    effectiveFilters.mine ? { key: "mine", label: "My Tickets" } : null,
    effectiveFilters.status ? { key: "status", label: formatLabel(effectiveFilters.status) } : null,
    effectiveFilters.category ? { key: "category", label: formatLegacyCategory(effectiveFilters.category) } : null,
    effectiveFilters.createdFrom ? { key: "createdFrom", label: `From ${effectiveFilters.createdFrom}` } : null,
    effectiveFilters.createdTo ? { key: "createdTo", label: `To ${effectiveFilters.createdTo}` } : null,
  ].filter(Boolean);

  const removeAppliedFilter = (filterKey) => {
    const nextFilters = { ...appliedFilters, [filterKey]: filterKey === "mine" ? false : "" };
    setAppliedFilters(nextFilters);
    setDraftFilters(nextFilters);
  };

  const setDateRange = (range) => {
    const today = getTodayDate();
    if (range === "today") {
      setDraftFilters((current) => ({ ...current, createdFrom: today, createdTo: today }));
      return;
    }

    if (range === "last7") {
      setDraftFilters((current) => ({ ...current, createdFrom: getDateDaysAgo(6), createdTo: today }));
      return;
    }

    if (range === "month") {
      setDraftFilters((current) => ({ ...current, createdFrom: getMonthStartDate(), createdTo: today }));
    }
  };

  return (
    <main className="ke-page-main lg:px-8">
      <div className="mx-auto w-full max-w-5xl">
        <div className="mb-3 flex min-w-0 items-center gap-2 sm:mb-5">
          <button type="button" onClick={() => navigate("/employee-dashboard")} className="flex min-h-10 shrink-0 items-center gap-1.5 rounded-xl px-1 py-1.5 font-semibold text-blue-950 sm:min-h-11 sm:gap-2 sm:py-2">
            <ArrowLeft size={18} aria-hidden="true" />
            <span className="sr-only sm:not-sr-only">Dashboard</span>
          </button>
          <div className="min-w-0 flex-1">
            <h1 className="break-words text-xl font-extrabold leading-tight text-blue-950 sm:text-2xl">Tickets</h1>
            <p className="mt-0.5 text-xs font-semibold text-gray-500 sm:text-sm">Search, filter, and open service tickets.</p>
          </div>
        </div>

        {(canUseSearch || canUseFilters) && <section className="ke-ticket-toolbar min-w-0 p-2.5 sm:p-4">
          <div className="flex items-center gap-2">
            {canUseSearch && (
              <>
                <label htmlFor="ticket-search" className="sr-only">Search tickets</label>
                <input
                  id="ticket-search"
                  type="search"
                  value={searchText}
                  onChange={(event) => setSearchText(event.target.value)}
                  placeholder="Search by ticket no, name, mobile, area"
                  className="ke-ticket-search-input min-h-11 min-w-0 flex-1 rounded-xl border px-3.5 py-2.5 text-base text-gray-900 outline-none sm:min-h-12 sm:px-4 sm:py-3 sm:text-sm"
                />
              </>
            )}
            {canUseSearch && searchText && (
              <button
                type="button"
                onClick={() => setSearchText("")}
                className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-blue-100 bg-white text-blue-950 hover:bg-blue-50 sm:h-12 sm:w-12"
                aria-label="Clear search"
              >
                <X size={17} aria-hidden="true" />
              </button>
            )}
            {canUseFilters && (
              <button
                type="button"
                onClick={toggleFilters}
                aria-expanded={showFilters}
                className="relative inline-flex h-11 min-w-11 shrink-0 items-center justify-center gap-1.5 rounded-xl border border-blue-950 bg-white px-3 text-sm font-bold text-blue-950 hover:bg-blue-50 sm:h-12 sm:px-4"
                aria-label={`Filters${activeFilterCount > 0 ? `, ${activeFilterCount} active` : ""}`}
              >
                <Filter size={16} aria-hidden="true" />
                <span className={activeFilterCount > 0 ? "hidden min-[380px]:inline" : "hidden sm:inline"}>Filters</span>{activeFilterCount > 0 ? ` ${activeFilterCount}` : ""}
                {activeFilterCount > 0 && <span className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-yellow-400 px-1 text-[0.65rem] font-extrabold text-black">{activeFilterCount}</span>}
              </button>
            )}
          </div>

          {canUseFilters && appliedFilterChips.length > 0 && (
            <div className="mt-2 flex min-w-0 flex-wrap gap-2" aria-label="Active filters">
              {appliedFilterChips.map((chip) => (
                <button
                  key={chip.key}
                  type="button"
                  onClick={() => removeAppliedFilter(chip.key)}
                  className="inline-flex min-h-9 max-w-full items-center gap-1.5 rounded-full bg-blue-50 px-3 py-1.5 text-xs font-bold text-blue-950 hover:bg-blue-100"
                  aria-label={`Remove ${chip.label} filter`}
                >
                  <span className="min-w-0 overflow-wrap-anywhere">{chip.label}</span>
                  <X size={14} aria-hidden="true" />
                </button>
              ))}
            </div>
          )}

          {canUseFilters && showFilters && (
              <div className="ticket-filter-panel mt-3 border-t border-blue-100 pb-[calc(6rem+env(safe-area-inset-bottom))] pt-3 sm:mt-4 sm:pb-0 sm:pt-4">
              <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2 sm:gap-4">
                <label className="flex min-h-11 items-center gap-3 rounded-xl border border-blue-100 bg-blue-50 px-3 py-2 text-sm font-semibold text-blue-950 sm:col-span-2">
                  <input name="mine" type="checkbox" checked={draftFilters.mine} onChange={handleFilterInput} className="h-5 w-5 rounded border-gray-300 text-blue-950 focus:ring-blue-950" />
                  My Tickets
                </label>
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
                <div className="sm:col-span-2">
                  <p className="text-sm font-semibold text-gray-700">Date Range</p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    <button type="button" onClick={() => setDateRange("today")} className="min-h-9 rounded-full border border-blue-100 px-3 py-1.5 text-xs font-bold text-blue-950 hover:bg-blue-50">
                      Today
                    </button>
                    <button type="button" onClick={() => setDateRange("last7")} className="min-h-9 rounded-full border border-blue-100 px-3 py-1.5 text-xs font-bold text-blue-950 hover:bg-blue-50">
                      Last 7 Days
                    </button>
                    <button type="button" onClick={() => setDateRange("month")} className="min-h-9 rounded-full border border-blue-100 px-3 py-1.5 text-xs font-bold text-blue-950 hover:bg-blue-50">
                      This Month
                    </button>
                  </div>
                  <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <label className="text-sm font-semibold text-gray-700">
                      From Date
                      <input name="createdFrom" type="date" value={draftFilters.createdFrom} onChange={handleFilterInput} className="mt-2 min-h-12 w-full rounded-xl border border-gray-300 px-4 py-3 text-base outline-none focus:border-blue-950" />
                    </label>
                    <label className="text-sm font-semibold text-gray-700">
                      To Date
                      <input name="createdTo" type="date" value={draftFilters.createdTo} onChange={handleFilterInput} className="mt-2 min-h-12 w-full rounded-xl border border-gray-300 px-4 py-3 text-base outline-none focus:border-blue-950" />
                    </label>
                  </div>
                </div>
              </div>
              <div className="filter-actions sticky bottom-[calc(5.25rem+env(safe-area-inset-bottom))] z-10 mt-4 grid grid-cols-2 gap-2 border-t border-blue-100 bg-white py-3 sm:static sm:flex sm:flex-wrap sm:border-t-0 sm:py-0">
                <button type="button" onClick={clearFilters} className="min-h-11 rounded-xl border border-blue-950 px-4 py-2.5 text-sm font-bold text-blue-950 hover:bg-blue-50">
                  Clear Filters
                </button>
                <button type="button" onClick={applyFilters} className="min-h-11 rounded-xl bg-blue-950 px-4 py-2.5 text-sm font-bold text-white hover:bg-blue-900">
                  Apply
                </button>
              </div>
            </div>
          )}
        </section>}

        <section className="mt-3.5 grid min-w-0 grid-cols-1 gap-3 sm:mt-5 sm:gap-4 lg:grid-cols-2" aria-live="polite">
          {isLoading && <p className="text-sm font-semibold text-gray-600">{loadingMessage}</p>}
          {error && <p className="rounded-xl bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">{error}</p>}
          {!isLoading && !error && tickets.length === 0 && (
            <div className="rounded-2xl border border-blue-100 bg-white px-4 py-5 shadow-sm">
              <p className="text-sm font-extrabold text-blue-950">{emptyMessage}</p>
              <p className="mt-1 text-sm font-semibold text-gray-500">{emptyHint}</p>
            </div>
          )}
          {!isLoading && !error && tickets.map((ticket) => (
            <TicketCard
              key={ticket.id ?? ticket.ticketNumber}
              ticket={ticket}
              onViewDetails={(ticketId) => navigate(`/tickets/${ticketId}${location.search}`)}
            />
          ))}
        </section>
        {!isLoading && !error && tickets.length > 0 && (
          <section className="mt-4 rounded-2xl border border-blue-100 bg-white px-4 py-3 shadow-sm" aria-live="polite">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-sm font-semibold text-gray-600">
                {resultSummary}
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
