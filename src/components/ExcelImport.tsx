import { useState } from "react";
import * as XLSX from "xlsx";
import { supabase } from "../lib/supabase";

const TIME_SLOT_MAP: Record<string, string> = {
  A: "10:30",
  B: "13:00",
  C: "15:30",
  D: "18:00",
  E: "20:30",
};

interface ParsedRow {
  title: string | null;
  date: string | null;
  time_slot: string | null;
  audience_total: number | null;
  revenue_taxin: number | null;
  revenue_taxout: number | null;
  mobilization: number | null;
  salary: number | null;
  profit: number | null;
}

function excelDateToISO(value: unknown): string | null {
  if (value == null) return null;
  // Excel serial number
  if (typeof value === "number") {
    const d = XLSX.SSF.parse_date_code(value);
    if (d) {
      const yyyy = String(d.y).padStart(4, "0");
      const mm = String(d.m).padStart(2, "0");
      const dd = String(d.d).padStart(2, "0");
      return `${yyyy}-${mm}-${dd}`;
    }
  }
  // Already a string like "2025-01-15" or "2025/01/15"
  const s = String(value).trim();
  const match = s.match(/^(\d{4})[/-](\d{1,2})[/-](\d{1,2})/);
  if (match) {
    return `${match[1]}-${match[2].padStart(2, "0")}-${match[3].padStart(2, "0")}`;
  }
  return null;
}

function toInt(value: unknown): number | null {
  if (value == null || value === "") return null;
  const n = Number(value);
  return isNaN(n) ? null : Math.round(n);
}

function parseSheet(sheet: XLSX.WorkSheet): ParsedRow[] {
  // Read as array of arrays (no header)
  const raw: unknown[][] = XLSX.utils.sheet_to_json(sheet, {
    header: 1,
    defval: null,
  });

  const rows: ParsedRow[] = [];

  for (let i = 0; i < raw.length; i++) {
    const r = raw[i];
    if (!r || r.length === 0) continue;

    const title = r[0] != null ? String(r[0]).trim() : null;
    const dateVal = excelDateToISO(r[2]);

    // Skip header/empty rows: need at least title or date
    if (!title && !dateVal) continue;
    // Skip if title looks like a header
    if (title === "タイトル" || title === "作品名") continue;

    const timeSlotRaw = r[7] != null ? String(r[7]).trim().toUpperCase() : null;
    const timeSlot = timeSlotRaw
      ? TIME_SLOT_MAP[timeSlotRaw] ?? timeSlotRaw
      : null;

    const audience = toInt(r[29]);
    const revenueTaxin = toInt(r[31]);
    const revenueTaxout = toInt(r[32]);
    const salary = toInt(r[64]);
    const profit = toInt(r[65]);

    rows.push({
      title,
      date: dateVal,
      time_slot: timeSlot,
      audience_total: audience,
      revenue_taxin: revenueTaxin,
      revenue_taxout: revenueTaxout,
      mobilization: audience,
      salary,
      profit,
    });
  }

  return rows;
}

export default function ExcelImport({ onComplete }: { onComplete: () => void }) {
  const [file, setFile] = useState<File | null>(null);
  const [parsed, setParsed] = useState<ParsedRow[]>([]);
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState<{ success: number; error: number } | null>(null);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    setFile(f);
    setResult(null);

    const buf = await f.arrayBuffer();
    const wb = XLSX.read(buf, { type: "array" });
    const sheet = wb.Sheets[wb.SheetNames[0]];
    const rows = parseSheet(sheet);
    setParsed(rows);
  };

  const handleImport = async () => {
    if (parsed.length === 0) return;
    setImporting(true);
    setResult(null);

    let success = 0;
    let errorCount = 0;

    for (let i = 0; i < parsed.length; i += 100) {
      const batch = parsed.slice(i, i + 100);
      const { error } = await supabase.from("daily_reports").upsert(batch, {
        onConflict: "title,date,time_slot",
        ignoreDuplicates: false,
      });
      if (error) {
        // Fallback to insert if upsert constraint doesn't exist
        const { error: insertErr } = await supabase
          .from("daily_reports")
          .insert(batch);
        if (insertErr) {
          console.error("Insert error:", insertErr);
          errorCount += batch.length;
        } else {
          success += batch.length;
        }
      } else {
        success += batch.length;
      }
    }

    setResult({ success, error: errorCount });
    setImporting(false);
    if (success > 0) onComplete();
  };

  const previewRows = parsed.slice(0, 5);

  return (
    <div className="space-y-6">
      {/* Upload area */}
      <label className="block border-2 border-dashed border-card-border rounded-2xl p-12 text-center cursor-pointer hover:border-accent/40 transition-colors">
        <input
          type="file"
          accept=".xlsx,.xls"
          onChange={handleFileChange}
          className="hidden"
        />
        <div className="text-4xl mb-3">📊</div>
        <div className="text-cream font-medium">
          {file ? file.name : "Excelファイル(.xlsx)をクリックで選択"}
        </div>
        <div className="text-sub text-sm mt-2">
          シネコヤ_経営ダッシュボード__日報_入力フォーム.xlsx
        </div>
      </label>

      {/* Preview */}
      {previewRows.length > 0 && (
        <div className="bg-card border border-card-border rounded-2xl p-5">
          <h3 className="text-cream font-bold mb-1">
            プレビュー（先頭5行 / 全{parsed.length}行）
          </h3>
          <p className="text-sub text-xs mb-3">
            col0:タイトル / col2:日付 / col7:時間帯 / col29:動員 / col31:売上(税込) / col32:売上(税抜) / col64:給与 / col65:利益
          </p>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-card-border">
                  <th className="text-left py-2 px-2 text-sub">タイトル</th>
                  <th className="text-left py-2 px-2 text-sub">日付</th>
                  <th className="text-left py-2 px-2 text-sub">時間帯</th>
                  <th className="text-right py-2 px-2 text-sub">動員</th>
                  <th className="text-right py-2 px-2 text-sub">売上(税込)</th>
                  <th className="text-right py-2 px-2 text-sub">売上(税抜)</th>
                  <th className="text-right py-2 px-2 text-sub">給与</th>
                  <th className="text-right py-2 px-2 text-sub">利益</th>
                </tr>
              </thead>
              <tbody>
                {previewRows.map((row, i) => (
                  <tr key={i} className="border-b border-card-border/50">
                    <td className="py-2 px-2 text-cream">{row.title ?? "-"}</td>
                    <td className="py-2 px-2 text-cream">{row.date ?? "-"}</td>
                    <td className="py-2 px-2 text-cream">{row.time_slot ?? "-"}</td>
                    <td className="py-2 px-2 text-right text-cream">
                      {row.audience_total ?? "-"}
                    </td>
                    <td className="py-2 px-2 text-right text-cream">
                      {row.revenue_taxin != null
                        ? `¥${row.revenue_taxin.toLocaleString()}`
                        : "-"}
                    </td>
                    <td className="py-2 px-2 text-right text-cream">
                      {row.revenue_taxout != null
                        ? `¥${row.revenue_taxout.toLocaleString()}`
                        : "-"}
                    </td>
                    <td className="py-2 px-2 text-right text-cream">
                      {row.salary != null
                        ? `¥${row.salary.toLocaleString()}`
                        : "-"}
                    </td>
                    <td className="py-2 px-2 text-right text-cream">
                      {row.profit != null
                        ? `¥${row.profit.toLocaleString()}`
                        : "-"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Import button */}
      {parsed.length > 0 && (
        <button
          onClick={handleImport}
          disabled={importing}
          className="w-full py-3 bg-accent hover:bg-accent/80 disabled:opacity-50 text-bg font-bold rounded-xl transition-colors"
        >
          {importing
            ? "インポート中..."
            : `${parsed.length}件をSupabaseにインポート`}
        </button>
      )}

      {/* Result */}
      {result && (
        <div className="bg-card border border-card-border rounded-2xl p-5">
          <div className="text-cream">
            ✅ 成功:{" "}
            <span className="text-green-400 font-bold">{result.success}件</span>
            {result.error > 0 && (
              <>
                {" "}/ ❌ エラー:{" "}
                <span className="text-red-400 font-bold">{result.error}件</span>
              </>
            )}
          </div>
        </div>
      )}

      {/* Column mapping guide */}
      <div className="bg-card border border-card-border rounded-2xl p-5">
        <h3 className="text-cream font-bold mb-3">📋 Excelカラムマッピング</h3>
        <div className="grid grid-cols-2 gap-x-6 gap-y-1 text-xs">
          <div className="flex justify-between">
            <span className="text-sub">col0</span>
            <span className="text-cream">タイトル（作品名）</span>
          </div>
          <div className="flex justify-between">
            <span className="text-sub">col2</span>
            <span className="text-cream">年月日</span>
          </div>
          <div className="flex justify-between">
            <span className="text-sub">col7</span>
            <span className="text-cream">時間帯（A〜E）</span>
          </div>
          <div className="flex justify-between">
            <span className="text-sub">col29</span>
            <span className="text-cream">動員</span>
          </div>
          <div className="flex justify-between">
            <span className="text-sub">col31</span>
            <span className="text-cream">売上高（税込）</span>
          </div>
          <div className="flex justify-between">
            <span className="text-sub">col32</span>
            <span className="text-cream">売上高（税抜）</span>
          </div>
          <div className="flex justify-between">
            <span className="text-sub">col64</span>
            <span className="text-cream">給与</span>
          </div>
          <div className="flex justify-between">
            <span className="text-sub">col65</span>
            <span className="text-cream">利益</span>
          </div>
        </div>
        <div className="mt-3 text-xs text-sub">
          時間帯: A→10:30 / B→13:00 / C→15:30 / D→18:00 / E→20:30
        </div>
      </div>
    </div>
  );
}
