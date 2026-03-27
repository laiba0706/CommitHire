import { BrowserRouter, Routes, Route, Navigate, Outlet } from "react-router-dom";
import Sidebar from "./components/Sidebar";
import Auth from "./pages/Auth";
import Dashboard from "./pages/Dashboard";
import Candidates from "./pages/Candidates";
import Jobs from "./pages/Jobs";
import { Shortlist, Admin } from "./pages/ShortlistAdmin";

function PrivateLayout() {
  const token = localStorage.getItem("token");
  if (!token) return <Navigate to="/login" replace />;
  return (
    <div style={{ display: "flex", minHeight: "100vh", background: "#090b0e" }}>
      <Sidebar />
      <div style={{ flex: 1, overflowY: "auto" }}>
        <Outlet />
      </div>
    </div>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<Auth />} />
        <Route element={<PrivateLayout />}>
          <Route path="/dashboard"  element={<Dashboard />} />
          <Route path="/candidates" element={<Candidates />} />
          <Route path="/jobs"       element={<Jobs />} />
          <Route path="/shortlist"  element={<Shortlist />} />
          <Route path="/admin"      element={<Admin />} />
        </Route>
        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Routes>
    </BrowserRouter>
  );
}