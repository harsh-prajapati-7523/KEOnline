import { useState } from "react";
import { ArrowLeft, Search } from "lucide-react";
import { useNavigate } from "react-router-dom";

function authHeaders() {
  return {
    Authorization: `Bearer ${localStorage.getItem("token")}`,
  };
}

export default function OpenTicket() {
  const navigate = useNavigate();
  const [ticketNumber, setTicketNumber] = useState("");
  const [message, setMessage] = useState("");
  const [isOpening, setIsOpening] = useState(false);

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (isOpening) return;

    const normalizedTicketNumber = ticketNumber.trim();
    if (!normalizedTicketNumber) {
      setMessage("Enter a ticket number to open.");
      return;
    }

    setIsOpening(true);
    setMessage("");

    try {
      const response = await fetch(`/volt/tickets/by-number/${encodeURIComponent(normalizedTicketNumber)}`, {
        headers: authHeaders(),
      });

      if (response.status === 404) {
        setMessage(`No ticket found for ${normalizedTicketNumber}.`);
        return;
      }

      if (!response.ok) throw new Error("Ticket lookup failed");

      const ticket = await response.json();
      if (!ticket?.id) {
        setMessage("Ticket found, but it cannot be opened.");
        return;
      }

      navigate(`/tickets/${ticket.id}`);
    } catch {
      setMessage("Unable to open ticket. Please try again.");
    } finally {
      setIsOpening(false);
    }
  };

  return (
    <main id="main-content" className="ke-page-main lg:px-8">
      <div className="mx-auto w-full max-w-xl">
        <div className="mb-3 flex min-w-0 items-center gap-2 sm:mb-5">
          <button type="button" onClick={() => navigate("/employee-dashboard")} className="flex min-h-10 shrink-0 items-center gap-1.5 rounded-xl px-1 py-1.5 font-semibold text-blue-950 sm:min-h-11 sm:gap-2 sm:py-2">
            <ArrowLeft size={18} aria-hidden="true" />
            <span className="sr-only sm:not-sr-only">Dashboard</span>
          </button>
          <div className="min-w-0 flex-1">
            <h1 className="break-words text-xl font-extrabold leading-tight text-blue-950 sm:text-2xl">Open Ticket</h1>
            <p className="mt-0.5 text-xs font-semibold text-gray-500 sm:text-sm">Enter a ticket number to open it directly.</p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="rounded-2xl border border-blue-100 bg-white p-4 shadow-sm sm:p-5">
          <label htmlFor="ticket-number" className="block text-sm font-extrabold text-blue-950">
            Ticket Number
          </label>
          <input
            id="ticket-number"
            type="text"
            value={ticketNumber}
            onChange={(event) => {
              setTicketNumber(event.target.value);
              setMessage("");
            }}
            placeholder="KE-001"
            className="mt-2 min-h-14 w-full rounded-xl border border-gray-300 px-4 py-3 text-xl font-extrabold uppercase tracking-normal text-blue-950 outline-none focus:border-blue-950"
            autoComplete="off"
            inputMode="text"
          />
          {message && (
            <p className={`mt-3 rounded-xl px-4 py-3 text-sm font-semibold ${message.startsWith("No ticket") || message.startsWith("Enter") ? "bg-yellow-50 text-yellow-800" : "bg-red-50 text-red-700"}`}>
              {message}
            </p>
          )}
          <button
            type="submit"
            disabled={isOpening}
            className="ke-primary-action mt-4 inline-flex min-h-14 w-full items-center justify-center gap-2 rounded-xl px-4 py-3 text-base font-extrabold disabled:opacity-70"
          >
            <Search size={18} aria-hidden="true" />
            {isOpening ? "Opening..." : "Open"}
          </button>
        </form>
      </div>
    </main>
  );
}
