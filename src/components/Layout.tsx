import { Link, useLocation } from "react-router-dom";

export default function Layout({ children }: { children: React.ReactNode }) {
  const { pathname } = useLocation();

  return (
    <div className="min-h-screen bg-bg">
      <header className="border-b border-card-border bg-bg/80 backdrop-blur sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-4 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-3 no-underline">
            <span className="text-2xl">🎬</span>
            <h1 className="text-xl font-bold text-cream m-0">
              シネコヤ <span className="text-accent">経営ダッシュボード</span>
            </h1>
          </Link>
          <nav className="flex gap-1">
            <Link
              to="/"
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors no-underline ${
                pathname === "/"
                  ? "bg-accent/20 text-accent"
                  : "text-sub hover:text-cream"
              }`}
            >
              ダッシュボード
            </Link>
            <Link
              to="/import"
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors no-underline ${
                pathname === "/import"
                  ? "bg-accent/20 text-accent"
                  : "text-sub hover:text-cream"
              }`}
            >
              データインポート
            </Link>
          </nav>
        </div>
      </header>
      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-8">{children}</main>
    </div>
  );
}
