import { useCallback, useEffect, useRef, useState } from "react";
import { ArrowLeft, Camera, QrCode, Search } from "lucide-react";
import QrScanner from "qr-scanner";
import { useNavigate } from "react-router-dom";

const VALID_TICKET_PATTERN = /^KE-\d{3,}$/i;
const ALLOWED_TICKET_HOSTS = new Set([
  "kumar-electricals.com",
  "test.kumar-electricals.com",
]);
const INVALID_QR_MESSAGE = "Invalid QR. Please scan a Kumar Electronics ticket label.";
const CAMERA_PERMISSION_MESSAGE = "Camera permission is required to scan QR codes. You can enter the ticket number manually.";

function extractTicketNumberFromQr(rawValue) {
  const value = String(rawValue || "").trim();
  if (!value) return "";

  const directMatch = value.match(VALID_TICKET_PATTERN);
  if (directMatch) return directMatch[0].toUpperCase();

  const prefixedMatch = value.match(/^KE:TICKET:(KE-\d{3,})$/i);
  if (prefixedMatch) return prefixedMatch[1].toUpperCase();

  try {
    const parsedUrl = new URL(value);
    if (!ALLOWED_TICKET_HOSTS.has(parsedUrl.hostname.toLowerCase())) return "";

    const pathMatch = parsedUrl.pathname.match(/^\/ticket\/(KE-\d{3,})\/?$/i);
    return pathMatch ? pathMatch[1].toUpperCase() : "";
  } catch {
    return "";
  }
}

function isPermissionDeniedError(error) {
  const name = String(error?.name || "").toLowerCase();
  const message = String(error?.message || error || "").toLowerCase();
  return name.includes("notallowed") || name.includes("permission") || message.includes("permission") || message.includes("not allowed");
}

export default function ScanTicketQr() {
  const navigate = useNavigate();
  const videoRef = useRef(null);
  const scannerRef = useRef(null);
  const scanLockedRef = useRef(false);
  const [isScanning, setIsScanning] = useState(false);
  const [scannerError, setScannerError] = useState("");
  const [manualTicketNumber, setManualTicketNumber] = useState("");
  const [showManualEntry, setShowManualEntry] = useState(false);

  const stopScanner = useCallback(() => {
    scannerRef.current?.stop();
    scannerRef.current?.destroy();
    scannerRef.current = null;
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    setIsScanning(false);
  }, []);

  const openTicket = useCallback((ticketNumber) => {
    stopScanner();
    navigate(`/ticket/${encodeURIComponent(ticketNumber)}`, { state: { from: "scanner" } });
  }, [navigate, stopScanner]);

  const acceptScannedValue = useCallback((rawValue) => {
    if (scanLockedRef.current) return;

    const ticketNumber = extractTicketNumberFromQr(rawValue);
    if (!ticketNumber) {
      setScannerError(INVALID_QR_MESSAGE);
      return;
    }

    scanLockedRef.current = true;
    setScannerError("");
    openTicket(ticketNumber);
  }, [openTicket]);

  useEffect(() => {
    let cancelled = false;

    const startScanner = async () => {
      try {
        if (!navigator.mediaDevices?.getUserMedia) {
          await Promise.resolve();
          throw new DOMException(CAMERA_PERMISSION_MESSAGE, "NotAllowedError");
        }

        const video = videoRef.current;
        if (!video) return;

        const scanner = new QrScanner(
          video,
          (result) => acceptScannedValue(typeof result === "string" ? result : result?.data || ""),
          {
            preferredCamera: "environment",
            returnDetailedScanResult: true,
            highlightScanRegion: true,
            highlightCodeOutline: true,
            maxScansPerSecond: 5,
          }
        );
        scannerRef.current = scanner;
        await scanner.start();
        if (cancelled) {
          scanner.stop();
          scanner.destroy();
          return;
        }
        setIsScanning(true);
      } catch (error) {
        if (!cancelled) {
          setIsScanning(false);
          setScannerError(isPermissionDeniedError(error) ? CAMERA_PERMISSION_MESSAGE : "Unable to start the QR scanner. You can enter the ticket number manually.");
        }
      }
    };

    void startScanner();

    return () => {
      cancelled = true;
      stopScanner();
    };
  }, [acceptScannedValue, stopScanner]);

  const handleManualSubmit = (event) => {
    event.preventDefault();
    const ticketNumber = extractTicketNumberFromQr(manualTicketNumber);
    if (!ticketNumber) {
      setScannerError(INVALID_QR_MESSAGE);
      return;
    }

    scanLockedRef.current = true;
    setScannerError("");
    openTicket(ticketNumber);
  };

  return (
    <main id="main-content" className="ke-page-main ticket-detail-page bg-gray-50 lg:px-8">
      <div className="mx-auto flex w-full max-w-2xl flex-col gap-4">
        <button type="button" onClick={() => navigate("/employee-dashboard")} className="flex min-h-10 w-fit items-center gap-2 rounded-xl px-1 py-1.5 text-base font-semibold text-blue-950">
          <ArrowLeft size={18} aria-hidden="true" /> Dashboard
        </button>

        <header className="rounded-2xl bg-blue-950 p-4 text-white shadow-lg">
          <div className="flex min-w-0 items-center gap-3">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-white/15">
              <QrCode size={25} aria-hidden="true" />
            </div>
            <div className="min-w-0">
              <h1 className="break-words text-2xl font-extrabold">Scan Ticket QR</h1>
              <p className="mt-1 break-words text-sm font-semibold text-blue-100">Scan the QR label pasted on the item to open its ticket.</p>
            </div>
          </div>
        </header>

        <section className="rounded-2xl border border-blue-100 bg-white p-3.5 shadow-sm" aria-label="Camera QR scanner">
          <div className="relative overflow-hidden rounded-xl border border-blue-100 bg-slate-950">
            <video
              ref={videoRef}
              className="aspect-square max-h-[62vh] w-full object-cover"
              muted
              playsInline
            />
            {!isScanning && (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-slate-950 text-blue-100">
                <Camera size={48} aria-hidden="true" />
                <span className="text-sm font-bold">Starting camera...</span>
              </div>
            )}
          </div>

          {scannerError && (
            <p className="mt-3 rounded-xl bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">{scannerError}</p>
          )}
        </section>

        <section className="rounded-2xl border border-blue-100 bg-white p-3.5 shadow-sm" aria-label="Manual ticket entry">
          {!showManualEntry ? (
            <button
              type="button"
              onClick={() => setShowManualEntry(true)}
              className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl border border-blue-950 bg-white px-4 py-2 text-sm font-extrabold text-blue-950 transition hover:bg-blue-50"
            >
              <Search size={18} aria-hidden="true" />
              Enter Ticket Number Manually
            </button>
          ) : (
            <form onSubmit={handleManualSubmit} className="space-y-3">
              <label className="block text-sm font-extrabold text-slate-900" htmlFor="manual-ticket-number">
                Enter Ticket Number Manually
              </label>
              <input
                id="manual-ticket-number"
                value={manualTicketNumber}
                onChange={(event) => setManualTicketNumber(event.target.value)}
                autoCapitalize="characters"
                autoComplete="off"
                inputMode="text"
                placeholder="KE-001"
                className="w-full rounded-xl border border-gray-300 px-4 py-3 text-base font-semibold text-blue-950 outline-none focus:border-blue-950"
              />
              <button type="submit" className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-blue-950 px-4 py-2 text-sm font-extrabold text-white transition hover:bg-blue-900">
                Open Ticket
              </button>
            </form>
          )}
        </section>
      </div>
    </main>
  );
}
