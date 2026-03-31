import { useMemo, useState } from "react";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Tooltip,
  Legend,
  Filler,
} from "chart.js";
import { Line } from "react-chartjs-2";
import { Search } from "lucide-react";
import { useDailyReports } from "../hooks/useDailyReports";
import { sampleReports } from "../data/sampleData";

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Tooltip,
  Legend,
  Filler
);

const COLORS = [
  "#c8861a",
  "#60a5fa",
  "#34d399",
  "#f472b6",
  "#a78bfa",
  "#fb923c",
  "#38bdf8",
  "#facc15",
  "#e879f9",
  "#4ade80",
  "#f87171",
  "#818cf8",
];

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

export default function Audience() {
  const { reports: dbReports, loading } = useDailyReports();
  const reports = dbReports.length > 0 ? dbReports : sampleReports;

  const [period, setPeriod] = useState<Period>("3m");
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());

  // Titles within selected period, sorted by earliest screening date (newest first)
  const filteredTitles = useMemo(() => {
    const startDate = getPeriodStartDate(period);
    const titleMinDate = new Map<string, string>();

    for (const r of reports) {
      if (!r.title || !r.date) continue;
      if (startDate && r.date < startDate) continue;
      const existing = titleMinDate.get(r.title);
      if (!existing || r.date < existing) {
        titleMinDate.set(r.title, r.date);
      }
    }

    let titles = Array.from(titleMinDate.entries());

    // Search filter
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      titles = titles.filter(([t]) => t.toLowerCase().includes(q));
    }

    // Sort by first screening date descending (newest first)
    titles.sort((a, b) => b[1].localeCompare(a[1]));

    return titles.map(([t]) => t);
  }, [reports, period, search]);

  // When period/search changes, prune selected to only valid titles
  const validSelected = useMemo(() => {
    const set = new Set<string>();
    for (const t of selected) {
      if (filteredTitles.includes(t)) set.add(t);
    }
    return set;
  }, [selected, filteredTitles]);

  const isAllSelected = validSelected.size === 0;
  const activeTitles = isAllSelected
    ? filteredTitles
    : Array.from(validSelected);

  const toggleTitle = (title: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(title)) next.delete(title);
      else next.add(title);
      return next;
    });
  };

  const selectAllFiltered = () => setSelected(new Set(filteredTitles));
  const clearAll = () => setSelected(new Set());

  // Filter reports by period for charts
  const periodReports = useMemo(() => {
    const startDate = getPeriodStartDate(period);
    if (!startDate) return reports;
    return reports.filter((r) => r.date && r.date >= startDate);
  }, [reports, period]);

  const chartData = useMemo(() => {
    if (isAllSelected) {
      return buildMonthlyData(periodReports);
    }
    return buildDailyData(periodReports, activeTitles);
  }, [periodReports, isAllSelected, activeTitles]);

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold text-cream">来客数分析</h2>

      {loading && (
        <div className="text-center py-12 text-sub">読み込み中...</div>
      )}

      {/* Movie selector card */}
      <div className="bg-card border border-card-border rounded-2xl p-5 space-y-4">
        {/* Period filter */}
        <div>
          <h3 className="text-xs font-medium text-sub mb-2">期間</h3>
          <div className="flex flex-wrap gap-1.5">
            {PERIODS.map((p) => (
              <button
                key={p.key}
                onClick={() => setPeriod(p.key)}
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

        {/* Search */}
        <div>
          <div className="relative">
            <Search
              size={14}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-sub"
            />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="作品名で検索..."
              className="w-full bg-white/[0.03] border border-card-border rounded-lg pl-9 pr-3 py-2 text-sm text-cream placeholder:text-sub/60 outline-none focus:border-accent/40 transition-colors"
            />
          </div>
        </div>

        {/* Title checkboxes */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-xs font-medium text-sub">
              作品選択
              <span className="ml-2 text-accent">{filteredTitles.length}作品</span>
            </h3>
            <div className="flex gap-2">
              <button
                onClick={selectAllFiltered}
                className="px-3 py-1 rounded-lg text-xs font-medium bg-white/[0.03] border border-card-border text-sub hover:text-cream transition-colors"
              >
                全選択
              </button>
              <button
                onClick={clearAll}
                className="px-3 py-1 rounded-lg text-xs font-medium bg-white/[0.03] border border-card-border text-sub hover:text-cream transition-colors"
              >
                クリア
              </button>
            </div>
          </div>
          <div className="flex flex-wrap gap-2 max-h-48 overflow-y-auto">
            {filteredTitles.map((title) => {
              const checked = validSelected.has(title);
              return (
                <label
                  key={title}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs cursor-pointer transition-colors ${
                    checked
                      ? "bg-accent/15 text-accent border border-accent/30"
                      : "bg-white/[0.02] text-sub border border-card-border hover:text-cream"
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={() => toggleTitle(title)}
                    className="accent-[#c8861a] w-3 h-3"
                  />
                  {title}
                </label>
              );
            })}
            {filteredTitles.length === 0 && (
              <p className="text-sub text-xs py-2">該当する作品がありません</p>
            )}
          </div>
        </div>
      </div>

      {/* Chart */}
      <div className="bg-card border border-card-border rounded-2xl p-5">
        <h3 className="text-sm font-bold text-cream mb-1">
          {isAllSelected
            ? "月次来客数推移（全作品合計）"
            : "日次来客数推移（選択作品）"}
        </h3>
        <p className="text-xs text-sub mb-4">
          {isAllSelected
            ? "作品未選択時は月次集計で表示"
            : `${activeTitles.length}作品選択中 — 上映期間中の日次データ`}
        </p>
        {chartData.labels.length > 0 ? (
          <Line
            data={{
              labels: chartData.labels,
              datasets: chartData.datasets,
            }}
            options={{
              responsive: true,
              aspectRatio: 3,
              interaction: { mode: "index", intersect: false },
              plugins: {
                legend: {
                  display: chartData.datasets.length <= 10,
                  labels: { color: "#a08860", font: { size: 11 } },
                },
                tooltip: {
                  callbacks: {
                    label: (ctx) => `${ctx.dataset.label}: ${ctx.raw}人`,
                  },
                },
              },
              scales: {
                x: {
                  ticks: {
                    color: "#a08860",
                    maxRotation: 45,
                    font: { size: 10 },
                  },
                  grid: { color: "rgba(255,180,60,0.06)" },
                },
                y: {
                  ticks: { color: "#a08860", callback: (v) => `${v}人` },
                  grid: { color: "rgba(255,180,60,0.06)" },
                  beginAtZero: true,
                },
              },
            }}
          />
        ) : (
          <div className="text-center py-12 text-sub">
            データがありません
          </div>
        )}
      </div>

      {/* Summary table */}
      {activeTitles.length > 0 && !isAllSelected && (
        <div className="bg-card border border-card-border rounded-2xl p-5">
          <h3 className="text-sm font-bold text-cream mb-3">選択作品サマリー</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-card-border">
                  <th className="text-left py-2 px-3 text-sub font-medium">
                    作品名
                  </th>
                  <th className="text-right py-2 px-3 text-sub font-medium">
                    総動員数
                  </th>
                  <th className="text-right py-2 px-3 text-sub font-medium">
                    上映回数
                  </th>
                  <th className="text-right py-2 px-3 text-sub font-medium">
                    平均動員
                  </th>
                </tr>
              </thead>
              <tbody>
                {activeTitles.map((title) => {
                  const titleReports = periodReports.filter(
                    (r) => r.title === title
                  );
                  const total = titleReports.reduce(
                    (s, r) => s + (r.mobilization ?? 0),
                    0
                  );
                  const count = titleReports.length;
                  const avg = count > 0 ? Math.round(total / count) : 0;
                  return (
                    <tr
                      key={title}
                      className="border-b border-card-border/50 hover:bg-white/[0.02]"
                    >
                      <td className="py-2 px-3 text-cream">{title}</td>
                      <td className="py-2 px-3 text-right text-cream">
                        {total.toLocaleString()}人
                      </td>
                      <td className="py-2 px-3 text-right text-sub">
                        {count}回
                      </td>
                      <td className="py-2 px-3 text-right text-cream">
                        {avg}人
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

/** Monthly aggregation for "all movies" view */
function buildMonthlyData(reports: typeof sampleReports) {
  const map = new Map<string, number>();

  for (const r of reports) {
    if (!r.date) continue;
    const key = r.date.slice(0, 7);
    map.set(key, (map.get(key) ?? 0) + (r.mobilization ?? 0));
  }

  const sorted = Array.from(map.entries()).sort((a, b) =>
    a[0].localeCompare(b[0])
  );
  const labels = sorted.map(
    ([k]) => k.replace(/^\d{4}-/, "").replace(/^0/, "") + "月"
  );
  const data = sorted.map(([, v]) => v);

  return {
    labels,
    datasets: [
      {
        label: "全作品合計",
        data,
        borderColor: "#c8861a",
        backgroundColor: "#c8861a33",
        tension: 0.3,
        fill: true,
        pointRadius: 3,
      },
    ],
  };
}

/** Daily per-movie lines for selected movies */
function buildDailyData(reports: typeof sampleReports, titles: string[]) {
  const allDates = new Set<string>();
  const movieMap = new Map<string, Map<string, number>>();

  for (const title of titles) {
    const dateMap = new Map<string, number>();
    for (const r of reports) {
      if (r.title !== title || !r.date) continue;
      allDates.add(r.date);
      dateMap.set(r.date, (dateMap.get(r.date) ?? 0) + (r.mobilization ?? 0));
    }
    movieMap.set(title, dateMap);
  }

  const WEEKDAYS = ['日', '月', '火', '水', '木', '金', '土'];
  const sortedDates = Array.from(allDates).sort();
  const labels = sortedDates.map((dateStr) => {
    const [, m, day] = dateStr.split("-");
    const d = new Date(dateStr);
    const weekday = WEEKDAYS[d.getDay()];
    return `${parseInt(m)}/${parseInt(day)}（${weekday}）`;
  });

  const datasets = titles.map((title, i) => {
    const dateMap = movieMap.get(title)!;
    return {
      label: title,
      data: sortedDates.map((d) => dateMap.get(d) ?? null),
      borderColor: COLORS[i % COLORS.length],
      backgroundColor: COLORS[i % COLORS.length] + "33",
      tension: 0.3,
      spanGaps: true,
      pointRadius: 3,
    };
  });

  return { labels, datasets };
}
