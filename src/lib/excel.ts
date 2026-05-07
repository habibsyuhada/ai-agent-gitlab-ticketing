import * as XLSX from 'xlsx';
import { TicketRow, ParsedTicket } from '@/types/ticket';

export function normalizeHeader(header: string): string {
  return header
    .trim()
    .replace(/[_\s]+/g, '')
    .toLowerCase();
}

export function normalizeValue(value: unknown): string {
  if (value === null || value === undefined) return '';
  if (typeof value === 'string') return value.trim();
  if (typeof value === 'number') return value.toString();
  return String(value);
}

export function parseExcelFile(buffer: Buffer): TicketRow[] {
  const workbook = XLSX.read(buffer, { type: 'buffer' });
  const sheetName = workbook.SheetNames[0];
  const worksheet = workbook.Sheets[sheetName];
  const rawData = XLSX.utils.sheet_to_json(worksheet, { header: 1 }) as (string | number)[][];

  if (rawData.length < 2) {
    throw new Error('Excel file must have at least a header row and one data row');
  }

  const headers = rawData[0] as string[];
  const dataRows = rawData.slice(1);

  // Create a mapping from normalized headers to original headers
  const headerMap = new Map<string, string>();
  headers.forEach(header => {
    const normalized = normalizeHeader(header);
    headerMap.set(normalized, header);
  });

  const requiredFields = [
    'type',
    'category',
    'requestor',
    'computername',
    'department',
    'location',
    'project',
    'description',
    'priority',
    'assign'
  ];

  // Check if all required fields exist
  const missingFields = requiredFields.filter(field => !headerMap.has(field));
  if (missingFields.length > 0) {
    throw new Error(`Missing required columns: ${missingFields.join(', ')}`);
  }

  const rows: TicketRow[] = dataRows.map((row, index) => {
    const ticketRow: any = { _rowIndex: index + 2 }; // +2 because Excel is 1-indexed and header is row 1

    headers.forEach((header, colIndex) => {
      const normalized = normalizeHeader(header);
      const value = row[colIndex];

      switch (normalized) {
        case 'type':
          ticketRow.type = normalizeValue(value);
          break;
        case 'category':
          ticketRow.Category = normalizeValue(value);
          break;
        case 'requestor':
          ticketRow.Requestor = normalizeValue(value);
          break;
        case 'computername':
          ticketRow.ComputerName = normalizeValue(value);
          break;
        case 'department':
          ticketRow.Department = normalizeValue(value);
          break;
        case 'location':
          ticketRow.Location = normalizeValue(value);
          break;
        case 'project':
          ticketRow.Project = normalizeValue(value);
          break;
        case 'description':
          ticketRow.Description = normalizeValue(value);
          break;
        case 'priority':
          ticketRow.Priority = normalizeValue(value);
          break;
        case 'assign':
          ticketRow.Assign = normalizeValue(value);
          break;
      }
    });

    return ticketRow as TicketRow;
  });

  return rows;
}
