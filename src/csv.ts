/** Parse une ligne CSV (séparateur virgule, champs entre guillemets RFC 4180). */
export function parseCsvLine(line: string): string[] {
  const result: string[] = [];
  let cur = "";
  let i = 0;
  let inQuotes = false;
  while (i < line.length) {
    const c = line[i];
    if (inQuotes) {
      if (c === '"') {
        if (line[i + 1] === '"') {
          cur += '"';
          i += 2;
          continue;
        }
        inQuotes = false;
        i++;
        continue;
      }
      cur += c;
      i++;
    } else {
      if (c === '"') {
        inQuotes = true;
        i++;
        continue;
      }
      if (c === ",") {
        result.push(cur);
        cur = "";
        i++;
        continue;
      }
      cur += c;
      i++;
    }
  }
  result.push(cur);
  return result;
}

function makeUniqueHeaders(cells: string[]): string[] {
  const count = new Map<string, number>();
  return cells.map((raw) => {
    const base = raw.trim() || "Colonne";
    const n = (count.get(base) ?? 0) + 1;
    count.set(base, n);
    return n === 1 ? base : `${base} (${n})`;
  });
}

export function parseCsv(content: string): { headers: string[]; rows: Record<string, string>[] } {
  const text = content.replace(/^\uFEFF/, "");
  const lines = text.split(/\r?\n/).filter((l) => l.length > 0);
  if (lines.length === 0) return { headers: [], rows: [] };
  const headerCells = parseCsvLine(lines[0]);
  const headers = makeUniqueHeaders(headerCells);
  const rows: Record<string, string>[] = [];
  for (let i = 1; i < lines.length; i++) {
    const cells = parseCsvLine(lines[i]);
    const row: Record<string, string> = {};
    let any = false;
    for (let j = 0; j < headers.length; j++) {
      const v = (cells[j] ?? "").trim();
      row[headers[j]] = v;
      if (v) any = true;
    }
    if (any) rows.push(row);
  }
  return { headers, rows };
}

export function buildTicketRef(row: Record<string, string>, keys: string[]): string {
  return keys
    .map((k) => (row[k] ?? "").trim())
    .filter(Boolean)
    .join(" — ");
}

/** Colonnes Jira fréquentes pour pré-sélection (Issue key, Summary, etc.). */
export function guessDefaultJiraColumns(headers: string[]): string[] {
  const out: string[] = [];
  for (const h of headers) {
    const l = h.trim().toLowerCase();
    if (
      l === "issue key" ||
      l === "key" ||
      /^\s*issue\s*key\s*$/i.test(h.trim()) ||
      l === "summary" ||
      l === "résumé" ||
      l === "resume"
    ) {
      out.push(h);
    }
  }
  return [...new Set(out)];
}
