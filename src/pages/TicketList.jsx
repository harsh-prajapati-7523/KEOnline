import { lazy, memo, Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ArrowLeft, Eye, Filter, X } from "lucide-react";
import { useLocation, useNavigate, useSearchParams } from "react-router-dom";
import { hasAccess } from "../utils/access";

const TicketFilterPanel = lazy(() => import("../components/TicketFilterPanel"));

let ticketDetailImportPromise;
function preloadTicketDetail() {
  ticketDetailImportPromise ??= import("./TicketDetail");
  return ticketDetailImportPromise;
}

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

const TICKET_PAGE_SIZE = 30;
const loadingCardPlaceholders = [0, 1, 2];

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

function getTicketCategoryLabel(ticket) {
  return ticket?.categoryDisplayName || ticket?.categoryKey || ticket?.category || "Not available";
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

const TicketCard = memo(function TicketCard({ ticket, onPreloadDetails, onViewDetails }) {
  const productType = formatOptionalLabel(ticket.productType) || "Not available";
  const customerName = ticket.customerName?.trim() || "Not available";
  const mobileNumber = ticket.mobileNumber?.trim() || "Not available";
  const villageOrArea = ticket.villageOrArea?.trim() || "Not available";
  const categoryLabel = getTicketCategoryLabel(ticket);

  return (
    <article className="ke-ticket-card min-w-0 overflow-hidden p-3.5 sm:p-4">
      <div className="flex min-w-0 items-start justify-between gap-3">
        <h2 className="min-w-0 overflow-wrap-anywhere text-[1.05rem] font-extrabold leading-tight text-blue-950 sm:text-lg">
          {ticket.ticketNumber ?? "Not available"} <span className="font-bold text-gray-400">|</span> <span className="text-[0.7rem] font-semibold text-gray-700 sm:text-[0.85rem]">{categoryLabel}</span>
        </h2>
        <span className="ke-status-pill max-w-[45%] shrink-0 overflow-wrap-anywhere rounded-full px-2.5 py-1 text-xs font-bold leading-tight">
          {getTicketStatusLabel(ticket)}
        </span>
      </div>

      <div className="mt-2.5 space-y-1.5 text-sm leading-snug">
        <p className="min-w-0 overflow-wrap-anywhere text-gray-600">
          <span className="text-xs font-bold uppercase tracking-wide text-gray-400">Customer: </span>
          <span className="font-semibold text-gray-900">{customerName} ({mobileNumber})</span>
        </p>
        <p className="min-w-0 overflow-wrap-anywhere text-gray-700">
          <span className="inline-block min-w-[4.7rem] text-xs font-bold uppercase tracking-wide text-gray-400">Area</span>
          <span className="font-semibold text-gray-900">: {villageOrArea}</span>
        </p>
        <p className="min-w-0 overflow-wrap-anywhere text-gray-700">
          <span className="inline-block min-w-[4.7rem] text-xs font-bold uppercase tracking-wide text-gray-400">Product</span>
          <span className="font-bold text-blue-950">: {productType}</span>
        </p>
      </div>

      <button
        type="button"
        onFocus={onPreloadDetails}
        onPointerEnter={onPreloadDetails}
        onPointerDown={onPreloadDetails}
        onTouchStart={onPreloadDetails}
        onClick={() => onViewDetails(ticket.id)}
        className="ke-primary-action mt-3.5 inline-flex min-h-10 w-full items-center justify-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold sm:w-auto"
      >
        <Eye size={16} aria-hidden="true" /> View Details
      </button>
    </article>
  );
});

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
      <div className="mt-4 flex items-center justify-between gap-3 border-t border-blue-50 pt-3">
        <div className="h-3.5 w-28 rounded-full bg-gray-100" />
        <div className="h-5 w-20 rounded-full bg-blue-100" />
      </div>
      <div className="mt-4 h-10 w-full rounded-xl bg-blue-100 sm:w-36" />
    </article>
  );
}

export default function TicketList() {
  const navigate = useNavigate();
  const location = useLocation();
  const locationSearchRef = useRef(location.search);
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
  const [hasLoadedStatusOptions, setHasLoadedStatusOptions] = useState(false);
  const [isLoadingStatusOptions, setIsLoadingStatusOptions] = useState(false);
  const [statusOptionsError, setStatusOptionsError] = useState("");
  const [categories, setCategories] = useState([]);
  const [hasLoadedCategories, setHasLoadedCategories] = useState(false);
  const [isLoadingCategories, setIsLoadingCategories] = useState(false);
  const [categoryError, setCategoryError] = useState("");
  const canUseSearch = hasAccess("USE_TICKET_SEARCH");
  const canUseFilters = hasAccess("USE_TICKET_FILTERS");
  const effectiveSearchText = useMemo(() => canUseSearch ? searchText.trim() : "", [canUseSearch, searchText]);
  const effectiveFilters = useMemo(() => canUseFilters ? appliedFilters : emptyFilters, [appliedFilters, canUseFilters]);
  const activeFilterCount = useMemo(() => countActiveFilters(effectiveFilters), [effectiveFilters]);
  const hasAppliedFilters = activeFilterCount > 0;
  const isSearchActive = effectiveSearchText.length >= 2;
  const syncedSearchParams = useMemo(
    () => createUrlSearchParams(canUseSearch ? searchText : "", effectiveFilters),
    [canUseSearch, effectiveFilters, searchText],
  );
  const requestParams = useMemo(
    () => createUrlSearchParams(isSearchActive ? effectiveSearchText : "", effectiveFilters),
    [effectiveFilters, effectiveSearchText, isSearchActive],
  );
  const requestKey = useMemo(
    () => `${hasAppliedFilters || isSearchActive ? "query" : "list"}:${requestParams.toString()}`,
    [hasAppliedFilters, isSearchActive, requestParams],
  );
  const pagedRequestParams = useMemo(() => appendPagingParams(requestParams, currentPage), [currentPage, requestParams]);
  const requestUrl = useMemo(() => {
    const queryString = pagedRequestParams.toString();
    return hasAppliedFilters || isSearchActive
      ? `/volt/tickets/query?${queryString}`
      : `/volt/tickets?${queryString}`;
  }, [hasAppliedFilters, isSearchActive, pagedRequestParams]);
  const selectedStatus = draftFilters.status;
  const selectedStatusInOptions = useMemo(
    () => !selectedStatus || statusFilterOptions.some((option) => option.statusKey === selectedStatus),
    [selectedStatus, statusFilterOptions],
  );
  const selectedCategory = draftFilters.category;
  const selectedCategoryInOptions = useMemo(
    () => !selectedCategory || categories.some((category) => category.categoryKey === selectedCategory),
    [categories, selectedCategory],
  );

  const loadStatusFilterOptions = useCallback(async () => {
    if (hasLoadedStatusOptions || isLoadingStatusOptions) return;

    if (!canUseFilters) {
      setStatusFilterOptions(fallbackStatusFilterOptions);
      setStatusOptionsError("");
      setHasLoadedStatusOptions(true);
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
      setHasLoadedStatusOptions(true);
      setIsLoadingStatusOptions(false);
    }
  }, [canUseFilters, hasLoadedStatusOptions, isLoadingStatusOptions]);

  const loadCategories = useCallback(async () => {
    if (hasLoadedCategories || isLoadingCategories) return;

    if (!canUseFilters) {
      setCategories([]);
      setCategoryError("");
      setHasLoadedCategories(true);
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
      setHasLoadedCategories(true);
      setIsLoadingCategories(false);
    }
  }, [canUseFilters, hasLoadedCategories, isLoadingCategories]);

  useEffect(() => {
    if (syncedSearchParams.toString() !== searchParams.toString()) {
      setSearchParams(syncedSearchParams, { replace: true });
    }
  }, [searchParams, setSearchParams, syncedSearchParams]);

  useEffect(() => {
    locationSearchRef.current = location.search;
  }, [location.search]);

  useEffect(() => {
    setCurrentPage(0);
    setHasMoreTickets(false);
  }, [requestKey]);

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

  const handleFilterInput = useCallback((event) => {
    const { checked, name, type, value } = event.target;
    setDraftFilters((current) => ({
      ...current,
      [name]: type === "checkbox" ? checked : value,
    }));
  }, []);

  const toggleFilters = useCallback(() => {
    if (!canUseFilters) return;
    if (!showFilters) {
      setDraftFilters(appliedFilters);
      loadStatusFilterOptions();
      loadCategories();
    }
    setShowFilters((current) => !current);
  }, [appliedFilters, canUseFilters, loadCategories, loadStatusFilterOptions, showFilters]);

  const applyFilters = useCallback(() => {
    if (!canUseFilters) return;
    setAppliedFilters({ ...draftFilters });
    setShowFilters(false);
  }, [canUseFilters, draftFilters]);

  const clearFilters = useCallback(() => {
    setDraftFilters({ ...emptyFilters });
    setAppliedFilters({ ...emptyFilters });
  }, []);

  const loadMoreTickets = useCallback(() => {
    if (isLoading || isLoadingMore || !hasMoreTickets) return;
    setCurrentPage((page) => page + 1);
  }, [hasMoreTickets, isLoading, isLoadingMore]);

  const loadingMessage = useMemo(
    () => isSearchActive ? "Searching tickets..." : hasAppliedFilters ? "Applying filters..." : "Loading tickets...",
    [hasAppliedFilters, isSearchActive],
  );
  const emptyMessage = useMemo(() => {
    if (isSearchActive && hasAppliedFilters) return `No tickets found for "${effectiveSearchText}"`;
    if (hasAppliedFilters) return "No tickets match the selected filters.";
    if (isSearchActive) return `No tickets found for "${effectiveSearchText}"`;
    return "No tickets yet";
  }, [effectiveSearchText, hasAppliedFilters, isSearchActive]);
  const emptyHint = useMemo(() => {
    if (isSearchActive) return "Try searching by ticket number, customer name, mobile number, or area.";
    if (hasAppliedFilters) return "Try clearing filters or changing the selected options.";
    return "Create a ticket to get started.";
  }, [hasAppliedFilters, isSearchActive]);
  const resultSummary = useMemo(() => {
    if (isSearchActive) return `Showing ${tickets.length} result${tickets.length === 1 ? "" : "s"} for "${effectiveSearchText}"`;
    if (hasAppliedFilters) return `Showing ${tickets.length} filtered ticket${tickets.length === 1 ? "" : "s"}`;
    return "Showing newest tickets first";
  }, [effectiveSearchText, hasAppliedFilters, isSearchActive, tickets.length]);
  const appliedFilterChips = useMemo(() => [
    effectiveFilters.mine ? { key: "mine", label: "My Tickets" } : null,
    effectiveFilters.status ? { key: "status", label: formatLabel(effectiveFilters.status) } : null,
    effectiveFilters.category ? { key: "category", label: formatLegacyCategory(effectiveFilters.category) } : null,
    effectiveFilters.createdFrom ? { key: "createdFrom", label: `From ${effectiveFilters.createdFrom}` } : null,
    effectiveFilters.createdTo ? { key: "createdTo", label: `To ${effectiveFilters.createdTo}` } : null,
  ].filter(Boolean), [effectiveFilters]);

  const removeAppliedFilter = useCallback((filterKey) => {
    const nextFilters = { ...appliedFilters, [filterKey]: filterKey === "mine" ? false : "" };
    setAppliedFilters(nextFilters);
    setDraftFilters(nextFilters);
  }, [appliedFilters]);

  const setDateRange = useCallback((range) => {
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
  }, []);

  const handleViewDetails = useCallback((ticketId) => {
    navigate(`/tickets/${ticketId}${locationSearchRef.current}`, { state: { from: "findTickets" } });
  }, [navigate]);

  const handlePreloadTicketDetail = useCallback(() => {
    void preloadTicketDetail();
  }, []);

  return (
    <main id="main-content" className="ke-page-main lg:px-8">
      <div className="mx-auto w-full max-w-5xl">
        <div className="mb-3 flex min-w-0 items-center gap-2 sm:mb-5">
          <button type="button" onClick={() => navigate("/employee-dashboard")} className="flex min-h-10 shrink-0 items-center gap-1.5 rounded-xl px-1 py-1.5 font-semibold text-blue-950 sm:min-h-11 sm:gap-2 sm:py-2">
            <ArrowLeft size={18} aria-hidden="true" />
            <span className="sr-only sm:not-sr-only">Dashboard</span>
          </button>
          <div className="min-w-0 flex-1">
            <h1 className="break-words text-xl font-extrabold leading-tight text-blue-950 sm:text-2xl">Find Tickets</h1>
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
            <Suspense fallback={null}>
              <TicketFilterPanel
                categories={categories}
                categoryError={categoryError}
                clearFilters={clearFilters}
                draftFilters={draftFilters}
                formatCategoryOption={formatCategoryOption}
                formatLabel={formatLabel}
                formatLegacyCategory={formatLegacyCategory}
                formatStatusOption={formatStatusOption}
                handleFilterInput={handleFilterInput}
                isLoadingCategories={isLoadingCategories}
                isLoadingStatusOptions={isLoadingStatusOptions}
                selectedCategory={selectedCategory}
                selectedCategoryInOptions={selectedCategoryInOptions}
                selectedStatus={selectedStatus}
                selectedStatusInOptions={selectedStatusInOptions}
                setDateRange={setDateRange}
                statusFilterOptions={statusFilterOptions}
                statusOptionsError={statusOptionsError}
                applyFilters={applyFilters}
              />
            </Suspense>
          )}
        </section>}

        <section className="mt-3.5 grid min-w-0 grid-cols-1 gap-3 sm:mt-5 sm:gap-4 lg:grid-cols-2" aria-live="polite">
          {isLoading && (
            <>
              <p className="text-sm font-semibold text-gray-600 lg:col-span-2">{loadingMessage}</p>
              {loadingCardPlaceholders.map((placeholder) => (
                <TicketCardSkeleton key={placeholder} />
              ))}
            </>
          )}
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
              onPreloadDetails={handlePreloadTicketDetail}
              onViewDetails={handleViewDetails}
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
