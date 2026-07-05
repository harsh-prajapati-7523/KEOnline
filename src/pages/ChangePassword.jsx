import { useState } from "react";
import { ArrowLeft, Eye, EyeOff, KeyRound, Lock, ShieldCheck } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { clearAccess } from "../utils/access";

const emptyForm = {
  currentPassword: "",
  newPassword: "",
  confirmPassword: "",
};

function clearAuthSession() {
  localStorage.removeItem("token");
  localStorage.removeItem("employeeName");
  localStorage.removeItem("role");
  localStorage.removeItem("employeeId");
  clearAccess();
}

function validate(form) {
  const errors = {};

  if (!form.currentPassword) errors.currentPassword = "Current password is required.";
  if (!form.newPassword) {
    errors.newPassword = "New password is required.";
  } else if (form.newPassword.length < 8) {
    errors.newPassword = "New password must contain at least 8 characters.";
  }
  if (!form.confirmPassword) {
    errors.confirmPassword = "Confirm new password is required.";
  } else if (form.newPassword && form.newPassword !== form.confirmPassword) {
    errors.confirmPassword = "New password and confirm password must match.";
  }

  return errors;
}

async function readApiError(response, fallback) {
  try {
    const body = await response.json();
    return typeof body.message === "string" && body.message.trim() ? body.message.trim() : fallback;
  } catch {
    return fallback;
  }
}

function PasswordField({
  autoComplete,
  error,
  icon: Icon,
  id,
  label,
  name,
  onChange,
  placeholder,
  showPassword,
  toggleShowPassword,
  value,
}) {
  return (
    <div>
      <label htmlFor={id} className="ke-form-label">
        {label}
      </label>
      <div className={`flex min-h-12 w-full items-center rounded-xl border bg-white px-3 py-1.5 ${error ? "border-red-600 shadow-[0_0_0_1px_rgba(220,38,38,0.12)]" : "border-blue-100 focus-within:border-blue-950 focus-within:shadow-[0_0_0_3px_rgba(16,27,77,0.1)]"}`}>
        <Icon className="mr-3 shrink-0 text-blue-950" size={20} aria-hidden="true" />
        <input
          id={id}
          name={name}
          type={showPassword ? "text" : "password"}
          value={value}
          onChange={onChange}
          placeholder={placeholder}
          autoComplete={autoComplete}
          aria-invalid={Boolean(error)}
          aria-describedby={error ? `${id}-error` : undefined}
          className="min-h-10 min-w-0 flex-1 bg-transparent text-base font-semibold text-slate-900 outline-none placeholder:text-slate-500"
        />
        <button
          type="button"
          onClick={toggleShowPassword}
          className="ml-2 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl p-0 text-blue-950 hover:bg-blue-50"
          aria-label={showPassword ? `Hide ${label.toLowerCase()}` : `Show ${label.toLowerCase()}`}
        >
          {showPassword ? <EyeOff size={19} aria-hidden="true" /> : <Eye size={19} aria-hidden="true" />}
        </button>
      </div>
      {error && (
        <p id={`${id}-error`} className="field-error">
          {error}
        </p>
      )}
    </div>
  );
}

export default function ChangePassword() {
  const navigate = useNavigate();
  const [form, setForm] = useState(emptyForm);
  const [errors, setErrors] = useState({});
  const [message, setMessage] = useState("");
  const [messageType, setMessageType] = useState("success");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [visibleFields, setVisibleFields] = useState({});

  const handleChange = (event) => {
    const { name, value } = event.target;
    setForm((current) => ({ ...current, [name]: value }));
    setErrors((current) => ({ ...current, [name]: "" }));
    setMessage("");
  };

  const toggleField = (fieldName) => {
    setVisibleFields((current) => ({ ...current, [fieldName]: !current[fieldName] }));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (isSubmitting) return;

    const validationErrors = validate(form);
    if (Object.keys(validationErrors).length > 0) {
      setErrors(validationErrors);
      setMessage("");
      return;
    }

    setIsSubmitting(true);
    setMessage("");
    setMessageType("success");

    try {
      const response = await fetch("/volt/auth/change-password", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${localStorage.getItem("token")}`,
        },
        body: JSON.stringify(form),
      });

      if (!response.ok) {
        if (response.status === 401) {
          clearAuthSession();
          navigate("/employee-login", { replace: true });
          return;
        }
        throw new Error(await readApiError(response, "Unable to change password. Please check the details."));
      }

      setMessageType("success");
      setMessage("Password changed successfully. Please login again.");
      setForm(emptyForm);
      clearAuthSession();
      window.setTimeout(() => {
        navigate("/employee-login", { replace: true });
      }, 1200);
    } catch (error) {
      setMessageType("error");
      setMessage(error.message || "Unable to change password. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const messageClassName = messageType === "error"
    ? "border-red-200 bg-red-50 text-red-700"
    : "border-green-200 bg-green-50 text-green-700";

  return (
    <main id="main-content" className="ke-page-main bg-gray-50 lg:px-8">
      <div className="mx-auto w-full max-w-xl">
        <button
          type="button"
          onClick={() => navigate(-1)}
          className="mb-4 flex min-h-11 items-center gap-2 rounded-xl px-1 py-2 text-base font-semibold text-blue-950"
        >
          <ArrowLeft size={20} aria-hidden="true" />
          Back
        </button>

        <section className="rounded-2xl border border-blue-100 bg-white p-4 shadow-sm sm:p-6" aria-labelledby="change-password-title">
          <div className="flex min-w-0 items-center gap-3">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-blue-950">
              <KeyRound size={23} aria-hidden="true" />
            </div>
            <div className="min-w-0">
              <h1 id="change-password-title" className="break-words text-2xl font-extrabold text-blue-950">
                Change Password
              </h1>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="mt-6 space-y-4">
            <PasswordField
              id="current-password"
              name="currentPassword"
              label="Current Password"
              value={form.currentPassword}
              onChange={handleChange}
              placeholder="Enter current password"
              autoComplete="current-password"
              icon={Lock}
              error={errors.currentPassword}
              showPassword={Boolean(visibleFields.currentPassword)}
              toggleShowPassword={() => toggleField("currentPassword")}
            />

            <PasswordField
              id="new-password"
              name="newPassword"
              label="New Password"
              value={form.newPassword}
              onChange={handleChange}
              placeholder="Enter new password"
              autoComplete="new-password"
              icon={ShieldCheck}
              error={errors.newPassword}
              showPassword={Boolean(visibleFields.newPassword)}
              toggleShowPassword={() => toggleField("newPassword")}
            />

            <PasswordField
              id="confirm-password"
              name="confirmPassword"
              label="Confirm New Password"
              value={form.confirmPassword}
              onChange={handleChange}
              placeholder="Confirm new password"
              autoComplete="new-password"
              icon={ShieldCheck}
              error={errors.confirmPassword}
              showPassword={Boolean(visibleFields.confirmPassword)}
              toggleShowPassword={() => toggleField("confirmPassword")}
            />

            <div className="grid grid-cols-1 gap-3 pt-2 sm:grid-cols-2">
              <button
                type="button"
                onClick={() => navigate(-1)}
                disabled={isSubmitting}
                className="min-h-12 rounded-xl border border-blue-950 px-4 py-2 text-base font-bold text-blue-950 hover:bg-blue-50 disabled:opacity-60"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSubmitting}
                aria-busy={isSubmitting}
                className="ke-accent-action flex min-h-12 items-center justify-center gap-2 rounded-xl px-4 py-2 text-base font-bold disabled:opacity-70"
              >
                <KeyRound size={19} aria-hidden="true" />
                {isSubmitting ? "Changing..." : "Change Password"}
              </button>
            </div>
          </form>

          {message && (
            <p role="alert" className={`mt-4 rounded-xl border px-4 py-3 text-sm font-semibold ${messageClassName}`}>
              {message}
            </p>
          )}
        </section>
      </div>
    </main>
  );
}
