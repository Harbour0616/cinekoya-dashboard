import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Tooltip,
} from "chart.js";
import { Bar } from "react-chartjs-2";
import type { DailyReport } from "../types";

ChartJS.register(CategoryScale, LinearScale, BarElement, Tooltip);

interface Props {
  reports: DailyReport[];
}

export default function TopMoviesChart({ reports }: Props) {
  const movieRevenue = new Map<string, number>();
  for (const r of reports) {
    if (!r.title) continue;
    movieRevenue.set(
      r.title,
      (movieRevenue.get(r.title) ?? 0) + (r.revenue_taxin ?? 0)
    );
  }

  const sorted = Array.from(movieRevenue.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10);

  const labels = sorted.map(([t]) => t);
  const data = sorted.map(([, v]) => v);

  return (
    <div className="bg-card border border-card-border rounded-2xl p-5">
      <h2 className="text-lg font-bold text-cream mb-4">作品別売上 TOP10</h2>
      <Bar
        data={{
          labels,
          datasets: [
            {
              data,
              backgroundColor: "#c8861a99",
              borderColor: "#c8861a",
              borderWidth: 1,
              borderRadius: 4,
            },
          ],
        }}
        options={{
          indexAxis: "y",
          responsive: true,
          plugins: {
            legend: { display: false },
            tooltip: {
              callbacks: {
                label: (ctx) => `¥${(ctx.raw as number).toLocaleString()}`,
              },
            },
          },
          scales: {
            x: {
              ticks: {
                color: "#a08860",
                callback: (v) => `¥${Number(v).toLocaleString()}`,
              },
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
  );
}
