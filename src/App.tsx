import { BrowserRouter, Routes, Route } from "react-router-dom";
import Layout from "./components/Layout";
import Dashboard from "./pages/Dashboard";
import Audience from "./pages/Audience";
import Movies from "./pages/Movies";
import MoviesMaster from "./pages/MoviesMaster";
import DailyReport from "./pages/DailyReport";
import Attendance from "./pages/Attendance";
import Import from "./pages/Import";

export default function App() {
  return (
    <BrowserRouter>
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
    </BrowserRouter>
  );
}
