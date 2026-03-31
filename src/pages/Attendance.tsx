import { useEffect, useState, useMemo } from "react";
import { Pencil, Trash2 } from "lucide-react";
import { supabase } from "../lib/supabase";

interface AttendanceRow {
  id: number;
  date: string;
  staff_name: string;
  start_time: string | null;
  end_time: string | null;
  break_minutes: number;
  work_minutes: number;
  work_hours: number;
  hourly_wage: number;
  salary: number;
  created_at: string;
}

interface FormState {
  date: string;
  staff_name: string;
  start_time: string;
  end_time: string;
  break_minutes: number;
  hourly_wage: number;
  salary: number;
  salaryManual: boolean;
}

const today = () => new Date().toISOString().split("T")[0];

const EMPTY_FORM: FormState = {
  date: today(),
  staff_name: "",
  start_time: "",
  end_time: "",
  break_minutes: 0,
  hourly_wage: 0,
  salary: 0,
  salaryManual: false,
};

function calcWorkMinutes(start: string, end: string, breakMin: number): number {
  if (!start || !end) return 0;
  const [sh, sm] = start.split(":").map(Number);
  const [eh, em] = end.split(":").map(Number);
  const total = eh * 60 + em - (sh * 60 + sm) - breakMin;
  return Math.max(0, total);
}

export default function Attendance() {
  const [rows, setRows] = useState<AttendanceRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState<string | null>(null);
  const [monthFilter, setMonthFilter] = useState("");
  const [staffFilter, setStaffFilter] = useState("");
  const [showStaffSuggest, setShowStaffSuggest] = useState(false);

  const fetchData = async () => {
    setLoading(true);
    const { data } = await supabase
      .from("attendance")
      .select("*")
      .order("date", { ascending: false })
      .order("staff_name");
    if (data) setRows(data);
    setLoading(false);
  };

  useEffect(() => {
    fetchData();
  }, []);

  // Derived
  const staffNames = useMemo(() => {
    const set = new Set<string>();
    for (const r of rows) set.add(r.staff_name);
    return Array.from(set).sort();
  }, [rows]);

  const staffSuggestions = useMemo(() => {
    if (!form.staff_name.trim()) return staffNames;
    const q = form.staff_name.toLowerCase();
    return staffNames.filter((n) => n.toLowerCase().includes(q));
  }, [staffNames, form.staff_name]);

  const availableMonths = useMemo(() => {
    const set = new Set<string>();
    for (const r of rows) set.add(r.date.slice(0, 7));
    return Array.from(set).sort().reverse();
  }, [rows]);

  const filteredRows = useMemo(() => {
    let result = rows;
    if (monthFilter) result = result.filter((r) => r.date.startsWith(monthFilter));
    if (staffFilter) result = result.filter((r) => r.staff_name === staffFilter);
    return result;
  }, [rows, monthFilter, staffFilter]);

  // Monthly summary
  const currentMonth = monthFilter || availableMonths[0] || "";
  const monthlySummary = useMemo(() => {
    const monthRows = rows.filter((r) => r.date.startsWith(currentMonth));
    const map = new Map<string, { days: number; minutes: number; salary: number }>();
    for (const r of monthRows) {
      const entry = map.get(r.staff_name) ?? { days: 0, minutes: 0, salary: 0 };
      entry.days += 1;
      entry.minutes += r.work_minutes ?? 0;
      entry.salary += r.salary ?? 0;
      map.set(r.staff_name, entry);
    }
    return Array.from(map.entries())
      .map(([name, v]) => ({ name, ...v }))
      .sort((a, b) => b.salary - a.salary);
  }, [rows, currentMonth]);

  // Auto-calc
  const workMinutes = calcWorkMinutes(form.start_time, form.end_time, form.break_minutes);
  const workHours = workMinutes / 60;
  const autoSalary = Math.round(workHours * form.hourly_wage);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.staff_name.trim()) return;
    setSaving(true);
    setSaveMsg(null);

    const finalSalary = form.salaryManual ? form.salary : autoSalary;

    const payload = {
      date: form.date,
      staff_name: form.staff_name.trim(),
      start_time: form.start_time || null,
      end_time: form.end_time || null,
      break_minutes: form.break_minutes,
      work_minutes: workMinutes,
      work_hours: Math.round(workHours * 100) / 100,
      hourly_wage: form.hourly_wage,
      salary: finalSalary,
    };

    let error;
    if (editingId) {
      ({ error } = await supabase.from("attendance").update(payload).eq("id", editingId));
    } else {
      ({ error } = await supabase.from("attendance").upsert(payload, {
        onConflict: "date,staff_name",
        ignoreDuplicates: false,
      }));
    }

    if (error) {
      setSaveMsg("エラー: " + error.message);
    } else {
      setSaveMsg(editingId ? "更新しました" : "登録しました");
      setForm(EMPTY_FORM);
      setEditingId(null);
      fetchData();
    }
    setSaving(false);
  };

  const handleEdit = (r: AttendanceRow) => {
    setEditingId(r.id);
    setForm({
      date: r.date,
      staff_name: r.staff_name,
      start_time: r.start_time ?? "",
      end_time: r.end_time ?? "",
      break_minutes: r.break_minutes,
      hourly_wage: r.hourly_wage,
      salary: r.salary,
      salaryManual: false,
    });
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const handleDelete = async (id: number) => {
    if (!window.confirm("この出勤記録を削除しますか？")) return;
    await supabase.from("attendance").delete().eq("id", id);
    fetchData();
  };

  const handleCancel = () => {
    setEditingId(null);
    setForm(EMPTY_FORM);
    setSaveMsg(null);
  };

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold text-cream">出勤簿</h2>

      {/* Form */}
      <form
        onSubmit={handleSubmit}
        className="bg-card border border-card-border rounded-2xl p-5 space-y-4"
      >
        <h3 className="text-sm font-bold text-cream">
          {editingId ? "出勤記録を編集" : "出勤記録を登録"}
        </h3>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-xs text-sub mb-1">日付</label>
            <input
              type="date"
              value={form.date}
              onChange={(e) => setForm({ ...form, date: e.target.value })}
              className="w-full bg-white/[0.03] border border-card-border rounded-lg px-3 py-2 text-sm text-cream outline-none focus:border-accent/40 transition-colors [color-scheme:dark]"
            />
          </div>
          <div className="relative">
            <label className="block text-xs text-sub mb-1">
              スタッフ名 <span className="text-red-400">*</span>
            </label>
            <input
              type="text"
              required
              value={form.staff_name}
              onChange={(e) => setForm({ ...form, staff_name: e.target.value })}
              onFocus={() => setShowStaffSuggest(true)}
              onBlur={() => setTimeout(() => setShowStaffSuggest(false), 200)}
              placeholder="スタッフ名"
              className="w-full bg-white/[0.03] border border-card-border rounded-lg px-3 py-2 text-sm text-cream placeholder:text-sub/60 outline-none focus:border-accent/40 transition-colors"
            />
            {showStaffSuggest && staffSuggestions.length > 0 && (
              <div className="absolute z-10 top-full left-0 right-0 mt-1 bg-[#2a1f10] border border-card-border rounded-lg max-h-40 overflow-y-auto shadow-lg">
                {staffSuggestions.map((n) => (
                  <button
                    key={n}
                    type="button"
                    onMouseDown={() => {
                      setForm({ ...form, staff_name: n });
                      setShowStaffSuggest(false);
                    }}
                    className="w-full text-left px-3 py-2 text-sm text-cream hover:bg-accent/10 transition-colors"
                  >
                    {n}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="grid grid-cols-3 gap-4">
          <div>
            <label className="block text-xs text-sub mb-1">開始時刻</label>
            <input
              type="time"
              value={form.start_time}
              onChange={(e) => setForm({ ...form, start_time: e.target.value })}
              className="w-full bg-white/[0.03] border border-card-border rounded-lg px-3 py-2 text-sm text-cream outline-none focus:border-accent/40 transition-colors [color-scheme:dark]"
            />
          </div>
          <div>
            <label className="block text-xs text-sub mb-1">終了時刻</label>
            <input
              type="time"
              value={form.end_time}
              onChange={(e) => setForm({ ...form, end_time: e.target.value })}
              className="w-full bg-white/[0.03] border border-card-border rounded-lg px-3 py-2 text-sm text-cream outline-none focus:border-accent/40 transition-colors [color-scheme:dark]"
            />
          </div>
          <div>
            <label className="block text-xs text-sub mb-1">休憩（分）</label>
            <input
              type="number"
              min={0}
              value={form.break_minutes || ""}
              onChange={(e) =>
                setForm({ ...form, break_minutes: parseInt(e.target.value) || 0 })
              }
              className="w-full bg-white/[0.03] border border-card-border rounded-lg px-3 py-2 text-sm text-cream outline-none focus:border-accent/40 transition-colors"
              placeholder="0"
            />
          </div>
        </div>

        <div className="grid grid-cols-3 gap-4">
          <div>
            <label className="block text-xs text-sub mb-1">
              就業時間
            </label>
            <div className="px-3 py-2 bg-white/[0.02] border border-card-border rounded-lg text-sm text-accent font-medium">
              {workHours.toFixed(2)}h（{workMinutes}分）
            </div>
          </div>
          <div>
            <label className="block text-xs text-sub mb-1">時給</label>
            <input
              type="number"
              min={0}
              value={form.hourly_wage || ""}
              onChange={(e) =>
                setForm({ ...form, hourly_wage: parseInt(e.target.value) || 0 })
              }
              className="w-full bg-white/[0.03] border border-card-border rounded-lg px-3 py-2 text-sm text-cream outline-none focus:border-accent/40 transition-colors"
              placeholder="0"
            />
          </div>
          <div>
            <label className="block text-xs text-sub mb-1">
              給与額
              {!form.salaryManual && (
                <span className="ml-1 text-accent">（自動）</span>
              )}
            </label>
            <input
              type="number"
              min={0}
              value={form.salaryManual ? form.salary || "" : autoSalary || ""}
              onChange={(e) =>
                setForm({
                  ...form,
                  salary: parseInt(e.target.value) || 0,
                  salaryManual: true,
                })
              }
              className="w-full bg-white/[0.03] border border-card-border rounded-lg px-3 py-2 text-sm text-cream outline-none focus:border-accent/40 transition-colors"
              placeholder="自動計算"
            />
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            type="submit"
            disabled={saving || !form.staff_name.trim()}
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
          {saveMsg && (
            <span
              className={`text-sm ${saveMsg.startsWith("エラー") ? "text-red-400" : "text-green-400"}`}
            >
              {saveMsg}
            </span>
          )}
        </div>
      </form>

      {/* Monthly Summary */}
      <div className="bg-card border border-card-border rounded-2xl p-5 space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-bold text-cream">月次サマリー</h3>
          <select
            value={currentMonth}
            onChange={(e) => setMonthFilter(e.target.value)}
            className="bg-white/[0.03] border border-card-border rounded-lg px-3 py-1.5 text-sm text-cream outline-none focus:border-accent/40 transition-colors [color-scheme:dark]"
          >
            {availableMonths.map((m) => (
              <option key={m} value={m} className="bg-bg text-cream">
                {m}
              </option>
            ))}
          </select>
        </div>

        {monthlySummary.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-card-border">
                  <th className="text-left py-2 px-3 text-sub font-medium">スタッフ名</th>
                  <th className="text-right py-2 px-3 text-sub font-medium">出勤日数</th>
                  <th className="text-right py-2 px-3 text-sub font-medium">総就業時間</th>
                  <th className="text-right py-2 px-3 text-sub font-medium">給与合計</th>
                </tr>
              </thead>
              <tbody>
                {monthlySummary.map((s) => (
                  <tr key={s.name} className="border-b border-card-border/50">
                    <td className="py-2 px-3 text-cream font-medium">{s.name}</td>
                    <td className="py-2 px-3 text-right text-cream">{s.days}日</td>
                    <td className="py-2 px-3 text-right text-cream">
                      {(s.minutes / 60).toFixed(1)}h
                    </td>
                    <td className="py-2 px-3 text-right text-accent font-medium">
                      ¥{s.salary.toLocaleString()}
                    </td>
                  </tr>
                ))}
                <tr className="border-t border-card-border">
                  <td className="py-2 px-3 text-sub font-medium">合計</td>
                  <td className="py-2 px-3 text-right text-sub">
                    {monthlySummary.reduce((s, r) => s + r.days, 0)}日
                  </td>
                  <td className="py-2 px-3 text-right text-sub">
                    {(monthlySummary.reduce((s, r) => s + r.minutes, 0) / 60).toFixed(1)}h
                  </td>
                  <td className="py-2 px-3 text-right text-accent font-bold">
                    ¥{monthlySummary.reduce((s, r) => s + r.salary, 0).toLocaleString()}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        ) : (
          <div className="text-center py-6 text-sub">データがありません</div>
        )}
      </div>

      {/* Attendance List */}
      <div className="bg-card border border-card-border rounded-2xl p-5 space-y-4">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <h3 className="text-sm font-bold text-cream">
            出勤一覧
            <span className="ml-2 text-accent font-normal">{filteredRows.length}件</span>
          </h3>
          <div className="flex gap-2">
            <select
              value={monthFilter}
              onChange={(e) => setMonthFilter(e.target.value)}
              className="bg-white/[0.03] border border-card-border rounded-lg px-3 py-1.5 text-sm text-cream outline-none focus:border-accent/40 transition-colors [color-scheme:dark]"
            >
              <option value="" className="bg-bg text-cream">全期間</option>
              {availableMonths.map((m) => (
                <option key={m} value={m} className="bg-bg text-cream">{m}</option>
              ))}
            </select>
            <select
              value={staffFilter}
              onChange={(e) => setStaffFilter(e.target.value)}
              className="bg-white/[0.03] border border-card-border rounded-lg px-3 py-1.5 text-sm text-cream outline-none focus:border-accent/40 transition-colors [color-scheme:dark]"
            >
              <option value="" className="bg-bg text-cream">全スタッフ</option>
              {staffNames.map((n) => (
                <option key={n} value={n} className="bg-bg text-cream">{n}</option>
              ))}
            </select>
          </div>
        </div>

        {loading ? (
          <div className="text-center py-8 text-sub">読み込み中...</div>
        ) : filteredRows.length === 0 ? (
          <div className="text-center py-8 text-sub">出勤記録がありません</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-card-border">
                  <th className="text-left py-2 px-3 text-sub font-medium">日付</th>
                  <th className="text-left py-2 px-3 text-sub font-medium">スタッフ名</th>
                  <th className="text-left py-2 px-3 text-sub font-medium">開始</th>
                  <th className="text-left py-2 px-3 text-sub font-medium">終了</th>
                  <th className="text-right py-2 px-3 text-sub font-medium">就業時間</th>
                  <th className="text-right py-2 px-3 text-sub font-medium">給与額</th>
                  <th className="text-right py-2 px-3 text-sub font-medium w-20">操作</th>
                </tr>
              </thead>
              <tbody>
                {filteredRows.map((r) => (
                  <tr
                    key={r.id}
                    className="border-b border-card-border/50 hover:bg-white/[0.02] transition-colors"
                  >
                    <td className="py-2 px-3 text-cream whitespace-nowrap">{r.date}</td>
                    <td className="py-2 px-3 text-cream font-medium">{r.staff_name}</td>
                    <td className="py-2 px-3 text-cream">{r.start_time ?? "—"}</td>
                    <td className="py-2 px-3 text-cream">{r.end_time ?? "—"}</td>
                    <td className="py-2 px-3 text-right text-cream">
                      {r.work_hours?.toFixed(2) ?? 0}h
                    </td>
                    <td className="py-2 px-3 text-right text-accent font-medium">
                      ¥{(r.salary ?? 0).toLocaleString()}
                    </td>
                    <td className="py-2 px-3 text-right">
                      <div className="flex justify-end gap-1">
                        <button
                          onClick={() => handleEdit(r)}
                          className="p-1.5 rounded-lg text-sub hover:text-accent hover:bg-accent/10 transition-colors"
                          title="編集"
                        >
                          <Pencil size={14} />
                        </button>
                        <button
                          onClick={() => handleDelete(r.id)}
                          className="p-1.5 rounded-lg text-sub hover:text-red-400 hover:bg-red-400/10 transition-colors"
                          title="削除"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
