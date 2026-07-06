import { Navigate, Route, Routes } from "react-router-dom";
import { useAuth } from "./lib/auth";
import Layout from "./components/Layout";
import Welcome from "./pages/Welcome";
import Library from "./pages/Library";
import TrackDetail from "./pages/TrackDetail";
import Projects from "./pages/Projects";

export default function App() {
  const { user, loading } = useAuth();

  if (loading) {
    return <div className="min-h-screen grid place-items-center text-deck-300">Warming up the decks…</div>;
  }

  if (!user) {
    return (
      <Routes>
        <Route path="*" element={<Welcome />} />
      </Routes>
    );
  }

  return (
    <Routes>
      <Route element={<Layout />}>
        <Route path="/" element={<Navigate to="/library" replace />} />
        <Route path="/library" element={<Library />} />
        <Route path="/library/:id" element={<TrackDetail />} />
        <Route path="/projects" element={<Projects />} />
        <Route path="*" element={<Navigate to="/library" replace />} />
      </Route>
    </Routes>
  );
}
