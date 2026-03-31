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

function distributeAudience(total: number) {
  const general = randomInt(Math.floor(total * 0.3), Math.floor(total * 0.5));
  let rest = total - general;
  const fc = randomInt(0, Math.min(rest, Math.floor(total * 0.15)));
  rest -= fc;
  const fcGuest = randomInt(0, Math.min(rest, Math.floor(total * 0.05)));
  rest -= fcGuest;
  const members = randomInt(0, Math.min(rest, Math.floor(total * 0.15)));
  rest -= members;
  const membersGuest = randomInt(0, Math.min(rest, Math.floor(total * 0.05)));
  rest -= membersGuest;
  const u28 = randomInt(0, Math.min(rest, Math.floor(total * 0.1)));
  rest -= u28;
  const u22 = randomInt(0, Math.min(rest, Math.floor(total * 0.08)));
  rest -= u22;
  const highschool = rest;

  return {
    audience_general: general,
    audience_fc: fc,
    audience_fc_guest: fcGuest,
    audience_members: members,
    audience_members_guest: membersGuest,
    audience_u28: u28,
    audience_u22: u22,
    audience_highschool: highschool,
  };
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
      const tickets = distributeAudience(audience);

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
        ...tickets,
        created_at: new Date().toISOString(),
      });
    }
  }

  return data;
}

export const sampleReports = generateSampleData();
