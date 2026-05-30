import { useNavigate } from "react-router-dom";

export default function EmployeeDashboard() {
  const navigate = useNavigate();
  const employeeName = localStorage.getItem("employeeName") ?? "";
  const role = localStorage.getItem("role") ?? "";

  const handleLogout = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("employeeName");
    localStorage.removeItem("role");
    navigate("/employee-login", { replace: true });
  };

  return (
    <main>
      <h1>Welcome, {employeeName}</h1>
      <p>Role: {role}</p>
      <button type="button" onClick={handleLogout}>
        Logout
      </button>
    </main>
  );
}
