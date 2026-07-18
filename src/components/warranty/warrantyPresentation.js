export const STATE_LABELS = {
  DETAILS_REQUIRED: "Warranty setup incomplete",
  COMPLAINT_REQUIRED: "Ready to register complaint",
  COMPLAINT_REGISTRATION_PENDING: "Complaint registration in progress",
  VISIT_SCHEDULING_REQUIRED: "Manufacturer visit needs scheduling",
  VISIT_PENDING: "Manufacturer visit pending",
  VISIT_COMPLETED_AWAITING_RESULT: "Visit complete — outcome required",
  AWAITING_RESULT: "Awaiting warranty outcome",
  MANUFACTURER_REPAIR_COMPLETED: "Manufacturer repair complete",
  REPLACEMENT_APPROVED_AWAITING_PRODUCT: "Replacement approved — awaiting product",
  WARRANTY_REJECTED_AWAITING_DECISION: "Warranty rejected — customer decision needed",
  CUSTOMER_DECISION_PENDING: "Customer journey pending",
  REPLACEMENT_RECEIVED: "Replacement received",
  RESOLVED: "Warranty resolved",
  DELIVERY_PENDING: "Ready for customer delivery",
  CLOSED: "Warranty process closed",
};

export const RESULT_LABELS = {
  PENDING: "Outcome not recorded",
  MANUFACTURER_REPAIR_DONE: "Repaired by manufacturer",
  REPLACEMENT_DONE: "Replacement provided",
  WARRANTY_REJECTED: "Warranty rejected",
  CUSTOMER_DID_NOT_PROCEED: "Customer did not proceed",
};

const registry = {
  COMPLETE_WARRANTY_DETAILS: ["edit-details", "Complete warranty details", "Add the manufacturer and product identification needed to continue.", "MANAGE_WARRANTY"],
  REGISTER_MANUFACTURER_COMPLAINT: ["register-complaint", "Register manufacturer complaint", "Record the complaint number and the next expected step.", "MANAGE_WARRANTY"],
  FOLLOW_UP_COMPLAINT_REGISTRATION: ["follow-up", "Follow up for complaint number", "Contact the manufacturer and record the next follow-up.", "MANAGE_WARRANTY"],
  ADD_EXPECTED_VISIT_DATE: ["schedule-visit", "Schedule manufacturer visit", "Set the expected engineer visit date.", "MANAGE_WARRANTY"],
  FOLLOW_UP_MANUFACTURER: ["follow-up", "Follow up with manufacturer", "Record the latest follow-up and next due date.", "MANAGE_WARRANTY"],
  RESCHEDULE_MANUFACTURER_VISIT: ["update-visit", "Reschedule manufacturer visit", "Update the expected date and record why it changed.", "MANAGE_WARRANTY"],
  RECORD_MANUFACTURER_VISIT: ["record-visit", "Record manufacturer visit", "Capture what happened during the engineer visit.", "MANAGE_WARRANTY"],
  RECORD_WARRANTY_RESULT: ["record-result", "Record warranty result", "Choose the outcome provided by the manufacturer.", "RESOLVE_WARRANTY"],
  MOVE_TO_READY_DELIVERY: ["move-ready", "Move to Ready for Delivery", "Continue the repaired ticket through the configured delivery workflow.", "RESOLVE_WARRANTY"],
  RECORD_CUSTOMER_DECISION: ["customer-decision", "Record customer decision", "Record how the customer wants to proceed after rejection.", "RESOLVE_WARRANTY"],
  CONTINUE_AS_PAID_REPAIR: [null, "Continue as paid repair", "Complete the configured paid-repair ticket workflow.", null],
  CLOSE_WARRANTY_CLAIM: ["close-claim", "Close warranty process", "Close this completed warranty journey with a note.", "RESOLVE_WARRANTY"],
  FOLLOW_UP_REPLACEMENT: [null, "Follow up for replacement", "Contact the manufacturer about the overdue replacement, then update the expected date if needed.", null],
  RECORD_REPLACEMENT: ["record-replacement", "Record replacement received", "Add the replacement product received by the shop.", "RESOLVE_WARRANTY"],
  COMPLETE_REPLACEMENT_DETAILS: ["supersede-replacement", "Correct replacement details", "Create a corrected replacement record with the missing serial and reference.", "RESOLVE_WARRANTY"],
  MOVE_REPLACEMENT_TO_READY_DELIVERY: ["move-replacement-ready", "Move replacement to Ready for Delivery", "Continue the replacement through the configured delivery workflow.", "RESOLVE_WARRANTY"],
  DELIVER_REPLACEMENT_TO_CUSTOMER: ["confirm-replacement-delivered", "Confirm customer delivery", "Complete the ticket delivery workflow first, then confirm that the replacement was given to the customer.", "RESOLVE_WARRANTY"],
  NO_IMMEDIATE_ACTION: [null, "No immediate action", "There is no warranty action due right now.", null],
};

export function pendingPresentation(pending) {
  const entry = registry[pending?.code] || [null, pending?.label || "Review warranty", "Review the warranty record before continuing.", null];
  return { key: entry[0], label: entry[1], description: entry[2], permission: entry[3], code: pending?.code || "NO_IMMEDIATE_ACTION" };
}

export function businessStatus(claim) {
  if (!claim) return "Warranty not started";
  return STATE_LABELS[claim.state] || "Warranty status unavailable";
}

const done = (label, status = "COMPLETED", note) => ({ label, status, note });
export function journeyFor(claim) {
  if (!claim) return [];
  const stages = [done("Claim Setup", "UPCOMING"), done("Complaint", "UPCOMING"), done("Manufacturer Visit", "UPCOMING"), done("Resolution", "UPCOMING"), done("Delivery", "UPCOMING")];
  const state = claim.state;
  const pending = claim.pendingAction;
  const setupComplete = Boolean(claim.manufacturerName && (claim.productSerialNumber || claim.modelNumber));
  stages[0].status = setupComplete ? "COMPLETED" : pending?.blocking ? "BLOCKED" : "CURRENT";
  if (!setupComplete) return stages;
  const complaintComplete = Boolean(claim.manufacturerComplaintNumber && claim.complaintRegisteredDate);
  stages[1].status = complaintComplete ? "COMPLETED" : "CURRENT";
  if (!complaintComplete) return stages;
  const visitComplete = Boolean(claim.actualVisitDate && claim.visitOutcome && claim.visitOutcome !== "ENGINEER_DID_NOT_VISIT");
  stages[2].status = visitComplete ? "COMPLETED" : pending?.overdue && ["RESCHEDULE_MANUFACTURER_VISIT", "RECORD_MANUFACTURER_VISIT"].includes(pending.code) ? "BLOCKED" : "CURRENT";
  const hasResolution = claim.result && claim.result !== "PENDING";
  const overriddenResolution = hasResolution && !visitComplete;
  if (overriddenResolution) { stages[2].status = "NOT_APPLICABLE"; stages[2].note = "Bypassed with authorization"; }
  if (!visitComplete && !hasResolution) return stages;
  const replacementWaiting = state === "REPLACEMENT_APPROVED_AWAITING_PRODUCT";
  stages[3].status = replacementWaiting || !hasResolution ? "CURRENT" : pending?.code === "COMPLETE_REPLACEMENT_DETAILS" ? "BLOCKED" : "COMPLETED";
  const deliveryApplicable = claim.result === "MANUFACTURER_REPAIR_DONE" || claim.result === "REPLACEMENT_DONE" || replacementWaiting;
  if (!deliveryApplicable) { stages[4].status = "NOT_APPLICABLE"; return stages; }
  if (replacementWaiting || !hasResolution) return stages;
  stages[4].status = claim.active ? "CURRENT" : "COMPLETED";
  return stages;
}

export function detailSectionFor(claim) {
  const code = claim?.pendingAction?.code || "";
  if (code.includes("COMPLAINT")) return "complaint";
  if (code.includes("VISIT") || code.includes("FOLLOW_UP_MANUFACTURER")) return "visit";
  if (code.includes("REPLACEMENT")) return "replacement";
  if (["RECORD_WARRANTY_RESULT", "RECORD_CUSTOMER_DECISION", "CLOSE_WARRANTY_CLAIM", "MOVE_TO_READY_DELIVERY"].includes(code)) return "resolution";
  return code === "COMPLETE_WARRANTY_DETAILS" ? "basics" : "visit";
}

const reasonCopy = {
  MANUFACTURER_MISSING: "Manufacturer information is required.",
  PRODUCT_IDENTIFICATION_MISSING: "Add a product serial number or model.",
  EXPECTED_VISIT_OVERDUE: "The manufacturer visit is overdue.",
  FOLLOW_UP_OVERDUE: "The manufacturer follow-up is overdue.",
  REPLACEMENT_DETAILS_INCOMPLETE: "Replacement serial or reference details are incomplete.",
  EXPECTED_REPLACEMENT_DATE_PASSED: "The expected replacement date has passed.",
};

export function buildAlerts(claim, documentSummary) {
  const alerts = [];
  (claim?.pendingAction?.reasons || []).forEach((reason) => {
    const message = reasonCopy[reason];
    if (message) alerts.push({ id: reason, severity: claim.pendingAction.blocking ? "blocking" : claim.pendingAction.overdue ? "overdue" : "info", message });
  });
  (documentSummary?.requirements || []).filter((r) => r.required && !r.present && !r.overridden).forEach((r) => alerts.push({ id: `doc-${r.category}`, severity: "document", message: `${r.label.replace(/^Upload /, "")} is required before continuing.`, actionKey: "manage-documents", category: r.category }));
  return alerts.filter((alert, index, all) => all.findIndex((x) => x.message === alert.message) === index);
}

export const formatDate = (value) => value ? new Intl.DateTimeFormat("en-IN", { dateStyle: "medium" }).format(new Date(`${value}T00:00:00`)) : null;
export const formatDateTime = (value) => value ? new Intl.DateTimeFormat("en-IN", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value)) : null;
