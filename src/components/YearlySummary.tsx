import type { DailyReport } from "../types";

interface Props {
  reports: DailyReport[];
}

export default function YearlySummary({ reports }: Props) {
  const now = new Date();
  const years = [now.getFullYear(), now.getFullYear() - 1, now.getFullYear() - 2];

  const yearlyStats = years.map((year) => {
    const yearReports = reports.filter(
      (r) => r.date && r.date.startsWith(String(year))
    );
    const revenue = yearReports.reduce((s, r) => s + (r.revenue_taxin ?? 0), 0);
    const mobilization = yearReports.reduce((s, r) => s + (r.mobilization ?? 0), 0);
    const profit = yearReports.reduce((s, r) => s + (r.profit ?? 0), 0);
    const count = yearReports.length;

    return { year, revenue, mobilization, profit, count };
  });

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
      {yearlyStats.map((ys) => (
        <div
          key={ys.year}
          className="bg-card border border-card-border rounded-2xl p-5"
        >
          <h3 className="text-lg font-bold text-accent mb-3">{ys.year}年度</h3>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-sub">売上（税込）</span>
              <span className="text-cream font-medium">
                ¥{ys.revenue.toLocaleString()}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-sub">動員数</span>
              <span className="text-cream font-medium">
                {ys.mobilization.toLocaleString()}人
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-sub">利益</span>
              <span
                className={`font-medium ${
                  ys.profit >= 0 ? "text-green-400" : "text-red-400"
                }`}
              >
                ¥{ys.profit.toLocaleString()}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-sub">上映回数</span>
              <span className="text-cream font-medium">{ys.count}回</span>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
