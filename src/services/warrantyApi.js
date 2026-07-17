function headers(json = false) {
  return { Authorization: `Bearer ${localStorage.getItem("token")}`, ...(json ? { "Content-Type": "application/json" } : {}) };
}
async function parse(response) {
  if (response.status === 204) return null;
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(data.message || "Warranty request failed");
    error.status = response.status;
    throw error;
  }
  return data;
}
export async function getWarranty(ticketId) { return parse(await fetch(`/volt/tickets/${ticketId}/warranty`, { headers: headers() })); }
export async function createWarranty(ticketId, body = {}) { return parse(await fetch(`/volt/tickets/${ticketId}/warranty`, { method: "POST", headers: headers(true), body: JSON.stringify(body) })); }
export async function updateWarranty(ticketId, claimId, body) { return parse(await fetch(`/volt/tickets/${ticketId}/warranty/${claimId}`, { method: "PATCH", headers: headers(true), body: JSON.stringify(body) })); }
export async function getWarrantyEvents(ticketId, claimId) { return parse(await fetch(`/volt/tickets/${ticketId}/warranty/${claimId}/events?page=0&size=10`, { headers: headers() })); }
export async function getAssignableEmployees() { return parse(await fetch("/volt/tickets/assignable-employees", { headers: headers() })); }
async function warrantyAction(ticketId, claimId, path, method, body) { return parse(await fetch(`/volt/tickets/${ticketId}/warranty/${claimId}/${path}`, { method, headers: headers(true), body: JSON.stringify(body) })); }
export const markComplaintRegistrationPending = (ticketId, claimId, body) => warrantyAction(ticketId, claimId, "actions/complaint-registration-pending", "POST", body);
export const registerWarrantyComplaint = (ticketId, claimId, body) => warrantyAction(ticketId, claimId, "actions/register-complaint", "POST", body);
export const scheduleWarrantyVisit = (ticketId, claimId, body) => warrantyAction(ticketId, claimId, "actions/schedule-visit", "POST", body);
export const updateExpectedWarrantyVisit = (ticketId, claimId, body) => warrantyAction(ticketId, claimId, "visit", "PATCH", body);
export const recordWarrantyVisit = (ticketId, claimId, body) => warrantyAction(ticketId, claimId, "actions/record-visit", "POST", body);
export const updateWarrantyFollowUp = (ticketId, claimId, body) => warrantyAction(ticketId, claimId, "follow-up", "PUT", body);
export const markManufacturerRepairDone = (ticketId, claimId, body) => warrantyAction(ticketId, claimId, "actions/manufacturer-repair-done", "POST", body);
export const rejectWarranty = (ticketId, claimId, body) => warrantyAction(ticketId, claimId, "actions/reject", "POST", body);
export const recordWarrantyCustomerDecision = (ticketId, claimId, body) => warrantyAction(ticketId, claimId, "actions/customer-decision", "POST", body);
export const markWarrantyCustomerDidNotProceed = (ticketId, claimId, body) => warrantyAction(ticketId, claimId, "actions/customer-did-not-proceed", "POST", body);
export const markReplacementApproved = (ticketId, claimId, body) => warrantyAction(ticketId, claimId, "actions/replacement-approved", "POST", body);
export const moveWarrantyToReadyDelivery = (ticketId, claimId, body) => warrantyAction(ticketId, claimId, "actions/move-to-ready-delivery", "POST", body);
export const closeWarrantyClaim = (ticketId, claimId, body) => warrantyAction(ticketId, claimId, "actions/close", "POST", body);
export const getWarrantyReplacements = (ticketId, claimId) => warrantyAction(ticketId, claimId, "replacements", "GET");
export const recordWarrantyReplacement = (ticketId, claimId, body) => warrantyAction(ticketId, claimId, "replacements", "POST", body);
export const updateWarrantyReplacement = (ticketId, claimId, replacementId, body) => warrantyAction(ticketId, claimId, `replacements/${replacementId}`, "PATCH", body);
export const supersedeWarrantyReplacement = (ticketId, claimId, replacementId, body) => warrantyAction(ticketId, claimId, `replacements/${replacementId}/supersede`, "POST", body);
export const moveReplacementToReadyDelivery = (ticketId, claimId, body) => warrantyAction(ticketId, claimId, "actions/move-replacement-to-ready-delivery", "POST", body);
export const markReplacementDelivered = (ticketId, claimId, body) => warrantyAction(ticketId, claimId, "actions/replacement-delivered", "POST", body);
export const getWarrantyAttachments = (ticketId, claimId) => warrantyAction(ticketId, claimId, "attachments", "GET");
export const getWarrantyDocumentSummary = (ticketId, claimId) => warrantyAction(ticketId, claimId, "attachments/summary", "GET");
export function uploadWarrantyAttachment(ticketId,claimId,{category,replacementId,file},progress){const f=new FormData();f.append("category",category);if(replacementId)f.append("replacementId",replacementId);f.append("file",file);return multipart(`/volt/tickets/${ticketId}/warranty/${claimId}/attachments`,f,progress);}
export function supersedeWarrantyAttachment(ticketId,claimId,id,{file,reason,version},progress){const f=new FormData();f.append("file",file);return multipart(`/volt/tickets/${ticketId}/warranty/${claimId}/attachments/${id}/supersede?reason=${encodeURIComponent(reason)}&version=${version}`,f,progress);}
export async function deactivateWarrantyAttachment(ticketId,claimId,id,reason,version){return parse(await fetch(`/volt/tickets/${ticketId}/warranty/${claimId}/attachments/${id}?reason=${encodeURIComponent(reason)}&version=${version}`,{method:"DELETE",headers:headers()}));}
export async function fetchWarrantyAttachmentBlob(path){const r=await fetch(path,{headers:headers()});if(!r.ok)await parse(r);return r.blob();}
function multipart(url,form,progress){return new Promise((resolve,reject)=>{const x=new XMLHttpRequest();x.open("POST",url);x.setRequestHeader("Authorization",`Bearer ${localStorage.getItem("token")}`);x.upload.onprogress=(e)=>e.lengthComputable&&progress?.(Math.round(e.loaded/e.total*100));x.onload=()=>{const d=x.responseText?JSON.parse(x.responseText):null;if(x.status>=200&&x.status<300)resolve(d);else{const error=new Error(d?.message||"Warranty upload failed");error.status=x.status;reject(error);}};x.onerror=()=>reject(new Error("Warranty upload failed"));x.send(form);});}
