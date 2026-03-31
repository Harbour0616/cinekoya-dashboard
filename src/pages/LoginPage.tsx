import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabase";

export default function LoginPage() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSubmitting(true);

    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      setError("メールアドレスまたはパスワードが正しくありません");
      setSubmitting(false);
      return;
    }

    navigate("/", { replace: true });
  };

  return (
    <div className="min-h-screen bg-bg flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        {/* Logo */}
        <div className="text-center mb-8">
          <span className="text-4xl">🎬</span>
          <h1 className="text-xl font-bold text-cream mt-2">シネコヤ</h1>
          <p className="text-sub text-sm mt-1">経営ダッシュボード</p>
        </div>

        {/* Login form */}
        <form
          onSubmit={handleSubmit}
          className="bg-card border border-card-border rounded-2xl p-6 space-y-5"
        >
          <div className="space-y-1.5">
            <label className="block text-xs font-medium text-sub">
              メールアドレス
            </label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full bg-white/[0.03] border border-card-border rounded-lg px-3 py-2.5 text-sm text-cream placeholder:text-sub/60 outline-none focus:border-accent/40"
              placeholder="mail@example.com"
            />
          </div>

          <div className="space-y-1.5">
            <label className="block text-xs font-medium text-sub">
              パスワード
            </label>
            <input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full bg-white/[0.03] border border-card-border rounded-lg px-3 py-2.5 text-sm text-cream placeholder:text-sub/60 outline-none focus:border-accent/40"
              placeholder="••••••••"
            />
          </div>

          {error && (
            <div className="bg-red-500/10 border border-red-500/30 rounded-lg px-3 py-2 text-sm text-red-400">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={submitting}
            className="w-full bg-accent hover:bg-accent/80 text-bg font-bold text-sm rounded-xl py-2.5 transition-colors disabled:opacity-50"
          >
            {submitting ? "ログイン中..." : "ログイン"}
          </button>
        </form>
      </div>
    </div>
  );
}
