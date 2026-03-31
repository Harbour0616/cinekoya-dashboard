interface KPICardProps {
  label: string;
  value: string;
  diff: number | null;
  icon: string;
}

export default function KPICard({ label, value, diff, icon }: KPICardProps) {
  return (
    <div className="bg-card border border-card-border rounded-2xl p-5 flex flex-col gap-2">
      <div className="flex items-center gap-2 text-sub text-sm">
        <span>{icon}</span>
        <span>{label}</span>
      </div>
      <div className="text-2xl font-bold text-cream">{value}</div>
      {diff !== null && (
        <div
          className={`text-sm font-medium ${
            diff >= 0 ? "text-green-400" : "text-red-400"
          }`}
        >
          {diff >= 0 ? "▲" : "▼"} 前月比 {Math.abs(diff).toFixed(1)}%
        </div>
      )}
    </div>
  );
}
