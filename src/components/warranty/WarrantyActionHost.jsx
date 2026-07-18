import { useCallback, useEffect, useMemo, useState } from "react";
import {
  updateWarranty,
  moveWarrantyToReadyDelivery,
  moveReplacementToReadyDelivery,
  closeWarrantyClaim,
  markReplacementDelivered,
} from "../../services/warrantyApi";
import WarrantyActions from "./WarrantyActions";
import WarrantyResolutionActions from "./WarrantyResolutionActions";
import WarrantyReplacementActions from "./WarrantyReplacementActions";
import WarrantyDocuments from "./WarrantyDocuments";
import WarrantyDialog from "./WarrantyDialog";
import { mapWarrantyError } from "./warrantyErrorMapper";
import { focusFirstError } from "./warrantyValidation";

const meta = {
  "edit-details": [
    "Edit warranty details",
    "Keep warranty dates and product information accurate.",
  ],
  "complaint-pending": [
    "Mark complaint registration pending",
    "Record the contact attempt and when the manufacturer should be contacted again.",
  ],
  "register-complaint": [
    "Register manufacturer complaint",
    "Enter the details received from the manufacturer. A visit or follow-up date keeps the case actionable.",
  ],
  "schedule-visit": [
    "Schedule manufacturer visit",
    "Set the expected engineer visit. A follow-up is created automatically when one is not supplied.",
  ],
  "update-visit": [
    "Change engineer visit date",
    "Record the new expected visit date and why it changed.",
  ],
  "record-visit": [
    "Record engineer visit",
    "Record what happened. If the engineer did not visit, the case remains open.",
  ],
  "follow-up": [
    "Update manufacturer follow-up",
    "Schedule, update, or clear the next manufacturer follow-up.",
  ],
  "record-result": [
    "Record warranty result",
    "Choose the outcome provided by the manufacturer, then enter only its required details.",
  ],
  "customer-decision": [
    "Record customer decision",
    "Record how the customer wants to proceed after warranty rejection.",
  ],
  "record-replacement": [
    "Record replacement received",
    "Capture the replacement received by the shop. This does not mark it delivered.",
  ],
  "edit-replacement": [
    "Edit replacement details",
    "Update non-identity information. Use Correct Replacement Record for product, model, serial, or reference changes.",
  ],
  "supersede-replacement": [
    "Correct replacement record",
    "This preserves the existing record in history and creates a corrected active replacement.",
  ],
  "move-ready": [
    "Move to Ready for Delivery",
    "The repaired product becomes ready for customer collection. It is not marked delivered.",
  ],
  "move-replacement-ready": [
    "Move replacement to Ready for Delivery",
    "The replacement becomes ready for customer collection. It is not marked delivered.",
  ],
  "confirm-replacement-delivered": [
    "Confirm replacement given to customer",
    "Use only after the normal ticket delivery workflow confirms receipt. This closes the warranty process.",
  ],
  "close-claim": [
    "Close warranty process",
    "This ends active warranty work. Documents and history remain available.",
  ],
  "manage-documents": [
    "Warranty documents",
    "Upload, preview, replace, or remove retained warranty evidence.",
  ],
};
const actionModes = {
  "complaint-pending": "pending",
  "register-complaint": "register",
  "schedule-visit": "schedule",
  "update-visit": "updateVisit",
  "record-visit": "recordVisit",
  "follow-up": "followUp",
};
const resolutionModes = { "customer-decision": "customerDecision" };
const replacementModes = {
  "record-replacement": "record",
  "edit-replacement": "edit",
  "supersede-replacement": "supersede",
};
const empty = {
  billingDate: "",
  warrantyStartDate: "",
  warrantyEndDate: "",
  manufacturerName: "",
  productSerialNumber: "",
  modelNumber: "",
  manufacturerComplaintNumber: "",
  complaintRegisteredDate: "",
  expectedVisitDate: "",
  manufacturerEngineerName: "",
  manufacturerEngineerMobile: "",
  manufacturerServiceCenterName: "",
  warrantyNotes: "",
  nextFollowUpDate: "",
};
const fromClaim = (claim) =>
  Object.fromEntries(Object.keys(empty).map((key) => [key, claim[key] || ""]));

function Field({
  label,
  name,
  value,
  onChange,
  type = "text",
  error,
  inputMode,
}) {
  const errorId = `${name}-error`;
  return (
    <label className="block text-sm font-bold text-slate-700">
      {label}
      <input
        name={name}
        type={type}
        inputMode={inputMode}
        value={value}
        onChange={onChange}
        aria-invalid={Boolean(error)}
        aria-describedby={error ? errorId : undefined}
        className={`mt-1 min-h-11 w-full rounded-xl border px-3 text-base ${error ? "border-red-500" : "border-slate-300"}`}
      />
      {error && (
        <span
          id={errorId}
          className="mt-1 block text-sm font-bold text-red-700"
        >
          {error}
        </span>
      )}
    </label>
  );
}
function DetailsForm({ claim, onSuccess, onError }) {
  const [form, setForm] = useState(() => fromClaim(claim)),
    [errors, setErrors] = useState({}),
    [saving, setSaving] = useState(false);
  const change = (event) => {
    setForm((current) => ({
      ...current,
      [event.target.name]: event.target.value,
    }));
    setErrors((current) => ({ ...current, [event.target.name]: undefined }));
  };
  const submit = async (event) => {
    event.preventDefault();
    const next = {};
    if (!form.manufacturerName)
      next.manufacturerName = "Enter the product manufacturer.";
    if (!form.productSerialNumber && !form.modelNumber) {
      next.productSerialNumber = "Enter a serial number or model.";
      next.modelNumber = "Enter a model or serial number.";
    }
    setErrors(next);
    if (Object.keys(next).length) {
      focusFirstError(event.currentTarget, next);
      return;
    }
    setSaving(true);
    onError("");
    try {
      const body = { version: claim.version };
      Object.keys(empty).forEach((key) => (body[key] = form[key] || null));
      await onSuccess(await updateWarranty(claim.ticketId, claim.id, body));
    } catch (error) {
      onError(error);
    } finally {
      setSaving(false);
    }
  };
  return (
    <form onSubmit={submit} noValidate>
      <fieldset disabled={saving} className="grid gap-3 sm:grid-cols-2">
        <legend className="sr-only">Warranty details</legend>
        <>
          <p className="text-xs font-extrabold uppercase text-slate-500 sm:col-span-2">
            Warranty dates
          </p>
          <Field
            label="Billing date"
            name="billingDate"
            type="date"
            value={form.billingDate}
            onChange={change}
          />
          <Field
            label="Warranty start"
            name="warrantyStartDate"
            type="date"
            value={form.warrantyStartDate}
            onChange={change}
          />
          <Field
            label="Warranty end"
            name="warrantyEndDate"
            type="date"
            value={form.warrantyEndDate}
            onChange={change}
          />
          <p className="text-xs font-extrabold uppercase text-slate-500 sm:col-span-2">
            Product and manufacturer
          </p>
          <Field
            label="Manufacturer"
            name="manufacturerName"
            value={form.manufacturerName}
            onChange={change}
            error={errors.manufacturerName}
          />
          <Field
            label="Product serial number"
            name="productSerialNumber"
            value={form.productSerialNumber}
            onChange={change}
            error={errors.productSerialNumber}
          />
          <Field
            label="Model number"
            name="modelNumber"
            value={form.modelNumber}
            onChange={change}
            error={errors.modelNumber}
          />
          <Field
            label="Engineer mobile"
            name="manufacturerEngineerMobile"
            type="tel"
            inputMode="tel"
            value={form.manufacturerEngineerMobile}
            onChange={change}
          />
          <label className="text-sm font-bold text-slate-700 sm:col-span-2">
            Warranty notes
            <textarea
              name="warrantyNotes"
              value={form.warrantyNotes}
              onChange={change}
              maxLength={2000}
              rows={4}
              className="mt-1 w-full rounded-xl border border-slate-300 p-3"
            />
          </label>
        </>
        <button className="ke-primary-action min-h-11 rounded-xl px-4 font-extrabold sm:col-span-2">
          {saving ? "Saving warranty details…" : "Save warranty details"}
        </button>
      </fieldset>
    </form>
  );
}

function ConsequenceConfirmation({ actionKey, claim, onSuccess, onError }) {
  const [notes, setNotes] = useState(""),
    [saving, setSaving] = useState(false);
  const submit = async () => {
    if (saving) return;
    setSaving(true);
    try {
      let response;
      if (actionKey === "move-ready")
        response = await moveWarrantyToReadyDelivery(claim.ticketId, claim.id, {
          version: claim.version,
        });
      if (actionKey === "move-replacement-ready")
        response = await moveReplacementToReadyDelivery(
          claim.ticketId,
          claim.id,
          { version: claim.version },
        );
      if (actionKey === "confirm-replacement-delivered")
        response = await markReplacementDelivered(claim.ticketId, claim.id, {
          deliveredDate: new Date().toLocaleDateString("en-CA", {
            timeZone: "Asia/Kolkata",
          }),
          claimVersion: claim.version,
          replacementVersion: claim.activeReplacement.version,
        });
      if (actionKey === "close-claim")
        response = await closeWarrantyClaim(claim.ticketId, claim.id, {
          version: claim.version,
          notes,
        });
      await onSuccess(response);
    } catch (error) {
      onError(error);
    } finally {
      setSaving(false);
    }
  };
  return (
    <div>
      {actionKey === "close-claim" && (
        <label className="block text-sm font-bold">
          Closure notes
          <textarea
            value={notes}
            onChange={(event) => setNotes(event.target.value)}
            rows={4}
            className="mt-1 w-full rounded-xl border p-3"
          />
        </label>
      )}
      <button
        type="button"
        onClick={submit}
        disabled={saving || (actionKey === "close-claim" && !notes.trim())}
        className="ke-primary-action min-h-11 w-full rounded-xl px-4 font-extrabold disabled:opacity-50"
      >
        {saving
          ? actionKey.includes("move")
            ? "Moving ticket…"
            : "Saving…"
          : actionKey === "confirm-replacement-delivered"
            ? "Confirm delivery and close"
            : actionKey === "close-claim"
              ? "Close warranty process"
              : "Move ticket to Ready for Delivery"}
      </button>
    </div>
  );
}

export default function WarrantyActionHost({
  activeActionKey,
  context,
  claim,
  canManageDocuments,
  onClose,
  onSuccess,
  onReload,
  onError,
}) {
  const [dirty, setDirty] = useState(false),
    [discardOpen, setDiscardOpen] = useState(false),
    [conflict, setConflict] = useState(false),
    [localError, setLocalError] = useState("");
  const details = meta[activeActionKey] || [
    "Warranty action",
    "Complete the information required for this warranty step.",
  ];
  const resetAndClose = useCallback(() => {
    setDirty(false);
    setDiscardOpen(false);
    setConflict(false);
    setLocalError("");
    onClose();
  }, [onClose]);
  const requestClose = useCallback(() => {
    if (dirty) setDiscardOpen(true);
    else resetAndClose();
  }, [dirty, resetAndClose]);
  useEffect(() => {
    if (!activeActionKey) return;
    history.pushState(
      { ...history.state, warrantyAction: activeActionKey },
      "",
    );
    const pop = () => {
      if (dirty) {
        history.pushState(
          { ...history.state, warrantyAction: activeActionKey },
          "",
        );
        setDiscardOpen(true);
      } else resetAndClose();
    };
    const unload = (event) => {
      if (dirty) {
        event.preventDefault();
        event.returnValue = "";
      }
    };
    window.addEventListener("popstate", pop);
    window.addEventListener("beforeunload", unload);
    return () => {
      window.removeEventListener("popstate", pop);
      window.removeEventListener("beforeunload", unload);
    };
  }, [activeActionKey, dirty, resetAndClose]);
  useEffect(() => {
    const timer = window.setTimeout(() => {
      setConflict(false);
      setLocalError("");
    }, 0);
    return () => window.clearTimeout(timer);
  }, [claim.version]);
  const reportError = useCallback(
    (error) => {
      if (!error) {
        setLocalError("");
        setConflict(false);
        onError("");
        return;
      }
      const mapped = mapWarrantyError(error);
      setLocalError(mapped.message);
      setConflict(Boolean(mapped.conflict));
      onError(mapped.message);
    },
    [onError],
  );
  const updated = async (response) => {
    setDirty(false);
    setConflict(false);
    await onSuccess(response, activeActionKey);
  };
  // The action body and callback intentionally share activeActionKey.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const content = useMemo(() => {
    if (!activeActionKey) return null;
    if (activeActionKey === "edit-details")
      return (
        <DetailsForm claim={claim} onSuccess={updated} onError={reportError} />
      );
    if (actionModes[activeActionKey])
      return (
        <WarrantyActions
          ticketId={claim.ticketId}
          claim={claim}
          forcedAction={actionModes[activeActionKey]}
          onUpdated={updated}
          onError={reportError}
        />
      );
    if (activeActionKey === "record-result")
      return (
        <WarrantyResolutionActions
          ticketId={claim.ticketId}
          claim={claim}
          onUpdated={updated}
          onError={reportError}
        />
      );
    if (resolutionModes[activeActionKey])
      return (
        <WarrantyResolutionActions
          ticketId={claim.ticketId}
          claim={claim}
          forcedAction={resolutionModes[activeActionKey]}
          onUpdated={updated}
          onError={reportError}
        />
      );
    if (replacementModes[activeActionKey])
      return (
        <WarrantyReplacementActions
          ticketId={claim.ticketId}
          claim={claim}
          forcedMode={replacementModes[activeActionKey]}
          onUpdated={updated}
          onError={reportError}
        />
      );
    if (
      [
        "move-ready",
        "move-replacement-ready",
        "confirm-replacement-delivered",
        "close-claim",
      ].includes(activeActionKey)
    )
      return (
        <ConsequenceConfirmation
          actionKey={activeActionKey}
          claim={claim}
          onSuccess={updated}
          onError={reportError}
        />
      );
    if (activeActionKey === "manage-documents")
      return (
        <WarrantyDocuments
          ticketId={claim.ticketId}
          claim={claim}
          canManage={canManageDocuments}
          initialCategory={context?.category}
          onError={reportError}
          onChanged={onReload}
        />
      );
    return null;
  }, [
    activeActionKey,
    canManageDocuments,
    claim,
    context?.category,
    onReload,
    reportError,
  ]);
  return (
    <>
      <WarrantyDialog
        open={Boolean(activeActionKey)}
        title={details[0]}
        description={details[1]}
        onClose={requestClose}
        closeDisabled={false}
      >
        <div
          onChangeCapture={() => setDirty(true)}
          onInputCapture={() => setDirty(true)}
        >
          {localError && (
            <div
              className={`mb-3 rounded-xl p-3 text-sm font-bold ${conflict ? "bg-amber-50 text-amber-950" : "bg-red-50 text-red-700"}`}
              role="alert"
            >
              <p>{localError}</p>
              {conflict && (
                <>
                  <p className="mt-1 font-semibold">
                    Reload the latest information before submitting again. Your
                    entries remain visible until you choose.
                  </p>
                  <div className="mt-2 flex gap-2">
                    <button
                      type="button"
                      onClick={onReload}
                      className="min-h-10 rounded-lg border px-3"
                    >
                      Reload Latest
                    </button>
                    <button
                      type="button"
                      onClick={requestClose}
                      className="min-h-10 rounded-lg border px-3"
                    >
                      Cancel
                    </button>
                  </div>
                </>
              )}
            </div>
          )}
          <fieldset disabled={conflict}>{content}</fieldset>
        </div>
      </WarrantyDialog>
      <WarrantyDialog
        open={discardOpen}
        title="Discard changes?"
        description="The information entered in this form has not been saved."
        onClose={() => setDiscardOpen(false)}
        variant="modal"
        destructive
      >
        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() => setDiscardOpen(false)}
            className="min-h-11 rounded-xl border font-bold"
          >
            Keep Editing
          </button>
          <button
            type="button"
            onClick={resetAndClose}
            className="min-h-11 rounded-xl bg-red-700 font-bold text-white"
          >
            Discard changes
          </button>
        </div>
      </WarrantyDialog>
    </>
  );
}
