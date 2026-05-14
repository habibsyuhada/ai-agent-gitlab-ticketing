import { Locator, Page } from 'playwright';
import { ParsedTicket } from '@/types/ticket';

const HELPDESK_LIST_URL = 'https://iss.smoebatam.com/helpdesk/it/it_helpdesk';

interface CandidateRow {
  ticketId: string;
  description: string;
  requestor: string;
  assign: string;
  status: string;
  checkboxLocator: Locator;
}

async function filterByStatus(page: Page, statusCode: string): Promise<void> {
  await page.selectOption('select[name="stat_req"]', statusCode);
  await page.click('button[type="submit"]:has-text("Search")');
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(1000);
}

function normalizeText(value: string): string {
  return value.toLowerCase().replace(/\s+/g, ' ').trim();
}

function getDescriptionKey(description: string): string {
  const trimmed = description.trim();
  const separatorIndex = trimmed.indexOf(' - ');

  if (separatorIndex > 0) {
    return trimmed.slice(0, separatorIndex).trim();
  }

  return trimmed.split(/\s+/).slice(0, 4).join(' ').trim();
}

function descriptionMatches(rowDescription: string, ticketDescription: string): boolean {
  const rowText = normalizeText(rowDescription);
  const ticketText = normalizeText(ticketDescription);
  const descriptionKey = normalizeText(getDescriptionKey(ticketDescription));

  if (descriptionKey && rowText.includes(descriptionKey)) {
    return true;
  }

  if (ticketText && (rowText.includes(ticketText) || ticketText.includes(rowText))) {
    return true;
  }

  const significantText = ticketText.slice(0, 80).trim();
  return significantText.length > 0 && rowText.includes(significantText);
}

function statusMatches(status: string): boolean {
  const normalizedStatus = normalizeText(status);
  return normalizedStatus === 'on process' || normalizedStatus === 'on progress';
}

function assignMatches(rowAssign: string, ticketAssign: string): boolean {
  const rowText = normalizeText(rowAssign);
  const ticketText = normalizeText(ticketAssign);

  return rowText === ticketText || rowText.includes(ticketText) || ticketText.includes(rowText);
}

async function setMaxPageLength(page: Page): Promise<string> {
  const lengthSelect = page.locator('select[id^="dt-length"], select[name="dataTable_length"]').first();

  if ((await lengthSelect.count()) === 0) {
    console.log('DataTables length select not found; using current page length');
    return 'current';
  }

  const options = await lengthSelect.evaluate((select) => {
    const selectEl = select as HTMLSelectElement;
    return Array.from(selectEl.options)
      .map((option) => option.value)
      .filter((value) => /^\d+$/.test(value));
  });

  const maxLength = options.map(Number).sort((a, b) => b - a)[0];

  if (!maxLength) {
    console.log('No numeric DataTables length options found; using current page length');
    return 'current';
  }

  await lengthSelect.selectOption(String(maxLength));
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(1000);

  return String(maxLength);
}

async function searchDataTable(page: Page, searchText: string): Promise<void> {
  const searchInput = page.locator('input[type="search"], input[aria-controls="dataTable"]').first();
  await searchInput.waitFor({ state: 'visible', timeout: 5000 });
  await searchInput.fill('');
  await searchInput.fill(searchText);
  await page.waitForLoadState('networkidle').catch(() => null);
  await page.waitForTimeout(1000);
}

async function clearDataTableSearch(page: Page): Promise<void> {
  const searchInput = page.locator('input[type="search"], input[aria-controls="dataTable"]').first();

  if ((await searchInput.count()) === 0) {
    return;
  }

  await searchInput.fill('');
  await page.waitForLoadState('networkidle').catch(() => null);
  await page.waitForTimeout(500);
}

async function getVisibleCandidateRows(page: Page): Promise<CandidateRow[]> {
  const candidates: CandidateRow[] = [];
  const rows = page.locator('#dataTable tbody tr');
  const rowCount = await rows.count();

  for (let i = 0; i < rowCount; i++) {
    const row = rows.nth(i);
    const cells = row.locator('td');

    if ((await cells.count()) < 13) {
      continue;
    }

    const checkbox = row.locator('input.checkbox:not([disabled])').first();

    if ((await checkbox.count()) === 0) {
      continue;
    }

    candidates.push({
      ticketId: (await checkbox.getAttribute('value')) || ((await cells.nth(1).textContent())?.trim() || ''),
      description: (await cells.nth(4).textContent())?.trim().replace(/\s+/g, ' ') || '',
      requestor: (await cells.nth(5).textContent())?.trim().replace(/\s+/g, ' ') || '',
      assign: (await cells.nth(8).textContent())?.trim().replace(/\s+/g, ' ') || '',
      status: (await cells.nth(12).textContent())?.trim().replace(/\s+/g, ' ') || '',
      checkboxLocator: checkbox,
    });
  }

  return candidates;
}

async function hasNextPage(page: Page): Promise<boolean> {
  const nextButton = page.locator('.dt-paging-button.next:not(.disabled)');
  return (await nextButton.count()) > 0;
}

async function goToNextPage(page: Page): Promise<void> {
  await page.click('.dt-paging-button.next:not(.disabled)');
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(1000);
}

async function findTicketForAssign(
  page: Page,
  ticket: ParsedTicket,
  diagnostics: CandidateRow[]
): Promise<CandidateRow | null> {
  const descriptionKey = getDescriptionKey(ticket.Description);

  while (true) {
    const candidates = await getVisibleCandidateRows(page);
    diagnostics.push(...candidates);

    const matchedCandidate = candidates.find((candidate) =>
      assignMatches(candidate.assign, ticket.Assign) &&
      statusMatches(candidate.status) &&
      descriptionMatches(candidate.description, ticket.Description)
    );

    if (matchedCandidate) {
      console.log(`Found ticket ${matchedCandidate.ticketId} for key "${descriptionKey}"`);
      return matchedCandidate;
    }

    if (!(await hasNextPage(page))) {
      return null;
    }

    await goToNextPage(page);
  }
}

function groupTicketsByAssign(tickets: ParsedTicket[]): Map<string, ParsedTicket[]> {
  const groupedTickets = new Map<string, ParsedTicket[]>();

  for (const ticket of tickets) {
    const assign = ticket.Assign.trim();
    const existingTickets = groupedTickets.get(assign) || [];
    existingTickets.push(ticket);
    groupedTickets.set(assign, existingTickets);
  }

  return groupedTickets;
}

function logNotFoundDiagnostics(ticket: ParsedTicket, candidates: CandidateRow[]): void {
  const descriptionKey = getDescriptionKey(ticket.Description);
  const uniqueCandidates = candidates
    .filter((candidate, index, allCandidates) =>
      allCandidates.findIndex((item) => item.ticketId === candidate.ticketId) === index
    )
    .slice(0, 10);

  console.log(
    `Ticket not found for key "${descriptionKey}" assigned to "${ticket.Assign}". ` +
    `Visible candidates: ${uniqueCandidates.length}`
  );

  for (const candidate of uniqueCandidates) {
    console.log(
      `Candidate ${candidate.ticketId}: "${candidate.description}" | ` +
      `Requestor: "${candidate.requestor}" | Assign: "${candidate.assign}" | Status: "${candidate.status}"`
    );
  }
}

async function solveTicket(
  page: Page,
  checkboxLocator: Locator
): Promise<{ success: boolean; error?: string }> {
  try {
    await checkboxLocator.check();
    await page.waitForTimeout(500);

    await page.selectOption('#stat_req', '2');
    await page.waitForTimeout(500);

    await page.click('.btnSubmit:not([disabled])');
    await page.waitForTimeout(500);

    const confirmButton = page.locator('.swal2-confirm');
    await confirmButton.waitFor({ state: 'visible', timeout: 5000 });
    await confirmButton.click();

    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1000);

    return { success: true };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error('Failed to solve ticket:', errorMessage);
    return { success: false, error: errorMessage };
  }
}

export async function solveAllTickets(
  page: Page,
  tickets: ParsedTicket[]
): Promise<{ successCount: number; failedCount: number; notFoundCount: number }> {
  let successCount = 0;
  let failedCount = 0;
  let notFoundCount = 0;

  await page.goto(HELPDESK_LIST_URL, { waitUntil: 'networkidle' });
  await page.waitForTimeout(1000);

  await filterByStatus(page, '1');

  const selectedPageLength = await setMaxPageLength(page);
  const ticketsByAssign = groupTicketsByAssign(tickets);

  for (const [assign, assignedTickets] of ticketsByAssign) {
    console.log(
      `Processing assign "${assign}" with ${assignedTickets.length} ticket(s). ` +
      `Entries per page: ${selectedPageLength}`
    );

    for (const ticket of assignedTickets) {
      const descriptionKey = getDescriptionKey(ticket.Description);
      const diagnostics: CandidateRow[] = [];

      await filterByStatus(page, '1');
      await setMaxPageLength(page);
      await searchDataTable(page, assign);

      const initialCandidateCount = await page.locator('#dataTable tbody tr').count();
      console.log(
        `Searching assign "${assign}" for key "${descriptionKey}". ` +
        `Rows shown: ${initialCandidateCount}`
      );

      const matchedCandidate = await findTicketForAssign(page, ticket, diagnostics);

      if (!matchedCandidate) {
        notFoundCount++;
        logNotFoundDiagnostics(ticket, diagnostics);
        continue;
      }

      console.log(
        `Solving ticket ${matchedCandidate.ticketId}: ` +
        `${ticket.Description.substring(0, 50)}...`
      );

      const result = await solveTicket(page, matchedCandidate.checkboxLocator);

      if (result.success) {
        successCount++;
        console.log(`Ticket ${matchedCandidate.ticketId} solved successfully`);
      } else {
        failedCount++;
        console.error(`Failed to solve ticket ${matchedCandidate.ticketId}: ${result.error}`);
      }
    }
  }

  await clearDataTableSearch(page);

  console.log(`Solve complete: ${successCount} success, ${failedCount} failed, ${notFoundCount} not found`);

  return { successCount, failedCount, notFoundCount };
}
