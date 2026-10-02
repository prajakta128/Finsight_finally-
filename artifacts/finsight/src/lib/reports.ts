// artifacts/finsight/src/lib/reports.ts
// Builds the three PDFs offered on the Reports page and downloads them.
import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import type { BusinessBootstrap } from "@workspace/api-client-react";
import { formatDate } from "./financials";

export type ReportKind = "management" | "receivables" | "vendors";

export interface ReportRange {
  from: string; // YYYY-MM-DD
  to: string; // YYYY-MM-DD
}

// jsPDF's built-in fonts cannot draw the rupee sign, so we write "Rs." instead.
const rs = (n: number) =>
  `Rs. ${new Intl.NumberFormat("en-IN", { maximumFractionDigits: 0 }).format(n)}`;

const isSettled = (status: string) =>
  /paid|cleared|collected|closed/i.test(status);

const inRange = (date: string, { from, to }: ReportRange) =>
  (!from || date >= from) && (!to || date <= to);

const daysBetween = (from: string, to: string) =>
  Math.floor((Date.parse(to) - Date.parse(from)) / 86400000);

const endY = (doc: jsPDF) =>
  (doc as unknown as { lastAutoTable?: { finalY: number } }).lastAutoTable
    ?.finalY ?? 40;

const GREEN: [number, number, number] = [49, 127, 108];

function startDoc(
  title: string,
  data: BusinessBootstrap,
  range: ReportRange,
  note?: string,
) {
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  doc.setFont("helvetica", "bold");
  doc.setFontSize(18);
  doc.text(title, 40, 50);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.setTextColor(100);
  doc.text(
    `${data.business.name} - ${data.business.location}`,
    40,
    68,
  );
  doc.text(
    `Period: ${formatDate(range.from)} to ${formatDate(range.to)}` +
      (note ? `  (${note})` : ""),
    40,
    82,
  );
  doc.text(`Generated ${formatDate(new Date().toISOString().slice(0, 10))}`, 40, 96);
  doc.setTextColor(0);
  return doc;
}

function heading(doc: jsPDF, text: string, y: number) {
  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.text(text, 40, y);
  doc.setFont("helvetica", "normal");
}

function addPageNumbers(doc: jsPDF) {
  const pages = doc.getNumberOfPages();
  const { width, height } = doc.internal.pageSize;
  doc.setFontSize(8);
  doc.setTextColor(120);
  for (let i = 1; i <= pages; i++) {
    doc.setPage(i);
    doc.text(`FinSight - page ${i} of ${pages}`, width - 40, height - 24, {
      align: "right",
    });
  }
}

function emptyNote(doc: jsPDF, y: number, text: string) {
  doc.setFontSize(10);
  doc.setTextColor(120);
  doc.text(text, 40, y);
  doc.setTextColor(0);
}

// ---------------------------------------------------------------------------
// 1. Monthly management pack
// ---------------------------------------------------------------------------
function managementPack(data: BusinessBootstrap, range: ReportRange) {
  const doc = startDoc("Monthly management pack", data, range);
  const txns = data.transactions.filter((t) => inRange(t.date, range));
  const revenue = txns
    .filter((t) => t.type === "revenue")
    .reduce((s, t) => s + t.amount, 0);
  const expenses = txns
    .filter((t) => t.type === "expense")
    .reduce((s, t) => s + t.amount, 0);
  const openReceivables = data.receivables
    .filter((r) => !isSettled(r.status))
    .reduce((s, r) => s + r.amount, 0);
  const openPayables = data.payables
    .filter((p) => !isSettled(p.status))
    .reduce((s, p) => s + p.amount, 0);

  heading(doc, "Summary", 125);
  autoTable(doc, {
    startY: 135,
    theme: "grid",
    headStyles: { fillColor: GREEN },
    head: [["Measure", "Amount"]],
    body: [
      ["Revenue", rs(revenue)],
      ["Expenses", rs(expenses)],
      ["Net cash flow", `${revenue - expenses < 0 ? "-" : ""}${rs(Math.abs(revenue - expenses))}`],
      ["Receivables outstanding", rs(openReceivables)],
      ["Payables outstanding", rs(openPayables)],
    ],
  });

  // Expenses by category
  const byCategory = new Map<string, number>();
  txns
    .filter((t) => t.type === "expense")
    .forEach((t) => byCategory.set(t.category, (byCategory.get(t.category) ?? 0) + t.amount));
  const catRows = [...byCategory.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([cat, amt]) => [
      cat,
      rs(amt),
      expenses ? `${((amt / expenses) * 100).toFixed(1)}%` : "-",
    ]);

  let y = endY(doc) + 28;
  heading(doc, "Expenses by category", y);
  if (catRows.length) {
    autoTable(doc, {
      startY: y + 10,
      theme: "grid",
      headStyles: { fillColor: GREEN },
      head: [["Category", "Spend", "Share"]],
      body: catRows,
    });
  } else {
    emptyNote(doc, y + 18, "No expenses in this period.");
  }

  // Transactions
  y = (catRows.length ? endY(doc) : y + 18) + 28;
  heading(doc, "Transactions", y);
  const txnRows = [...txns]
    .sort((a, b) => a.date.localeCompare(b.date))
    .map((t) => [
      formatDate(t.date),
      t.type === "revenue" ? "Revenue" : "Expense",
      t.description,
      t.category,
      rs(t.amount),
      t.status,
    ]);
  if (txnRows.length) {
    autoTable(doc, {
      startY: y + 10,
      theme: "striped",
      headStyles: { fillColor: GREEN },
      styles: { fontSize: 8 },
      head: [["Date", "Type", "Description", "Category", "Amount", "Status"]],
      body: txnRows,
    });
  } else {
    emptyNote(doc, y + 18, "No transactions in this period.");
  }

  addPageNumbers(doc);
  return doc;
}

// ---------------------------------------------------------------------------
// 2. Receivables aging (measured at the end of the selected period)
// ---------------------------------------------------------------------------
function receivablesAging(data: BusinessBootstrap, range: ReportRange) {
  const doc = startDoc("Receivables aging", data, range, `aged as of ${formatDate(range.to)}`);
  const open = data.receivables.filter((r) => !isSettled(r.status));
  const rows = open
    .map((r) => ({ ...r, overdue: daysBetween(r.dueDate, range.to) }))
    .sort((a, b) => b.overdue - a.overdue);

  const buckets = [
    { label: "Not yet due", test: (d: number) => d <= 0 },
    { label: "1-30 days overdue", test: (d: number) => d >= 1 && d <= 30 },
    { label: "31-60 days overdue", test: (d: number) => d >= 31 && d <= 60 },
    { label: "Over 60 days overdue", test: (d: number) => d > 60 },
  ];

  heading(doc, "Aging summary", 125);
  autoTable(doc, {
    startY: 135,
    theme: "grid",
    headStyles: { fillColor: GREEN },
    head: [["Bucket", "Invoices", "Amount"]],
    body: [
      ...buckets.map((b) => {
        const m = rows.filter((r) => b.test(r.overdue));
        return [b.label, String(m.length), rs(m.reduce((s, r) => s + r.amount, 0))];
      }),
      ["Total outstanding", String(rows.length), rs(rows.reduce((s, r) => s + r.amount, 0))],
    ],
  });

  const y = endY(doc) + 28;
  heading(doc, "Customer-wise outstanding", y);
  if (rows.length) {
    autoTable(doc, {
      startY: y + 10,
      theme: "striped",
      headStyles: { fillColor: GREEN },
      head: [["Customer", "Invoice", "Amount", "Due date", "Days overdue", "Status"]],
      body: rows.map((r) => [
        r.customer,
        r.invoice,
        rs(r.amount),
        formatDate(r.dueDate),
        r.overdue > 0 ? String(r.overdue) : "Not due",
        r.status,
      ]),
    });
  } else {
    emptyNote(doc, y + 18, "No outstanding receivables.");
  }

  addPageNumbers(doc);
  return doc;
}

// ---------------------------------------------------------------------------
// 3. Vendor spend review
// ---------------------------------------------------------------------------
function vendorSpend(data: BusinessBootstrap, range: ReportRange) {
  const doc = startDoc("Vendor spend review", data, range);
  const expenses = data.transactions.filter(
    (t) => t.type === "expense" && t.vendor && inRange(t.date, range),
  );
  const total = expenses.reduce((s, t) => s + t.amount, 0);

  const grouped = new Map<string, { spend: number; count: number }>();
  expenses.forEach((t) => {
    const g = grouped.get(t.vendor as string) ?? { spend: 0, count: 0 };
    g.spend += t.amount;
    g.count += 1;
    grouped.set(t.vendor as string, g);
  });
  const terms = new Map(data.vendors.map((v) => [v.name, v.terms]));
  const rows = [...grouped.entries()].sort((a, b) => b[1].spend - a[1].spend);

  heading(doc, "Concentration", 125);
  const top = rows[0];
  const top3 = rows.slice(0, 3).reduce((s, [, g]) => s + g.spend, 0);
  autoTable(doc, {
    startY: 135,
    theme: "grid",
    headStyles: { fillColor: GREEN },
    head: [["Measure", "Value"]],
    body: [
      ["Total vendor spend", rs(total)],
      ["Vendors paid", String(rows.length)],
      ["Largest vendor", top ? `${top[0]} (${((top[1].spend / total) * 100).toFixed(1)}%)` : "-"],
      ["Top 3 vendors share", total ? `${((top3 / total) * 100).toFixed(1)}%` : "-"],
    ],
  });

  const y = endY(doc) + 28;
  heading(doc, "Spend by vendor", y);
  if (rows.length) {
    autoTable(doc, {
      startY: y + 10,
      theme: "striped",
      headStyles: { fillColor: GREEN },
      head: [["Vendor", "Payments", "Spend", "Share", "Terms"]],
      body: rows.map(([name, g]) => [
        name,
        String(g.count),
        rs(g.spend),
        `${((g.spend / total) * 100).toFixed(1)}%`,
        terms.get(name) ?? "-",
      ]),
    });
  } else {
    emptyNote(doc, y + 18, "No vendor spend in this period.");
  }

  addPageNumbers(doc);
  return doc;
}

// ---------------------------------------------------------------------------
// Public entry point used by the Reports page
// ---------------------------------------------------------------------------
export function exportReport(
  kind: ReportKind,
  data: BusinessBootstrap,
  range: ReportRange,
) {
  const doc =
    kind === "management"
      ? managementPack(data, range)
      : kind === "receivables"
        ? receivablesAging(data, range)
        : vendorSpend(data, range);
  doc.save(`FinSight-${kind}-${range.from}-to-${range.to}.pdf`);
}

/** Earliest and latest transaction dates, used as the default date range. */
export function defaultRange(data: BusinessBootstrap): ReportRange {
  const dates = data.transactions.map((t) => t.date).sort();
  const today = new Date().toISOString().slice(0, 10);
  return { from: dates[0] ?? today, to: dates[dates.length - 1] ?? today };
}
