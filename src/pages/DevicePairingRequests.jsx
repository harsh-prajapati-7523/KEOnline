import { useCallback, useEffect, useMemo, useState } from "react";
import { ArrowLeft, CheckCircle2, RefreshCw, Save, Smartphone, Trash2 } from "lucide-react";
import { useNavigate } from "react-router-dom";

function authHeaders(includeContentType = false) {
  return {
    ...(includeContentType ? { "Content-Type": "application/json" } : {}),
    Authorization: `Bearer ${localStorage.getItem("token")}`,
  };
}

async function readApiError(response, fallback) {
  try {
    const body = await response.json();
    return typeof body.message === "string" && body.message.length <= 160 ? body.message : fallback;
  } catch {
    return fallback;
  }
}

function parsePairingToken(value) {
  const token = value.trim();
  if (!token) throw new Error("Paste or scan a pairing token first.");
  const parsed = JSON.parse(token);
  return {
    requestId: parsed.requestId,
    nonce: parsed.nonce,
    expiresAt: parsed.expiresAt,
    signature: parsed.signature,
  };
}

export default function DevicePairingRequests() {
  const navigate = useNavigate();
  const [pendingRequests, setPendingRequests] = useState([]);
  const [trustedDevices, setTrustedDevices] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [pairingToken, setPairingToken] = useState("");
  const [selectedEmployeeId, setSelectedEmployeeId] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [revokingDeviceId, setRevokingDeviceId] = useState(null);
  const [message, setMessage] = useState("");
  const [messageType, setMessageType] = useState("success");

  const activeEmployees = useMemo(
    () => employees.filter((employee) => employee.active),
    [employees]
  );

  const loadData = useCallback(async () => {
    setIsLoading(true);
    setMessage("");
    try {
      const [pendingResponse, trustedResponse, employeesResponse] = await Promise.all([
        fetch("/volt/auth/device-pairing/pending", { headers: authHeaders() }),
        fetch("/volt/auth/device-pairing/trusted-devices", { headers: authHeaders() }),
        fetch("/volt/employees", { headers: authHeaders() }),
      ]);
      if (!pendingResponse.ok) throw new Error(await readApiError(pendingResponse, "Unable to load pending pairing requests."));
      if (!trustedResponse.ok) throw new Error(await readApiError(trustedResponse, "Unable to load trusted devices."));
      if (!employeesResponse.ok) throw new Error(await readApiError(employeesResponse, "Unable to load employees."));
      setPendingRequests(await pendingResponse.json());
      setTrustedDevices(await trustedResponse.json());
      setEmployees(await employeesResponse.json());
    } catch (error) {
      setPendingRequests([]);
      setTrustedDevices([]);
      setEmployees([]);
      setMessageType("error");
      setMessage(error.message || "Unable to load device pairing requests.");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const approve = async () => {
    if (isSaving) return;
    setIsSaving(true);
    setMessage("");
    try {
      const parsedToken = parsePairingToken(pairingToken);
      if (!selectedEmployeeId) throw new Error("Select an employee for this device.");
      const response = await fetch("/volt/auth/device-pairing/approve", {
        method: "PATCH",
        headers: authHeaders(true),
        body: JSON.stringify({
          ...parsedToken,
          employeeId: selectedEmployeeId,
        }),
      });
      if (!response.ok) throw new Error(await readApiError(response, "Unable to approve device pairing."));
      setMessageType("success");
      setMessage("Device pairing approved.");
      setPairingToken("");
      setSelectedEmployeeId("");
      await loadData();
    } catch (error) {
      setMessageType("error");
      setMessage(error.message || "Unable to approve device pairing.");
    } finally {
      setIsSaving(false);
    }
  };

  const revokeTrustedDevice = async (device) => {
    if (!device?.id || revokingDeviceId) return;
    const confirmed = window.confirm(`Revoke trusted device for ${device.employeeName || device.employeeId || "this employee"}?\n\nPIN login will stop working on that device immediately.`);
    if (!confirmed) return;

    setRevokingDeviceId(device.id);
    setMessage("");
    try {
      const response = await fetch(`/volt/auth/device-pairing/trusted-devices/${device.id}/revoke`, {
        method: "PATCH",
        headers: authHeaders(),
      });
      if (!response.ok) throw new Error(await readApiError(response, "Unable to revoke trusted device."));
      setMessageType("success");
      setMessage("Trusted device revoked.");
      await loadData();
    } catch (error) {
      setMessageType("error");
      setMessage(error.message || "Unable to revoke trusted device.");
    } finally {
      setRevokingDeviceId(null);
    }
  };

  return (
    <main className="min-h-screen bg-gray-50 px-4 py-6 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-4xl">
        <button type="button" onClick={() => navigate("/settings")} className="flex items-center gap-2 font-semibold text-blue-950">
          <ArrowLeft size={18} aria-hidden="true" /> Settings
        </button>

        <header className="mt-4 rounded-2xl bg-blue-950 p-5 text-white shadow-lg">
          <div className="flex min-w-0 items-center gap-3">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-white/15">
              <Smartphone size={24} aria-hidden="true" />
            </div>
            <div className="min-w-0">
              <h1 className="break-words text-2xl font-extrabold">Device Pairing Requests</h1>
              <p className="mt-1 break-words text-sm font-semibold text-blue-100">Approve trusted devices for roles using Device Pairing + PIN.</p>
            </div>
          </div>
        </header>

        {message && (
          <p className={`mt-4 rounded-xl border px-4 py-3 text-sm font-semibold ${messageType === "error" ? "border-red-200 bg-red-50 text-red-700" : "border-green-200 bg-green-50 text-green-700"}`}>
            {message}
          </p>
        )}

        <section className="mt-5 rounded-2xl border border-blue-100 bg-white p-5 shadow-sm">
          <h2 className="text-xl font-extrabold text-blue-950">Approve Device</h2>
          <div className="mt-4 grid gap-4">
            <label className="font-semibold text-gray-700">
              Pairing QR Token
              <textarea
                value={pairingToken}
                onChange={(event) => setPairingToken(event.target.value)}
                rows={4}
                className="mt-2 w-full rounded-xl border border-gray-300 bg-white px-4 py-3 font-mono text-sm outline-none focus:border-blue-950"
                placeholder='{"requestId":"...","nonce":"...","expiresAt":"...","signature":"..."}'
              />
            </label>

            <label className="font-semibold text-gray-700">
              Employee
              <select
                value={selectedEmployeeId}
                onChange={(event) => setSelectedEmployeeId(event.target.value)}
                disabled={isLoading || activeEmployees.length === 0}
                className="mt-2 w-full rounded-xl border border-gray-300 bg-white px-4 py-3 outline-none focus:border-blue-950 disabled:opacity-60"
              >
                <option value="">{isLoading ? "Loading employees..." : "Select employee"}</option>
                {activeEmployees.map((employee) => (
                  <option key={employee.id} value={employee.employeeId}>
                    {employee.name} ({employee.employeeId})
                  </option>
                ))}
              </select>
            </label>

            <button
              type="button"
              onClick={approve}
              disabled={isSaving || isLoading}
              className="flex min-h-12 items-center justify-center gap-2 rounded-2xl bg-blue-950 px-5 py-3 font-bold text-white transition hover:bg-blue-900 disabled:opacity-60"
            >
              {isSaving ? <RefreshCw size={18} aria-hidden="true" /> : <Save size={18} aria-hidden="true" />}
              {isSaving ? "Approving..." : "Approve"}
            </button>
          </div>
        </section>

        <section className="mt-5 rounded-2xl border border-blue-100 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-xl font-extrabold text-blue-950">Pending Requests</h2>
            <button type="button" onClick={loadData} disabled={isLoading} className="flex min-h-10 items-center gap-2 rounded-xl border border-blue-950 px-3 py-2 text-sm font-bold text-blue-950 disabled:opacity-60">
              <RefreshCw size={16} aria-hidden="true" />
              Refresh
            </button>
          </div>

          {isLoading && <p className="mt-4 rounded-xl bg-gray-50 px-4 py-3 text-sm font-semibold text-gray-600">Loading requests...</p>}
          {!isLoading && pendingRequests.length === 0 && (
            <p className="mt-4 rounded-xl bg-gray-50 px-4 py-3 text-sm font-semibold text-gray-600">No pending requests.</p>
          )}
          {!isLoading && pendingRequests.length > 0 && (
            <div className="mt-4 space-y-3">
              {pendingRequests.map((request) => (
                <div key={request.requestId} className="rounded-xl border border-gray-200 bg-gray-50 p-4">
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                    <div className="min-w-0">
                      <p className="break-words font-bold text-slate-900">{request.deviceLabel || "Unknown device"}</p>
                      <p className="mt-1 break-all font-mono text-xs font-semibold text-slate-500">{request.requestId}</p>
                    </div>
                    <span className="inline-flex w-fit items-center gap-2 rounded-full bg-yellow-100 px-3 py-1 text-xs font-bold text-yellow-800">
                      <CheckCircle2 size={14} aria-hidden="true" />
                      {request.status}
                    </span>
                  </div>
                  <p className="mt-2 text-sm font-semibold text-slate-600">Expires: {new Date(request.expiresAt).toLocaleString()}</p>
                </div>
              ))}
            </div>
          )}
        </section>

        <section className="mt-5 rounded-2xl border border-blue-100 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-xl font-extrabold text-blue-950">Trusted Devices</h2>
            <button type="button" onClick={loadData} disabled={isLoading} className="flex min-h-10 items-center gap-2 rounded-xl border border-blue-950 px-3 py-2 text-sm font-bold text-blue-950 disabled:opacity-60">
              <RefreshCw size={16} aria-hidden="true" />
              Refresh
            </button>
          </div>

          {isLoading && <p className="mt-4 rounded-xl bg-gray-50 px-4 py-3 text-sm font-semibold text-gray-600">Loading trusted devices...</p>}
          {!isLoading && trustedDevices.length === 0 && (
            <p className="mt-4 rounded-xl bg-gray-50 px-4 py-3 text-sm font-semibold text-gray-600">No trusted devices.</p>
          )}
          {!isLoading && trustedDevices.length > 0 && (
            <div className="mt-4 space-y-3">
              {trustedDevices.map((device) => (
                <div key={device.id} className="rounded-xl border border-gray-200 bg-gray-50 p-4">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div className="min-w-0">
                      <p className="break-words font-bold text-slate-900">{device.deviceLabel || "Unknown device"}</p>
                      <p className="mt-1 break-words text-sm font-semibold text-slate-600">
                        {device.employeeName || "Employee"} {device.employeeId ? `(${device.employeeId})` : ""}
                      </p>
                      <p className="mt-1 break-all font-mono text-xs font-semibold text-slate-500">{device.deviceFingerprint || "No fingerprint"}</p>
                      <p className="mt-2 text-sm font-semibold text-slate-600">Trusted: {new Date(device.trustedAt).toLocaleString()}</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => revokeTrustedDevice(device)}
                      disabled={revokingDeviceId === device.id}
                      className="flex min-h-10 items-center justify-center gap-2 rounded-xl border border-red-200 bg-white px-3 py-2 text-sm font-bold text-red-700 transition hover:bg-red-50 disabled:opacity-60"
                    >
                      <Trash2 size={16} aria-hidden="true" />
                      {revokingDeviceId === device.id ? "Revoking..." : "Revoke"}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
