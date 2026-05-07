import { NextRequest, NextResponse } from 'next/server';
import { parseExcelFile } from '@/lib/excel';
import { validateTicketRow } from '@/lib/validation';
import { ParsedTicket } from '@/types/ticket';

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File;

    if (!file) {
      return NextResponse.json(
        { error: 'No file provided' },
        { status: 400 }
      );
    }

    // Check file type
    if (!file.name.endsWith('.xlsx') && !file.name.endsWith('.xls')) {
      return NextResponse.json(
        { error: 'Invalid file type. Please upload an Excel file (.xlsx or .xls)' },
        { status: 400 }
      );
    }

    // Convert file to buffer
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // Parse Excel file
    const rows = parseExcelFile(buffer);

    // Validate rows
    const parsedTickets: ParsedTicket[] = rows.map((row) => {
      const validationResult = validateTicketRow(row);
      return {
        ...row,
        validationResult,
        status: 'pending' as const,
      };
    });

    // Count valid and invalid rows
    const validRows = parsedTickets.filter(t => t.validationResult.isValid);
    const invalidRows = parsedTickets.filter(t => !t.validationResult.isValid);

    return NextResponse.json({
      success: true,
      data: {
        rows: parsedTickets,
        summary: {
          total: parsedTickets.length,
          valid: validRows.length,
          invalid: invalidRows.length,
        },
      },
    });

  } catch (error) {
    console.error('Error parsing Excel file:', error);
    return NextResponse.json(
      {
        error: 'Failed to parse Excel file',
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}
