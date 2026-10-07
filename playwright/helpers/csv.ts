import * as fs from 'fs';
import type { Download } from '@playwright/test';

/**
 * Parses the CSV Fleet's frontend writes (`utilities/convert_to_csv`): every
 * field wrapped in double quotes, an embedded quote doubled, rows joined by
 * `\n`. A value with leading zeros comes out as `="0123"`, which is how Fleet
 * keeps a spreadsheet from trimming it; it is returned as written.
 */
export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (quoted) {
      if (c === '"' && text[i + 1] === '"') {
        field += '"';
        i++;
      } else if (c === '"') {
        quoted = false;
      } else {
        field += c;
      }
    } else if (c === '"') {
      quoted = true;
    } else if (c === ',') {
      row.push(field);
      field = '';
    } else if (c === '\n' || c === '\r') {
      if (c === '\r' && text[i + 1] === '\n') i++;
      row.push(field);
      rows.push(row);
      row = [];
      field = '';
    } else {
      field += c;
    }
  }
  if (field !== '' || row.length > 0) {
    row.push(field);
    rows.push(row);
  }
  return rows;
}

/** The CSV's header row, and every data row keyed by it. */
export function csvRecords(text: string): { header: string[]; records: Record<string, string>[] } {
  const [header = [], ...rows] = parseCsv(text);
  return {
    header,
    records: rows.map((cells) => Object.fromEntries(header.map((name, i) => [name, cells[i] ?? '']))),
  };
}

/** Reads a finished browser download as a CSV. */
export async function readCsvDownload(download: Download): Promise<ReturnType<typeof csvRecords>> {
  return csvRecords(fs.readFileSync(await download.path(), 'utf-8'));
}
