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

const WEEKDAYS = ["日", "月", "火", "水", "木", "金", "土"];

interface Props {
  reports: DailyReport[];
}

export default function WeekdayChart({ reports }: Props) {
  const totals = Array(7).fill(0);
  const counts = Array(7).fill(0);

  for (const r of reports) {
    if (!r.date) continue;
    const dow = new Date(r.date).getDay();
    totals[dow] += r.audience_total ?? 0;
    counts[dow] += 1;
  }

  const averages = totals.map((t, i) => (counts[i] > 0 ? Math.round(t / counts[i]) : 0));

  return (
    <div className="bg-card border border-card-border rounded-2xl p-5">
      <h2 className="text-lg font-bold text-cream mb-4">曜日別平均来客数</h2>
      <Bar
        data={{
          labels: WEEKDAYS,
          datasets: [
            {
              data: averages,
              backgroundColor: WEEKDAYS.map((_, i) =>
                i === 0 || i === 6 ? "#c8861a99" : "#60a5fa99"
              ),
              borderColor: WEEKDAYS.map((_, i) =>
                i === 0 || i === 6 ? "#c8861a" : "#60a5fa"
              ),
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
                label: (ctx) => `平均 ${ctx.raw}人`,
              },
            },
          },
          scales: {
            x: {
              ticks: { color: "#f5ead8" },
              grid: { color: "rgba(255,180,60,0.06)" },
            },
            y: {
              ticks: { color: "#a08860", callback: (v) => `${v}人` },
              grid: { color: "rgba(255,180,60,0.06)" },
            },
          },
        }}
      />
    </div>
  );
}
