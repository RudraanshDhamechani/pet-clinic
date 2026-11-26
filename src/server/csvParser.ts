export interface ParsedCsvData {
  headers: string[];
  rows: Map<string, string>[];
}

const MAX_CSV_BYTES = 1_500_000;
const MAX_CSV_ROWS = 1000;

export function normalizeHeaderName(raw: string): string {
  return raw
    .replace(/^\uFEFF/, '')
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, '_');
}

/**
 * RFC 4180 compliant CSV parser using Map per row to prevent prototype pollution.
 */
export function parseCsvText(csvText: string): ParsedCsvData {
  if (typeof csvText !== 'string') {
    throw new Error('CSV payload must be plain UTF-8 text.');
  }
  const cleaned = csvText.replace(/^\uFEFF/, '');
  if (!cleaned.trim()) {
    throw new Error('The uploaded CSV file is empty.');
  }
  if (Buffer.byteLength(cleaned, 'utf8') > MAX_CSV_BYTES) {
    throw new Error('CSV file exceeds the 1.5 MB limit.');
  }

  const records: string[][] = [];
  let currentRow: string[] = [];
  let currentField = '';
  let inQuotes = false;

  for (let i = 0; i < cleaned.length; i += 1) {
    const ch = cleaned[i];
    if (inQuotes) {
      if (ch === '"') {
        if (cleaned[i + 1] === '"') {
          currentField += '"';
          i += 1;
        } else {
          inQuotes = false;
        }
      } else {
        currentField += ch;
      }
    } else if (ch === '"') {
      inQuotes = true;
    } else if (ch === ',') {
      currentRow.push(currentField);
      currentField = '';
    } else if (ch === '\r') {
      if (cleaned[i + 1] === '\n') {
        i += 1;
      }
      currentRow.push(currentField);
      records.push(currentRow);
      currentRow = [];
      currentField = '';
    } else if (ch === '\n') {
      currentRow.push(currentField);
      records.push(currentRow);
      currentRow = [];
      currentField = '';
    } else {
      currentField += ch;
    }
  }

  if (inQuotes) {
    throw new Error('Malformed CSV: unclosed quoted field detected.');
  }

  if (currentField.length > 0 || currentRow.length > 0) {
    currentRow.push(currentField);
    records.push(currentRow);
  }

  const nonEmptyRecords = records.filter((row) => row.some((cell) => cell.trim() !== ''));
  if (nonEmptyRecords.length < 2) {
    throw new Error('CSV must include a header row and at least one data row.');
  }

  const headers = nonEmptyRecords[0].map(normalizeHeaderName);
  if (headers.some((h) => !h)) {
    throw new Error('CSV header row contains an empty column name.');
  }

  const dataRows = nonEmptyRecords.slice(1);
  if (dataRows.length > MAX_CSV_ROWS) {
    throw new Error(`CSV exceeds the maximum of ${MAX_CSV_ROWS} rows per import.`);
  }

  const rows: Map<string, string>[] = dataRows.map((cells) => {
    const rowMap = new Map<string, string>();
    for (let idx = 0; idx < headers.length; idx += 1) {
      const header = headers[idx];
      if (!rowMap.has(header)) {
        rowMap.set(header, (cells[idx] ?? '').trim());
      }
    }
    return rowMap;
  });

  return { headers, rows };
}
