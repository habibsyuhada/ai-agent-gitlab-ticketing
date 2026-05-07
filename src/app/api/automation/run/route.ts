import { NextRequest, NextResponse } from 'next/server';
import { runHelpdeskAutomation } from '@/lib/helpdesk-rpa';
import { createLogger } from '@/lib/logger';
import { ParsedTicket, AutomationOptions } from '@/types/ticket';

export async function POST(request: NextRequest) {
  const logger = createLogger(`api-${Date.now()}`);

  try {
    const body = await request.json();

    const { rows, options } = body as {
      rows: ParsedTicket[];
      options: AutomationOptions;
    };

    if (!rows || !Array.isArray(rows)) {
      return NextResponse.json(
        { error: 'Invalid request: rows array is required' },
        { status: 400 }
      );
    }

    if (!options) {
      return NextResponse.json(
        { error: 'Invalid request: options object is required' },
        { status: 400 }
      );
    }

    logger.info('Starting automation', {
      rowCount: rows.length,
      options,
    });

    // Run automation
    const result = await runHelpdeskAutomation(
      rows,
      options,
      (current, total, currentRow) => {
        logger.info(`Processing row ${current}/${total}`, {
          requestor: currentRow.Requestor,
          status: currentRow.status,
        });
      }
    );

    logger.info('Automation completed', {
      successCount: result.successCount,
      failedCount: result.failedCount,
      skippedCount: result.skippedCount,
      duration: result.duration,
    });

    return NextResponse.json({
      success: true,
      data: result,
    });

  } catch (error) {
    logger.error('Automation failed', error);

    return NextResponse.json(
      {
        error: 'Automation failed',
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}
