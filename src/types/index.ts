export interface DailyReport {
  id: number;
  title: string | null;
  date: string | null;
  time_slot: string | null;
  audience_total: number | null;
  revenue_taxin: number | null;
  revenue_taxout: number | null;
  mobilization: number | null;
  salary: number | null;
  profit: number | null;
  created_at: string;
}
