import type { DailyReport } from "../types";

const titles = [
  "街の上で",
  "パーフェクトデイズ",
  "PERFECT DAYS",
  "花束みたいな恋をした",
  "ドライブ・マイ・カー",
  "万引き家族",
  "海街diary",
  "かもめ食堂",
  "リトル・フォレスト",
  "南極料理人",
  "深夜食堂",
  "珈琲時光",
];

const timeSlots = ["10:30", "13:00", "15:30", "18:00", "20:30"];

function randomInt(min: number, max: number) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function generateSampleData(): DailyReport[] {
  const data: DailyReport[] = [];
  let id = 1;
  const now = new Date();

  for (let monthOffset = 0; monthOffset < 24; monthOffset++) {
    const d = new Date(now.getFullYear(), now.getMonth() - monthOffset, 1);
    const daysInMonth = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();

    for (let day = 1; day <= daysInMonth; day += randomInt(1, 3)) {
      const date = new Date(d.getFullYear(), d.getMonth(), day);
      if (date > now) continue;

      const title = titles[randomInt(0, titles.length - 1)];
      const timeSlot = timeSlots[randomInt(0, timeSlots.length - 1)];
      const audience = randomInt(5, 35);
      const revenueTaxin = audience * randomInt(1200, 1800);
      const revenueTaxout = Math.round(revenueTaxin / 1.1);
      const salary = randomInt(8000, 25000);
      const profit = revenueTaxout - salary - randomInt(5000, 15000);

      data.push({
        id: id++,
        title,
        date: date.toISOString().split("T")[0],
        time_slot: timeSlot,
        audience_total: audience,
        revenue_taxin: revenueTaxin,
        revenue_taxout: revenueTaxout,
        mobilization: audience,
        salary,
        profit,
        created_at: new Date().toISOString(),
      });
    }
  }

  return data;
}

export const sampleReports = generateSampleData();
