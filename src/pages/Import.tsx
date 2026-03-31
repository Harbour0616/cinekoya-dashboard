import { useState } from "react";
import { useNavigate } from "react-router-dom";
import CSVImport from "../components/CSVImport";
import ExcelImport from "../components/ExcelImport";

type Mode = "excel" | "csv";

export default function Import() {
  const navigate = useNavigate();
  const [mode, setMode] = useState<Mode>("excel");

  const handleComplete = () => {
    setTimeout(() => navigate("/"), 1500);
  };

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <h2 className="text-2xl font-bold text-cream">データインポート</h2>
      <p className="text-sub">
        日報データをSupabaseのdaily_reportsテーブルにインポートします。
      </p>

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
