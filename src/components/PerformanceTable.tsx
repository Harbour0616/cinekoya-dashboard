import { useState } from "react";
import type { DailyReport } from "../types";

type SortKey = "revenue" | "mobilization" | "avg";

interface MovieStat {
  title: string;
  revenue: number;
  mobilization: number;
  count: number;
  avg: number;
}

interface Props {
  reports: DailyReport[];
}

export default function PerformanceTable({ reports }: Props) {
  const [sortKey, setSortKey] = useState<SortKey>("revenue");

  const statsMap = new Map<string, { revenue: number; mobilization: number; count: number }>();
  for (const r of reports) {
    if (!r.title) continue;
    const entry = statsMap.get(r.title) ?? { revenue: 0, mobilization: 0, count: 0 };
    entry.revenue += r.revenue_taxin ?? 0;
    entry.mobilization += r.mobilization ?? 0;
    entry.count += 1;
    statsMap.set(r.title, entry);
  }

  const stats: MovieStat[] = Array.from(statsMap.entries()).map(([title, v]) => ({
    title,
    ...v,
    avg: v.count > 0 ? Math.round(v.mobilization / v.count) : 0,
  }));

  stats.sort((a, b) => b[sortKey] - a[sortKey]);

  const headers: { key: SortKey; label: string }[] = [
    { key: "revenue", label: "売上" },
    { key: "mobilization", label: "動員数" },
    { key: "avg", label: "平均動員" },
  ];

  return (
    <div className="bg-card border border-card-border rounded-2xl p-5">
      <h2 className="text-lg font-bold text-cream mb-4">映画別パフォーマンス</h2>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-card-border">
              <th className="text-left py-2 px-3 text-sub font-medium">作品名</th>
              {headers.map((h) => (
                <th
                  key={h.key}
                  onClick={() => setSortKey(h.key)}
                  className={`text-right py-2 px-3 font-medium cursor-pointer transition-colors ${
                    sortKey === h.key ? "text-accent" : "text-sub hover:text-cream"
                  }`}
                >
                  {h.label} {sortKey === h.key && "▼"}
                </th>
              ))}
              <th className="text-right py-2 px-3 text-sub font-medium">上映回数</th>
            </tr>
          </thead>
          <tbody>
            {stats.map((s) => (
              <tr
                key={s.title}
                className="border-b border-card-border/50 hover:bg-white/[0.02] transition-colors"
              >
                <td className="py-2 px-3 text-cream">{s.title}</td>
                <td className="py-2 px-3 text-right text-cream">
                  ¥{s.revenue.toLocaleString()}
                </td>
                <td className="py-2 px-3 text-right text-cream">
                  {s.mobilization.toLocaleString()}人
                </td>
                <td className="py-2 px-3 text-right text-cream">{s.avg}人</td>
                <td className="py-2 px-3 text-right text-sub">{s.count}回</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
