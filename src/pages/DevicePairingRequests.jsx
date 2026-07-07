import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ArrowLeft, Camera, CheckCircle2, QrCode, RefreshCw, Save, Smartphone, Trash2, X } from "lucide-react";
import QrScanner from "qr-scanner";
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
  if (!token) throw new Error("Scan the technician QR first.");
  const parsed = JSON.parse(token);
  const pairingToken = {
    requestId: String(parsed.requestId || "").trim(),
    nonce: String(parsed.nonce || "").trim(),
    expiresAt: String(parsed.expiresAt || "").trim(),
    signature: String(parsed.signature || "").trim(),
  };
  if (!pairingToken.requestId || !pairingToken.nonce || !pairingToken.expiresAt || !pairingToken.signature) {
    throw new Error("Scanned QR is not a valid pairing token.");
  }
  return pairingToken;
}

function IconBubble({ icon: Icon, tone = "blue" }) {
  const toneClassNames = {
    blue: "bg-blue-50 text-blue-950",
    red: "bg-red-50 text-red-700",
    slate: "bg-slate-100 text-slate-700",
  };

  return (
    <span className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${toneClassNames[tone] || toneClassNames.blue}`}>
      <Icon size={20} aria-hidden="true" />
    </span>
  );
}

export default function DevicePairingRequests() {
  const navigate = useNavigate();
  const videoRef = useRef(null);
  const scannerRef = useRef(null);
  const [pendingRequests, setPendingRequests] = useState([]);
  const [trustedDevices, setTrustedDevices] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [pairingToken, setPairingToken] = useState("");
  const [scannedRequestId, setScannedRequestId] = useState("");
  const [selectedEmployeeId, setSelectedEmployeeId] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isScanning, setIsScanning] = useState(false);
  const [scannerError, setScannerError] = useState("");
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

  const stopScanner = useCallback((updateState = true) => {
    scannerRef.current?.stop();
    scannerRef.current?.destroy();
    scannerRef.current = null;
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    if (updateState) setIsScanning(false);
  }, []);

  const acceptScannedValue = (rawValue) => {
    try {
      const parsedToken = parsePairingToken(rawValue);
      setPairingToken(rawValue);
      setScannedRequestId(parsedToken.requestId || "");
      setScannerError("");
      stopScanner();
    } catch {
      setScannerError("Scanned QR is not a valid pairing token.");
    }
  };

  useEffect(() => {
    return () => {
      stopScanner(false);
    };
  }, [stopScanner]);

  const startScanner = async () => {
    setScannerError("");
    setPairingToken("");
    setScannedRequestId("");

    if (!navigator.mediaDevices?.getUserMedia) {
      setScannerError("Camera access is not available in this browser.");
      return;
    }

    try {
      const video = videoRef.current;
      if (!video) throw new Error("Scanner unavailable");
      setIsScanning(true);
      const scanner = new QrScanner(
        video,
        (result) => acceptScannedValue(typeof result === "string" ? result : result?.data || ""),
        {
          preferredCamera: "environment",
          returnDetailedScanResult: true,
          highlightScanRegion: true,
          highlightCodeOutline: true,
        }
      );
      scannerRef.current = scanner;
      await scanner.start();
    } catch (error) {
      stopScanner();
      setScannerError(error.message || "Unable to start camera scanner.");
    }
  };

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
      setScannedRequestId("");
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
    <main id="main-content" className="ke-page-main ticket-detail-page bg-gray-50 lg:px-8">
      <div className="mx-auto w-full max-w-4xl">
        <button type="button" onClick={() => navigate("/settings")} className="flex min-h-10 items-center gap-2 rounded-xl px-1 py-1.5 text-base font-semibold text-blue-950">
          <ArrowLeft size={18} aria-hidden="true" /> Settings
        </button>

        <div className="mt-4 min-w-0 space-y-3.5">
          <header className="rounded-2xl bg-blue-950 p-3.5 text-white shadow-lg">
            <div className="flex min-w-0 items-center gap-3">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-white/15">
                <Smartphone size={24} aria-hidden="true" />
              </div>
              <div className="min-w-0">
                <h1 className="break-words text-2xl font-extrabold">Device Pairing Requests</h1>
                <p className="mt-1 break-words text-sm font-semibold text-blue-100">Approve and manage trusted devices</p>
              </div>
            </div>
          </header>

          {message && (
            <p className={`rounded-xl border px-4 py-3 text-sm font-semibold ${messageType === "error" ? "border-red-200 bg-red-50 text-red-700" : "border-green-200 bg-green-50 text-green-700"}`}>
              {message}
            </p>
          )}

          <section className="min-w-0 rounded-2xl border border-blue-100 bg-white p-3.5 shadow-sm" aria-label="Approve device">
            <div className="flex min-w-0 items-start gap-3">
              <IconBubble icon={QrCode} tone="blue" />
              <div className="min-w-0 flex-1">
                <h2 className="text-sm font-extrabold text-slate-900">Approve Device</h2>
                <p className="mt-1 break-words text-sm font-semibold text-slate-600">
                  {scannedRequestId ? `Scanned request ${scannedRequestId}` : "Scan the technician QR to load the pairing request."}
                </p>

                <div className="mt-4 flex flex-wrap gap-2">
                  {!isScanning && (
                    <button
                      type="button"
                      onClick={startScanner}
                      disabled={isSaving}
                      className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-blue-950 px-4 py-2 text-sm font-extrabold text-white transition hover:bg-blue-900 disabled:opacity-60"
                    >
                      <Camera size={18} aria-hidden="true" />
                      Scan QR
                    </button>
                  )}
                  {isScanning && (
                    <button
                      type="button"
                      onClick={stopScanner}
                      className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-red-200 bg-white px-4 py-2 text-sm font-extrabold text-red-700 transition hover:bg-red-50"
                    >
                      <X size={18} aria-hidden="true" />
                      Stop
                    </button>
                  )}
                </div>

                <div className="relative mt-4 overflow-hidden rounded-xl border border-blue-100 bg-slate-900">
                  <video
                    ref={videoRef}
                    className="h-72 w-full object-cover"
                    muted
                    playsInline
                  />
                  {!isScanning && (
                    <div className="absolute inset-0 flex items-center justify-center bg-slate-900 text-blue-100">
                      <QrCode size={46} aria-hidden="true" />
                    </div>
                  )}
                </div>

                {scannerError && (
                  <p className="mt-3 rounded-xl bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">{scannerError}</p>
                )}
                {pairingToken && !scannerError && (
                  <p className="mt-3 rounded-xl bg-green-50 px-4 py-3 text-sm font-semibold text-green-700">QR scanned successfully.</p>
                )}

                <label className="mt-4 block text-sm font-semibold text-slate-900">
                  Employee
                  <select
                    value={selectedEmployeeId}
                    onChange={(event) => setSelectedEmployeeId(event.target.value)}
                    disabled={isLoading || activeEmployees.length === 0}
                    className="mt-2 w-full rounded-xl border border-gray-300 bg-white px-4 py-3 text-sm font-semibold text-slate-900 outline-none focus:border-blue-950 disabled:opacity-60"
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
                  disabled={isSaving || isLoading || !pairingToken}
                  className="mt-4 inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-blue-950 px-4 py-2 text-sm font-extrabold text-white transition hover:bg-blue-900 disabled:opacity-60"
                >
                  {isSaving ? <RefreshCw size={18} aria-hidden="true" /> : <Save size={18} aria-hidden="true" />}
                  {isSaving ? "Approving..." : "Approve"}
                </button>
              </div>
            </div>
          </section>

          <section className="min-w-0 rounded-2xl border border-blue-100 bg-white p-3.5 shadow-sm" aria-label="Pending requests">
            <div className="flex min-w-0 items-center gap-3">
              <IconBubble icon={RefreshCw} tone="blue" />
              <div className="min-w-0 flex-1">
                <h2 className="text-sm font-extrabold text-slate-900">Pending Requests</h2>
                <p className="mt-1 text-sm font-semibold text-slate-600">{pendingRequests.length} waiting</p>
              </div>
              <button type="button" onClick={loadData} disabled={isLoading} className="inline-flex min-h-10 items-center gap-2 rounded-xl border border-blue-950 px-3 py-2 text-sm font-extrabold text-blue-950 disabled:opacity-60">
                <RefreshCw size={16} aria-hidden="true" />
                Refresh
              </button>
            </div>

            {isLoading && <p className="mt-4 rounded-xl bg-gray-50 px-4 py-3 text-sm font-semibold text-gray-600">Loading requests...</p>}
            {!isLoading && pendingRequests.length === 0 && (
              <p className="mt-4 rounded-xl bg-gray-50 px-4 py-3 text-sm font-semibold text-gray-600">No pending requests.</p>
            )}
            {!isLoading && pendingRequests.length > 0 && (
              <div className="mt-3.5 space-y-2.5">
                {pendingRequests.map((request) => (
                  <div key={request.requestId} className="rounded-xl border border-blue-100 bg-gray-50 p-3.5">
                    <div className="flex min-w-0 flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                      <div className="min-w-0">
                        <p className="break-words text-sm font-extrabold text-slate-900">{request.deviceLabel || "Unknown device"}</p>
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

          <section className="min-w-0 rounded-2xl border border-blue-100 bg-white p-3.5 shadow-sm" aria-label="Trusted devices">
            <div className="flex min-w-0 items-center gap-3">
              <IconBubble icon={Smartphone} tone="blue" />
              <div className="min-w-0 flex-1">
                <h2 className="text-sm font-extrabold text-slate-900">Trusted Devices</h2>
                <p className="mt-1 text-sm font-semibold text-slate-600">{trustedDevices.length} active</p>
              </div>
              <button type="button" onClick={loadData} disabled={isLoading} className="inline-flex min-h-10 items-center gap-2 rounded-xl border border-blue-950 px-3 py-2 text-sm font-extrabold text-blue-950 disabled:opacity-60">
                <RefreshCw size={16} aria-hidden="true" />
                Refresh
              </button>
            </div>

            {isLoading && <p className="mt-4 rounded-xl bg-gray-50 px-4 py-3 text-sm font-semibold text-gray-600">Loading trusted devices...</p>}
            {!isLoading && trustedDevices.length === 0 && (
              <p className="mt-4 rounded-xl bg-gray-50 px-4 py-3 text-sm font-semibold text-gray-600">No trusted devices.</p>
            )}
            {!isLoading && trustedDevices.length > 0 && (
              <div className="mt-3.5 space-y-2.5">
                {trustedDevices.map((device) => (
                  <div key={device.id} className="rounded-xl border border-blue-100 bg-gray-50 p-3.5">
                    <div className="flex min-w-0 flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                      <div className="min-w-0">
                        <p className="break-words text-sm font-extrabold text-slate-900">{device.deviceLabel || "Unknown device"}</p>
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
                        className="inline-flex min-h-10 items-center justify-center gap-2 rounded-xl border border-red-200 bg-white px-3 py-2 text-sm font-extrabold text-red-700 transition hover:bg-red-50 disabled:opacity-60"
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
      </div>
    </main>
  );
}
