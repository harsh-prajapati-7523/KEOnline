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
