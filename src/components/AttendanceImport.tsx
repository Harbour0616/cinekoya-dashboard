import { useState } from "react";
import * as XLSX from "xlsx";
import { supabase } from "../lib/supabase";

interface ParsedRow {
  date: string | null;
  staff_name: string | null;
  start_time: string | null;
  end_time: string | null;
  break_minutes: number;
  work_minutes: number;
  work_hours: number;
  hourly_wage: number;
  salary: number;
}

function excelDateToISO(value: unknown): string | null {
  if (value == null) return null;
  if (typeof value === "number") {
    const epoch = new Date(1899, 11, 30);
    const d = new Date(epoch.getTime() + value * 86400000);
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${y}-${m}-${day}`;
  }
  if (typeof value === "string") {
    const match = value.match(/^(\d{4})[/-](\d{1,2})[/-](\d{1,2})/);
    if (match)
      return `${match[1]}-${match[2].padStart(2, "0")}-${match[3].padStart(2, "0")}`;
  }
  return null;
}

function toTimeStr(value: unknown): string | null {
  if (value == null || value === "") return null;
  if (typeof value === "number") {
    // Excel stores time as fraction of day
    const totalMinutes = Math.round(value * 24 * 60);
    const h = Math.floor(totalMinutes / 60);
    const m = totalMinutes % 60;
    return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
  }
  const s = String(value).trim();
  if (s.match(/^\d{1,2}:\d{2}/)) return s.slice(0, 5);
  return null;
}

function toInt(value: unknown): number {
  if (value == null || value === "") return 0;
  const n = Number(value);
  return isNaN(n) ? 0 : Math.round(n);
}

function toFloat(value: unknown): number {
  if (value == null || value === "") return 0;
  const n = Number(value);
  return isNaN(n) ? 0 : Math.round(n * 100) / 100;
}

function parseSheet(sheet: XLSX.WorkSheet): ParsedRow[] {
  const raw: unknown[][] = XLSX.utils.sheet_to_json(sheet, {
    header: 1,
    defval: null,
  });

  const rows: ParsedRow[] = [];
  for (let i = 0; i < raw.length; i++) {
    const r = raw[i];
    if (!r || r.length === 0) continue;

    const date = excelDateToISO(r[2]);
    const staff_name = r[3] != null ? String(r[3]).trim() : null;
    if (!staff_name || !date) continue;

    const salary = toInt(r[11]);
    // Skip rows with 0 salary
    if (salary === 0) continue;

    rows.push({
      date,
      staff_name,
      start_time: toTimeStr(r[4]),
      end_time: toTimeStr(r[5]),
      break_minutes: toInt(r[6]),
      work_minutes: toInt(r[8]),
      work_hours: toFloat(r[9]),
      hourly_wage: toInt(r[10]),
      salary,
    });
  }
  return rows;
}

export default function AttendanceImport() {
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
      const { error } = await supabase.from("attendance").upsert(batch, {
        onConflict: "date,staff_name",
        ignoreDuplicates: false,
      });
      if (error) {
        console.error("Attendance upsert error:", error);
        errorCount += batch.length;
      } else {
        success += batch.length;
      }
    }

    setResult({ success, error: errorCount });
    setImporting(false);
  };

  const previewRows = parsed.slice(0, 5);

  return (
    <div className="space-y-6">
      <label className="block border-2 border-dashed border-card-border rounded-2xl p-12 text-center cursor-pointer hover:border-accent/40 transition-colors">
        <input
          type="file"
          accept=".xlsx,.xls"
          onChange={handleFileChange}
          className="hidden"
        />
        <div className="text-4xl mb-3">📋</div>
        <div className="text-cream font-medium">
          {file ? file.name : "出勤簿Excelファイル(.xlsx)を選択"}
        </div>
      </label>

      {previewRows.length > 0 && (
        <div className="bg-card border border-card-border rounded-2xl p-5">
          <h3 className="text-cream font-bold mb-1">
            プレビュー（先頭5行 / 全{parsed.length}行）
          </h3>
          <p className="text-sub text-xs mb-3">給与額が0の行はスキップ済み</p>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-card-border">
                  <th className="text-left py-2 px-2 text-sub">日付</th>
                  <th className="text-left py-2 px-2 text-sub">スタッフ名</th>
                  <th className="text-left py-2 px-2 text-sub">開始</th>
                  <th className="text-left py-2 px-2 text-sub">終了</th>
                  <th className="text-right py-2 px-2 text-sub">休憩</th>
                  <th className="text-right py-2 px-2 text-sub">就業(分)</th>
                  <th className="text-right py-2 px-2 text-sub">就業(h)</th>
                  <th className="text-right py-2 px-2 text-sub">時給</th>
                  <th className="text-right py-2 px-2 text-sub">給与</th>
                </tr>
              </thead>
              <tbody>
                {previewRows.map((row, i) => (
                  <tr key={i} className="border-b border-card-border/50">
                    <td className="py-2 px-2 text-cream">{row.date}</td>
                    <td className="py-2 px-2 text-cream">{row.staff_name}</td>
                    <td className="py-2 px-2 text-cream">{row.start_time ?? "—"}</td>
                    <td className="py-2 px-2 text-cream">{row.end_time ?? "—"}</td>
                    <td className="py-2 px-2 text-right text-cream">{row.break_minutes}</td>
                    <td className="py-2 px-2 text-right text-cream">{row.work_minutes}</td>
                    <td className="py-2 px-2 text-right text-cream">{row.work_hours}</td>
                    <td className="py-2 px-2 text-right text-cream">
                      ¥{row.hourly_wage.toLocaleString()}
                    </td>
                    <td className="py-2 px-2 text-right text-accent">
                      ¥{row.salary.toLocaleString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

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

      <div className="bg-card border border-card-border rounded-2xl p-5">
        <h3 className="text-cream font-bold mb-3">📋 カラムマッピング</h3>
        <div className="grid grid-cols-2 gap-x-6 gap-y-1 text-xs">
          <div className="flex justify-between">
            <span className="text-sub">col2</span>
            <span className="text-cream">日付</span>
          </div>
          <div className="flex justify-between">
            <span className="text-sub">col3</span>
            <span className="text-cream">スタッフ名</span>
          </div>
          <div className="flex justify-between">
            <span className="text-sub">col4</span>
            <span className="text-cream">開始時刻</span>
          </div>
          <div className="flex justify-between">
            <span className="text-sub">col5</span>
            <span className="text-cream">終了時刻</span>
          </div>
          <div className="flex justify-between">
            <span className="text-sub">col6</span>
            <span className="text-cream">休憩時間（分）</span>
          </div>
          <div className="flex justify-between">
            <span className="text-sub">col8</span>
            <span className="text-cream">就業時間（分）</span>
          </div>
          <div className="flex justify-between">
            <span className="text-sub">col9</span>
            <span className="text-cream">就業時間（h）</span>
          </div>
          <div className="flex justify-between">
            <span className="text-sub">col10</span>
            <span className="text-cream">時給</span>
          </div>
          <div className="flex justify-between">
            <span className="text-sub">col11</span>
            <span className="text-cream">給与額</span>
          </div>
        </div>
        <p className="text-xs text-sub mt-3">※ 給与額が0の行はスキップされます</p>
      </div>
    </div>
  );
}
