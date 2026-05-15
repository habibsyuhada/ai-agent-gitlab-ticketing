import { NextRequest, NextResponse } from 'next/server';
import { runHelpdeskAutomation } from '@/lib/helpdesk-rpa';
import { createLogger } from '@/lib/logger';
import { generateTicketsFromHookCommitsWithMode, fetchUserById } from '@/lib/gitlab';
import { validateTicketRow } from '@/lib/validation';
import { ParsedTicket, AutomationOptions } from '@/types/ticket';
import { GitLabSystemHookPushPayload } from '@/types/gitlab';

export async function POST(request: NextRequest) {
  const logger = createLogger(`gitlab-hook-${Date.now()}`);

  try {
    const eventHeader = request.headers.get('x-gitlab-event');
    if (eventHeader !== 'System Hook') {
      return NextResponse.json(
        { error: 'Invalid hook event header', details: 'Expected X-Gitlab-Event: System Hook' },
        { status: 400 }
      );
    }

    const body = (await request.json()) as GitLabSystemHookPushPayload;

    if (body.event_name !== 'push') {
      return NextResponse.json(
        { error: 'Invalid event', details: 'Only push event is supported' },
        { status: 400 }
      );
    }

    if (!body.project_id || !body.user_id || !Array.isArray(body.commits)) {
      return NextResponse.json(
        {
          error: 'Invalid request payload',
          details: 'project_id, user_id, and commits[] are required',
        },
        { status: 400 }
      );
    }

    const gitlabUser = await fetchUserById(body.user_id);
    const assignName = gitlabUser?.name?.trim();

    if (!assignName) {
      return NextResponse.json(
        {
          error: 'Failed to resolve assign name',
          details: `GitLab user ${body.user_id} has no valid name`,
        },
        { status: 500 }
      );
    }

    const ticketRows = await generateTicketsFromHookCommitsWithMode(body.commits, assignName, true);

    const parsedTickets: ParsedTicket[] = ticketRows.map((ticket, index) => {
      const validationResult = validateTicketRow(ticket);
      return {
        ...ticket,
        validationResult,
        status: 'pending' as const,
        _rowIndex: index + 1,
      };
    });

    const validRows = parsedTickets.filter((t) => t.validationResult.isValid);
    const invalidRows = parsedTickets.filter((t) => !t.validationResult.isValid);

    const parseSummary = {
      total: parsedTickets.length,
      valid: validRows.length,
      invalid: invalidRows.length,
    };

    if (validRows.length === 0) {
      return NextResponse.json({
        success: true,
        data: {
          metadata: {
            project_id: body.project_id,
            user_id: body.user_id,
            assignName,
            commitCount: body.commits.length,
            ref: body.ref || null,
          },
          parseSummary,
          automationSummary: null,
          details: 'No valid rows to process. Automation skipped.',
        },
      });
    }

    const options: AutomationOptions = {
      dryRun: false,
      headless: true,
      delayMs: 3000,
      useAI: true,
      solveAfterInsert: true,
    };

    logger.info('Starting hook automation', {
      projectId: body.project_id,
      userId: body.user_id,
      assignName,
      commitCount: body.commits.length,
      rowCount: validRows.length,
      options,
    });

    const result = await runHelpdeskAutomation(validRows, options, (current, total, currentRow) => {
      logger.info(`Processing hook row ${current}/${total}`, {
        requestor: currentRow.Requestor,
        status: currentRow.status,
      });
    });

    return NextResponse.json({
      success: true,
      data: {
        metadata: {
          project_id: body.project_id,
          user_id: body.user_id,
          assignName,
          commitCount: body.commits.length,
          ref: body.ref || null,
        },
        parseSummary,
        automationSummary: {
          totalRows: result.totalRows,
          successCount: result.successCount,
          failedCount: result.failedCount,
          skippedCount: result.skippedCount,
          solveSuccessCount: result.solveSuccessCount || 0,
          solveFailedCount: result.solveFailedCount || 0,
          solveNotFoundCount: result.solveNotFoundCount || 0,
          duration: result.duration,
          runId: result.runId,
        },
      },
    });
  } catch (error) {
    logger.error('GitLab hook import failed', error);
    return NextResponse.json(
      {
        error: 'GitLab hook import failed',
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}
