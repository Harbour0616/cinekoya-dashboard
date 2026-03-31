import { useState } from "react";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  LineElement,
  PointElement,
  Tooltip,
  Legend,
} from "chart.js";
import { Bar } from "react-chartjs-2";
import type { DailyReport } from "../types";

ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  LineElement,
  PointElement,
  Tooltip,
  Legend
);

type Tab = "revenue" | "mobilization" | "profit";

interface Props {
  reports: DailyReport[];
}

export default function MonthlyChart({ reports }: Props) {
  const [tab, setTab] = useState<Tab>("revenue");

  const monthlyData = getMonthlyData(reports);
  const labels = monthlyData.map((m) => m.label);

  const dataMap: Record<Tab, { data: number[]; label: string; color: string }> = {
    revenue: {
      data: monthlyData.map((m) => m.revenue),
      label: "売上（税込）",
      color: "#c8861a",
    },
    mobilization: {
      data: monthlyData.map((m) => m.mobilization),
      label: "動員数",
      color: "#60a5fa",
    },
    profit: {
      data: monthlyData.map((m) => m.profit),
      label: "利益",
      color: "#34d399",
    },
  };

  const active = dataMap[tab];

  const tabs: { key: Tab; label: string }[] = [
    { key: "revenue", label: "売上" },
    { key: "mobilization", label: "動員" },
    { key: "profit", label: "利益" },
  ];

  return (
    <div className="bg-card border border-card-border rounded-2xl p-5">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-bold text-cream">月次推移（直近12ヶ月）</h2>
        <div className="flex gap-1">
          {tabs.map((t) => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`px-3 py-1 rounded-lg text-xs font-medium transition-colors ${
                tab === t.key
                  ? "bg-accent/20 text-accent"
                  : "text-sub hover:text-cream"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>
      <Bar
        data={{
          labels,
          datasets: [
            {
              label: active.label,
              data: active.data,
              backgroundColor: active.color + "99",
              borderColor: active.color,
              borderWidth: 1,
              borderRadius: 4,
            },
          ],
        }}
        options={{
          responsive: true,
          plugins: {
            legend: { display: false },
            tooltip: {
              callbacks: {
                label: (ctx) => {
                  const v = ctx.raw as number;
                  return tab === "mobilization"
                    ? `${v}人`
                    : `¥${v.toLocaleString()}`;
                },
              },
            },
          },
          scales: {
            x: {
              ticks: { color: "#a08860" },
              grid: { color: "rgba(255,180,60,0.06)" },
            },
            y: {
              ticks: {
                color: "#a08860",
                callback: (v) =>
                  tab === "mobilization"
                    ? `${v}`
                    : `¥${Number(v).toLocaleString()}`,
              },
              grid: { color: "rgba(255,180,60,0.06)" },
            },
          },
        }}
      />
    </div>
  );
}

function getMonthlyData(reports: DailyReport[]) {
  const map = new Map<
    string,
    { revenue: number; mobilization: number; profit: number }
  >();
  const now = new Date();

  for (let i = 11; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    map.set(key, { revenue: 0, mobilization: 0, profit: 0 });
  }

  for (const r of reports) {
    if (!r.date) continue;
    const key = r.date.slice(0, 7);
    const entry = map.get(key);
    if (entry) {
      entry.revenue += r.revenue_taxin ?? 0;
      entry.mobilization += r.mobilization ?? 0;
      entry.profit += r.profit ?? 0;
    }
  }

  return Array.from(map.entries()).map(([key, val]) => ({
    label: key.replace(/^\d{4}-/, "").replace(/^0/, "") + "月",
    ...val,
  }));
}
