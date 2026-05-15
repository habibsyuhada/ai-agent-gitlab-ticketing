import { chromium, Browser, Page, BrowserContext } from 'playwright';
import { TicketRow, AutomationOptions, ParsedTicket, AutomationResult } from '@/types/ticket';
import { textEquals } from './validation';
import { randomUUID } from 'crypto';
import path from 'path';
import fs from 'fs/promises';
import { solveAllTickets } from './helpdesk-ai-solve';
import { getHelpdeskHostname, getHelpdeskNewTicketUrl } from './helpdesk-config';

export async function createBrowser(options: AutomationOptions): Promise<{ browser: Browser; context: BrowserContext; page: Page }> {
  const browser = await chromium.launch({
    headless: options.headless,
    slowMo: options.headless ? 0 : 200,
    chromiumSandbox: false,
    args: ['--disable-crash-reporter'],
  });

  const sessionDir = path.join(process.cwd(), 'automation-logs', 'session');
  const authStatePath = path.join(sessionDir, 'auth-state.json');

  await fs.mkdir(sessionDir, { recursive: true });

  const context = await browser.newContext({
    viewport: { width: 1280, height: 720 },
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  });

  const hasExistingAuth = await fileExists(authStatePath);
  if (hasExistingAuth) {
    console.log('Loading saved cookies from previous session...');

    try {
      const authState = JSON.parse(await fs.readFile(authStatePath, 'utf-8'));

      if (authState.cookies && authState.cookies.length > 0) {
        const normalizedCookies = normalizeCookiesForTarget(authState.cookies, getHelpdeskNewTicketUrl());

        await context.addCookies(normalizedCookies);

        console.log(`Loaded ${normalizedCookies.length} cookies`);

        const authCookies = normalizedCookies.filter((c: any) =>
          c.name.toLowerCase().includes('portal_user') ||
          c.name.toLowerCase().includes('ci_session') ||
          c.name.toLowerCase().includes('session') ||
          c.name.toLowerCase().includes('csrf')
        );

        if (authCookies.length > 0) {
          console.log(`Auth cookies: ${authCookies.map((c: any) => c.name).join(', ')}`);
        }
      }
    } catch (error) {
      console.error('Failed to load cookies:', error);
      console.log('Will require manual login');
    }
  } else {
    console.log('No saved cookies found - will require manual login');
  }

  const page = await context.newPage();

  const finalCookies = await context.cookies();
  const portalUserCookie = finalCookies.find((c: any) => c.name === 'portal_user');

  if (portalUserCookie) {
    console.log('portal_user cookie is present - should stay logged in');
  } else if (hasExistingAuth) {
    console.log('Warning: portal_user cookie not found. May need to login again.');
    if (process.env.DEBUG === 'true') {
      console.log('Current cookies:', finalCookies.map((c: any) => c.name).join(', '));
    }
  }

  return { browser, context, page };
}

function normalizeCookiesForTarget(cookies: any[], targetUrl: string): any[] {
  const targetDomain = new URL(targetUrl).hostname;
  const normalized: any[] = [];

  for (const cookie of cookies) {
    const normalizedCookie: any = { ...cookie };

    if (cookie.domain) {
      const cookieDomain = cookie.domain.replace(/^\./, '');

      if (!targetDomain.endsWith(cookieDomain)) {
        normalizedCookie.domain = getHelpdeskHostname();
      }
    }

    normalized.push(normalizedCookie);
  }

  return normalized;
}

async function fileExists(filePath: string): Promise<boolean> {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

export async function waitForManualLoginIfNeeded(page: Page): Promise<void> {
  await page.goto(getHelpdeskNewTicketUrl(), { waitUntil: 'networkidle' });

  const currentUrl = page.url();

  if (!currentUrl.includes('/helpdesk/it/new_helpdesk')) {
    console.log('Not on helpdesk form page. Please login manually.');
    console.log('Waiting for login...');

    await page.waitForURL(
      (url: URL) => url.toString().includes('/helpdesk/it/new_helpdesk'),
      { timeout: 0 }
    );

    console.log('Login detected. Proceeding with automation...');
  }
}

export async function selectByLabelOrValue(page: Page, selector: string, value: string): Promise<boolean> {
  try {
    const select = page.locator(selector).first();

    await select.waitFor({ state: 'attached', timeout: 5000 });

    const options = await select.evaluate((el) => {
      const selectEl = el as HTMLSelectElement;
      return Array.from(selectEl.options).map((opt: HTMLOptionElement) => ({
        value: opt.value,
        text: opt.text,
      }));
    });

    const matchedOption = options.find((opt: any) =>
      textEquals(opt.text, value) || textEquals(opt.value, value)
    );

    if (matchedOption) {
      await select.selectOption(matchedOption.value);
      await select.evaluate((el) => {
        const selectEl = el as HTMLSelectElement;
        selectEl.dispatchEvent(new Event('change', { bubbles: true }));
        selectEl.dispatchEvent(new Event('input', { bubbles: true }));
      });
      return true;
    }

    console.log(`No matching option found for "${value}" using ${selector}. Trying Select2 fallback...`);

    const select2Container = page.locator(`${selector} + .select2, ${selector} ~ .select2`).first();

    if (await select2Container.count() > 0) {
      const select2Trigger = select2Container.locator('.select2-selection').first();
      await select2Trigger.click();

      const dropdown = page.locator('.select2-dropdown-open .select2-search__field').first();
      await dropdown.waitFor({ state: 'visible', timeout: 2000 });

      await dropdown.fill(value);

      await page.waitForTimeout(300);

      await dropdown.press('Enter');

      await page.waitForTimeout(200);

      return true;
    }

    console.error(`Failed to select value "${value}" for ${selector}`);
    return false;
  } catch (error) {
    console.error(`Error selecting value "${value}" for ${selector}:`, error);
    return false;
  }
}

export async function fillInputIfValue(page: Page, selector: string, value: string): Promise<boolean> {
  try {
    const input = page.locator(selector).first();
    await input.waitFor({ state: 'attached', timeout: 5000 });
    await input.fill(value);
    await input.evaluate((el) => {
      const inputEl = el as HTMLInputElement;
      inputEl.dispatchEvent(new Event('input', { bubbles: true }));
      inputEl.dispatchEvent(new Event('change', { bubbles: true }));
    });
    return true;
  } catch (error) {
    console.error(`Error filling input ${selector} with value "${value}":`, error);
    return false;
  }
}

export async function createHelpdeskTicket(
  page: Page,
  ticket: TicketRow,
  options: AutomationOptions,
  screenshotDir: string,
  rowIndex: number
): Promise<{ success: boolean; error?: string; screenshotPath?: string }> {
  try {
    console.log(`Processing row ${rowIndex}: ${ticket.Requestor}`);

    await page.goto(getHelpdeskNewTicketUrl(), { waitUntil: 'networkidle' });

    await page.waitForSelector('form', { timeout: 10000 });

    await selectByLabelOrValue(page, 'select[name="type"]', ticket.type);
    await selectByLabelOrValue(page, 'select[name="cat_id"]', ticket.Category);
    await fillInputIfValue(page, 'input[name="requestor"]', ticket.Requestor);
    await fillInputIfValue(page, 'input[name="comp_name"]', ticket.ComputerName);
    await selectByLabelOrValue(page, 'select[name="dept"]', ticket.Department);
    await selectByLabelOrValue(page, 'select[name="loc"]', ticket.Location);
    await selectByLabelOrValue(page, 'select[name="project"]', ticket.Project);

    const descSelector = 'textarea[name="description"], #description';
    await fillInputIfValue(page, descSelector, ticket.Description);

    await selectByLabelOrValue(page, 'select[name="prior"]', ticket.Priority || 'Medium');
    await selectByLabelOrValue(page, 'select[name="assign"]', ticket.Assign);

    const screenshotPath = path.join(screenshotDir, `row-${rowIndex}-before-submit.png`);
    await page.screenshot({ path: screenshotPath, fullPage: true });

    if (options.dryRun) {
      console.log(`Row ${rowIndex}: Dry run - skipping submit`);
      return { success: true, screenshotPath };
    }

    const submitButton = page.locator('button[type="submit"], input[type="submit"]').filter({ hasText: /submit/i }).first();

    await Promise.all([
      page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => null),
      submitButton.click(),
    ]);

    const errorSelector = '.alert-danger, .error, .alert-error, text-danger';
    const hasError = await page.locator(errorSelector).count();

    if (hasError > 0) {
      const errorText = await page.locator(errorSelector).first().textContent();
      throw new Error(`Form submission error: ${errorText}`);
    }

    const currentUrl = page.url();
    if (currentUrl.includes('new_helpdesk')) {
      const pageText = await page.textContent('body');
      if (pageText?.toLowerCase().includes('error') || pageText?.toLowerCase().includes('failed')) {
        throw new Error('Form submission may have failed - error detected on page');
      }
    }

    console.log(`Row ${rowIndex}: Successfully submitted ticket for ${ticket.Requestor}`);
    return { success: true, screenshotPath };

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error(`Row ${rowIndex}: Failed - ${errorMessage}`);

    const failureScreenshotPath = path.join(screenshotDir, `row-${rowIndex}-failure.png`);
    try {
      await page.screenshot({ path: failureScreenshotPath, fullPage: true });
    } catch (screenshotError) {
      console.error('Failed to take screenshot:', screenshotError);
    }

    return {
      success: false,
      error: errorMessage,
      screenshotPath: failureScreenshotPath
    };
  }
}

export async function runHelpdeskAutomation(
  rows: ParsedTicket[],
  options: AutomationOptions,
  onProgress?: (current: number, total: number, currentRow: ParsedTicket) => void
): Promise<AutomationResult> {
  const runId = randomUUID();
  const startTime = new Date().toISOString();

  const logsDir = path.join(process.cwd(), 'automation-logs');
  const screenshotDir = path.join(logsDir, 'screenshots', runId);
  const runsDir = path.join(logsDir, 'runs');

  await fs.mkdir(screenshotDir, { recursive: true });
  await fs.mkdir(runsDir, { recursive: true });

  let successCount = 0;
  let failedCount = 0;
  let skippedCount = 0;
  let solveSuccessCount = 0;
  let solveFailedCount = 0;
  let solveNotFoundCount = 0;

  const { browser, context, page } = await createBrowser(options);

  try {
    await waitForManualLoginIfNeeded(page);

    let filteredRows = rows.filter(row => row.validationResult.isValid);

    if (options.startRow !== undefined || options.endRow !== undefined) {
      const start = options.startRow || 0;
      const end = options.endRow || filteredRows.length;
      filteredRows = filteredRows.slice(start, end);
    }

    skippedCount = rows.length - filteredRows.length;

    console.log(`Starting automation: ${filteredRows.length} valid rows to process`);

    // Phase 1: Create tickets
    for (let i = 0; i < filteredRows.length; i++) {
      const row = filteredRows[i];
      const rowIndex = row._rowIndex || i + 1;

      row.status = 'processing';
      row.timestamp = new Date().toISOString();

      if (onProgress) {
        onProgress(i + 1, filteredRows.length, row);
      }

      const result = await createHelpdeskTicket(page, row, options, screenshotDir, rowIndex);

      if (result.success) {
        row.status = options.dryRun ? 'dry_run_success' : 'success';
        successCount++;
      } else {
        row.status = 'failed';
        row.error = result.error;
        row.screenshotPath = result.screenshotPath;
        failedCount++;
      }

      if (i < filteredRows.length - 1 && options.delayMs > 0) {
        await page.waitForTimeout(options.delayMs);
      }
    }

    // Phase 2: Solve tickets
    if (options.solveAfterInsert && !options.dryRun && successCount > 0) {
      console.log('Starting solve phase...');

      const solvedRows = filteredRows.filter(
        (row: ParsedTicket) => row.status === 'success' || row.status === 'dry_run_success'
      );

      const solveResult = await solveAllTickets(page, solvedRows);
      solveSuccessCount = solveResult.successCount;
      solveFailedCount = solveResult.failedCount;
      solveNotFoundCount = solveResult.notFoundCount;

      console.log(`Solve phase complete: ${solveSuccessCount} solved, ${solveFailedCount} failed, ${solveNotFoundCount} not found`);
    } else if (options.solveAfterInsert && options.dryRun) {
      console.log('Dry run mode - skipping solve phase');
    }

    const endTime = new Date().toISOString();
    const duration = new Date(endTime).getTime() - new Date(startTime).getTime();

    const result: AutomationResult = {
      runId,
      totalRows: rows.length,
      successCount,
      failedCount,
      skippedCount,
      rows: filteredRows,
      startTime,
      endTime,
      duration,
      solveSuccessCount: options.solveAfterInsert ? solveSuccessCount : undefined,
      solveFailedCount: options.solveAfterInsert ? solveFailedCount : undefined,
      solveNotFoundCount: options.solveAfterInsert ? solveNotFoundCount : undefined,
    };

    const resultPath = path.join(runsDir, `${runId}.json`);
    await fs.writeFile(resultPath, JSON.stringify(result, null, 2));

    const sessionDir = path.join(process.cwd(), 'automation-logs', 'session');
    const authStatePath = path.join(sessionDir, 'auth-state.json');

    await context.storageState({ path: authStatePath });
    console.log(`Cookies and storage saved to: ${authStatePath}`);

    const finalCookies = await context.cookies();
    console.log(`Saved ${finalCookies.length} cookies`);

    if (process.env.DEBUG === 'true') {
      const authCookies = finalCookies.filter((c: any) =>
        c.name.toLowerCase().includes('session') ||
        c.name.toLowerCase().includes('auth') ||
        c.name.toLowerCase().includes('token') ||
        c.name.toLowerCase().includes('phpsessid') ||
        c.name.toLowerCase().includes('ci_session')
      );

      if (authCookies.length > 0) {
        console.log('Authentication cookies found:', authCookies.map((c: any) => c.name).join(', '));
      }
    }

    console.log(`Automation completed: ${successCount} success, ${failedCount} failed, ${skippedCount} skipped`);

    return result;

  } finally {
    await context.close();
    await browser.close();
  }
}
