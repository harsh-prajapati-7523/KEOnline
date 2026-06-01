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

        <section className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-2" aria-live="polite">
          {isLoading && <p className="text-sm font-semibold text-gray-600">Loading tickets...</p>}
          {error && <p className="rounded-xl bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">{error}</p>}
          {!isLoading && !error && tickets.length === 0 && <p className="text-sm font-semibold text-gray-600">No tickets found.</p>}
          {tickets.map((ticket) => (
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
