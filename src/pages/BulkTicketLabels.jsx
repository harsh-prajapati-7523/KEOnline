import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowLeft, Download, Eye, Printer, RotateCcw, Save, TriangleAlert, Upload } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { jsPDF } from "jspdf";
import QRCode from "qrcode";

const A4_WIDTH_MM = 210;
const A4_HEIGHT_MM = 297;
const LABEL_LIMIT = 1000;
const LOGO_PATH = "/ke-logo-transparent.png";
const STORAGE_KEY = "ke_bulk_label_design_settings";

const initialForm = {
  startNumber: "1",
  endNumber: "500",
  prefix: "KE",
  digits: "3",
  baseUrl: "https://kumar-electricals.com/ticket/",
};

const defaultDesignSettings = {
  labelWidthMm: "95",
  labelHeightMm: "34",
  columns: "2",
  rows: "7",
  horizontalGapMm: "4",
  verticalGapMm: "4",
  pageMarginMm: "8",
  businessLine1: "KUMAR ELECTRONICS",
  businessLine2: "& ELECTRICALS",
  subtitle: "Service Ticket",
  qrCaption: "Scan to Track",
  navyColor: "#1C264A",
  goldColor: "#F4B000",
  borderWidthMm: "0.6",
  borderRadiusMm: "4.2",
  ticketFontSizeMm: "23.5",
  businessFontSizeMm: "5.4",
  subtitleFontSizeMm: "6.5",
  qrCaptionFontSizeMm: "5.4",
  logoSizeMm: "23",
  qrSizeMm: "18.8",
  brandXPercent: "15",
  brandYPercent: "7",
  dividerXPercent: "30",
  ticketXPercent: "56",
  ticketYPercent: "42",
  qrXPercent: "79",
  qrYPercent: "14",
  subtitleXPercent: "56",
  subtitleYPercent: "75",
  qrCaptionXPercent: "89.5",
  qrCaptionYPercent: "76",
};

const designFields = Object.keys(defaultDesignSettings);

function normalizePrefix(value) {
  return String(value || "").trim().replace(/-+$/g, "").toUpperCase();
}

function numberValue(value, fallback = 0) {
  if (value === "" || value === null || typeof value === "undefined") return fallback;
  const next = Number(value);
  return Number.isFinite(next) ? next : fallback;
}

function settingNumber(settings, key) {
  return numberValue(settings[key], numberValue(defaultDesignSettings[key]));
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function roundedString(value, decimals = 1) {
  return String(Number(value).toFixed(decimals)).replace(/\.0$/, "");
}

function buildTicketNumber(prefix, number, digits) {
  return `${normalizePrefix(prefix)}-${String(number).padStart(digits, "0")}`;
}

function buildTrackingUrl(baseUrl, ticketNumber) {
  return `${String(baseUrl || "").trim().replace(/\/?$/, "/")}${encodeURIComponent(ticketNumber)}`;
}

function getLayout(settings) {
  const labelWidth = settingNumber(settings, "labelWidthMm");
  const labelHeight = settingNumber(settings, "labelHeightMm");
  const columns = settingNumber(settings, "columns");
  const rows = settingNumber(settings, "rows");
  const horizontalGap = settingNumber(settings, "horizontalGapMm");
  const verticalGap = settingNumber(settings, "verticalGapMm");
  const pageMargin = settingNumber(settings, "pageMarginMm");
  const usedWidth = columns * labelWidth + Math.max(0, columns - 1) * horizontalGap + pageMargin * 2;
  const usedHeight = rows * labelHeight + Math.max(0, rows - 1) * verticalGap + pageMargin * 2;

  return {
    labelWidth,
    labelHeight,
    columns,
    rows,
    horizontalGap,
    verticalGap,
    pageMargin,
    labelsPerPage: columns * rows,
    pageCountFor: (count) => columns > 0 && rows > 0 ? Math.ceil(count / (columns * rows)) : 0,
    usedWidth,
    usedHeight,
    fitsA4: usedWidth <= A4_WIDTH_MM && usedHeight <= A4_HEIGHT_MM,
  };
}

function validatePositive(errors, settings, key, label, min = 0.1) {
  if (settingNumber(settings, key) < min) errors[key] = `${label} must be ${min} or higher.`;
}

function validateForm(form, settings) {
  const errors = {};
  const start = Number(form.startNumber);
  const end = Number(form.endNumber);
  const digits = Number(form.digits);
  const prefix = normalizePrefix(form.prefix);
  const baseUrl = String(form.baseUrl || "").trim();
  const layout = getLayout(settings);

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

  validatePositive(errors, settings, "labelWidthMm", "Label width", 20);
  validatePositive(errors, settings, "labelHeightMm", "Label height", 15);
  validatePositive(errors, settings, "columns", "Columns", 1);
  validatePositive(errors, settings, "rows", "Rows", 1);
  validatePositive(errors, settings, "logoSizeMm", "Logo size", 4);
  validatePositive(errors, settings, "qrSizeMm", "QR size", 6);
  validatePositive(errors, settings, "ticketFontSizeMm", "Ticket font size", 1);
  validatePositive(errors, settings, "businessFontSizeMm", "Business font size", 1);
  validatePositive(errors, settings, "subtitleFontSizeMm", "Subtitle font size", 1);
  validatePositive(errors, settings, "qrCaptionFontSizeMm", "QR caption font size", 1);

  if (!Number.isInteger(layout.columns)) errors.columns = "Columns must be a whole number.";
  if (!Number.isInteger(layout.rows)) errors.rows = "Rows must be a whole number.";
  if (!layout.fitsA4) errors.layout = "Selected label layout does not fit on A4. Reduce label size, rows, columns, or gaps.";
  if (layout.labelsPerPage < 1) errors.layout = "Rows and columns must create at least one label per page.";
  if (settingNumber(settings, "qrSizeMm") > layout.labelWidth * 0.35 || settingNumber(settings, "qrSizeMm") > layout.labelHeight * 0.75) {
    errors.qrSizeMm = "QR size must fit inside the label.";
  }
  if (settingNumber(settings, "logoSizeMm") > layout.labelWidth * 0.35 || settingNumber(settings, "logoSizeMm") > layout.labelHeight * 0.75) {
    errors.logoSizeMm = "Logo size must fit inside the label.";
  }
  const qrRightMm = layout.labelWidth * settingNumber(settings, "qrXPercent") / 100 + settingNumber(settings, "qrSizeMm");
  const qrBottomMm = layout.labelHeight * settingNumber(settings, "qrYPercent") / 100 + settingNumber(settings, "qrSizeMm");
  if (qrRightMm > layout.labelWidth || qrBottomMm > layout.labelHeight) {
    errors.qrSizeMm = "Move or resize QR so it stays inside the label.";
  }
  const logoHalfMm = settingNumber(settings, "logoSizeMm") / 2;
  const logoCenterMm = layout.labelWidth * settingNumber(settings, "brandXPercent") / 100;
  if (logoCenterMm - logoHalfMm < 0 || logoCenterMm + logoHalfMm > layout.labelWidth) {
    errors.logoSizeMm = "Move or resize logo so it stays inside the label.";
  }

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
    color: { dark: "#000000", light: "#FFFFFF" },
  });
}

function drawLightning(doc, x, y, scale, goldColor) {
  doc.setFillColor(goldColor);
  doc.triangle(x + 1.6 * scale, y, x, y + 4.2 * scale, x + 2.3 * scale, y + 4.2 * scale, "F");
  doc.triangle(x + 2.3 * scale, y + 3 * scale, x + 0.7 * scale, y + 7.5 * scale, x + 4.1 * scale, y + 3 * scale, "F");
}

function drawPdfLabel(doc, label, x, y, logoDataUrl, qrDataUrl, settings) {
  const layout = getLayout(settings);
  const labelWidth = layout.labelWidth;
  const labelHeight = layout.labelHeight;
  const navy = settings.navyColor;
  const gold = settings.goldColor;
  const dividerX = labelWidth * settingNumber(settings, "dividerXPercent") / 100;
  const brandX = labelWidth * settingNumber(settings, "brandXPercent") / 100;
  const brandY = labelHeight * settingNumber(settings, "brandYPercent") / 100;
  const ticketX = labelWidth * settingNumber(settings, "ticketXPercent") / 100;
  const ticketY = labelHeight * settingNumber(settings, "ticketYPercent") / 100;
  const qrX = labelWidth * settingNumber(settings, "qrXPercent") / 100;
  const qrY = labelHeight * settingNumber(settings, "qrYPercent") / 100;
  const subtitleX = labelWidth * settingNumber(settings, "subtitleXPercent") / 100;
  const subtitleY = labelHeight * settingNumber(settings, "subtitleYPercent") / 100;
  const qrCaptionX = labelWidth * settingNumber(settings, "qrCaptionXPercent") / 100;
  const qrCaptionY = labelHeight * settingNumber(settings, "qrCaptionYPercent") / 100;
  const logoSize = settingNumber(settings, "logoSizeMm");
  const qrSize = settingNumber(settings, "qrSizeMm");
  const logoX = Math.max(1, brandX - logoSize / 2);
  const logoY = Math.max(1, brandY);

  doc.setDrawColor(gold);
  doc.setLineWidth(settingNumber(settings, "borderWidthMm"));
  doc.roundedRect(x, y, labelWidth, labelHeight, settingNumber(settings, "borderRadiusMm"), settingNumber(settings, "borderRadiusMm"), "S");

  doc.addImage(logoDataUrl, "PNG", x + logoX, y + logoY, logoSize, logoSize);
  doc.setTextColor(navy);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(settingNumber(settings, "businessFontSizeMm"));
  doc.text(settings.businessLine1, x + brandX, y + logoY + logoSize + 5.3, { align: "center" });
  doc.text(settings.businessLine2, x + brandX, y + logoY + logoSize + 9, { align: "center" });

  doc.setDrawColor(navy);
  doc.setLineWidth(0.35);
  doc.line(x + dividerX, y + labelHeight * 0.17, x + dividerX, y + labelHeight * 0.83);

  doc.setTextColor(navy);
  doc.setFontSize(settingNumber(settings, "ticketFontSizeMm"));
  doc.text(label.ticketNumber, x + ticketX, y + ticketY, { align: "center" });

  doc.setDrawColor(gold);
  doc.setLineWidth(0.45);
  const accentY = y + Math.min(labelHeight - 8, ticketY + 4.7);
  const accentLeft = x + dividerX + 4.5;
  const accentRight = x + qrX - 2.5;
  const lightningX = x + (dividerX + qrX) / 2 - 1.6;
  doc.line(accentLeft, accentY, Math.max(accentLeft, lightningX - 2), accentY);
  drawLightning(doc, lightningX, accentY - 3, 0.78, gold);
  doc.line(lightningX + 5.5, accentY, accentRight, accentY);

  doc.setTextColor(navy);
  doc.setFontSize(settingNumber(settings, "subtitleFontSizeMm"));
  doc.setDrawColor(navy);
  doc.setLineWidth(0.45);
  doc.line(x + subtitleX - 14, y + subtitleY - 1.4, x + subtitleX - 9.4, y + subtitleY - 1.4);
  doc.line(x + subtitleX + 9.4, y + subtitleY - 1.4, x + subtitleX + 14, y + subtitleY - 1.4);
  doc.text(settings.subtitle, x + subtitleX, y + subtitleY, { align: "center" });

  doc.setDrawColor(navy);
  doc.setLineWidth(0.35);
  doc.roundedRect(x + qrX, y + qrY, qrSize + 1.4, qrSize + 1.4, 1, 1, "S");
  doc.addImage(qrDataUrl, "PNG", x + qrX + 0.7, y + qrY + 0.7, qrSize, qrSize);
  doc.setTextColor(navy);
  doc.setFontSize(settingNumber(settings, "qrCaptionFontSizeMm"));
  doc.text(settings.qrCaption, x + qrCaptionX, y + qrCaptionY, { align: "center" });
}

function DesignNumberInput({ label, name, value, onChange, error, min, max, step = "1", type = "number" }) {
  return (
    <label className="bulk-label-control">
      <span>{label}</span>
      <input name={name} type={type} min={min} max={max} step={step} value={value} onChange={onChange} />
      {error && <small>{error}</small>}
    </label>
  );
}

function SliderControl({ label, name, value, onChange, min, max, step = "1", suffix = "" }) {
  return (
    <label className="bulk-label-slider">
      <span>{label}</span>
      <input name={name} type="range" min={min} max={max} step={step} value={value} onChange={onChange} />
      <output>{value}{suffix}</output>
    </label>
  );
}

function LabelPreview({ label, settings, qrDataUrl, editable = false, selectedElement = "", onSelect, onDesignChange }) {
  const labelRef = useRef(null);
  const layout = getLayout(settings);
  const labelWidth = layout.labelWidth;
  const labelHeight = layout.labelHeight;
  const brandX = settingNumber(settings, "brandXPercent");
  const brandY = settingNumber(settings, "brandYPercent");
  const dividerX = settingNumber(settings, "dividerXPercent");
  const ticketX = settingNumber(settings, "ticketXPercent");
  const ticketY = settingNumber(settings, "ticketYPercent");
  const qrX = settingNumber(settings, "qrXPercent");
  const qrY = settingNumber(settings, "qrYPercent");
  const subtitleX = settingNumber(settings, "subtitleXPercent");
  const subtitleY = settingNumber(settings, "subtitleYPercent");
  const qrCaptionX = settingNumber(settings, "qrCaptionXPercent");
  const qrCaptionY = settingNumber(settings, "qrCaptionYPercent");
  const brandWidthPct = Math.max(10, dividerX - 3);
  const logoSizePct = clamp((settingNumber(settings, "logoSizeMm") / labelWidth * 100) / (brandWidthPct / 100), 20, 120);
  const qrSizePct = settingNumber(settings, "qrSizeMm") / labelWidth * 100;
  const canEdit = editable && typeof onDesignChange === "function";

  const updateSetting = (key, value) => {
    onDesignChange?.((current) => ({ ...current, [key]: roundedString(value) }));
  };

  const startDrag = (event, elementName, keys) => {
    if (!canEdit) return;
    event.preventDefault();
    event.stopPropagation();
    onSelect?.(elementName);
    const rect = labelRef.current?.getBoundingClientRect();
    if (!rect) return;
    const startX = event.clientX;
    const startY = event.clientY;
    const initial = keys.reduce((next, key) => ({ ...next, [key]: settingNumber(settings, key) }), {});
    event.currentTarget.setPointerCapture?.(event.pointerId);

    const handleMove = (moveEvent) => {
      const deltaXPercent = (moveEvent.clientX - startX) / rect.width * 100;
      const deltaYPercent = (moveEvent.clientY - startY) / rect.height * 100;
      onDesignChange((current) => {
        const next = { ...current };
        keys.forEach((key) => {
          const isY = key.toLowerCase().includes("y");
          const min = key === "dividerXPercent" ? 20 : 2;
          const max = key === "dividerXPercent" ? 55 : 94;
          next[key] = roundedString(clamp(initial[key] + (isY ? deltaYPercent : deltaXPercent), min, max));
        });
        return next;
      });
    };

    const stopDrag = () => {
      window.removeEventListener("pointermove", handleMove);
      window.removeEventListener("pointerup", stopDrag);
      window.removeEventListener("pointercancel", stopDrag);
    };

    window.addEventListener("pointermove", handleMove);
    window.addEventListener("pointerup", stopDrag, { once: true });
    window.addEventListener("pointercancel", stopDrag, { once: true });
  };

  const startResize = (event, elementName, key, min, max, unit = "mm") => {
    if (!canEdit) return;
    event.preventDefault();
    event.stopPropagation();
    onSelect?.(elementName);
    const rect = labelRef.current?.getBoundingClientRect();
    if (!rect) return;
    const startX = event.clientX;
    const startValue = settingNumber(settings, key);
    event.currentTarget.setPointerCapture?.(event.pointerId);

    const handleMove = (moveEvent) => {
      const deltaPx = moveEvent.clientX - startX;
      const delta = unit === "mm" ? deltaPx / rect.width * labelWidth : deltaPx / 10;
      updateSetting(key, clamp(startValue + delta, min, max));
    };

    const stopResize = () => {
      window.removeEventListener("pointermove", handleMove);
      window.removeEventListener("pointerup", stopResize);
      window.removeEventListener("pointercancel", stopResize);
    };

    window.addEventListener("pointermove", handleMove);
    window.addEventListener("pointerup", stopResize, { once: true });
    window.addEventListener("pointercancel", stopResize, { once: true });
  };

  const elementClass = (name, baseClass) => `${baseClass} ${editable ? "bulk-label-editable-element" : ""} ${selectedElement === name ? "bulk-label-element-selected" : ""}`.trim();
  const handleClass = (name) => editable && selectedElement === name ? "bulk-label-resize-handle" : "hidden";

  return (
    <div
      ref={labelRef}
      className="bulk-label-live-label"
      style={{
        aspectRatio: `${labelWidth} / ${labelHeight}`,
        borderColor: settings.goldColor,
        borderRadius: `${settingNumber(settings, "borderRadiusMm") * 3}px`,
        borderWidth: `${Math.max(1, settingNumber(settings, "borderWidthMm") * 4)}px`,
        color: settings.navyColor,
      }}
    >
      <div
        className={elementClass("brand", "bulk-label-live-brand")}
        onPointerDown={(event) => startDrag(event, "brand", ["brandXPercent", "brandYPercent"])}
        style={{ left: `${brandX}%`, top: `${brandY}%`, width: `${brandWidthPct}%`, transform: "translateX(-50%)" }}
      >
        <img src={LOGO_PATH} alt="" aria-hidden="true" style={{ width: `${logoSizePct}%` }} />
        <p style={{ fontSize: `${settingNumber(settings, "businessFontSizeMm") * 2.6}px` }}>{settings.businessLine1}<br />{settings.businessLine2}</p>
        <button type="button" className={handleClass("brand")} aria-label="Resize logo" onPointerDown={(event) => startResize(event, "brand", "logoSizeMm", 4, 24)} />
      </div>
      <div
        className={elementClass("divider", "bulk-label-live-divider")}
        style={{ left: `${dividerX}%`, background: settings.navyColor }}
        onPointerDown={(event) => startDrag(event, "divider", ["dividerXPercent"])}
        aria-hidden="true"
      />
      <strong
        className={elementClass("ticket", "bulk-label-live-ticket")}
        onPointerDown={(event) => startDrag(event, "ticket", ["ticketXPercent", "ticketYPercent"])}
        style={{
          left: `${ticketX}%`,
          top: `${ticketY}%`,
          color: settings.navyColor,
          fontSize: `${settingNumber(settings, "ticketFontSizeMm") * 3.2}px`,
        }}
      >
        {label.ticketNumber}
        <button type="button" className={handleClass("ticket")} aria-label="Resize ticket number" onPointerDown={(event) => startResize(event, "ticket", "ticketFontSizeMm", 4, 24, "font")} />
      </strong>
      <div className="bulk-label-live-accent" style={{ left: `${(dividerX + qrX) / 2}%`, top: `${Math.min(82, ticketY + 15)}%`, color: settings.goldColor }} aria-hidden="true">
        <span style={{ background: settings.goldColor }} />
        <svg viewBox="0 0 16 28" focusable="false" aria-hidden="true"><polygon points="9,0 1,15 8,15 5,28 15,11 9,11" /></svg>
        <span style={{ background: settings.goldColor }} />
      </div>
      <span
        className={elementClass("subtitle", "bulk-label-live-subtitle")}
        onPointerDown={(event) => startDrag(event, "subtitle", ["subtitleXPercent", "subtitleYPercent"])}
        style={{ left: `${subtitleX}%`, top: `${subtitleY}%`, fontSize: `${settingNumber(settings, "subtitleFontSizeMm") * 2.8}px` }}
      >
        {settings.subtitle}
        <button type="button" className={handleClass("subtitle")} aria-label="Resize subtitle" onPointerDown={(event) => startResize(event, "subtitle", "subtitleFontSizeMm", 2, 12, "font")} />
      </span>
      <div
        className={elementClass("qr", "bulk-label-live-qr")}
        onPointerDown={(event) => startDrag(event, "qr", ["qrXPercent", "qrYPercent"])}
        style={{ left: `${qrX}%`, top: `${qrY}%`, width: `${qrSizePct}%`, borderColor: settings.navyColor }}
      >
        {qrDataUrl ? <img src={qrDataUrl} alt="" aria-hidden="true" /> : <div />}
        <button type="button" className={handleClass("qr")} aria-label="Resize QR code" onPointerDown={(event) => startResize(event, "qr", "qrSizeMm", 6, 22)} />
      </div>
      <span
        className={elementClass("qrCaption", "bulk-label-live-qr-caption")}
        onPointerDown={(event) => startDrag(event, "qrCaption", ["qrCaptionXPercent", "qrCaptionYPercent"])}
        style={{ left: `${qrCaptionX}%`, top: `${qrCaptionY}%`, fontSize: `${settingNumber(settings, "qrCaptionFontSizeMm") * 2.5}px` }}
      >
        {settings.qrCaption}
        <button type="button" className={handleClass("qrCaption")} aria-label="Resize QR caption" onPointerDown={(event) => startResize(event, "qrCaption", "qrCaptionFontSizeMm", 2, 10, "font")} />
      </span>
    </div>
  );
}

export default function BulkTicketLabels() {
  const navigate = useNavigate();
  const [form, setForm] = useState(initialForm);
  const [design, setDesign] = useState(defaultDesignSettings);
  const [errors, setErrors] = useState({});
  const [sampleQrDataUrl, setSampleQrDataUrl] = useState("");
  const [previewLabels, setPreviewLabels] = useState([]);
  const [message, setMessage] = useState("");
  const [selectedElement, setSelectedElement] = useState("");
  const [isPreviewing, setIsPreviewing] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);

  const labelCount = useMemo(() => {
    const start = Number(form.startNumber);
    const end = Number(form.endNumber);
    return Number.isInteger(start) && Number.isInteger(end) && end >= start ? end - start + 1 : 0;
  }, [form.endNumber, form.startNumber]);

  const layout = useMemo(() => getLayout(design), [design]);
  const pageCount = labelCount > 0 ? layout.pageCountFor(labelCount) : 0;
  const sampleTicketNumber = buildTicketNumber(form.prefix, Number(form.startNumber) || 1, Number(form.digits) || 3);
  const sampleUrl = buildTrackingUrl(form.baseUrl, sampleTicketNumber);

  useEffect(() => {
    let isCurrent = true;
    makeQrDataUrl(sampleUrl, 180)
      .then((dataUrl) => {
        if (isCurrent) setSampleQrDataUrl(dataUrl);
      })
      .catch(() => {
        if (isCurrent) setSampleQrDataUrl("");
      });
    return () => {
      isCurrent = false;
    };
  }, [sampleUrl]);

  const updateField = (event) => {
    const { name, value } = event.target;
    setForm((current) => ({ ...current, [name]: value }));
    setErrors((current) => ({ ...current, [name]: "" }));
    setMessage("");
  };

  const updateDesign = (event) => {
    const { name, value } = event.target;
    setDesign((current) => ({ ...current, [name]: value }));
    setErrors((current) => ({ ...current, [name]: "" }));
    setMessage("");
  };

  const getLabels = () => {
    const nextErrors = validateForm(form, design);
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return null;

    const start = Number(form.startNumber);
    const end = Number(form.endNumber);
    const digits = Number(form.digits);

    return Array.from({ length: end - start + 1 }, (_, index) => {
      const ticketNumber = buildTicketNumber(form.prefix, start + index, digits);
      return { ticketNumber, url: buildTrackingUrl(form.baseUrl, ticketNumber) };
    });
  };

  const generatePreview = async () => {
    const labels = getLabels();
    if (!labels) return;

    setIsPreviewing(true);
    setMessage("");
    try {
      const visibleLabels = await Promise.all(labels.slice(0, layout.labelsPerPage).map(async (label) => ({
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

      for (let index = 0; index < labels.length; index += 1) {
        if (index > 0 && index % layout.labelsPerPage === 0) doc.addPage();
        const pageIndex = index % layout.labelsPerPage;
        const col = pageIndex % layout.columns;
        const row = Math.floor(pageIndex / layout.columns);
        const x = layout.pageMargin + col * (layout.labelWidth + layout.horizontalGap);
        const y = layout.pageMargin + row * (layout.labelHeight + layout.verticalGap);
        const qrDataUrl = await makeQrDataUrl(labels[index].url);
        drawPdfLabel(doc, labels[index], x, y, logoDataUrl, qrDataUrl, design);
      }

      doc.save(`bulk-ticket-labels-${labels[0].ticketNumber}-to-${labels[labels.length - 1].ticketNumber}.pdf`);
      setMessage(`PDF generated for ${labels.length} labels across ${layout.pageCountFor(labels.length)} A4 page${labels.length <= layout.labelsPerPage ? "" : "s"}.`);
    } catch {
      setMessage("Unable to generate PDF. Please try again.");
    } finally {
      setIsDownloading(false);
    }
  };

  const resetDesign = () => {
    setDesign(defaultDesignSettings);
    setPreviewLabels([]);
    setMessage("Default design restored.");
  };

  const saveDesign = () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(design));
    setMessage("Label design settings saved locally.");
  };

  const loadDesign = () => {
    try {
      const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}");
      const nextDesign = designFields.reduce((next, key) => ({
        ...next,
        [key]: saved[key] ?? defaultDesignSettings[key],
      }), {});
      setDesign(nextDesign);
      setPreviewLabels([]);
      setMessage("Saved label design settings loaded.");
    } catch {
      setMessage("Unable to load saved label design settings.");
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
            <p className="mt-2 max-w-2xl text-sm font-semibold text-slate-600">Customize scannable QR sticker labels before generating an A4 PDF.</p>
          </div>
          <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-bold text-amber-900">
            {layout.labelsPerPage || 0} labels per page, {labelCount || 0} labels = {pageCount || 0} page{pageCount === 1 ? "" : "s"}
          </div>
        </header>

        <section className="mt-5 grid gap-5 xl:grid-cols-[minmax(0,30rem)_1fr]">
          <div className="space-y-4">
            <form className="space-y-4" onSubmit={(event) => event.preventDefault()}>
              <section className="bulk-label-settings-section">
                <h2>Ticket Range</h2>
                <div className="grid grid-cols-2 gap-3">
                  <DesignNumberInput label="Start Ticket Number" name="startNumber" value={form.startNumber} onChange={updateField} error={errors.startNumber} min="1" />
                  <DesignNumberInput label="End Ticket Number" name="endNumber" value={form.endNumber} onChange={updateField} error={errors.endNumber} min="1" />
                  <DesignNumberInput label="Prefix" name="prefix" value={form.prefix} onChange={updateField} error={errors.prefix} type="text" />
                  <DesignNumberInput label="Digits" name="digits" value={form.digits} onChange={updateField} error={errors.digits} min="3" max="6" />
                </div>
                <DesignNumberInput label="Base Tracking URL" name="baseUrl" value={form.baseUrl} onChange={updateField} error={errors.baseUrl} type="url" />
              </section>

              <section className="bulk-label-settings-section">
                <h2>Label Size / A4 Layout</h2>
                <div className="grid grid-cols-2 gap-3">
                  <DesignNumberInput label="Label Width in mm" name="labelWidthMm" value={design.labelWidthMm} onChange={updateDesign} error={errors.labelWidthMm} min="20" step="0.5" />
                  <DesignNumberInput label="Label Height in mm" name="labelHeightMm" value={design.labelHeightMm} onChange={updateDesign} error={errors.labelHeightMm} min="15" step="0.5" />
                  <DesignNumberInput label="Columns per A4 page" name="columns" value={design.columns} onChange={updateDesign} error={errors.columns} min="1" max="6" />
                  <DesignNumberInput label="Rows per A4 page" name="rows" value={design.rows} onChange={updateDesign} error={errors.rows} min="1" max="12" />
                  <DesignNumberInput label="Horizontal gap in mm" name="horizontalGapMm" value={design.horizontalGapMm} onChange={updateDesign} min="0" step="0.5" />
                  <DesignNumberInput label="Vertical gap in mm" name="verticalGapMm" value={design.verticalGapMm} onChange={updateDesign} min="0" step="0.5" />
                  <DesignNumberInput label="Page margin in mm" name="pageMarginMm" value={design.pageMarginMm} onChange={updateDesign} min="0" step="0.5" />
                </div>
                {errors.layout && <p className="bulk-label-error">{errors.layout}</p>}
                <p className={`bulk-label-fit ${layout.fitsA4 ? "bulk-label-fit-ok" : "bulk-label-fit-bad"}`}>
                  Uses {layout.usedWidth.toFixed(1)}mm x {layout.usedHeight.toFixed(1)}mm of A4 {A4_WIDTH_MM}mm x {A4_HEIGHT_MM}mm.
                </p>
              </section>

              <section className="bulk-label-settings-section">
                <h2>Label Text</h2>
                <div className="grid grid-cols-2 gap-3">
                  <DesignNumberInput label="Business Name Line 1" name="businessLine1" value={design.businessLine1} onChange={updateDesign} type="text" />
                  <DesignNumberInput label="Business Name Line 2" name="businessLine2" value={design.businessLine2} onChange={updateDesign} type="text" />
                  <DesignNumberInput label="Subtitle / Label Type" name="subtitle" value={design.subtitle} onChange={updateDesign} type="text" />
                  <DesignNumberInput label="QR Caption" name="qrCaption" value={design.qrCaption} onChange={updateDesign} type="text" />
                </div>
              </section>

              <section className="bulk-label-settings-section">
                <h2>Style</h2>
                <div className="grid grid-cols-2 gap-3">
                  <DesignNumberInput label="Navy Color" name="navyColor" value={design.navyColor} onChange={updateDesign} type="color" />
                  <DesignNumberInput label="Gold Color" name="goldColor" value={design.goldColor} onChange={updateDesign} type="color" />
                  <DesignNumberInput label="Border Width" name="borderWidthMm" value={design.borderWidthMm} onChange={updateDesign} min="0.1" step="0.05" />
                  <DesignNumberInput label="Border Radius" name="borderRadiusMm" value={design.borderRadiusMm} onChange={updateDesign} min="0" step="0.5" />
                  <DesignNumberInput label="Ticket Font Size" name="ticketFontSizeMm" value={design.ticketFontSizeMm} onChange={updateDesign} error={errors.ticketFontSizeMm} min="1" step="0.2" />
                  <DesignNumberInput label="Business Font Size" name="businessFontSizeMm" value={design.businessFontSizeMm} onChange={updateDesign} error={errors.businessFontSizeMm} min="1" step="0.2" />
                  <DesignNumberInput label="Subtitle Font Size" name="subtitleFontSizeMm" value={design.subtitleFontSizeMm} onChange={updateDesign} error={errors.subtitleFontSizeMm} min="1" step="0.2" />
                  <DesignNumberInput label="QR Caption Font Size" name="qrCaptionFontSizeMm" value={design.qrCaptionFontSizeMm} onChange={updateDesign} error={errors.qrCaptionFontSizeMm} min="1" step="0.2" />
                </div>
              </section>

              <section className="bulk-label-settings-section">
                <h2>Element Size / Position</h2>
                <div className="grid gap-3">
                  <SliderControl label="Logo Size" name="logoSizeMm" value={design.logoSizeMm} onChange={updateDesign} min="4" max="24" step="0.2" suffix="mm" />
                  {errors.logoSizeMm && <p className="bulk-label-error">{errors.logoSizeMm}</p>}
                  <SliderControl label="QR Size" name="qrSizeMm" value={design.qrSizeMm} onChange={updateDesign} min="6" max="22" step="0.2" suffix="mm" />
                  {errors.qrSizeMm && <p className="bulk-label-error">{errors.qrSizeMm}</p>}
                  <SliderControl label="Move Logo/Business Left/Right" name="brandXPercent" value={design.brandXPercent} onChange={updateDesign} min="8" max="32" suffix="%" />
                  <SliderControl label="Move Logo/Business Up/Down" name="brandYPercent" value={design.brandYPercent} onChange={updateDesign} min="4" max="35" suffix="%" />
                  <SliderControl label="Vertical Divider X Position" name="dividerXPercent" value={design.dividerXPercent} onChange={updateDesign} min="25" max="45" suffix="%" />
                  <SliderControl label="Move Ticket Number Left/Right" name="ticketXPercent" value={design.ticketXPercent} onChange={updateDesign} min="38" max="74" suffix="%" />
                  <SliderControl label="Move Ticket Number Up/Down" name="ticketYPercent" value={design.ticketYPercent} onChange={updateDesign} min="25" max="62" suffix="%" />
                  <SliderControl label="Move QR Left/Right" name="qrXPercent" value={design.qrXPercent} onChange={updateDesign} min="60" max="88" suffix="%" />
                  <SliderControl label="Move QR Up/Down" name="qrYPercent" value={design.qrYPercent} onChange={updateDesign} min="5" max="48" suffix="%" />
                  <SliderControl label="Subtitle X Position" name="subtitleXPercent" value={design.subtitleXPercent} onChange={updateDesign} min="38" max="74" suffix="%" />
                  <SliderControl label="Subtitle Y Position" name="subtitleYPercent" value={design.subtitleYPercent} onChange={updateDesign} min="55" max="88" suffix="%" />
                  <SliderControl label="QR Caption X Position" name="qrCaptionXPercent" value={design.qrCaptionXPercent} onChange={updateDesign} min="58" max="96" suffix="%" />
                  <SliderControl label="QR Caption Y Position" name="qrCaptionYPercent" value={design.qrCaptionYPercent} onChange={updateDesign} min="35" max="92" suffix="%" />
                </div>
              </section>
            </form>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <button type="button" onClick={generatePreview} disabled={isPreviewing || isDownloading} className="bulk-label-secondary-button">
                <Eye size={17} aria-hidden="true" /> {isPreviewing ? "Generating..." : "Generate Preview"}
              </button>
              <button type="button" onClick={downloadPdf} disabled={isDownloading || isPreviewing} className="bulk-label-primary-button">
                <Download size={17} aria-hidden="true" /> {isDownloading ? "Preparing..." : "Download PDF"}
              </button>
              <button type="button" onClick={resetDesign} className="bulk-label-secondary-button">
                <RotateCcw size={17} aria-hidden="true" /> Reset to Default Design
              </button>
              <button type="button" onClick={saveDesign} className="bulk-label-secondary-button">
                <Save size={17} aria-hidden="true" /> Save Settings Locally
              </button>
              <button type="button" onClick={loadDesign} className="bulk-label-secondary-button sm:col-span-2">
                <Upload size={17} aria-hidden="true" /> Load Saved Settings
              </button>
            </div>

            <aside className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-amber-950">
              <div className="flex items-start gap-3">
                <TriangleAlert className="mt-0.5 shrink-0" size={20} aria-hidden="true" />
                <p className="text-sm font-bold">Print using A4 paper and 100% / Actual Size. Do not use Fit to Page.</p>
              </div>
            </aside>
          </div>

          <section className="min-w-0 rounded-lg border border-blue-100 bg-white p-4 shadow-sm" aria-label="Label preview">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 className="text-lg font-extrabold text-blue-950">Live Label Preview</h2>
                <p className="text-sm font-semibold text-slate-600">Updates as you edit settings. QR encodes {sampleUrl}</p>
              </div>
              <span className="inline-flex w-fit items-center gap-2 rounded-lg bg-blue-50 px-3 py-2 text-xs font-extrabold text-blue-950">
                <Printer size={15} aria-hidden="true" /> {layout.labelsPerPage || 0} per A4 page
              </span>
            </div>

            {message && <p className={`mt-4 rounded-lg px-4 py-3 text-sm font-bold ${message.startsWith("Unable") ? "bg-red-50 text-red-700" : "bg-green-50 text-green-700"}`}>{message}</p>}

            <div className="bulk-label-live-preview-wrap">
              <LabelPreview
                label={{ ticketNumber: sampleTicketNumber }}
                settings={design}
                qrDataUrl={sampleQrDataUrl}
                editable
                selectedElement={selectedElement}
                onSelect={setSelectedElement}
                onDesignChange={setDesign}
              />
            </div>
            <p className="mt-2 text-xs font-bold text-slate-500">Drag label elements to move them. Use the small square handle on a selected element to resize it.</p>

            <section className="mt-5 rounded-lg border border-blue-100 bg-blue-50 p-4">
              <h2 className="text-sm font-extrabold text-blue-950">Generation Summary</h2>
              <dl className="mt-3 grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
                <div><dt className="font-bold text-slate-500">Labels</dt><dd className="font-extrabold text-blue-950">{labelCount || "Not ready"}</dd></div>
                <div><dt className="font-bold text-slate-500">Pages</dt><dd className="font-extrabold text-blue-950">{pageCount || "Not ready"}</dd></div>
                <div><dt className="font-bold text-slate-500">First</dt><dd className="font-extrabold text-blue-950">{labelCount ? buildTicketNumber(form.prefix, Number(form.startNumber), Number(form.digits)) : "Not ready"}</dd></div>
                <div><dt className="font-bold text-slate-500">Last</dt><dd className="font-extrabold text-blue-950">{labelCount ? buildTicketNumber(form.prefix, Number(form.endNumber), Number(form.digits)) : "Not ready"}</dd></div>
              </dl>
            </section>

            <div className="bulk-label-preview-sheet mt-4">
              {previewLabels.length > 0 ? (
                previewLabels.map((label) => <LabelPreview key={label.ticketNumber} label={label} settings={design} qrDataUrl={label.qrDataUrl} />)
              ) : (
                <div className="bulk-label-empty-state">
                  <p className="text-base font-extrabold text-blue-950">Generate a preview to see the first A4 page.</p>
                  <p className="mt-1 text-sm font-semibold text-slate-600">The PDF will include the full validated range and current design settings.</p>
                </div>
              )}
            </div>
          </section>
        </section>
      </div>
    </main>
  );
}
