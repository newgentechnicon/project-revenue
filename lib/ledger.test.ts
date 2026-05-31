import { describe, it, expect } from "vitest";
import { LedgerEntry } from "./types";
import type { CashflowMonth } from "./cashflow";
import {
  summarizeLedger,
  groupByCategory,
  summarizeLedgerByMonth,
  reconcileActualVsProjected,
} from "./ledger";

const entry = (overrides: Partial<LedgerEntry>): LedgerEntry => ({
  id: "l1",
  date: "2026-05-10",
  direction: "in",
  amount: 1000,
  category: "project_payment",
  attachments: [],
  createdAt: "2026-05-10T00:00:00.000Z",
  updatedAt: "2026-05-10T00:00:00.000Z",
  ...overrides,
});

describe("summarizeLedger", () => {
  it("แยกยอดเข้า/ออก และคำนวณ net", () => {
    const s = summarizeLedger([
      entry({ direction: "in", amount: 5000 }),
      entry({ direction: "in", amount: 3000 }),
      entry({ direction: "out", amount: 2000, category: "salary" }),
    ]);
    expect(s.totalIn).toBe(8000);
    expect(s.totalOut).toBe(2000);
    expect(s.net).toBe(6000);
    expect(s.countIn).toBe(2);
    expect(s.countOut).toBe(1);
  });

  it("ลิสต์ว่างคืนศูนย์ทั้งหมด", () => {
    expect(summarizeLedger([])).toEqual({
      totalIn: 0,
      totalOut: 0,
      net: 0,
      countIn: 0,
      countOut: 0,
    });
  });
});

describe("groupByCategory", () => {
  it("รวมตามหมวด+ทิศทาง และเรียงจากมากไปน้อย", () => {
    const g = groupByCategory([
      entry({ category: "project_payment", amount: 1000 }),
      entry({ category: "project_payment", amount: 4000 }),
      entry({ direction: "out", category: "salary", amount: 9000 }),
    ]);
    expect(g[0].category).toBe("salary");
    expect(g[0].total).toBe(9000);
    const proj = g.find((x) => x.category === "project_payment")!;
    expect(proj.total).toBe(5000);
    expect(proj.count).toBe(2);
    expect(proj.direction).toBe("in");
  });
});

describe("summarizeLedgerByMonth", () => {
  it("จัดกลุ่มรายเดือน + ยอดสะสมต่อเนื่อง", () => {
    const months = summarizeLedgerByMonth(
      [
        entry({ date: "2026-05-01", direction: "in", amount: 10000 }),
        entry({ date: "2026-05-20", direction: "out", amount: 3000 }),
        entry({ date: "2026-06-05", direction: "out", amount: 2000 }),
      ],
      1000 // opening balance
    );
    expect(months).toHaveLength(2);
    expect(months[0].monthKey).toBe("2026-05");
    expect(months[0].net).toBe(7000);
    expect(months[0].cumulative).toBe(8000); // 1000 + 7000
    expect(months[1].cumulative).toBe(6000); // 8000 - 2000
  });

  it("ข้ามรายการที่วันที่ไม่ถูกต้อง", () => {
    const months = summarizeLedgerByMonth([entry({ date: "ไม่ใช่วันที่" })]);
    expect(months).toHaveLength(0);
  });
});

describe("reconcileActualVsProjected", () => {
  it("คำนวณส่วนต่างจริง vs ประมาณการ และรวม month ทั้งสองฝั่ง", () => {
    const actual = summarizeLedgerByMonth([
      entry({ date: "2026-05-10", direction: "in", amount: 12000 }),
      entry({ date: "2026-05-15", direction: "out", amount: 4000 }),
    ]);
    const projected: CashflowMonth[] = [
      {
        monthDate: new Date("2026-05-01"),
        monthLabel: "May 26",
        inflow: 10000,
        outflow: 5000,
        net: 5000,
        cumulative: 5000,
        inflowDetails: [],
        outflowDetails: [],
      },
    ];
    const rows = reconcileActualVsProjected(actual, projected);
    expect(rows).toHaveLength(1);
    expect(rows[0].inflowVariance).toBe(2000); // 12000 - 10000
    expect(rows[0].outflowVariance).toBe(-1000); // 4000 - 5000
  });
});
