import { useState } from "react";
import { useNavigate } from "react-router-dom";
import CSVImport from "../components/CSVImport";
import ExcelImport from "../components/ExcelImport";
import { supabase } from "../lib/supabase";

type Mode = "excel" | "csv";

export default function Import() {
  const navigate = useNavigate();
  const [mode, setMode] = useState<Mode>("excel");
  const [syncing, setSyncing] = useState(false);
  const [syncResult, setSyncResult] = useState<string | null>(null);

  const handleComplete = () => {
    setTimeout(() => navigate("/"), 1500);
  };

  const handleSyncMovies = async () => {
    setSyncing(true);
    setSyncResult(null);

    // Get unique titles with min/max dates from daily_reports
    const { data, error } = await supabase
      .from("daily_reports")
      .select("title, date");

    if (error || !data) {
      setSyncResult("エラー: データの取得に失敗しました");
      setSyncing(false);
      return;
    }

    // Aggregate per title
    const titleMap = new Map<string, { minDate: string; maxDate: string }>();
    for (const row of data) {
      if (!row.title || !row.date) continue;
      const existing = titleMap.get(row.title);
      if (!existing) {
        titleMap.set(row.title, { minDate: row.date, maxDate: row.date });
      } else {
        if (row.date < existing.minDate) existing.minDate = row.date;
        if (row.date > existing.maxDate) existing.maxDate = row.date;
      }
    }

    if (titleMap.size === 0) {
      setSyncResult("日報データに作品がありません");
      setSyncing(false);
      return;
    }

    const rows = Array.from(titleMap.entries()).map(([title, dates]) => ({
      title,
      start_date: dates.minDate,
      end_date: dates.maxDate,
    }));

    // Upsert into movies (requires unique constraint on title)
    // Try upsert first, fallback to individual inserts
    let count = 0;
    for (const row of rows) {
      const { data: existing } = await supabase
        .from("movies")
        .select("id")
        .eq("title", row.title)
        .limit(1);

      if (existing && existing.length > 0) {
        await supabase
          .from("movies")
          .update({ start_date: row.start_date, end_date: row.end_date })
          .eq("id", existing[0].id);
      } else {
        await supabase.from("movies").insert(row);
      }
      count++;
    }

    setSyncResult(`${count}件の作品を登録しました`);
    setSyncing(false);
  };

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <h2 className="text-2xl font-bold text-cream">データインポート</h2>
      <p className="text-sub">
        日報データをSupabaseのdaily_reportsテーブルにインポートします。
      </p>

      {/* Re-import banner */}
      <div className="bg-accent/10 border border-accent/30 rounded-xl px-4 py-3 text-sm text-accent">
        🎟️ 券種別データ（一般・FC・メンバーズ・U28・U22・高校生以下）に対応しました。
        作品分析ページで券種構成を確認するには、券種データを含めて再インポートしてください。
      </div>

      {/* Sync movies button */}
      <div className="bg-card border border-card-border rounded-2xl p-5 space-y-3">
        <h3 className="text-sm font-bold text-cream">作品マスタ同期</h3>
        <p className="text-xs text-sub">
          daily_reportsに登録済みの全作品名を抽出し、上映開始日・終了日とともにmoviesテーブルに一括登録します。
          既に登録済みの作品は上映期間を更新します。
        </p>
        <div className="flex items-center gap-4">
          <button
            onClick={handleSyncMovies}
            disabled={syncing}
            className="px-5 py-2.5 bg-accent hover:bg-accent/80 disabled:opacity-50 text-bg font-bold rounded-xl transition-colors text-sm"
          >
            {syncing ? "同期中..." : "日報データから作品を一括登録"}
          </button>
          {syncResult && (
            <span className="text-sm text-green-400">{syncResult}</span>
          )}
        </div>
      </div>

      {/* Mode tabs */}
      <div className="flex gap-2">
        <button
          onClick={() => setMode("excel")}
          className={`px-5 py-2.5 rounded-xl text-sm font-medium transition-colors ${
            mode === "excel"
              ? "bg-accent text-bg"
              : "bg-card border border-card-border text-sub hover:text-cream"
          }`}
        >
          📊 Excelファイル（.xlsx）
        </button>
        <button
          onClick={() => setMode("csv")}
          className={`px-5 py-2.5 rounded-xl text-sm font-medium transition-colors ${
            mode === "csv"
              ? "bg-accent text-bg"
              : "bg-card border border-card-border text-sub hover:text-cream"
          }`}
        >
          📄 CSVファイル
        </button>
      </div>

      {mode === "excel" ? (
        <ExcelImport onComplete={handleComplete} />
      ) : (
        <CSVImport onComplete={handleComplete} />
      )}
    </div>
  );
}
