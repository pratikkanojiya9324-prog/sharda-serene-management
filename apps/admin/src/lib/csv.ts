export interface FlatRow {
  tower: string;
  flat: string;
}

/** Parse pasted `tower,flat` lines. Throws Error('bad_row:<lineNo>') for rows without exactly 2 fields. */
export function parseFlatsCsv(text: string): FlatRow[] {
  const rows: FlatRow[] = [];
  text.split(/\r?\n/).forEach((raw, i) => {
    const line = raw.trim();
    if (line === '') return;
    const fields = line.split(',').map((f) => f.trim());
    if (fields.length === 2 && fields[0].toLowerCase() === 'tower' && fields[1].toLowerCase() === 'flat') return;
    if (fields.length !== 2 || fields[0] === '' || fields[1] === '') throw new Error(`bad_row:${i + 1}`);
    rows.push({ tower: fields[0], flat: fields[1] });
  });
  return rows;
}
