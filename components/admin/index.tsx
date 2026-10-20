import type { ReactNode } from "react";

// Small building blocks for the admin screens (English UI).

export function AdminSection({ title, children, actions }: { title: string; children: ReactNode; actions?: ReactNode }) {
  return (
    <section className="mb-10" aria-label={title}>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-2xl font-extrabold">{title}</h2>
        {actions}
      </div>
      {children}
    </section>
  );
}

export function Table({ head, rows, empty = "Nothing yet." }: { head: string[]; rows: ReactNode[][]; empty?: string }) {
  if (!rows.length) return <p className="text-muted">{empty}</p>;
  return (
    <div className="overflow-x-auto rounded-xl border-2 border-line">
      <table className="w-full border-collapse text-sm">
        <thead className="bg-sand">
          <tr>
            {head.map((h) => (
              <th key={h} scope="col" className="border-b-2 border-line px-3 py-2 text-start font-bold">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((cells, i) => (
            <tr key={i} className="border-b border-line align-top last:border-0">
              {cells.map((c, j) => (
                <td key={j} className="px-3 py-2">
                  {c}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function CsvLink({ dataset }: { dataset: string }) {
  return (
    <a href={`/admin/export/${dataset}`} className="inline-flex min-h-10 items-center rounded-lg border-2 border-ink px-3 text-sm font-bold">
      Export CSV
    </a>
  );
}

export function Stat({ label, value, tone = "neutral" }: { label: string; value: number | string; tone?: "neutral" | "warn" }) {
  return (
    <div className={`rounded-xl border-2 p-4 ${tone === "warn" ? "border-warn bg-warn-soft" : "border-line"}`}>
      <p className="text-3xl font-extrabold">{value}</p>
      <p className="text-sm font-bold">{label}</p>
    </div>
  );
}
