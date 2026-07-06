import { useMemo, useState } from "react";
import { ArrowLeft, Download, Eye, Printer, TriangleAlert } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { jsPDF } from "jspdf";
import QRCode from "qrcode";

const NAVY = "#0B2A6E";
const GOLD = "#F4B000";
const LABEL_LIMIT = 1000;
const LABEL_WIDTH_MM = 65;
const LABEL_HEIGHT_MM = 33;
const PAGE_MARGIN_X_MM = 5;
const PAGE_MARGIN_Y_MM = 12;
const LABEL_COLS = 3;
const LABEL_ROWS = 8;
const LABELS_PER_PAGE = LABEL_COLS * LABEL_ROWS;
const LOGO_PATH = "/ke-logo-transparent.png";

const initialForm = {
  startNumber: "1",
  endNumber: "500",
  prefix: "KE",
  digits: "3",
  baseUrl: "https://kumar-electricals.com/ticket/",
};

function normalizePrefix(value) {
  return String(value || "").trim().replace(/-+$/g, "").toUpperCase();
}

function buildTicketNumber(prefix, number, digits) {
  return `${normalizePrefix(prefix)}-${String(number).padStart(digits, "0")}`;
}

function buildTrackingUrl(baseUrl, ticketNumber) {
  return `${String(baseUrl || "").trim().replace(/\/?$/, "/")}${encodeURIComponent(ticketNumber)}`;
}

function validateForm(form) {
  const errors = {};
  const start = Number(form.startNumber);
  const end = Number(form.endNumber);
  const digits = Number(form.digits);
  const prefix = normalizePrefix(form.prefix);
  const baseUrl = String(form.baseUrl || "").trim();

  if (!form.startNumber) errors.startNumber = "Start number is required.";
  if (!form.endNumber) errors.endNumber = "End number is required.";
  if (!Number.isInteger(start) || start < 1) errors.startNumber = "Start must be 1 or higher.";
  if (!Number.isInteger(end)) errors.endNumber = "End must be a whole number.";
  if (Number.isInteger(start) && Number.isInteger(end) && end < start) errors.endNumber = "End must be greater than or equal to start.";
  if (Number.isInteger(start) && Number.isInteger(end) && end >= start && end - start + 1 > LABEL_LIMIT) {
    errors.endNumber = `Generate ${LABEL_LIMIT} labels or fewer at once.`;
  }
  if (!prefix) errors.prefix = "Prefix is required.";
  if (!Number.isInteger(digits) || digits < 3 || digits > 6) errors.digits = "Digits must be between 3 and 6.";
  if (!baseUrl) errors.baseUrl = "Base tracking URL is required.";

  return errors;
}

async function imageToDataUrl(path) {
  const response = await fetch(path);
  if (!response.ok) throw new Error("Logo image could not be loaded");
  const blob = await response.blob();
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

async function makeQrDataUrl(url, width = 256) {
  return QRCode.toDataURL(url, {
    errorCorrectionLevel: "M",
    margin: 2,
    width,
    color: {
      dark: "#000000",
      light: "#FFFFFF",
    },
  });
}

function drawLightning(doc, x, y, scale = 1) {
  doc.setFillColor(GOLD);
  doc.triangle(x + 1.6 * scale, y, x, y + 4.2 * scale, x + 2.3 * scale, y + 4.2 * scale, "F");
  doc.triangle(x + 2.3 * scale, y + 3 * scale, x + 0.7 * scale, y + 7.5 * scale, x + 4.1 * scale, y + 3 * scale, "F");
}

function drawPdfLabel(doc, label, x, y, logoDataUrl, qrDataUrl) {
  doc.setDrawColor(GOLD);
  doc.setLineWidth(0.45);
  doc.roundedRect(x, y, LABEL_WIDTH_MM, LABEL_HEIGHT_MM, 3, 3, "S");

  doc.addImage(logoDataUrl, "PNG", x + 5.3, y + 4.2, 12.2, 12.2);
  doc.setTextColor(NAVY);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(4.6);
  doc.text("KUMAR ELECTRONICS", x + 11.4, y + 21.7, { align: "center" });
  doc.text("& ELECTRICALS", x + 11.4, y + 25.4, { align: "center" });

  doc.setDrawColor(NAVY);
  doc.setLineWidth(0.35);
  doc.line(x + 22.6, y + 5.7, x + 22.6, y + 27.3);

  doc.setFontSize(11.6);
  doc.text(label.ticketNumber, x + 36.6, y + 14.1, { align: "center" });

  doc.setDrawColor(GOLD);
  doc.setLineWidth(0.45);
  doc.line(x + 27.2, y + 18.8, x + 34.5, y + 18.8);
  drawLightning(doc, x + 35.4, y + 15.8, 0.78);
  doc.line(x + 41.1, y + 18.8, x + 47.7, y + 18.8);

  doc.setTextColor(NAVY);
  doc.setFontSize(5.3);
  doc.text("Service Ticket", x + 36.6, y + 24.7, { align: "center" });

  doc.setDrawColor(NAVY);
  doc.setLineWidth(0.35);
  doc.roundedRect(x + 50.2, y + 4.1, 13.2, 13.2, 1, 1, "S");
  doc.addImage(qrDataUrl, "PNG", x + 50.9, y + 4.8, 11.8, 11.8);
  doc.setFontSize(4.1);
  doc.text("Scan to Track", x + 56.8, y + 21.2, { align: "center" });
}

function LabelPreview({ label }) {
  return (
    <div className="bulk-label-preview-label">
      <div className="bulk-label-preview-brand">
        <img src={LOGO_PATH} alt="" aria-hidden="true" />
        <p>KUMAR ELECTRONICS<br />&amp; ELECTRICALS</p>
      </div>
      <div className="bulk-label-preview-divider" aria-hidden="true" />
      <div className="bulk-label-preview-ticket">
        <strong>{label.ticketNumber}</strong>
        <div className="bulk-label-preview-accent" aria-hidden="true">
          <span />
          <svg viewBox="0 0 16 28" focusable="false" aria-hidden="true">
            <polygon points="9,0 1,15 8,15 5,28 15,11 9,11" />
          </svg>
          <span />
        </div>
        <p>Service Ticket</p>
      </div>
      <div className="bulk-label-preview-qr">
        {label.qrDataUrl ? <img src={label.qrDataUrl} alt="" aria-hidden="true" /> : <div />}
        <p>Scan to Track</p>
      </div>
    </div>
  );
}

export default function BulkTicketLabels() {
  const navigate = useNavigate();
  const [form, setForm] = useState(initialForm);
  const [errors, setErrors] = useState({});
  const [previewLabels, setPreviewLabels] = useState([]);
  const [message, setMessage] = useState("");
  const [isPreviewing, setIsPreviewing] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);

  const labelCount = useMemo(() => {
    const start = Number(form.startNumber);
    const end = Number(form.endNumber);
    return Number.isInteger(start) && Number.isInteger(end) && end >= start ? end - start + 1 : 0;
  }, [form.endNumber, form.startNumber]);

  const pageCount = labelCount > 0 ? Math.ceil(labelCount / LABELS_PER_PAGE) : 0;

  const updateField = (event) => {
    const { name, value } = event.target;
    setForm((current) => ({ ...current, [name]: value }));
    setErrors((current) => ({ ...current, [name]: "" }));
    setMessage("");
  };

  const getLabels = () => {
    const nextErrors = validateForm(form);
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return null;

    const start = Number(form.startNumber);
    const end = Number(form.endNumber);
    const digits = Number(form.digits);

    return Array.from({ length: end - start + 1 }, (_, index) => {
      const ticketNumber = buildTicketNumber(form.prefix, start + index, digits);
      return {
        ticketNumber,
        url: buildTrackingUrl(form.baseUrl, ticketNumber),
      };
    });
  };

  const generatePreview = async () => {
    const labels = getLabels();
    if (!labels) return;

    setIsPreviewing(true);
    setMessage("");
    try {
      const visibleLabels = await Promise.all(labels.slice(0, LABELS_PER_PAGE).map(async (label) => ({
        ...label,
        qrDataUrl: await makeQrDataUrl(label.url, 160),
      })));
      setPreviewLabels(visibleLabels);
      setMessage(`Previewing first ${visibleLabels.length} of ${labels.length} labels. PDF will use ${pageCount} A4 page${pageCount === 1 ? "" : "s"}.`);
    } catch {
      setPreviewLabels([]);
      setMessage("Unable to generate preview QR codes. Please try again.");
    } finally {
      setIsPreviewing(false);
    }
  };

  const downloadPdf = async () => {
    const labels = getLabels();
    if (!labels) return;

    setIsDownloading(true);
    setMessage("");
    try {
      const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4", compress: true });
      const logoDataUrl = await imageToDataUrl(LOGO_PATH);
      const colGap = (210 - PAGE_MARGIN_X_MM * 2 - LABEL_COLS * LABEL_WIDTH_MM) / (LABEL_COLS - 1);
      const rowGap = (297 - PAGE_MARGIN_Y_MM * 2 - LABEL_ROWS * LABEL_HEIGHT_MM) / (LABEL_ROWS - 1);

      for (let index = 0; index < labels.length; index += 1) {
        if (index > 0 && index % LABELS_PER_PAGE === 0) doc.addPage();
        const pageIndex = index % LABELS_PER_PAGE;
        const col = pageIndex % LABEL_COLS;
        const row = Math.floor(pageIndex / LABEL_COLS);
        const x = PAGE_MARGIN_X_MM + col * (LABEL_WIDTH_MM + colGap);
        const y = PAGE_MARGIN_Y_MM + row * (LABEL_HEIGHT_MM + rowGap);
        const qrDataUrl = await makeQrDataUrl(labels[index].url);
        drawPdfLabel(doc, labels[index], x, y, logoDataUrl, qrDataUrl);
      }

      doc.save(`bulk-ticket-labels-${labels[0].ticketNumber}-to-${labels[labels.length - 1].ticketNumber}.pdf`);
      setMessage(`PDF generated for ${labels.length} labels across ${Math.ceil(labels.length / LABELS_PER_PAGE)} A4 page${labels.length <= LABELS_PER_PAGE ? "" : "s"}.`);
    } catch {
      setMessage("Unable to generate PDF. Please try again.");
    } finally {
      setIsDownloading(false);
    }
  };

  return (
    <main id="main-content" className="ke-page-main bulk-label-page bg-gray-50 lg:px-8">
      <div className="mx-auto w-full max-w-7xl">
        <button type="button" onClick={() => navigate("/employee-dashboard")} className="flex min-h-10 items-center gap-2 rounded-xl px-1 py-1.5 text-base font-semibold text-blue-950">
          <ArrowLeft size={18} aria-hidden="true" /> Back to Dashboard
        </button>

        <header className="mt-4 flex flex-col gap-3 border-b border-blue-100 pb-5 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-sm font-extrabold uppercase tracking-wider text-amber-700">Print Tools</p>
            <h1 className="mt-1 text-3xl font-extrabold text-blue-950">Bulk Ticket Labels</h1>
            <p className="mt-2 max-w-2xl text-sm font-semibold text-slate-600">Generate scannable QR sticker labels for ticket tracking links.</p>
          </div>
          <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-bold text-amber-900">
            A4, 3 columns x 8 rows, 24 labels per page
          </div>
        </header>

        <section className="mt-5 grid gap-5 lg:grid-cols-[minmax(0,24rem)_1fr]">
          <div className="space-y-4">
            <form className="rounded-lg border border-blue-100 bg-white p-4 shadow-sm" onSubmit={(event) => event.preventDefault()}>
              <div className="grid gap-4">
                <label className="block text-sm font-bold text-slate-700">
                  Start Ticket Number
                  <input name="startNumber" type="number" min="1" value={form.startNumber} onChange={updateField} className="mt-1 h-11 w-full rounded-lg border border-slate-300 px-3 font-semibold text-blue-950" />
                  {errors.startNumber && <span className="mt-1 block text-xs font-bold text-red-700">{errors.startNumber}</span>}
                </label>
                <label className="block text-sm font-bold text-slate-700">
                  End Ticket Number
                  <input name="endNumber" type="number" min="1" value={form.endNumber} onChange={updateField} className="mt-1 h-11 w-full rounded-lg border border-slate-300 px-3 font-semibold text-blue-950" />
                  {errors.endNumber && <span className="mt-1 block text-xs font-bold text-red-700">{errors.endNumber}</span>}
                </label>
                <div className="grid grid-cols-2 gap-3">
                  <label className="block text-sm font-bold text-slate-700">
                    Prefix
                    <input name="prefix" value={form.prefix} onChange={updateField} className="mt-1 h-11 w-full rounded-lg border border-slate-300 px-3 font-semibold text-blue-950" />
                    {errors.prefix && <span className="mt-1 block text-xs font-bold text-red-700">{errors.prefix}</span>}
                  </label>
                  <label className="block text-sm font-bold text-slate-700">
                    Digits
                    <input name="digits" type="number" min="3" max="6" value={form.digits} onChange={updateField} className="mt-1 h-11 w-full rounded-lg border border-slate-300 px-3 font-semibold text-blue-950" />
                    {errors.digits && <span className="mt-1 block text-xs font-bold text-red-700">{errors.digits}</span>}
                  </label>
                </div>
                <label className="block text-sm font-bold text-slate-700">
                  Base Tracking URL
                  <input name="baseUrl" type="url" value={form.baseUrl} onChange={updateField} className="mt-1 h-11 w-full rounded-lg border border-slate-300 px-3 font-semibold text-blue-950" />
                  {errors.baseUrl && <span className="mt-1 block text-xs font-bold text-red-700">{errors.baseUrl}</span>}
                </label>
              </div>

              <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">
                <button type="button" onClick={generatePreview} disabled={isPreviewing || isDownloading} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg border border-blue-950 px-4 py-2 text-sm font-extrabold text-blue-950 hover:bg-blue-50 disabled:opacity-60">
                  <Eye size={17} aria-hidden="true" /> {isPreviewing ? "Generating..." : "Generate Preview"}
                </button>
                <button type="button" onClick={downloadPdf} disabled={isDownloading || isPreviewing} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg bg-blue-950 px-4 py-2 text-sm font-extrabold text-white hover:bg-blue-900 disabled:opacity-60">
                  <Download size={17} aria-hidden="true" /> {isDownloading ? "Preparing..." : "Download PDF"}
                </button>
              </div>
            </form>

            <aside className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-amber-950">
              <div className="flex items-start gap-3">
                <TriangleAlert className="mt-0.5 shrink-0" size={20} aria-hidden="true" />
                <p className="text-sm font-bold">Print using A4 paper and 100% / Actual Size. Do not use Fit to Page.</p>
              </div>
            </aside>

            <section className="rounded-lg border border-blue-100 bg-white p-4 shadow-sm">
              <h2 className="text-sm font-extrabold text-blue-950">Generation Summary</h2>
              <dl className="mt-3 grid grid-cols-2 gap-3 text-sm">
                <div><dt className="font-bold text-slate-500">Labels</dt><dd className="font-extrabold text-blue-950">{labelCount || "Not ready"}</dd></div>
                <div><dt className="font-bold text-slate-500">Pages</dt><dd className="font-extrabold text-blue-950">{pageCount || "Not ready"}</dd></div>
                <div><dt className="font-bold text-slate-500">First</dt><dd className="font-extrabold text-blue-950">{labelCount ? buildTicketNumber(form.prefix, Number(form.startNumber), Number(form.digits)) : "Not ready"}</dd></div>
                <div><dt className="font-bold text-slate-500">Last</dt><dd className="font-extrabold text-blue-950">{labelCount ? buildTicketNumber(form.prefix, Number(form.endNumber), Number(form.digits)) : "Not ready"}</dd></div>
              </dl>
            </section>
          </div>

          <section className="min-w-0 rounded-lg border border-blue-100 bg-white p-4 shadow-sm" aria-label="Label preview">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 className="text-lg font-extrabold text-blue-950">Preview</h2>
                <p className="text-sm font-semibold text-slate-600">First page preview with real generated QR codes.</p>
              </div>
              <span className="inline-flex w-fit items-center gap-2 rounded-lg bg-blue-50 px-3 py-2 text-xs font-extrabold text-blue-950">
                <Printer size={15} aria-hidden="true" /> {LABELS_PER_PAGE} per A4 page
              </span>
            </div>

            {message && <p className={`mt-4 rounded-lg px-4 py-3 text-sm font-bold ${message.startsWith("Unable") ? "bg-red-50 text-red-700" : "bg-green-50 text-green-700"}`}>{message}</p>}

            <div className="bulk-label-preview-sheet mt-4">
              {previewLabels.length > 0 ? (
                previewLabels.map((label) => <LabelPreview key={label.ticketNumber} label={label} />)
              ) : (
                <div className="bulk-label-empty-state">
                  <p className="text-base font-extrabold text-blue-950">Generate a preview to see the first A4 page.</p>
                  <p className="mt-1 text-sm font-semibold text-slate-600">The PDF will include the full validated range.</p>
                </div>
              )}
            </div>
          </section>
        </section>
      </div>
    </main>
  );
}
