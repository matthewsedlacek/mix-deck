import { NavLink, Outlet } from "react-router-dom";
import { useAuth } from "../lib/auth";

const navLinkClass = ({ isActive }: { isActive: boolean }) =>
  `px-3 py-2 rounded-lg font-medium transition-colors ${
    isActive ? "bg-deck-800 text-glow-400" : "text-deck-300 hover:text-deck-100"
  }`;

export default function Layout() {
  const { user, studio, logout } = useAuth();

  return (
    <div className="min-h-screen flex flex-col">
      <header className="border-b border-deck-700 bg-deck-900/80 backdrop-blur sticky top-0 z-10">
        <div className="max-w-6xl mx-auto px-6 py-3 flex items-center gap-6">
          <span className="text-xl font-bold tracking-tight">
            Mix<span className="text-glow-500">Deck</span>
          </span>
          <nav className="flex gap-1">
            <NavLink to="/library" className={navLinkClass}>
              Library
            </NavLink>
            <NavLink to="/projects" className={navLinkClass}>
              Projects
            </NavLink>
          </nav>
          <div className="ml-auto flex items-center gap-4 text-sm">
            <span className="text-deck-300">
              {user?.name} · {studio?.name}
            </span>
            <button onClick={() => void logout()} className="text-deck-300 hover:text-deck-100 cursor-pointer">
              Sign out
            </button>
          </div>
        </div>
      </header>
      <main className="flex-1 max-w-6xl mx-auto w-full px-6 py-8">
        <Outlet />
      </main>
    </div>
  );
}
