import { NextRequest, NextResponse } from 'next/server';
import { GitLabParseRequest } from '@/types/gitlab';
import {
  fetchUserEvents,
  generateTicketsFromCommits,
  adjustDate,
} from '@/lib/gitlab';
import { validateTicketRow } from '@/lib/validation';
import { ParsedTicket } from '@/types/ticket';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    const { fromDate, toDate, userIds } = body as GitLabParseRequest;

    if (!fromDate || !toDate || !userIds || !Array.isArray(userIds)) {
      return NextResponse.json(
        {
          error: 'Invalid request',
          details: 'fromDate, toDate, and userIds are required',
        },
        { status: 400 }
      );
    }

    if (userIds.length === 0) {
      return NextResponse.json(
        { error: 'Invalid request', details: 'At least one user ID is required' },
        { status: 400 }
      );
    }

    const fromDateObj = new Date(fromDate);
    const toDateObj = new Date(toDate);

    if (isNaN(fromDateObj.getTime()) || isNaN(toDateObj.getTime())) {
      return NextResponse.json(
        { error: 'Invalid request', details: 'Invalid date format' },
        { status: 400 }
      );
    }

    const afterDate = adjustDate(fromDateObj, -1);
    const beforeDate = adjustDate(toDateObj, 1);

    const allEvents: any[] = [];

    for (const userId of userIds) {
      try {
        const events = await fetchUserEvents(userId, afterDate, beforeDate);
        allEvents.push(...events);
      } catch (error) {
        console.error(`Failed to fetch events for user ${userId}:`, error);
      }
    }

    const tickets = await generateTicketsFromCommits(allEvents);

    const parsedTickets: ParsedTicket[] = tickets.map((ticket, index) => {
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
    console.error('Error processing GitLab data:', error);
    return NextResponse.json(
      {
        error: 'Failed to process GitLab data',
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}
