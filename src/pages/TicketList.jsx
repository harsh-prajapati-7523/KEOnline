import { useEffect, useState } from "react";
import { ArrowLeft, Eye, Phone } from "lucide-react";
import { useNavigate } from "react-router-dom";

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
  const [tickets, setTickets] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const [searchText, setSearchText] = useState("");
  const [searchResults, setSearchResults] = useState([]);
  const [isSearching, setIsSearching] = useState(false);
  const [searchError, setSearchError] = useState("");

  useEffect(() => {
    const loadTickets = async () => {
      setIsLoading(true);
      setError("");
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

    loadTickets();
  }, []);

  useEffect(() => {
    const trimmedSearchText = searchText.trim();
    if (trimmedSearchText.length < 2) {
      setSearchResults([]);
      setIsSearching(false);
      setSearchError("");
      return undefined;
    }

    const controller = new AbortController();
    setSearchResults([]);
    setIsSearching(true);
    setSearchError("");

    const timeoutId = setTimeout(async () => {
      try {
        const response = await fetch(`/volt/tickets/search?query=${encodeURIComponent(trimmedSearchText)}`, {
          headers: {
            Authorization: `Bearer ${localStorage.getItem("token")}`,
          },
          signal: controller.signal,
        });

        if (!response.ok) throw new Error("Ticket search failed");

        const data = await response.json();
        setSearchResults(Array.isArray(data) ? data : []);
      } catch (searchRequestError) {
        if (searchRequestError.name !== "AbortError") {
          setSearchResults([]);
          setSearchError("Unable to search tickets. Please try again.");
        }
      } finally {
        if (!controller.signal.aborted) {
          setIsSearching(false);
        }
      }
    }, 275);

    return () => {
      clearTimeout(timeoutId);
      controller.abort();
    };
  }, [searchText]);

  const isSearchActive = searchText.trim().length >= 2;
  const displayedTickets = isSearchActive ? searchResults : tickets;

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
          </div>
        </section>

        <section className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-2" aria-live="polite">
          {!isSearchActive && isLoading && <p className="text-sm font-semibold text-gray-600">Loading tickets...</p>}
          {!isSearchActive && error && <p className="rounded-xl bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">{error}</p>}
          {!isSearchActive && !isLoading && !error && displayedTickets.length === 0 && <p className="text-sm font-semibold text-gray-600">No tickets found.</p>}
          {isSearchActive && isSearching && <p className="text-sm font-semibold text-gray-600">Searching tickets...</p>}
          {isSearchActive && searchError && <p className="rounded-xl bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">{searchError}</p>}
          {isSearchActive && !isSearching && !searchError && displayedTickets.length === 0 && <p className="text-sm font-semibold text-gray-600">No matching tickets found.</p>}
          {!isSearching && !searchError && displayedTickets.map((ticket) => (
            <TicketCard
              key={ticket.id ?? ticket.ticketNumber}
              ticket={ticket}
              onViewDetails={(ticketId) => navigate(`/tickets/${ticketId}`)}
            />
          ))}
        </section>
      </div>
    </main>
  );
}
