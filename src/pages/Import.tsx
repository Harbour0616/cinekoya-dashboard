import { useNavigate } from "react-router-dom";
import CSVImport from "../components/CSVImport";

export default function Import() {
  const navigate = useNavigate();

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <h2 className="text-2xl font-bold text-cream">データインポート</h2>
      <p className="text-sub">
        Excelの日報データをCSV形式に変換してアップロードしてください。
        データはSupabaseのdaily_reportsテーブルに保存されます。
      </p>
      <CSVImport
        onComplete={() => {
          setTimeout(() => navigate("/"), 1500);
        }}
      />
    </div>
  );
}
