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
  audience_general: number | null;
  audience_fc: number | null;
  audience_fc_guest: number | null;
  audience_members: number | null;
  audience_members_guest: number | null;
  audience_u28: number | null;
  audience_u22: number | null;
  audience_highschool: number | null;
  created_at: string;
}

export const TICKET_TYPES = [
  { key: "audience_general", label: "一般", color: "#c8861a" },
  { key: "audience_fc", label: "ファンクラブ", color: "#5b9bd5" },
  { key: "audience_fc_guest", label: "ファンクラブ同伴", color: "#85b7eb" },
  { key: "audience_members", label: "メンバーズ", color: "#6fcf97" },
  { key: "audience_members_guest", label: "メンバーズ同伴", color: "#a8e6c1" },
  { key: "audience_u28", label: "U28", color: "#eb5757" },
  { key: "audience_u22", label: "U22", color: "#f0a0a0" },
  { key: "audience_highschool", label: "高校生以下", color: "#a08860" },
] as const;

export type TicketTypeKey = (typeof TICKET_TYPES)[number]["key"];
