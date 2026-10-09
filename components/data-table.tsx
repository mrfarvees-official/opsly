"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";

export interface DataTableRow {
  [key: string]: string;
}

export function DataTable({
  columns,
  rows,
  emptyLabel = "Nothing here yet.",
  createHref,
  showActions = true,
}: {
  columns: string[];
  rows: DataTableRow[];
  emptyLabel?: string;
  createHref?: string;
  showActions?: boolean;
}) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(1);
  const pageSize = 8;

  const filteredRows = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return rows;
    return rows.filter((row) =>
      columns.some((column) => row[column].toLowerCase().includes(needle)),
    );
  }, [columns, query, rows]);

  const pageCount = Math.max(1, Math.ceil(filteredRows.length / pageSize));
  const currentPage = Math.min(page, pageCount);
  const visibleRows = filteredRows.slice(
    (currentPage - 1) * pageSize,
    currentPage * pageSize,
  );

  function updateQuery(value: string) {
    setQuery(value);
    setPage(1);
  }

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line px-5 py-4">
        <div>
          <h2 className="font-display text-lg font-semibold">
            {filteredRows.length} {filteredRows.length === 1 ? "record" : "records"}
          </h2>
          <p className="mt-1 text-sm text-ink-soft">Filter and browse the records you can access.</p>
        </div>
        <div className="flex items-center gap-2">
          {createHref && <Link href={createHref} className="rounded-xl bg-brand px-3.5 py-2 text-sm font-semibold text-white hover:bg-brand-dark">Create</Link>}
          <label className="flex items-center gap-2 rounded-xl border border-line bg-paper px-3 py-2 text-sm text-ink-soft focus-within:border-brand">
          <span aria-hidden="true">⌕</span>
          <span className="sr-only">Filter records</span>
          <input
            value={query}
            onChange={(event) => updateQuery(event.target.value)}
            placeholder="Filter records"
            className="w-40 bg-transparent text-ink outline-none placeholder:text-ink-soft/70 sm:w-56"
          />
          </label>
        </div>
      </div>

      {columns.length === 0 || rows.length === 0 ? (
        <div className="px-5 py-14 text-center text-sm text-ink-soft">{emptyLabel}</div>
      ) : filteredRows.length === 0 ? (
        <div className="px-5 py-14 text-center text-sm text-ink-soft">No records match that filter.</div>
      ) : (
        <div className="max-h-[min(620px,calc(100vh-290px))] overflow-auto">
          <table className="w-full min-w-[760px] text-left text-sm">
            <thead className="sticky top-0 z-10 bg-paper text-ink-soft">
              <tr>
                {columns.map((column) => (
                  <th key={column} className="px-5 py-3 font-medium">{formatLabel(column)}</th>
                ))}
                {showActions && <th className="px-5 py-3 text-right font-medium">Actions</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {visibleRows.map((row, index) => (
                <tr key={`${currentPage}-${index}`} className="hover:bg-paper/60">
                  {columns.map((column) => (
                    <td key={column} className="max-w-[300px] px-5 py-3.5 align-top text-ink-soft">
                      <span className="line-clamp-3">{row[column]}</span>
                    </td>
                  ))}
                  {showActions && <td className="whitespace-nowrap px-5 py-3.5 text-right"><div className="flex justify-end gap-2">{row.viewHref && <Link href={row.viewHref} className="rounded-lg border border-line px-2.5 py-1.5 text-xs font-semibold hover:border-brand">View</Link>}{row.editHref && <Link href={row.editHref} className="rounded-lg border border-line px-2.5 py-1.5 text-xs font-semibold hover:border-brand">Edit</Link>}{row.deleteEndpoint && <button type="button" onClick={async () => { if (!window.confirm("Delete this record?")) return; const response = await fetch(row.deleteEndpoint, { method: "DELETE" }); if (!response.ok) { window.alert("The record could not be deleted."); return; } router.refresh(); }} className="rounded-lg border border-bad/30 px-2.5 py-1.5 text-xs font-semibold text-bad hover:bg-red-50">Delete</button>}</div></td>}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="flex items-center justify-between gap-3 border-t border-line px-5 py-3 text-sm text-ink-soft">
        <span>{filteredRows.length === 0 ? "0" : `${(currentPage - 1) * pageSize + 1}–${Math.min(currentPage * pageSize, filteredRows.length)}`} of {filteredRows.length}</span>
        <div className="flex items-center gap-2">
          <button type="button" onClick={() => setPage((value) => Math.max(1, value - 1))} disabled={currentPage === 1} className="rounded-lg border border-line px-3 py-1.5 font-medium hover:border-brand disabled:cursor-not-allowed disabled:opacity-40">Previous</button>
          <span className="min-w-16 text-center">Page {currentPage} / {pageCount}</span>
          <button type="button" onClick={() => setPage((value) => Math.min(pageCount, value + 1))} disabled={currentPage === pageCount} className="rounded-lg border border-line px-3 py-1.5 font-medium hover:border-brand disabled:cursor-not-allowed disabled:opacity-40">Next</button>
        </div>
      </div>
    </div>
  );
}

function formatLabel(value: string) {
  return value.replaceAll("_", " ").replace(/(^|\s)\S/g, (letter) => letter.toUpperCase());
}
