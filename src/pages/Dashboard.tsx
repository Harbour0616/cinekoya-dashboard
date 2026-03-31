import { useMemo } from "react";
import { useDailyReports } from "../hooks/useDailyReports";
import { sampleReports } from "../data/sampleData";
import KPICard from "../components/KPICard";
import MonthlyChart from "../components/MonthlyChart";
import TopMoviesChart from "../components/TopMoviesChart";
import WeekdayChart from "../components/WeekdayChart";
import PerformanceTable from "../components/PerformanceTable";
import YearlySummary from "../components/YearlySummary";
import type { DailyReport } from "../types";

export default function Dashboard() {
  const { reports: dbReports, loading } = useDailyReports();
  const reports = dbReports.length > 0 ? dbReports : sampleReports;
  const usingSample = dbReports.length === 0 && !loading;

  const kpis = useMemo(() => computeKPIs(reports), [reports]);

  return (
    <div className="space-y-6">
      {usingSample && (
        <div className="bg-accent/10 border border-accent/30 rounded-xl px-4 py-3 text-sm text-accent">
          📊 サンプルデータを表示中です。「データインポート」からCSVをアップロードしてください。
        </div>
      )}

      {loading && (
        <div className="text-center py-12 text-sub">読み込み中...</div>
      )}

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KPICard
          label="今月売上"
          value={`¥${kpis.currentRevenue.toLocaleString()}`}
          diff={kpis.revenueDiff}
          icon="💰"
        />
        <KPICard
          label="今月動員数"
          value={`${kpis.currentMobilization.toLocaleString()}人`}
          diff={kpis.mobilizationDiff}
          icon="🎟️"
        />
        <KPICard
          label="客単価"
          value={`¥${kpis.unitPrice.toLocaleString()}`}
          diff={kpis.unitPriceDiff}
          icon="👤"
        />
        <KPICard
          label="今月利益"
          value={`¥${kpis.currentProfit.toLocaleString()}`}
          diff={kpis.profitDiff}
          icon="📈"
        />
      </div>

      {/* Monthly chart */}
      <MonthlyChart reports={reports} />

      {/* Two column charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <TopMoviesChart reports={reports} />
        <WeekdayChart reports={reports} />
      </div>

      {/* Performance table */}
      <PerformanceTable reports={reports} />

      {/* Yearly summary */}
      <h2 className="text-lg font-bold text-cream mt-8">年度別サマリー</h2>
      <YearlySummary reports={reports} />
    </div>
  );
}

function computeKPIs(reports: DailyReport[]) {
  const now = new Date();
  const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  const prevDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const prevMonth = `${prevDate.getFullYear()}-${String(prevDate.getMonth() + 1).padStart(2, "0")}`;

  const current = reports.filter((r) => r.date?.startsWith(currentMonth));
  const prev = reports.filter((r) => r.date?.startsWith(prevMonth));

  const currentRevenue = current.reduce((s, r) => s + (r.revenue_taxin ?? 0), 0);
  const prevRevenue = prev.reduce((s, r) => s + (r.revenue_taxin ?? 0), 0);

  const currentMobilization = current.reduce((s, r) => s + (r.mobilization ?? 0), 0);
  const prevMobilization = prev.reduce((s, r) => s + (r.mobilization ?? 0), 0);

  const currentProfit = current.reduce((s, r) => s + (r.profit ?? 0), 0);
  const prevProfit = prev.reduce((s, r) => s + (r.profit ?? 0), 0);

  const unitPrice = currentMobilization > 0 ? Math.round(currentRevenue / currentMobilization) : 0;
  const prevUnitPrice = prevMobilization > 0 ? Math.round(prevRevenue / prevMobilization) : 0;

  const pctDiff = (curr: number, prev: number) =>
    prev > 0 ? ((curr - prev) / prev) * 100 : null;

  return {
    currentRevenue,
    currentMobilization,
    currentProfit,
    unitPrice,
    revenueDiff: pctDiff(currentRevenue, prevRevenue),
    mobilizationDiff: pctDiff(currentMobilization, prevMobilization),
    profitDiff: pctDiff(currentProfit, Math.abs(prevProfit) || 1),
    unitPriceDiff: pctDiff(unitPrice, prevUnitPrice),
  };
}
