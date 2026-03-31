import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";
import type { DailyReport } from "../types";

export function useDailyReports() {
  const [reports, setReports] = useState<DailyReport[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchReports = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("daily_reports")
      .select("*")
      .order("date", { ascending: false });

    if (error) {
      console.error("Error fetching reports:", error);
    } else {
      setReports(data ?? []);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchReports();
  }, []);

  return { reports, loading, refetch: fetchReports };
}
