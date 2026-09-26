/**
 * Minimal RFC 4180 CSV parser: quoted fields, escaped quotes ("") and
 * newlines inside quotes. Returns rows keyed by the header line.
 */
export function parseCsv(text: string): { header: string[]; rows: Array<Record<string, string>> } {
  const records: string[][] = [];
  let field = '';
  let record: string[] = [];
  let inQuotes = false;
  const input = text.replace(/^﻿/, '');

  for (let index = 0; index < input.length; index += 1) {
    const char = input[index];

    if (inQuotes) {
      if (char === '"' && input[index + 1] === '"') {
        field += '"';
        index += 1;
      } else if (char === '"') {
        inQuotes = false;
      } else {
        field += char;
      }
      continue;
    }

    if (char === '"') {
      inQuotes = true;
    } else if (char === ',') {
      record.push(field);
      field = '';
    } else if (char === '\n' || char === '\r') {
      if (char === '\r' && input[index + 1] === '\n') {
        index += 1;
      }
      record.push(field);
      records.push(record);
      record = [];
      field = '';
    } else {
      field += char;
    }
  }

  if (inQuotes) {
    throw new Error('CSV has an unterminated quoted field');
  }

  if (field !== '' || record.length) {
    record.push(field);
    records.push(record);
  }

  const nonEmpty = records.filter((row) => row.some((value) => value.trim() !== ''));
  const [header = [], ...body] = nonEmpty;
  const keys = header.map((name) => name.trim());

  return {
    header: keys,
    rows: body.map((values) =>
      Object.fromEntries(keys.map((key, column) => [key, (values[column] ?? '').trim()]))
    )
  };
}
