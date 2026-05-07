export interface TicketRow {
  type: string;
  Category: string;
  Requestor: string;
  ComputerName: string;
  Department: string;
  Location: string;
  Project: string;
  Description: string;
  Priority: string;
  Assign: string;
  _rowIndex?: number;
}

export interface ValidationResult {
  isValid: boolean;
  errors: Record<string, string>;
  missingFields: string[];
}

export interface ParsedTicket extends TicketRow {
  validationResult: ValidationResult;
  status: 'pending' | 'processing' | 'success' | 'failed' | 'dry_run_success';
  error?: string;
  screenshotPath?: string;
  timestamp?: string;
}

export interface AutomationOptions {
  dryRun: boolean;
  headless: boolean;
  delayMs: number;
  startRow?: number;
  endRow?: number;
}

export interface AutomationResult {
  runId: string;
  totalRows: number;
  successCount: number;
  failedCount: number;
  skippedCount: number;
  rows: ParsedTicket[];
  startTime: string;
  endTime: string;
  duration: number;
}

export interface SelectOption {
  value: string;
  label: string;
}
