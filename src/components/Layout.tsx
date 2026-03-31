import { Link, useLocation } from "react-router-dom";
import {
  LayoutDashboard,
  Users,
  Film,
  Clapperboard,
  ClipboardList,
  Upload,
} from "lucide-react";

const menuItems = [
  { to: "/", label: "ダッシュボード", icon: LayoutDashboard },
  { to: "/audience", label: "来客数分析", icon: Users },
  { to: "/movies", label: "作品分析", icon: Film },
  { to: "/movies-master", label: "作品管理", icon: Clapperboard },
  { to: "/daily-report", label: "日報登録", icon: ClipboardList },
  { to: "/import", label: "データインポート", icon: Upload },
];

export default function Layout({ children }: { children: React.ReactNode }) {
  const { pathname } = useLocation();

  return (
    <div className="min-h-screen bg-bg flex">
      {/* Sidebar */}
      <aside className="w-[220px] shrink-0 bg-bg border-r border-card-border fixed top-0 left-0 h-screen flex flex-col z-50">
        {/* Logo */}
        <Link
          to="/"
          className="flex items-center gap-2.5 px-5 py-6 no-underline border-b border-card-border"
        >
          <span className="text-2xl">🎬</span>
          <span className="text-lg font-bold text-cream">シネコヤ</span>
        </Link>

        {/* Nav */}
        <nav className="flex-1 px-3 py-4 space-y-1">
          {menuItems.map(({ to, label, icon: Icon }) => {
            const active = pathname === to;
            return (
              <Link
                key={to}
                to={to}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors no-underline ${
                  active
                    ? "bg-accent/15 text-accent"
                    : "text-sub hover:text-cream hover:bg-white/[0.03]"
                }`}
              >
                <Icon size={18} strokeWidth={active ? 2.2 : 1.8} />
                {label}
              </Link>
            );
          })}
        </nav>

        {/* Footer */}
        <div className="px-5 py-4 border-t border-card-border text-xs text-sub">
          経営ダッシュボード
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 ml-[220px] px-6 py-8">
        {children}
      </main>
    </div>
  );
}
