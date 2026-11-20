// CSV helpers for the admin uploads. Parsers throw Error('bad_row:<line>') with the
// 1-based line number of the first unusable row, so the page can point at it.

/** One row of the flats & members CSV: building,wing,flat,password,member_name,member_phone,relation. */
export interface MemberRow {
  line: number;
  building: string;
  wing: string;
  flat: string;
  password: string;
  member_name: string;
  member_phone: string;
  relation: string;
}

/** One row of the custom bills CSV: building,wing,flat,amount. */
export interface BillRow {
  line: number;
  building: string;
  wing: string;
  flat: string;
  amount: number;
}

/**
 * "1", "B1", "b 1", "building1" -> "Building 1"; anything else is kept with whitespace
 * collapsed. The accounts function groups flats case-sensitively, so every row of a
 * building must be spelled the same way before it is sent.
 */
export function normalizeBuilding(raw: string): string {
  const s = raw.trim().replace(/\s+/g, ' ');
  const m = /^(?:b|building)?\s*(\d+)$/i.exec(s);
  return m ? `Building ${Number(m[1])}` : s;
}

/** Splits one CSV line into trimmed fields (double quotes, "" escapes). Null on an unterminated quote. */
function splitLine(line: string): string[] | null {
  const fields: string[] = [];
  let cur = '';
  let quoted = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (quoted) {
      if (c === '"' && line[i + 1] === '"') {
        cur += '"';
        i++;
      } else if (c === '"') quoted = false;
      else cur += c;
    } else if (c === '"') quoted = true;
    else if (c === ',') {
      fields.push(cur.trim());
      cur = '';
    } else cur += c;
  }
  if (quoted) return null;
  fields.push(cur.trim());
  return fields;
}

/** Non-blank lines as fields, minus a header whose first column is `headerFirst`. */
function rows(text: string, headerFirst: string): { line: number; fields: string[] }[] {
  const out: { line: number; fields: string[] }[] = [];
  let first = true;
  text.split(/\r?\n/).forEach((raw, i) => {
    if (raw.trim() === '') return;
    const fields = splitLine(raw);
    if (!fields) throw new Error(`bad_row:${i + 1}`);
    const isHeader = first && fields[0].toLowerCase() === headerFirst;
    first = false;
    if (!isHeader) out.push({ line: i + 1, fields });
  });
  return out;
}

export function parseMembersCsv(text: string): MemberRow[] {
  return rows(text, 'building').map(({ line, fields }) => {
    if (fields.length < 3 || fields.length > 7) throw new Error(`bad_row:${line}`);
    const [building, wing, flat, password = '', member_name = '', member_phone = '', relation = ''] = fields;
    if (!building || !wing || !flat) throw new Error(`bad_row:${line}`);
    return {
      line,
      building: normalizeBuilding(building),
      wing: wing.toUpperCase(),
      flat,
      password,
      member_name,
      member_phone,
      relation,
    };
  });
}

export function parseBillsCsv(text: string): BillRow[] {
  return rows(text, 'building').map(({ line, fields }) => {
    if (fields.length !== 4) throw new Error(`bad_row:${line}`);
    const [building, wing, flat, amountText] = fields;
    const amount = Number(amountText);
    if (!building || !wing || !flat || !/^\d+(\.\d{1,2})?$/.test(amountText) || !(amount > 0) || amount >= 1e8) {
      throw new Error(`bad_row:${line}`);
    }
    return { line, building: normalizeBuilding(building), wing: wing.toUpperCase(), flat, amount };
  });
}

/** Rows -> CSV text (CRLF, fields quoted when needed). */
export function toCsv(table: string[][]): string {
  const cell = (v: string) => (/[",\r\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v);
  return table.map((r) => r.map(cell).join(',')).join('\r\n') + '\r\n';
}

/** Lets the browser save `text` as a file (nothing is logged). */
export function downloadCsv(filename: string, text: string) {
  const url = URL.createObjectURL(new Blob([text], { type: 'text/csv;charset=utf-8' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** "bad_row:5" -> a friendly message for the given expected format. */
export function csvErrorMessage(e: unknown, format: string): string {
  const msg = e instanceof Error ? e.message : String(e);
  const m = /^bad_row:(\d+)$/.exec(msg);
  return m ? `Line ${m[1]} is not valid. Expected: ${format}` : msg;
}
