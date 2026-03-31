import { useEffect, useState, useMemo } from "react";
import { Search, Pencil, Trash2 } from "lucide-react";
import { supabase } from "../lib/supabase";

interface Movie {
  id: number;
  title: string;
  start_date: string | null;
  end_date: string | null;
  group_name: string | null;
  notes: string | null;
  created_at: string;
}

const EMPTY_FORM = {
  title: "",
  start_date: "",
  end_date: "",
  group_name: "",
  notes: "",
};

interface TitleStats {
  count: number;
  mobilization: number;
  revenue_taxin: number;
  revenue_taxout: number;
}

export default function MoviesMaster() {
  const [movies, setMovies] = useState<Movie[]>([]);
  const [statsMap, setStatsMap] = useState<Map<string, TitleStats>>(new Map());
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState(EMPTY_FORM);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState("");
  const [showGroupSuggest, setShowGroupSuggest] = useState(false);

  const fetchMovies = async () => {
    setLoading(true);
    const [moviesRes, reportsRes] = await Promise.all([
      supabase
        .from("movies")
        .select("*")
        .order("start_date", { ascending: false, nullsFirst: false }),
      supabase
        .from("daily_reports")
        .select("title, mobilization, revenue_taxin, revenue_taxout"),
    ]);
    if (!moviesRes.error && moviesRes.data) setMovies(moviesRes.data);

    // Aggregate daily_reports by title
    const map = new Map<string, TitleStats>();
    if (!reportsRes.error && reportsRes.data) {
      for (const r of reportsRes.data) {
        if (!r.title) continue;
        const entry = map.get(r.title) ?? {
          count: 0,
          mobilization: 0,
          revenue_taxin: 0,
          revenue_taxout: 0,
        };
        entry.count += 1;
        entry.mobilization += r.mobilization ?? 0;
        entry.revenue_taxin += r.revenue_taxin ?? 0;
        entry.revenue_taxout += r.revenue_taxout ?? 0;
        map.set(r.title, entry);
      }
    }
    setStatsMap(map);
    setLoading(false);
  };

  useEffect(() => {
    fetchMovies();
  }, []);

  // Unique existing groups for suggestions
  const existingGroups = useMemo(() => {
    const set = new Set<string>();
    for (const m of movies) {
      if (m.group_name) set.add(m.group_name);
    }
    return Array.from(set).sort();
  }, [movies]);

  const groupSuggestions = useMemo(() => {
    if (!form.group_name.trim()) return existingGroups;
    const q = form.group_name.toLowerCase();
    return existingGroups.filter((g) => g.toLowerCase().includes(q));
  }, [existingGroups, form.group_name]);

  const filteredMovies = useMemo(() => {
    if (!search.trim()) return movies;
    const q = search.trim().toLowerCase();
    return movies.filter((m) => m.title.toLowerCase().includes(q));
  }, [movies, search]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.title.trim()) return;
    setSaving(true);

    const payload = {
      title: form.title.trim(),
      start_date: form.start_date || null,
      end_date: form.end_date || null,
      group_name: form.group_name.trim() || null,
      notes: form.notes.trim() || null,
    };

    if (editingId) {
      await supabase.from("movies").update(payload).eq("id", editingId);
    } else {
      await supabase.from("movies").insert(payload);
    }

    setForm(EMPTY_FORM);
    setEditingId(null);
    setSaving(false);
    fetchMovies();
  };

  const handleEdit = (m: Movie) => {
    setEditingId(m.id);
    setForm({
      title: m.title,
      start_date: m.start_date ?? "",
      end_date: m.end_date ?? "",
      group_name: m.group_name ?? "",
      notes: m.notes ?? "",
    });
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const handleDelete = async (id: number) => {
    if (!window.confirm("この作品を削除しますか？")) return;
    await supabase.from("movies").delete().eq("id", id);
    fetchMovies();
  };

  const handleCancel = () => {
    setEditingId(null);
    setForm(EMPTY_FORM);
  };

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold text-cream">作品管理</h2>

      {/* Registration form */}
      <form
        onSubmit={handleSubmit}
        className="bg-card border border-card-border rounded-2xl p-5 space-y-4"
      >
        <h3 className="text-sm font-bold text-cream">
          {editingId ? "作品を編集" : "作品を登録"}
        </h3>

        {/* Title */}
        <div>
          <label className="block text-xs text-sub mb-1">
            作品名 <span className="text-red-400">*</span>
          </label>
          <input
            type="text"
            required
            value={form.title}
            onChange={(e) => setForm({ ...form, title: e.target.value })}
            className="w-full bg-white/[0.03] border border-card-border rounded-lg px-3 py-2 text-sm text-cream placeholder:text-sub/60 outline-none focus:border-accent/40 transition-colors"
            placeholder="作品名を入力"
          />
        </div>

        {/* Dates */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-xs text-sub mb-1">上映開始日</label>
            <input
              type="date"
              value={form.start_date}
              onChange={(e) => setForm({ ...form, start_date: e.target.value })}
              className="w-full bg-white/[0.03] border border-card-border rounded-lg px-3 py-2 text-sm text-cream outline-none focus:border-accent/40 transition-colors [color-scheme:dark]"
            />
          </div>
          <div>
            <label className="block text-xs text-sub mb-1">上映終了日</label>
            <input
              type="date"
              value={form.end_date}
              onChange={(e) => setForm({ ...form, end_date: e.target.value })}
              className="w-full bg-white/[0.03] border border-card-border rounded-lg px-3 py-2 text-sm text-cream outline-none focus:border-accent/40 transition-colors [color-scheme:dark]"
            />
          </div>
        </div>

        {/* Group with autocomplete */}
        <div className="relative">
          <label className="block text-xs text-sub mb-1">グループ</label>
          <input
            type="text"
            value={form.group_name}
            onChange={(e) => setForm({ ...form, group_name: e.target.value })}
            onFocus={() => setShowGroupSuggest(true)}
            onBlur={() => setTimeout(() => setShowGroupSuggest(false), 200)}
            className="w-full bg-white/[0.03] border border-card-border rounded-lg px-3 py-2 text-sm text-cream placeholder:text-sub/60 outline-none focus:border-accent/40 transition-colors"
            placeholder="グループ名（例：枯れ葉、バグダッド・カフェ）"
          />
          {showGroupSuggest && groupSuggestions.length > 0 && (
            <div className="absolute z-10 top-full left-0 right-0 mt-1 bg-[#2a1f10] border border-card-border rounded-lg max-h-40 overflow-y-auto shadow-lg">
              {groupSuggestions.map((g) => (
                <button
                  key={g}
                  type="button"
                  onMouseDown={() => {
                    setForm({ ...form, group_name: g });
                    setShowGroupSuggest(false);
                  }}
                  className="w-full text-left px-3 py-2 text-sm text-cream hover:bg-accent/10 transition-colors"
                >
                  {g}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Notes */}
        <div>
          <label className="block text-xs text-sub mb-1">備考・メモ</label>
          <textarea
            value={form.notes}
            onChange={(e) => setForm({ ...form, notes: e.target.value })}
            rows={3}
            className="w-full bg-white/[0.03] border border-card-border rounded-lg px-3 py-2 text-sm text-cream placeholder:text-sub/60 outline-none focus:border-accent/40 transition-colors resize-none"
            placeholder="備考を入力"
          />
        </div>

        {/* Buttons */}
        <div className="flex gap-3">
          <button
            type="submit"
            disabled={saving || !form.title.trim()}
            className="px-6 py-2.5 bg-accent hover:bg-accent/80 disabled:opacity-50 text-bg font-bold rounded-xl transition-colors text-sm"
          >
            {saving ? "保存中..." : editingId ? "更新する" : "登録する"}
          </button>
          {editingId && (
            <button
              type="button"
              onClick={handleCancel}
              className="px-6 py-2.5 bg-white/[0.05] border border-card-border text-sub hover:text-cream rounded-xl transition-colors text-sm"
            >
              キャンセル
            </button>
          )}
        </div>
      </form>

      {/* Movie list */}
      <div className="bg-card border border-card-border rounded-2xl p-5 space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-bold text-cream">
            登録済み作品
            <span className="ml-2 text-accent font-normal">{movies.length}件</span>
          </h3>
          <div className="relative w-60">
            <Search
              size={14}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-sub"
            />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="作品名で検索..."
              className="w-full bg-white/[0.03] border border-card-border rounded-lg pl-9 pr-3 py-1.5 text-sm text-cream placeholder:text-sub/60 outline-none focus:border-accent/40 transition-colors"
            />
          </div>
        </div>

        {loading ? (
          <div className="text-center py-8 text-sub">読み込み中...</div>
        ) : filteredMovies.length === 0 ? (
          <div className="text-center py-8 text-sub">
            {movies.length === 0
              ? "登録された作品がありません"
              : "該当する作品がありません"}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-card-border">
                  <th className="text-left py-2 px-3 text-sub font-medium">作品名</th>
                  <th className="text-left py-2 px-3 text-sub font-medium">上映期間</th>
                  <th className="text-left py-2 px-3 text-sub font-medium">グループ</th>
                  <th className="text-right py-2 px-3 text-sub font-medium">上映回数</th>
                  <th className="text-right py-2 px-3 text-sub font-medium">来客数</th>
                  <th className="text-right py-2 px-3 text-sub font-medium">売上（税込）</th>
                  <th className="text-right py-2 px-3 text-sub font-medium">売上（税抜）</th>
                  <th className="text-left py-2 px-3 text-sub font-medium">備考</th>
                  <th className="text-right py-2 px-3 text-sub font-medium w-20">操作</th>
                </tr>
              </thead>
              <tbody>
                {filteredMovies.map((m) => {
                  const stats = statsMap.get(m.title);
                  return (
                    <tr
                      key={m.id}
                      className="border-b border-card-border/50 hover:bg-white/[0.02] transition-colors"
                    >
                      <td className="py-2.5 px-3 text-cream font-medium">
                        {m.title}
                      </td>
                      <td className="py-2.5 px-3 text-cream text-xs whitespace-nowrap">
                        {m.start_date ?? "—"} 〜 {m.end_date ?? "—"}
                      </td>
                      <td className="py-2.5 px-3">
                        {m.group_name ? (
                          <span className="inline-block px-2 py-0.5 rounded bg-accent/10 text-accent text-xs">
                            {m.group_name}
                          </span>
                        ) : (
                          <span className="text-sub text-xs">—</span>
                        )}
                      </td>
                      <td className="py-2.5 px-3 text-right text-cream text-xs">
                        {stats ? `${stats.count}回` : "—"}
                      </td>
                      <td className="py-2.5 px-3 text-right text-cream text-xs">
                        {stats ? `${stats.mobilization.toLocaleString()}名` : "—"}
                      </td>
                      <td className="py-2.5 px-3 text-right text-cream text-xs whitespace-nowrap">
                        {stats ? `¥${stats.revenue_taxin.toLocaleString()}` : "—"}
                      </td>
                      <td className="py-2.5 px-3 text-right text-cream text-xs whitespace-nowrap">
                        {stats ? `¥${stats.revenue_taxout.toLocaleString()}` : "—"}
                      </td>
                      <td className="py-2.5 px-3 text-sub text-xs max-w-[160px] truncate">
                        {m.notes ?? "—"}
                      </td>
                      <td className="py-2.5 px-3 text-right">
                        <div className="flex justify-end gap-1">
                          <button
                            onClick={() => handleEdit(m)}
                            className="p-1.5 rounded-lg text-sub hover:text-accent hover:bg-accent/10 transition-colors"
                            title="編集"
                          >
                            <Pencil size={14} />
                          </button>
                          <button
                            onClick={() => handleDelete(m.id)}
                            className="p-1.5 rounded-lg text-sub hover:text-red-400 hover:bg-red-400/10 transition-colors"
                            title="削除"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
