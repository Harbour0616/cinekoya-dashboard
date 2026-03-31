import { useEffect, useState, useMemo, useRef } from "react";
import { Pencil, Trash2, Search } from "lucide-react";
import { Bar, Line } from "react-chartjs-2";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  PointElement,
  LineElement,
  Tooltip,
  Legend,
} from "chart.js";
import { supabase } from "../lib/supabase";
import { TICKET_TYPES } from "../types";
import type { DailyReport, TicketTypeKey } from "../types";

ChartJS.register(CategoryScale, LinearScale, BarElement, PointElement, LineElement, Tooltip, Legend);

const TIME_SLOTS = [
  { value: "10:30", label: "A（10:30）" },
  { value: "13:00", label: "B（13:00）" },
  { value: "15:30", label: "C（15:30）" },
  { value: "18:00", label: "D（18:00）" },
  { value: "20:30", label: "E（20:30）" },
];

const today = () => new Date().toISOString().split("T")[0];

interface TicketForm {
  audience_general: number;
  audience_fc: number;
  audience_fc_guest: number;
  audience_members: number;
  audience_members_guest: number;
  audience_u28: number;
  audience_u22: number;
  audience_highschool: number;
}

const EMPTY_TICKETS: TicketForm = {
  audience_general: 0,
  audience_fc: 0,
  audience_fc_guest: 0,
  audience_members: 0,
  audience_members_guest: 0,
  audience_u28: 0,
  audience_u22: 0,
  audience_highschool: 0,
};

interface FormState {
  date: string;
  title: string;
  time_slot: string;
  tickets: TicketForm;
  revenue_taxin: number;
  notes: string;
}

const EMPTY_FORM: FormState = {
  date: today(),
  title: "",
  time_slot: "10:30",
  tickets: { ...EMPTY_TICKETS },
  revenue_taxin: 0,
  notes: "",
};

const PAGE_SIZE = 50;

export default function DailyReportPage() {
  const [movieTitles, setMovieTitles] = useState<string[]>([]);
  const [movieSearch, setMovieSearch] = useState("");
  const [showMovieDropdown, setShowMovieDropdown] = useState(false);

  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState<string | null>(null);
  const [titleError, setTitleError] = useState(false);

  const [reports, setReports] = useState<DailyReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [monthFilter, setMonthFilter] = useState("");
  const [page, setPage] = useState(0);

  // Fetch movie titles from movies table
  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from("movies")
        .select("title")
        .order("start_date", { ascending: false, nullsFirst: false });
      if (data) setMovieTitles(data.map((d) => d.title));
    })();
  }, []);

  const filteredMovies = useMemo(() => {
    if (!movieSearch.trim()) return movieTitles;
    const q = movieSearch.toLowerCase();
    return movieTitles.filter((t) => t.toLowerCase().includes(q));
  }, [movieTitles, movieSearch]);

  // Fetch daily reports
  const fetchReports = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("daily_reports")
      .select("*")
      .order("created_at", { ascending: false });
    if (!error && data) setReports(data);
    setLoading(false);
  };

  useEffect(() => {
    fetchReports();
  }, []);

  // Available months for filter
  const availableMonths = useMemo(() => {
    const set = new Set<string>();
    for (const r of reports) {
      if (r.date) set.add(r.date.slice(0, 7));
    }
    return Array.from(set).sort().reverse();
  }, [reports]);

  // Filtered + paginated reports
  const filteredReports = useMemo(() => {
    if (!monthFilter) return reports;
    return reports.filter((r) => r.date?.startsWith(monthFilter));
  }, [reports, monthFilter]);

  const pagedReports = filteredReports.slice(
    page * PAGE_SIZE,
    (page + 1) * PAGE_SIZE
  );
  const totalPages = Math.ceil(filteredReports.length / PAGE_SIZE);

  const ticketRefs = useRef<(HTMLInputElement | null)[]>([]);
  const titleRef = useRef<HTMLDivElement>(null);

  // Attendance salary for the selected date
  const [attendanceSalary, setAttendanceSalary] = useState(0);

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from("attendance")
        .select("salary")
        .eq("date", form.date);
      const total = data?.reduce((s, r) => s + (r.salary ?? 0), 0) ?? 0;
      setAttendanceSalary(total);
    })();
  }, [form.date, reports]);

  // Daily revenue total (tax-excluded) for the selected date
  const dailyRevenueTaxout = useMemo(() => {
    const dayReports = reports.filter((r) => r.date === form.date);
    const taxin = dayReports.reduce((s, r) => s + (r.revenue_taxin ?? 0), 0);
    return Math.floor(taxin / 1.1);
  }, [reports, form.date]);

  // Daily mobilization by movie
  const dailyMobilByMovie = useMemo(() => {
    const dayReports = reports.filter((r) => r.date === form.date);
    const map = new Map<string, number>();
    for (const r of dayReports) {
      const title = r.title ?? "不明";
      map.set(title, (map.get(title) ?? 0) + (r.mobilization ?? 0));
    }
    return Array.from(map, ([title, count]) => ({ title, count })).sort(
      (a, b) => b.count - a.count
    );
  }, [reports, form.date]);

  // 2-week trend data (only days with revenue > 0)
  const trendData = useMemo(() => {
    const weekdays = ["日", "月", "火", "水", "木", "金", "土"];
    const days: string[] = [];
    const baseDate = new Date(form.date + "T00:00:00");
    for (let i = 13; i >= 0; i--) {
      const d = new Date(baseDate);
      d.setDate(d.getDate() - i);
      days.push(d.toISOString().split("T")[0]);
    }
    const labels: string[] = [];
    const revenue: number[] = [];
    const mobil: number[] = [];
    const salary: number[] = [];
    const profit: number[] = [];
    for (const d of days) {
      const dayR = reports.filter((r) => r.date === d);
      const taxin = dayR.reduce((s, r) => s + (r.revenue_taxin ?? 0), 0);
      if (taxin === 0) continue;
      const taxout = Math.floor(taxin / 1.1);
      const dt = new Date(d + "T00:00:00");
      labels.push(`${dt.getMonth() + 1}/${dt.getDate()}(${weekdays[dt.getDay()]})`);
      const m = dayR.reduce((s, r) => s + (r.mobilization ?? 0), 0);
      const sal = dayR.reduce((s, r) => s + (r.salary ?? 0), 0);
      revenue.push(taxout);
      mobil.push(m);
      salary.push(sal);
      profit.push(taxout - Math.floor(taxout * 0.5) - sal - 70000);
    }
    return { labels, revenue, mobil, salary, profit };
  }, [reports, form.date]);

  // Ticket total
  const ticketTotal = Object.values(form.tickets).reduce((s, v) => s + v, 0);

  // Auto-calculated revenue
  const calculatedRevenue = TICKET_TYPES.reduce(
    (s, t) => s + form.tickets[t.key] * t.price,
    0
  );

  const setTicket = (key: TicketTypeKey, value: number) => {
    setForm((prev) => ({
      ...prev,
      tickets: { ...prev.tickets, [key]: value },
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.title.trim()) {
      setTitleError(true);
      titleRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
      return;
    }
    setTitleError(false);
    setSaving(true);
    setSaveMsg(null);

    try {
      const revenueTaxout = Math.round(calculatedRevenue / 1.1);

      const payload = {
        date: form.date,
        title: form.title,
        time_slot: form.time_slot,
        audience_total: ticketTotal,
        mobilization: ticketTotal,
        revenue_taxin: calculatedRevenue,
        revenue_taxout: revenueTaxout,
        ...form.tickets,
      };

      let error;
      if (editingId) {
        ({ error } = await supabase
          .from("daily_reports")
          .update(payload)
          .eq("id", editingId));
      } else {
        ({ error } = await supabase.from("daily_reports").insert(payload));
      }

      if (error) {
        setSaveMsg("エラー: " + error.message);
      } else {
        const msg = editingId ? "更新しました" : "登録しました";
        setSaveMsg(msg);
        setTimeout(() => setSaveMsg((cur) => (cur === msg ? null : cur)), 5000);
        setForm(EMPTY_FORM);
        setMovieSearch("");
        setEditingId(null);
        fetchReports();
      }
    } catch (err) {
      console.error("日報登録エラー:", err);
      setSaveMsg(
        "エラー: " + (err instanceof Error ? err.message : "予期しないエラー")
      );
    } finally {
      setSaving(false);
    }
  };

  const handleEdit = (r: DailyReport) => {
    setEditingId(r.id);
    setForm({
      date: r.date ?? today(),
      title: r.title ?? "",
      time_slot: r.time_slot ?? "10:30",
      tickets: {
        audience_general: r.audience_general ?? 0,
        audience_fc: r.audience_fc ?? 0,
        audience_fc_guest: r.audience_fc_guest ?? 0,
        audience_members: r.audience_members ?? 0,
        audience_members_guest: r.audience_members_guest ?? 0,
        audience_u28: r.audience_u28 ?? 0,
        audience_u22: r.audience_u22 ?? 0,
        audience_highschool: r.audience_highschool ?? 0,
      },
      revenue_taxin: r.revenue_taxin ?? 0,
      notes: "",
    });
    setMovieSearch(r.title ?? "");
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const handleDelete = async (id: number) => {
    if (!window.confirm("この日報を削除しますか？")) return;
    await supabase.from("daily_reports").delete().eq("id", id);
    fetchReports();
  };

  const handleCancel = () => {
    setEditingId(null);
    setForm(EMPTY_FORM);
    setMovieSearch("");
    setSaveMsg(null);
  };

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold text-cream">日報登録</h2>

      <div className="flex gap-6">
      {/* Registration form */}
      <form
        onSubmit={handleSubmit}
        className="bg-card border border-card-border rounded-2xl p-5 space-y-4 w-1/3 min-w-0"
      >
        {/* 日付 */}
        <div>
          <label className="block text-xs text-sub mb-1">日付</label>
          <input
            type="date"
            value={form.date}
            onChange={(e) => setForm({ ...form, date: e.target.value })}
            className="w-full bg-white/[0.03] border border-card-border rounded-lg px-3 py-2 text-sm text-cream outline-none focus:border-accent/40 transition-colors [color-scheme:dark]"
          />
        </div>

        {/* 時間帯 */}
        <div>
          <label className="block text-xs text-sub mb-1">時間帯</label>
          <select
            value={form.time_slot}
            onChange={(e) => setForm({ ...form, time_slot: e.target.value })}
            className="w-full bg-white/[0.03] border border-card-border rounded-lg px-3 py-2 text-sm text-cream outline-none focus:border-accent/40 transition-colors [color-scheme:dark]"
          >
            {TIME_SLOTS.map((s) => (
              <option key={s.value} value={s.value} className="bg-bg text-cream">
                {s.label}
              </option>
            ))}
          </select>
        </div>

        {/* 上映作品 */}
        <div ref={titleRef} className="relative">
          <label className="block text-xs text-sub mb-1">
            上映作品 <span className="text-red-400">*</span>
          </label>
          <div className="relative">
            <Search
              size={14}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-sub"
            />
            <input
              type="text"
              value={movieSearch}
              onChange={(e) => {
                setMovieSearch(e.target.value);
                setForm({ ...form, title: e.target.value });
                setShowMovieDropdown(true);
                if (e.target.value.trim()) setTitleError(false);
              }}
              onFocus={() => setShowMovieDropdown(true)}
              onBlur={() => setTimeout(() => setShowMovieDropdown(false), 200)}
              placeholder="作品名を検索..."
              className="w-full bg-white/[0.03] border border-card-border rounded-lg pl-9 pr-3 py-2 text-sm text-cream placeholder:text-sub/60 outline-none focus:border-accent/40 transition-colors"
            />
          </div>
          {showMovieDropdown && filteredMovies.length > 0 && (
            <div className="absolute z-10 top-full left-0 right-0 mt-1 bg-[#2a1f10] border border-card-border rounded-lg max-h-48 overflow-y-auto shadow-lg">
              {filteredMovies.slice(0, 30).map((t) => (
                <button
                  key={t}
                  type="button"
                  onMouseDown={() => {
                    setForm({ ...form, title: t });
                    setMovieSearch(t);
                    setShowMovieDropdown(false);
                    setTitleError(false);
                  }}
                  className="w-full text-left px-3 py-2 text-sm text-cream hover:bg-accent/10 transition-colors"
                >
                  {t}
                </button>
              ))}
            </div>
          )}
          {titleError && (
            <p className="text-xs text-red-400 mt-1">作品名を選択してください</p>
          )}
        </div>

        {/* 券種別（縦一列） */}
        <div>
          <label className="block text-xs text-sub mb-2">
            動員数（券種別）
          </label>
          <div className="space-y-3">
            {TICKET_TYPES.map((t, i) => (
              <div key={t.key}>
                <label className="block text-xs text-sub mb-1 flex items-center gap-1.5">
                  <span
                    className="w-2.5 h-2.5 rounded-sm inline-block"
                    style={{ backgroundColor: t.color }}
                  />
                  {t.label}
                </label>
                <input
                  ref={(el) => { ticketRefs.current[i] = el; }}
                  type="number"
                  min={0}
                  value={form.tickets[t.key] || ""}
                  onChange={(e) =>
                    setTicket(t.key, parseInt(e.target.value) || 0)
                  }
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      ticketRefs.current[i + 1]?.focus();
                    }
                  }}
                  className="w-full bg-white/[0.03] border border-card-border rounded-lg px-3 py-2 text-sm text-cream outline-none focus:border-accent/40 transition-colors no-spinner"
                  placeholder="0"
                />
              </div>
            ))}
          </div>
        </div>

        {/* 備考・メモ */}
        <div>
          <label className="block text-xs text-sub mb-1">備考・メモ</label>
          <textarea
            value={form.notes}
            onChange={(e) => setForm({ ...form, notes: e.target.value })}
            rows={2}
            className="w-full bg-white/[0.03] border border-card-border rounded-lg px-3 py-2 text-sm text-cream placeholder:text-sub/60 outline-none focus:border-accent/40 transition-colors resize-none"
            placeholder="備考を入力"
          />
        </div>

        {/* 売上（税込・自動計算） */}
        <div>
          <label className="block text-xs text-sub mb-1">
            売上（税込・自動計算）
            <span className="ml-2 text-accent font-bold">合計: {ticketTotal}人</span>
          </label>
          <input
            type="text"
            readOnly
            value={`¥${calculatedRevenue.toLocaleString()}`}
            className="w-full bg-white/[0.06] border border-card-border rounded-lg px-3 py-2 text-sm text-cream outline-none cursor-default"
          />
        </div>

        {/* Buttons */}
        <div className="flex items-center gap-3">
          <button
            type="submit"
            disabled={saving}
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
              className={`text-sm ${
                saveMsg.startsWith("エラー") ? "text-red-400" : "text-green-400"
              }`}
            >
              {saveMsg}
            </span>
          )}
        </div>
      </form>

      {/* Daily summary cards */}
      <div className="flex-1 space-y-4 pt-0">
        <p className="text-2xl font-bold text-accent">
          {new Date(form.date + "T00:00:00").toLocaleDateString("ja-JP", {
            year: "numeric",
            month: "long",
            day: "numeric",
            weekday: "short",
          })}
        </p>
        <div className="bg-card border border-card-border rounded-2xl p-5">
          <p className="text-xs text-sub mb-2">売上（税抜）</p>
          <p className="text-2xl font-bold text-cream">
            ¥{dailyRevenueTaxout.toLocaleString()}
          </p>
        </div>
        <div className="bg-card border border-card-border rounded-2xl p-5">
          <p className="text-xs text-sub mb-2">上映権料</p>
          <p className="text-2xl font-bold text-cream">
            ¥{Math.floor(dailyRevenueTaxout * 0.5).toLocaleString()}
          </p>
        </div>
        <div className="bg-card border border-card-border rounded-2xl p-5">
          <p className="text-xs text-sub mb-2">給与</p>
          <p className="text-2xl font-bold text-cream">
            ¥{attendanceSalary.toLocaleString()}
          </p>
        </div>
        <div className="bg-card border border-card-border rounded-2xl p-5">
          <p className="text-xs text-sub mb-2">固定費</p>
          <p className="text-2xl font-bold text-cream">
            ¥70,000
          </p>
        </div>
        {(() => {
          const profit = dailyRevenueTaxout - Math.floor(dailyRevenueTaxout * 0.5) - attendanceSalary - 70000;
          return (
            <div className="bg-card border border-card-border rounded-2xl p-5">
              <p className="text-xs text-sub mb-2">利益</p>
              <p className={`text-2xl font-bold ${profit >= 0 ? "text-green-400" : "text-red-400"}`}>
                ¥{profit.toLocaleString()}
              </p>
            </div>
          );
        })()}
        <div className="bg-card border border-card-border rounded-2xl p-5">
          <p className="text-xs text-sub mb-3">今日の作品別動員数</p>
          {dailyMobilByMovie.length === 0 ? (
            <p className="text-sm text-sub text-center py-4">データなし</p>
          ) : (
            <div className="w-full" style={{ aspectRatio: `${Math.max(dailyMobilByMovie.length, 2)} / 1` }}>
              <Bar
                data={{
                  labels: dailyMobilByMovie.map((d) => d.title),
                  datasets: [
                    {
                      data: dailyMobilByMovie.map((d) => d.count),
                      backgroundColor: "#c8861a",
                      borderRadius: 4,
                    },
                  ],
                }}
                plugins={[{
                  id: "barLabels",
                  afterDatasetsDraw(chart) {
                    const ctx = chart.ctx;
                    chart.data.datasets.forEach((ds, i) => {
                      const meta = chart.getDatasetMeta(i);
                      meta.data.forEach((bar, j) => {
                        const v = ds.data[j] as number;
                        if (v > 0) {
                          ctx.fillStyle = "#f5ead8";
                          ctx.font = "11px sans-serif";
                          ctx.textAlign = "left";
                          ctx.textBaseline = "middle";
                          ctx.fillText(`${v}人`, bar.x + 4, bar.y);
                        }
                      });
                    });
                  },
                }]}
                options={{
                  indexAxis: "y",
                  responsive: true,
                  maintainAspectRatio: false,
                  plugins: { legend: { display: false }, tooltip: { enabled: true } },
                  scales: {
                    x: {
                      ticks: { color: "#a08860", stepSize: 1 },
                      grid: { color: "rgba(255,180,60,0.06)" },
                    },
                    y: {
                      ticks: { color: "#f5ead8", font: { size: 11 } },
                      grid: { display: false },
                    },
                  },
                }}
              />
            </div>
          )}
        </div>
        <div className="bg-card border border-card-border rounded-2xl p-5">
          <p className="text-xs text-sub mb-3">過去2週間のトレンド</p>
          <div className="w-full max-h-[250px]">
            <Line
              data={{
                labels: trendData.labels,
                datasets: [
                  {
                    label: "売上（税抜）",
                    data: trendData.revenue,
                    borderColor: "#5b9bd5",
                    backgroundColor: "#5b9bd5",
                    tension: 0.3,
                    pointRadius: 2,
                    yAxisID: "y",
                  },
                  {
                    label: "給与",
                    data: trendData.salary,
                    borderColor: "#c8861a",
                    backgroundColor: "#c8861a",
                    tension: 0.3,
                    pointRadius: 2,
                    yAxisID: "y",
                  },
                  {
                    label: "利益",
                    data: trendData.profit,
                    borderColor: "#a07de8",
                    backgroundColor: "#a07de8",
                    tension: 0.3,
                    pointRadius: 2,
                    yAxisID: "y",
                  },
                  {
                    label: "動員数",
                    data: trendData.mobil,
                    borderColor: "#6fcf97",
                    backgroundColor: "#6fcf97",
                    tension: 0.3,
                    pointRadius: 2,
                    yAxisID: "y1",
                  },
                ],
              }}
              options={{
                responsive: true,
                maintainAspectRatio: false,
                interaction: { mode: "index", intersect: false },
                plugins: {
                  legend: {
                    labels: { color: "#a08860", boxWidth: 12, font: { size: 10 } },
                  },
                },
                scales: {
                  x: {
                    ticks: { color: "#a08860", font: { size: 10 } },
                    grid: { color: "rgba(255,180,60,0.06)" },
                  },
                  y: {
                    position: "left",
                    ticks: { color: "#a08860", font: { size: 10 } },
                    grid: { color: "rgba(255,180,60,0.06)" },
                  },
                  y1: {
                    position: "right",
                    ticks: { color: "#6fcf97", font: { size: 10 } },
                    grid: { drawOnChartArea: false },
                  },
                },
              }}
            />
          </div>
        </div>
      </div>
      </div>

      {/* Report list */}
      <div className="bg-card border border-card-border rounded-2xl p-5 space-y-4">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <h3 className="text-sm font-bold text-cream">
            日報一覧
            <span className="ml-2 text-accent font-normal">
              {filteredReports.length}件
            </span>
          </h3>
          <select
            value={monthFilter}
            onChange={(e) => {
              setMonthFilter(e.target.value);
              setPage(0);
            }}
            className="bg-white/[0.03] border border-card-border rounded-lg px-3 py-1.5 text-sm text-cream outline-none focus:border-accent/40 transition-colors [color-scheme:dark]"
          >
            <option value="" className="bg-bg text-cream">
              全期間
            </option>
            {availableMonths.map((m) => (
              <option key={m} value={m} className="bg-bg text-cream">
                {m}
              </option>
            ))}
          </select>
        </div>

        {loading ? (
          <div className="text-center py-8 text-sub">読み込み中...</div>
        ) : pagedReports.length === 0 ? (
          <div className="text-center py-8 text-sub">日報がありません</div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-card-border">
                    <th className="text-left py-2 px-3 text-sub font-medium">
                      日付
                    </th>
                    <th className="text-left py-2 px-3 text-sub font-medium">
                      作品名
                    </th>
                    <th className="text-left py-2 px-3 text-sub font-medium">
                      時間帯
                    </th>
                    <th className="text-right py-2 px-3 text-sub font-medium">
                      動員数
                    </th>
                    <th className="text-right py-2 px-3 text-sub font-medium">
                      売上（税込）
                    </th>
                    <th className="text-right py-2 px-3 text-sub font-medium">
                      給与
                    </th>
                    <th className="text-right py-2 px-3 text-sub font-medium w-20">
                      操作
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {pagedReports.map((r) => (
                    <tr
                      key={r.id}
                      className="border-b border-card-border/50 hover:bg-white/[0.02] transition-colors"
                    >
                      <td className="py-2 px-3 text-cream whitespace-nowrap">
                        {r.date ?? "—"}
                      </td>
                      <td className="py-2 px-3 text-cream font-medium max-w-[30vw] truncate">
                        {r.title ?? "—"}
                      </td>
                      <td className="py-2 px-3 text-cream">{r.time_slot ?? "—"}</td>
                      <td className="py-2 px-3 text-right text-cream">
                        {r.mobilization?.toLocaleString() ?? 0}人
                      </td>
                      <td className="py-2 px-3 text-right text-cream">
                        ¥{(r.revenue_taxin ?? 0).toLocaleString()}
                      </td>
                      <td className="py-2 px-3 text-right text-sub">
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

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex items-center justify-center gap-2 pt-2">
                <button
                  onClick={() => setPage((p) => Math.max(0, p - 1))}
                  disabled={page === 0}
                  className="px-3 py-1 rounded-lg text-xs font-medium bg-white/[0.03] border border-card-border text-sub hover:text-cream disabled:opacity-30 transition-colors"
                >
                  前へ
                </button>
                <span className="text-xs text-sub">
                  {page + 1} / {totalPages}
                </span>
                <button
                  onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
                  disabled={page >= totalPages - 1}
                  className="px-3 py-1 rounded-lg text-xs font-medium bg-white/[0.03] border border-card-border text-sub hover:text-cream disabled:opacity-30 transition-colors"
                >
                  次へ
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
