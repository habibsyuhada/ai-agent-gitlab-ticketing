import { z } from 'zod';
import { TicketRow, ValidationResult } from '@/types/ticket';

export const ticketSchema = z.object({
  type: z.string().min(1, 'Type is required'),
  Category: z.string().min(1, 'Category is required'),
  Requestor: z.string().min(1, 'Requestor is required'),
  ComputerName: z.string().min(1, 'Computer Name is required'),
  Department: z.string().min(1, 'Department is required'),
  Location: z.string().min(1, 'Location is required'),
  Project: z.string().min(1, 'Project is required'),
  Description: z.string().min(1, 'Description is required'),
  Priority: z.string().optional(),
  Assign: z.string().min(1, 'Assign is required'),
});

export function validateTicketRow(ticket: TicketRow): ValidationResult {
  const result: ValidationResult = {
    isValid: true,
    errors: {},
    missingFields: [],
  };

  const requiredFields = [
    { key: 'type', label: 'Type' },
    { key: 'Category', label: 'Category' },
    { key: 'Requestor', label: 'Requestor' },
    { key: 'ComputerName', label: 'Computer Name' },
    { key: 'Department', label: 'Department' },
    { key: 'Location', label: 'Location' },
    { key: 'Project', label: 'Project' },
    { key: 'Description', label: 'Description' },
    { key: 'Assign', label: 'Assign' },
  ];

  requiredFields.forEach(field => {
    const value = ticket[field.key as keyof TicketRow];
    if (!value || String(value).trim() === '') {
      result.isValid = false;
      result.missingFields.push(field.label);
      result.errors[field.key] = `${field.label} is required`;
    }
  });

  return result;
}

export function normalizeText(value: unknown): string {
  if (value === null || value === undefined) return '';
  return String(value)
    .trim()
    .replace(/\s+/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&#(\d+);/g, (_, dec) => String.fromCharCode(parseInt(dec, 10)))
    .toLowerCase();
}

export function textEquals(a: string, b: string): boolean {
  return normalizeText(a) === normalizeText(b);
}
