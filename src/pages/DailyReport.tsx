import { Fragment, useEffect, useState, useMemo, useRef } from "react";
import { Pencil, Trash2, Search, ChevronDown, ChevronRight } from "lucide-react";
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

const TIME_SLOT_SHORT: Record<string, string> = {
  "10:30": "A",
  "13:00": "B",
  "15:30": "C",
  "18:00": "D",
  "20:30": "E",
};

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
      .order("date", { ascending: false })
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

  // Group reports by date
  const groupedReports = useMemo(() => {
    const map = new Map<string, DailyReport[]>();
    for (const r of filteredReports) {
      const d = r.date ?? "";
      if (!map.has(d)) map.set(d, []);
      map.get(d)!.push(r);
    }
    return Array.from(map.entries()).sort((a, b) => b[0].localeCompare(a[0]));
  }, [filteredReports]);

  const [expandedDates, setExpandedDates] = useState<Set<string>>(new Set());

  // Auto-expand latest date when data changes
  useEffect(() => {
    if (groupedReports.length > 0) {
      setExpandedDates(new Set([groupedReports[0][0]]));
    }
  }, [groupedReports]);

  const toggleDate = (date: string) => {
    setExpandedDates((prev) => {
      const next = new Set(prev);
      if (next.has(date)) next.delete(date);
      else next.add(date);
      return next;
    });
  };

  const periodTotals = useMemo(() => {
    let mobil = 0, taxout = 0, sal = 0;
    const dateSet = new Set<string>();
    for (const r of filteredReports) {
      mobil += r.mobilization ?? 0;
      taxout += Math.floor((r.revenue_taxin ?? 0) / 1.1);
      sal += r.salary ?? 0;
      if (r.date) dateSet.add(r.date);
    }
    const rights = Math.floor(taxout * 0.5);
    const days = dateSet.size;
    const fixed = 70000 * days;
    const profit = taxout - rights - sal - fixed;
    return { mobil, taxout, rights, sal, fixed, profit, days };
  }, [filteredReports]);

  const totalPages = Math.ceil(groupedReports.length / PAGE_SIZE);
  const pagedGroups = groupedReports.slice(
    page * PAGE_SIZE,
    (page + 1) * PAGE_SIZE
  );

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
    <div className="space-y-[1.5vw]">
      <div className="flex items-center gap-[1.5vw]">
        <h2 className="text-[1.7vw] font-bold text-cream w-1/3">日報登録</h2>
        <p className="text-[1.7vw] font-bold text-accent flex-1">
          {new Date(form.date + "T00:00:00").toLocaleDateString("ja-JP", {
            year: "numeric",
            month: "long",
            day: "numeric",
            weekday: "short",
          })}
        </p>
      </div>

      <div className="flex gap-[1.5vw]">
      {/* Registration form */}
      <form
        onSubmit={handleSubmit}
        className="bg-card border border-card-border rounded-[1vw] p-[1.2vw] space-y-[1vw] w-1/3 min-w-0"
      >
        {/* 日付 */}
        <div>
          <label className="block text-[0.85vw] text-sub mb-[0.3vw]">日付</label>
          <input
            type="date"
            value={form.date}
            onChange={(e) => setForm({ ...form, date: e.target.value })}
            className="w-full bg-white/[0.03] border border-card-border rounded-lg px-[0.8vw] py-[0.5vw] text-[0.95vw] text-cream outline-none focus:border-accent/40 transition-colors [color-scheme:dark]"
          />
        </div>

        {/* 時間帯 */}
        <div>
          <label className="block text-[0.85vw] text-sub mb-[0.3vw]">時間帯</label>
          <select
            value={form.time_slot}
            onChange={(e) => setForm({ ...form, time_slot: e.target.value })}
            className="w-full bg-white/[0.03] border border-card-border rounded-lg px-[0.8vw] py-[0.5vw] text-[0.95vw] text-cream outline-none focus:border-accent/40 transition-colors [color-scheme:dark]"
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
          <label className="block text-[0.85vw] text-sub mb-[0.3vw]">
            上映作品 <span className="text-red-400">*</span>
          </label>
          <div className="relative">
            <Search
              size={14}
              className="absolute left-[0.8vw] top-1/2 -translate-y-1/2 text-sub"
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
              className="w-full bg-white/[0.03] border border-card-border rounded-lg pl-[2vw] pr-[0.8vw] py-[0.5vw] text-[0.95vw] text-cream placeholder:text-sub/60 outline-none focus:border-accent/40 transition-colors"
            />
          </div>
          {showMovieDropdown && filteredMovies.length > 0 && (
            <div className="absolute z-10 top-full left-0 right-0 mt-[0.3vw] bg-[#2a1f10] border border-card-border rounded-lg max-h-[15vw] overflow-y-auto shadow-lg">
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
                  className="w-full text-left px-[0.8vw] py-[0.5vw] text-[0.95vw] text-cream hover:bg-accent/10 transition-colors"
                >
                  {t}
                </button>
              ))}
            </div>
          )}
          {titleError && (
            <p className="text-[0.85vw] text-red-400 mt-[0.3vw]">作品名を選択してください</p>
          )}
        </div>

        {/* 券種別（縦一列） */}
        <div>
          <label className="block text-[0.85vw] text-sub mb-[0.5vw]">
            動員数（券種別）
          </label>
          <div className="space-y-[0.7vw]">
            {TICKET_TYPES.map((t, i) => (
              <div key={t.key}>
                <label className="block text-[0.85vw] text-sub mb-[0.3vw] flex items-center gap-[0.4vw]">
                  <span
                    className="w-[0.7vw] h-[0.7vw] rounded-sm inline-block"
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
                  className="w-full bg-white/[0.03] border border-card-border rounded-lg px-[0.8vw] py-[0.5vw] text-[0.95vw] text-cream outline-none focus:border-accent/40 transition-colors no-spinner"
                  placeholder="0"
                />
              </div>
            ))}
          </div>
        </div>

        {/* 備考・メモ */}
        <div>
          <label className="block text-[0.85vw] text-sub mb-[0.3vw]">備考・メモ</label>
          <textarea
            value={form.notes}
            onChange={(e) => setForm({ ...form, notes: e.target.value })}
            rows={2}
            className="w-full bg-white/[0.03] border border-card-border rounded-lg px-[0.8vw] py-[0.5vw] text-[0.95vw] text-cream placeholder:text-sub/60 outline-none focus:border-accent/40 transition-colors resize-none"
            placeholder="備考を入力"
          />
        </div>

        {/* 売上（税込・自動計算） */}
        <div>
          <label className="block text-[0.85vw] text-sub mb-[0.3vw]">
            売上（税込・自動計算）
            <span className="ml-[0.5vw] text-accent font-bold">合計: {ticketTotal}人</span>
          </label>
          <input
            type="text"
            readOnly
            value={`¥${calculatedRevenue.toLocaleString()}`}
            className="w-full bg-white/[0.06] border border-card-border rounded-lg px-[0.8vw] py-[0.5vw] text-[0.95vw] text-cream outline-none cursor-default"
          />
        </div>

        {/* Buttons */}
        <div className="flex items-center gap-[0.8vw]">
          <button
            type="submit"
            disabled={saving}
            className="px-[1.5vw] py-[0.6vw] bg-accent hover:bg-accent/80 disabled:opacity-50 text-bg font-bold rounded-xl transition-colors text-[0.95vw]"
          >
            {saving ? "保存中..." : editingId ? "更新する" : "登録する"}
          </button>
          {editingId && (
            <button
              type="button"
              onClick={handleCancel}
              className="px-[1.5vw] py-[0.6vw] bg-white/[0.05] border border-card-border text-sub hover:text-cream rounded-xl transition-colors text-[0.95vw]"
            >
              キャンセル
            </button>
          )}
          {saveMsg && (
            <span
              className={`text-[0.95vw] ${
                saveMsg.startsWith("エラー") ? "text-red-400" : "text-green-400"
              }`}
            >
              {saveMsg}
            </span>
          )}
        </div>
      </form>

      {/* Daily summary cards */}
      <div className="flex-1 min-w-0 space-y-[1vw] pt-0">
        <div className="bg-card border border-card-border rounded-[1vw] p-[1.2vw]">
          <p className="text-[0.85vw] text-sub mb-[0.4vw]">売上（税抜）</p>
          <p className="text-[1.7vw] font-bold text-cream">
            ¥{dailyRevenueTaxout.toLocaleString()}
          </p>
        </div>
        <div className="bg-card border border-card-border rounded-[1vw] p-[1.2vw]">
          <p className="text-[0.85vw] text-sub mb-[0.4vw]">上映権料</p>
          <p className="text-[1.7vw] font-bold text-cream">
            ¥{Math.floor(dailyRevenueTaxout * 0.5).toLocaleString()}
          </p>
        </div>
        <div className="bg-card border border-card-border rounded-[1vw] p-[1.2vw]">
          <p className="text-[0.85vw] text-sub mb-[0.4vw]">給与</p>
          <p className="text-[1.7vw] font-bold text-cream">
            ¥{attendanceSalary.toLocaleString()}
          </p>
        </div>
        <div className="bg-card border border-card-border rounded-[1vw] p-[1.2vw]">
          <p className="text-[0.85vw] text-sub mb-[0.4vw]">固定費</p>
          <p className="text-[1.7vw] font-bold text-cream">
            ¥70,000
          </p>
        </div>
        {(() => {
          const profit = dailyRevenueTaxout - Math.floor(dailyRevenueTaxout * 0.5) - attendanceSalary - 70000;
          return (
            <div className="bg-card border border-card-border rounded-[1vw] p-[1.2vw]">
              <p className="text-[0.85vw] text-sub mb-[0.4vw]">利益</p>
              <p className={`text-[1.7vw] font-bold ${profit >= 0 ? "text-green-400" : "text-red-400"}`}>
                ¥{profit.toLocaleString()}
              </p>
            </div>
          );
        })()}
        <div className="bg-card border border-card-border rounded-[1vw] p-[1.2vw]">
          <p className="text-[0.85vw] text-sub mb-[0.7vw]">今日の作品別動員数</p>
          <div className="w-full relative" style={{ height: "14vw" }}>
          {dailyMobilByMovie.length === 0 ? (
            <div className="absolute inset-0 flex items-center justify-center">
              <p className="text-sm text-sub">データなし</p>
            </div>
          ) : (
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
          )}
          </div>
        </div>
        <div className="bg-card border border-card-border rounded-[1vw] p-[1.2vw]">
          <p className="text-[0.85vw] text-sub mb-[0.7vw]">過去2週間のトレンド</p>
          <div className="w-full" style={{ height: "14vw" }}>
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
      <div className="bg-card border border-card-border rounded-[1vw] p-[1.2vw] space-y-[1vw]">
        <div className="flex items-center justify-between flex-wrap gap-[0.8vw]">
          <h3 className="text-[0.95vw] font-bold text-cream">
            日報一覧
            <span className="ml-[0.5vw] text-accent font-normal">
              {filteredReports.length}件
            </span>
          </h3>
          <select
            value={monthFilter}
            onChange={(e) => {
              setMonthFilter(e.target.value);
              setPage(0);
            }}
            className="bg-white/[0.03] border border-card-border rounded-lg px-[0.8vw] py-[0.4vw] text-[0.95vw] text-cream outline-none focus:border-accent/40 transition-colors [color-scheme:dark]"
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
        ) : pagedGroups.length === 0 ? (
          <div className="text-center py-8 text-sub">日報がありません</div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-[0.95vw]">
                <thead>
                  <tr className="border-b border-card-border">
                    <th className="text-left py-[0.5vw] px-[0.8vw] text-sub font-medium">日付</th>
                    <th className="w-[2.5vw]"></th>
                    <th className="text-right py-[0.5vw] px-[0.8vw] text-sub font-medium">動員数</th>
                    <th className="text-right py-[0.5vw] px-[0.8vw] text-sub font-medium">売上（税抜）</th>
                    <th className="text-right py-[0.5vw] px-[0.8vw] text-sub font-medium">上映権料</th>
                    <th className="text-right py-[0.5vw] px-[0.8vw] text-sub font-medium">給与</th>
                    <th className="text-right py-[0.5vw] px-[0.8vw] text-sub font-medium">固定費</th>
                    <th className="text-right py-[0.5vw] px-[0.8vw] text-sub font-medium">利益</th>
                    <th className="w-[2.5vw]"></th>
                  </tr>
                </thead>
                <tbody>
                  {pagedGroups.map(([date, rows]) => {
                    const expanded = expandedDates.has(date);
                    const totalMobil = rows.reduce((s, r) => s + (r.mobilization ?? 0), 0);
                    const totalTaxout = rows.reduce((s, r) => s + Math.floor((r.revenue_taxin ?? 0) / 1.1), 0);
                    const totalRights = Math.floor(totalTaxout * 0.5);
                    const totalSal = rows.reduce((s, r) => s + (r.salary ?? 0), 0);
                    const totalProfit = totalTaxout - totalRights - totalSal - 70000;
                    return (
                      <Fragment key={date}>
                        <tr
                          className="border-b border-card-border hover:bg-white/[0.02] transition-colors cursor-pointer"
                          onClick={() => toggleDate(date)}
                        >
                          <td className="py-[0.6vw] px-[0.8vw] text-cream font-bold whitespace-nowrap">{date}</td>
                          <td></td>
                          <td className="py-[0.6vw] px-[0.8vw] text-right text-cream">{totalMobil.toLocaleString()}人</td>
                          <td className="py-[0.6vw] px-[0.8vw] text-right text-cream">¥{totalTaxout.toLocaleString()}</td>
                          <td className="py-[0.6vw] px-[0.8vw] text-right text-cream">¥{totalRights.toLocaleString()}</td>
                          <td className="py-[0.6vw] px-[0.8vw] text-right text-sub">¥{totalSal.toLocaleString()}</td>
                          <td className="py-[0.6vw] px-[0.8vw] text-right text-sub">¥70,000</td>
                          <td className={`py-[0.6vw] px-[0.8vw] text-right font-medium ${totalProfit >= 0 ? "text-green-400" : "text-red-400"}`}>
                            ¥{totalProfit.toLocaleString()}
                          </td>
                          <td className="py-[0.6vw] px-[0.3vw] text-sub">
                            {expanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                          </td>
                        </tr>
                        {expanded &&
                          rows.map((r) => {
                            const taxout = Math.floor((r.revenue_taxin ?? 0) / 1.1);
                            return (
                              <tr
                                key={r.id}
                                className="border-b border-card-border/30 bg-white/[0.01]"
                              >
                                <td className="py-[0.4vw] pl-[2vw] pr-[0.8vw] text-sub">{r.title ?? "—"}</td>
                                <td className="py-[0.4vw] px-[0.3vw] text-center text-sub text-[0.85vw]">{TIME_SLOT_SHORT[r.time_slot ?? ""] ?? r.time_slot ?? ""}</td>
                                <td className="py-[0.4vw] px-[0.8vw] text-right text-sub">{(r.mobilization ?? 0).toLocaleString()}人</td>
                                <td className="py-[0.4vw] px-[0.8vw] text-right text-sub">¥{taxout.toLocaleString()}</td>
                                <td className="py-[0.4vw] px-[0.8vw] text-center text-sub/40">-</td>
                                <td className="py-[0.4vw] px-[0.8vw] text-center text-sub/40">-</td>
                                <td className="py-[0.4vw] px-[0.8vw] text-center text-sub/40">-</td>
                                <td className="py-[0.4vw] px-[0.8vw] text-center text-sub/40">-</td>
                                <td className="py-[0.4vw] px-[0.8vw]">
                                  <div className="flex justify-end gap-1">
                                    <button
                                      onClick={(e) => { e.stopPropagation(); handleEdit(r); }}
                                      className="p-1 rounded-lg text-sub hover:text-accent hover:bg-accent/10 transition-colors"
                                      title="編集"
                                    >
                                      <Pencil size={12} />
                                    </button>
                                    <button
                                      onClick={(e) => { e.stopPropagation(); handleDelete(r.id); }}
                                      className="p-1 rounded-lg text-sub hover:text-red-400 hover:bg-red-400/10 transition-colors"
                                      title="削除"
                                    >
                                      <Trash2 size={12} />
                                    </button>
                                  </div>
                                </td>
                              </tr>
                            );
                          })}
                      </Fragment>
                    );
                  })}
                </tbody>
                <tfoot>
                  <tr className="border-t-2 border-accent/30 bg-white/[0.04]">
                    <td className="py-[0.7vw] px-[0.8vw] text-cream font-bold">合計（{periodTotals.days}日間）</td>
                    <td></td>
                    <td className="py-[0.7vw] px-[0.8vw] text-right text-cream font-bold">{periodTotals.mobil.toLocaleString()}人</td>
                    <td className="py-[0.7vw] px-[0.8vw] text-right text-cream font-bold">¥{periodTotals.taxout.toLocaleString()}</td>
                    <td className="py-[0.7vw] px-[0.8vw] text-right text-cream font-bold">¥{periodTotals.rights.toLocaleString()}</td>
                    <td className="py-[0.7vw] px-[0.8vw] text-right text-cream font-bold">¥{periodTotals.sal.toLocaleString()}</td>
                    <td className="py-[0.7vw] px-[0.8vw] text-right text-cream font-bold">¥{periodTotals.fixed.toLocaleString()}</td>
                    <td className={`py-[0.7vw] px-[0.8vw] text-right font-bold ${periodTotals.profit >= 0 ? "text-green-400" : "text-red-400"}`}>
                      ¥{periodTotals.profit.toLocaleString()}
                    </td>
                    <td></td>
                  </tr>
                </tfoot>
              </table>
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex items-center justify-center gap-[0.5vw] pt-[0.5vw]">
                <button
                  onClick={() => setPage((p) => Math.max(0, p - 1))}
                  disabled={page === 0}
                  className="px-[0.8vw] py-[0.3vw] rounded-lg text-[0.85vw] font-medium bg-white/[0.03] border border-card-border text-sub hover:text-cream disabled:opacity-30 transition-colors"
                >
                  前へ
                </button>
                <span className="text-[0.85vw] text-sub">
                  {page + 1} / {totalPages}
                </span>
                <button
                  onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
                  disabled={page >= totalPages - 1}
                  className="px-[0.8vw] py-[0.3vw] rounded-lg text-[0.85vw] font-medium bg-white/[0.03] border border-card-border text-sub hover:text-cream disabled:opacity-30 transition-colors"
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
