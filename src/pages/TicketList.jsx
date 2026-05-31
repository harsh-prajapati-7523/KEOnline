import { useEffect, useState } from "react";
import { ArrowLeft, Calendar, MapPin, Phone } from "lucide-react";
import { useNavigate } from "react-router-dom";

function formatDate(value) {
  if (!value) return "Not available";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleDateString();
}

function TicketCard({ ticket }) {
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
        <div><dt className="font-bold text-gray-500">Customer Name</dt><dd className="mt-1 text-gray-800">{ticket.customerName ?? "Not available"}</dd></div>
        <div><dt className="font-bold text-gray-500">Product Type</dt><dd className="mt-1 text-gray-800">{ticket.productType ?? "Not available"}</dd></div>
        <div><dt className="font-bold text-gray-500">Category</dt><dd className="mt-1 text-gray-800">{ticket.category ?? "Not available"}</dd></div>
        <div>
          <dt className="font-bold text-gray-500">Mobile Number</dt>
          <dd className="mt-1 flex items-center gap-2 text-gray-800"><Phone size={15} aria-hidden="true" />{ticket.mobileNumber ?? "Not available"}</dd>
        </div>
        {ticket.villageOrArea && (
          <div>
            <dt className="font-bold text-gray-500">Village / Area</dt>
            <dd className="mt-1 flex items-center gap-2 text-gray-800"><MapPin size={15} aria-hidden="true" />{ticket.villageOrArea}</dd>
          </div>
        )}
        <div>
          <dt className="font-bold text-gray-500">Created Date</dt>
          <dd className="mt-1 flex items-center gap-2 text-gray-800"><Calendar size={15} aria-hidden="true" />{formatDate(ticket.createdAt ?? ticket.createdDate)}</dd>
        </div>
      </dl>
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
          <p className="mt-2 text-sm text-blue-100">Customer service ticket list.</p>
        </header>

        <section className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-2" aria-live="polite">
          {isLoading && <p className="text-sm font-semibold text-gray-600">Loading tickets...</p>}
          {error && <p className="rounded-xl bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">{error}</p>}
          {!isLoading && !error && tickets.length === 0 && <p className="text-sm font-semibold text-gray-600">No tickets found.</p>}
          {tickets.map((ticket) => <TicketCard key={ticket.id ?? ticket.ticketNumber} ticket={ticket} />)}
        </section>
      </div>
    </main>
  );
}
