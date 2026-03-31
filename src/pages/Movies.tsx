import { useMemo, useState, useRef } from "react";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  ArcElement,
  Tooltip,
  Legend,
} from "chart.js";
import { Bar, Doughnut } from "react-chartjs-2";
import { Search } from "lucide-react";
import { useDailyReports } from "../hooks/useDailyReports";
import { sampleReports } from "../data/sampleData";
import { TICKET_TYPES } from "../types";
import type { DailyReport, TicketTypeKey } from "../types";

ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  ArcElement,
  Tooltip,
  Legend
);

type Period = "1m" | "3m" | "6m" | "1y" | "all";

const PERIODS: { key: Period; label: string }[] = [
  { key: "1m", label: "直近1ヶ月" },
  { key: "3m", label: "3ヶ月" },
  { key: "6m", label: "6ヶ月" },
  { key: "1y", label: "1年" },
  { key: "all", label: "全期間" },
];

function getPeriodStartDate(period: Period): string | null {
  if (period === "all") return null;
  const now = new Date();
  const months = { "1m": 1, "3m": 3, "6m": 6, "1y": 12 }[period];
  const d = new Date(now.getFullYear(), now.getMonth() - months, now.getDate());
  return d.toISOString().split("T")[0];
}

interface MovieTicketStats {
  title: string;
  total: number;
  byType: Record<TicketTypeKey, number>;
}

function aggregateByMovie(reports: DailyReport[]): MovieTicketStats[] {
  const map = new Map<string, MovieTicketStats>();

  for (const r of reports) {
    if (!r.title) continue;
    let entry = map.get(r.title);
    if (!entry) {
      entry = {
        title: r.title,
        total: 0,
        byType: {
          audience_general: 0,
          audience_fc: 0,
          audience_fc_guest: 0,
          audience_members: 0,
          audience_members_guest: 0,
          audience_u28: 0,
          audience_u22: 0,
          audience_highschool: 0,
        },
      };
      map.set(r.title, entry);
    }
    entry.total += r.mobilization ?? 0;
    for (const t of TICKET_TYPES) {
      entry.byType[t.key] += (r[t.key] as number) ?? 0;
    }
  }

  return Array.from(map.values()).sort((a, b) => b.total - a.total);
}

export default function Movies() {
  const { reports: dbReports, loading } = useDailyReports();
  const reports = dbReports.length > 0 ? dbReports : sampleReports;

  const [period, setPeriod] = useState<Period>("3m");
  const [search, setSearch] = useState("");
  const [selectedMovie, setSelectedMovie] = useState<string | null>(null);
  const detailRef = useRef<HTMLDivElement>(null);

  const periodReports = useMemo(() => {
    const startDate = getPeriodStartDate(period);
    if (!startDate) return reports;
    return reports.filter((r) => r.date && r.date >= startDate);
  }, [reports, period]);

  const allStats = useMemo(() => aggregateByMovie(periodReports), [periodReports]);

  const filteredStats = useMemo(() => {
    let stats = allStats;
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      stats = stats.filter((s) => s.title.toLowerCase().includes(q));
    }
    return stats.slice(0, 15);
  }, [allStats, search]);

  const selectedStats = useMemo(
    () => allStats.find((s) => s.title === selectedMovie) ?? null,
    [allStats, selectedMovie]
  );

  const handleBarClick = (_: unknown, elements: { index: number }[]) => {
    if (elements.length > 0) {
      const title = filteredStats[elements[0].index]?.title;
      if (title) {
        setSelectedMovie(title);
        setTimeout(() => detailRef.current?.scrollIntoView({ behavior: "smooth" }), 100);
      }
    }
  };

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold text-cream">作品分析（券種別）</h2>

      {loading && <div className="text-center py-12 text-sub">読み込み中...</div>}

      {/* Filters */}
      <div className="bg-card border border-card-border rounded-2xl p-5 space-y-4">
        <div>
          <h3 className="text-xs font-medium text-sub mb-2">期間</h3>
          <div className="flex flex-wrap gap-1.5">
            {PERIODS.map((p) => (
              <button
                key={p.key}
                onClick={() => { setPeriod(p.key); setSelectedMovie(null); }}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                  period === p.key
                    ? "bg-accent text-bg"
                    : "bg-white/[0.03] text-sub border border-card-border hover:text-cream"
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>
        </div>
        <div className="relative">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-sub" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="作品名で検索..."
            className="w-full bg-white/[0.03] border border-card-border rounded-lg pl-9 pr-3 py-2 text-sm text-cream placeholder:text-sub/60 outline-none focus:border-accent/40 transition-colors"
          />
        </div>
        <p className="text-xs text-sub">
          {filteredStats.length}作品表示中（動員数順 上位15作品）
        </p>
      </div>

      {/* Stacked bar chart */}
      <div className="bg-card border border-card-border rounded-2xl p-5">
        <h3 className="text-sm font-bold text-cream mb-1">券種別来客数（積み上げ）</h3>
        <p className="text-xs text-sub mb-4">作品バーをクリックすると下の詳細が表示されます</p>
        {filteredStats.length > 0 ? (
          <Bar
            data={{
              labels: filteredStats.map((s) => s.title),
              datasets: TICKET_TYPES.map((t) => ({
                label: t.label,
                data: filteredStats.map((s) => s.byType[t.key]),
                backgroundColor: t.color,
                borderRadius: 2,
              })),
            }}
            options={{
              responsive: true,
              onClick: handleBarClick,
              scales: {
                x: {
                  stacked: true,
                  ticks: { color: "#f5ead8", font: { size: 10 }, maxRotation: 45 },
                  grid: { display: false },
                },
                y: {
                  stacked: true,
                  ticks: { color: "#a08860", callback: (v) => `${v}人` },
                  grid: { color: "rgba(255,180,60,0.06)" },
                },
              },
              plugins: {
                legend: {
                  labels: { color: "#a08860", font: { size: 11 }, boxWidth: 12 },
                },
                tooltip: {
                  callbacks: {
                    label: (ctx) => `${ctx.dataset.label}: ${ctx.raw}人`,
                  },
                },
              },
            }}
          />
        ) : (
          <div className="text-center py-12 text-sub">該当する作品がありません</div>
        )}
      </div>

      {/* Donut detail */}
      {selectedStats && (
        <div ref={detailRef} className="bg-card border border-card-border rounded-2xl p-5">
          <h3 className="text-sm font-bold text-cream mb-4">
            券種構成 — {selectedStats.title}
          </h3>
          <div className="flex flex-col md:flex-row items-center gap-8">
            {/* Donut */}
            <div className="relative w-64 h-64 shrink-0">
              <Doughnut
                data={{
                  labels: TICKET_TYPES.map((t) => t.label),
                  datasets: [
                    {
                      data: TICKET_TYPES.map((t) => selectedStats.byType[t.key]),
                      backgroundColor: TICKET_TYPES.map((t) => t.color),
                      borderWidth: 0,
                    },
                  ],
                }}
                options={{
                  cutout: "65%",
                  plugins: {
                    legend: { display: false },
                    tooltip: {
                      callbacks: {
                        label: (ctx) => {
                          const val = ctx.raw as number;
                          const pct =
                            selectedStats.total > 0
                              ? ((val / selectedStats.total) * 100).toFixed(1)
                              : "0";
                          return `${ctx.label}: ${val}人 (${pct}%)`;
                        },
                      },
                    },
                  },
                }}
              />
              {/* Center label */}
              <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                <span className="text-cream text-xs font-medium leading-tight text-center max-w-[100px] truncate">
                  {selectedStats.title}
                </span>
                <span className="text-accent text-lg font-bold">
                  {selectedStats.total.toLocaleString()}人
                </span>
              </div>
            </div>

            {/* Breakdown list */}
            <div className="flex-1 w-full">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-card-border">
                    <th className="text-left py-2 px-2 text-sub font-medium">券種</th>
                    <th className="text-right py-2 px-2 text-sub font-medium">人数</th>
                    <th className="text-right py-2 px-2 text-sub font-medium">構成比</th>
                  </tr>
                </thead>
                <tbody>
                  {TICKET_TYPES.map((t) => {
                    const val = selectedStats.byType[t.key];
                    const pct =
                      selectedStats.total > 0
                        ? ((val / selectedStats.total) * 100).toFixed(1)
                        : "0.0";
                    return (
                      <tr key={t.key} className="border-b border-card-border/50">
                        <td className="py-2 px-2 flex items-center gap-2">
                          <span
                            className="w-3 h-3 rounded-sm shrink-0"
                            style={{ backgroundColor: t.color }}
                          />
                          <span className="text-cream">{t.label}</span>
                        </td>
                        <td className="py-2 px-2 text-right text-cream">
                          {val.toLocaleString()}人
                        </td>
                        <td className="py-2 px-2 text-right text-sub">{pct}%</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
