import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "./contexts/AuthContext";
import PrivateRoute from "./components/PrivateRoute";
import Layout from "./components/Layout";
import Dashboard from "./pages/Dashboard";
import Audience from "./pages/Audience";
import Movies from "./pages/Movies";
import MoviesMaster from "./pages/MoviesMaster";
import DailyReport from "./pages/DailyReport";
import Attendance from "./pages/Attendance";
import Import from "./pages/Import";
import LoginPage from "./pages/LoginPage";

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route
            path="/*"
            element={
              <PrivateRoute>
                <Layout>
                  <Routes>
                    <Route path="/" element={<Dashboard />} />
                    <Route path="/audience" element={<Audience />} />
                    <Route path="/movies" element={<Movies />} />
                    <Route path="/movies-master" element={<MoviesMaster />} />
                    <Route path="/daily-report" element={<DailyReport />} />
                    <Route path="/attendance" element={<Attendance />} />
                    <Route path="/import" element={<Import />} />
                  </Routes>
                </Layout>
              </PrivateRoute>
            }
          />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}
