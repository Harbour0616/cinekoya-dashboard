import { useState } from "react";
import Papa from "papaparse";
import { supabase } from "../lib/supabase";

interface CSVRow {
  title?: string;
  date?: string;
  time_slot?: string;
  audience_total?: string;
  revenue_taxin?: string;
  revenue_taxout?: string;
  mobilization?: string;
  salary?: string;
  profit?: string;
}

export default function CSVImport({ onComplete }: { onComplete: () => void }) {
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<CSVRow[]>([]);
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState<{ success: number; error: number } | null>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    setFile(f);
    setResult(null);

    Papa.parse<CSVRow>(f, {
      header: true,
      preview: 5,
      complete: (results) => {
        setPreview(results.data);
      },
    });
  };

  const handleImport = async () => {
    if (!file) return;
    setImporting(true);
    setResult(null);

    Papa.parse<CSVRow>(file, {
      header: true,
      skipEmptyLines: true,
      complete: async (results) => {
        let success = 0;
        let errorCount = 0;

        const rows = results.data.map((row) => ({
          title: row.title || null,
          date: row.date || null,
          time_slot: row.time_slot || null,
          audience_total: row.audience_total ? parseInt(row.audience_total) : null,
          revenue_taxin: row.revenue_taxin ? parseInt(row.revenue_taxin) : null,
          revenue_taxout: row.revenue_taxout ? parseInt(row.revenue_taxout) : null,
          mobilization: row.mobilization ? parseInt(row.mobilization) : null,
          salary: row.salary ? parseInt(row.salary) : null,
          profit: row.profit ? parseInt(row.profit) : null,
        }));

        // Insert in batches of 100
        for (let i = 0; i < rows.length; i += 100) {
          const batch = rows.slice(i, i + 100);
          const { error } = await supabase.from("daily_reports").insert(batch);
          if (error) {
            console.error("Insert error:", error);
            errorCount += batch.length;
          } else {
            success += batch.length;
          }
        }

        setResult({ success, error: errorCount });
        setImporting(false);
        if (success > 0) onComplete();
      },
    });
  };

  return (
    <div className="space-y-6">
      {/* Upload area */}
      <label className="block border-2 border-dashed border-card-border rounded-2xl p-12 text-center cursor-pointer hover:border-accent/40 transition-colors">
        <input
          type="file"
          accept=".csv"
          onChange={handleFileChange}
          className="hidden"
        />
        <div className="text-4xl mb-3">📄</div>
        <div className="text-cream font-medium">
          {file ? file.name : "CSVファイルをドラッグ＆ドロップまたはクリックで選択"}
        </div>
        <div className="text-sub text-sm mt-2">
          カラム: title, date, time_slot, audience_total, revenue_taxin,
          revenue_taxout, mobilization, salary, profit
        </div>
      </label>

      {/* Preview */}
      {preview.length > 0 && (
        <div className="bg-card border border-card-border rounded-2xl p-5">
          <h3 className="text-cream font-bold mb-3">
            プレビュー（先頭5行）
          </h3>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-card-border">
                  {Object.keys(preview[0]).map((k) => (
                    <th key={k} className="text-left py-2 px-2 text-sub">
                      {k}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {preview.map((row, i) => (
                  <tr key={i} className="border-b border-card-border/50">
                    {Object.values(row).map((v, j) => (
                      <td key={j} className="py-2 px-2 text-cream">
                        {v}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Import button */}
      {file && (
        <button
          onClick={handleImport}
          disabled={importing}
          className="w-full py-3 bg-accent hover:bg-accent/80 disabled:opacity-50 text-bg font-bold rounded-xl transition-colors"
        >
          {importing ? "インポート中..." : "Supabaseにインポート"}
        </button>
      )}

      {/* Result */}
      {result && (
        <div className="bg-card border border-card-border rounded-2xl p-5">
          <div className="text-cream">
            ✅ 成功: <span className="text-green-400 font-bold">{result.success}件</span>
            {result.error > 0 && (
              <>
                {" "}/ ❌ エラー:{" "}
                <span className="text-red-400 font-bold">{result.error}件</span>
              </>
            )}
          </div>
        </div>
      )}

      {/* CSV format guide */}
      <div className="bg-card border border-card-border rounded-2xl p-5">
        <h3 className="text-cream font-bold mb-3">📋 CSVフォーマット</h3>
        <pre className="text-xs text-sub overflow-x-auto">
{`title,date,time_slot,audience_total,revenue_taxin,revenue_taxout,mobilization,salary,profit
街の上で,2025-01-15,13:00,25,37500,34091,25,15000,10000
パーフェクトデイズ,2025-01-16,15:30,30,45000,40909,30,18000,12000`}
        </pre>
      </div>
    </div>
  );
}
