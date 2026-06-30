import { useState } from "react";
import { ArrowLeft, Search } from "lucide-react";
import { useNavigate } from "react-router-dom";

function authHeaders() {
  return {
    Authorization: `Bearer ${localStorage.getItem("token")}`,
  };
}

function getTicketNumberDigits(value) {
  return value.replace(/^KE-/i, "").replace(/\D/g, "").slice(0, 8);
}

function getTicketNumberCandidates(digits) {
  const normalizedDigits = digits.replace(/^0+(?=\d)/, "");
  if (!normalizedDigits) return [];

  const candidates = new Set();
  candidates.add(`KE-${normalizedDigits.padStart(3, "0")}`);
  if (normalizedDigits.length >= 3) {
    candidates.add(`KE-${normalizedDigits.padStart(5, "0")}`);
  }

  return Array.from(candidates);
}

export default function OpenTicket() {
  const navigate = useNavigate();
  const [ticketDigits, setTicketDigits] = useState("");
  const [message, setMessage] = useState("");
  const [isOpening, setIsOpening] = useState(false);
  const ticketNumberCandidates = getTicketNumberCandidates(ticketDigits);

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (isOpening) return;

    if (ticketNumberCandidates.length === 0) {
      setMessage("Enter a ticket number to open.");
      return;
    }

    setIsOpening(true);
    setMessage("");

    try {
      for (const ticketNumber of ticketNumberCandidates) {
        const response = await fetch(`/volt/tickets/by-number/${encodeURIComponent(ticketNumber)}`, {
          headers: authHeaders(),
        });

        if (response.status === 404) {
          continue;
        }

        if (!response.ok) throw new Error("Ticket lookup failed");

        const ticket = await response.json();
        if (!ticket?.id) {
          setMessage("Ticket found, but it cannot be opened.");
          return;
        }

        navigate(`/tickets/${ticket.id}`);
        return;
      }

      setMessage(`No ticket found for ${ticketNumberCandidates.join(" or ")}.`);
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
          <div className="mt-2 flex min-h-14 overflow-hidden rounded-xl border border-gray-300 bg-white focus-within:border-blue-950">
            <span className="flex shrink-0 items-center border-r border-gray-200 bg-blue-50 px-4 text-xl font-extrabold text-blue-950">
              KE-
            </span>
            <input
              id="ticket-number"
              type="text"
              value={ticketDigits}
              onChange={(event) => {
                setTicketDigits(getTicketNumberDigits(event.target.value));
                setMessage("");
              }}
              placeholder="001"
              className="min-h-14 min-w-0 flex-1 px-4 py-3 text-xl font-extrabold tracking-normal text-blue-950 outline-none"
              autoComplete="off"
              inputMode="numeric"
            />
          </div>
          {ticketNumberCandidates.length > 0 && (
            <div className="mt-3 flex min-w-0 flex-wrap gap-2" aria-label="Ticket number formats to try">
              {ticketNumberCandidates.map((candidate) => (
                <span key={candidate} className="rounded-full bg-blue-50 px-3 py-1.5 text-sm font-extrabold text-blue-950">
                  {candidate}
                </span>
              ))}
            </div>
          )}
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
