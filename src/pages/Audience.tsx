import { useMemo, useState } from "react";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Tooltip,
  Legend,
} from "chart.js";
import { Line } from "react-chartjs-2";
import { useDailyReports } from "../hooks/useDailyReports";
import { sampleReports } from "../data/sampleData";

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Tooltip,
  Legend
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

export default function Audience() {
  const { reports: dbReports, loading } = useDailyReports();
  const reports = dbReports.length > 0 ? dbReports : sampleReports;

  const allTitles = useMemo(() => {
    const set = new Set<string>();
    for (const r of reports) {
      if (r.title) set.add(r.title);
    }
    return Array.from(set).sort();
  }, [reports]);

  const [selected, setSelected] = useState<Set<string>>(new Set());

  const isAllSelected = selected.size === 0;

  const toggleTitle = (title: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(title)) next.delete(title);
      else next.add(title);
      return next;
    });
  };

  const selectAll = () => setSelected(new Set());
  const clearAll = () => setSelected(new Set(["__none__"]));

  const activeTitles = isAllSelected ? allTitles : Array.from(selected).filter((t) => t !== "__none__");

  const chartData = useMemo(() => {
    if (isAllSelected) {
      return buildMonthlyData(reports);
    }
    return buildDailyData(reports, activeTitles);
  }, [reports, isAllSelected, activeTitles]);

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold text-cream">来客数分析</h2>

      {loading && <div className="text-center py-12 text-sub">読み込み中...</div>}

      {/* Movie selector */}
      <div className="bg-card border border-card-border rounded-2xl p-5">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-bold text-cream">作品選択</h3>
          <div className="flex gap-2">
            <button
              onClick={selectAll}
              className={`px-3 py-1 rounded-lg text-xs font-medium transition-colors ${
                isAllSelected
                  ? "bg-accent text-bg"
                  : "bg-card border border-card-border text-sub hover:text-cream"
              }`}
            >
              全作品
            </button>
            <button
              onClick={clearAll}
              className="px-3 py-1 rounded-lg text-xs font-medium bg-card border border-card-border text-sub hover:text-cream transition-colors"
            >
              選択クリア
            </button>
          </div>
        </div>
        <div className="flex flex-wrap gap-2 max-h-40 overflow-y-auto">
          {allTitles.map((title) => {
            const checked = isAllSelected || selected.has(title);
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
                  onChange={() => {
                    if (isAllSelected) {
                      // Switch from "all" to individual: select only this one
                      setSelected(new Set([title]));
                    } else {
                      toggleTitle(title);
                    }
                  }}
                  className="accent-[#c8861a] w-3 h-3"
                />
                {title}
              </label>
            );
          })}
        </div>
      </div>

      {/* Chart */}
      <div className="bg-card border border-card-border rounded-2xl p-5">
        <h3 className="text-sm font-bold text-cream mb-1">
          {isAllSelected ? "月次来客数推移（全作品合計）" : "日次来客数推移（選択作品）"}
        </h3>
        <p className="text-xs text-sub mb-4">
          {isAllSelected
            ? "全作品選択時は月次集計で表示"
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
                  ticks: { color: "#a08860", maxRotation: 45, font: { size: 10 } },
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
            作品を選択してください
          </div>
        )}
      </div>

      {/* Summary table */}
      {activeTitles.length > 0 && (
        <div className="bg-card border border-card-border rounded-2xl p-5">
          <h3 className="text-sm font-bold text-cream mb-3">選択作品サマリー</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-card-border">
                  <th className="text-left py-2 px-3 text-sub font-medium">作品名</th>
                  <th className="text-right py-2 px-3 text-sub font-medium">総動員数</th>
                  <th className="text-right py-2 px-3 text-sub font-medium">上映回数</th>
                  <th className="text-right py-2 px-3 text-sub font-medium">平均動員</th>
                </tr>
              </thead>
              <tbody>
                {activeTitles.map((title) => {
                  const titleReports = reports.filter((r) => r.title === title);
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
                      <td className="py-2 px-3 text-right text-sub">{count}回</td>
                      <td className="py-2 px-3 text-right text-cream">{avg}人</td>
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
    const key = r.date.slice(0, 7); // "YYYY-MM"
    map.set(key, (map.get(key) ?? 0) + (r.mobilization ?? 0));
  }

  const sorted = Array.from(map.entries()).sort((a, b) => a[0].localeCompare(b[0]));
  const labels = sorted.map(([k]) => k.replace(/^\d{4}-/, "").replace(/^0/, "") + "月");
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
  // Collect all dates across selected movies
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

  const sortedDates = Array.from(allDates).sort();
  const labels = sortedDates.map((d) => {
    const [, m, day] = d.split("-");
    return `${parseInt(m)}/${parseInt(day)}`;
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
