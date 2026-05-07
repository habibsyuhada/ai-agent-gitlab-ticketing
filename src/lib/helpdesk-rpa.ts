import { chromium, Browser, Page, BrowserContext } from 'playwright';
import { TicketRow, AutomationOptions, ParsedTicket, AutomationResult } from '@/types/ticket';
import { textEquals } from './validation';
import { randomUUID } from 'crypto';
import path from 'path';
import fs from 'fs/promises';

const TARGET_URL = 'https://iss.smoebatam.com/helpdesk/it/new_helpdesk';
const FORM_ACTION_URL = 'https://iss.smoebatam.com/helpdesk/it/process_add_helpdesk';

export async function createBrowser(options: AutomationOptions): Promise<{ browser: Browser; context: BrowserContext; page: Page }> {
  const browser = await chromium.launch({
    headless: options.headless,
    slowMo: options.headless ? 0 : 200,
  });

  // Create persistent context to save session cookies
  const sessionDir = path.join(process.cwd(), 'automation-logs', 'session');
  const authStatePath = path.join(sessionDir, 'auth-state.json');

  await fs.mkdir(sessionDir, { recursive: true });

  const context = await browser.newContext({
    viewport: { width: 1280, height: 720 },
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  });

  // Load and apply cookies manually
  const hasExistingAuth = await fileExists(authStatePath);
  if (hasExistingAuth) {
    console.log('🔄 Loading saved cookies from previous session...');

    try {
      const authState = JSON.parse(await fs.readFile(authStatePath, 'utf-8'));

      if (authState.cookies && authState.cookies.length > 0) {
        // Normalize and add cookies for all relevant domains
        const normalizedCookies = normalizeCookiesForTarget(authState.cookies, TARGET_URL);

        await context.addCookies(normalizedCookies);

        console.log(`✅ Loaded ${normalizedCookies.length} cookies`);

        // Log specific auth cookies
        const authCookies = normalizedCookies.filter(c =>
          c.name.toLowerCase().includes('portal_user') ||
          c.name.toLowerCase().includes('ci_session') ||
          c.name.toLowerCase().includes('session') ||
          c.name.toLowerCase().includes('csrf')
        );

        if (authCookies.length > 0) {
          console.log(`🔑 Auth cookies: ${authCookies.map(c => c.name).join(', ')}`);
        }
      }
    } catch (error) {
      console.error('❌ Failed to load cookies:', error);
      console.log('🔐 Will require manual login');
    }
  } else {
    console.log('🔐 No saved cookies found - will require manual login');
  }

  const page = await context.newPage();

  // Verify cookies are actually set
  const finalCookies = await context.cookies();
  const portalUserCookie = finalCookies.find(c => c.name === 'portal_user');

  if (portalUserCookie) {
    console.log('✅ portal_user cookie is present - should stay logged in');
  } else if (hasExistingAuth) {
    console.log('⚠️  Warning: portal_user cookie not found. May need to login again.');
    if (process.env.DEBUG === 'true') {
      console.log('Current cookies:', finalCookies.map(c => c.name).join(', '));
    }
  }

  return { browser, context, page };
}

/**
 * Normalize cookies to ensure they work for the target domain
 * Handles domain mismatches (www vs non-www, subdomains, etc.)
 */
function normalizeCookiesForTarget(cookies: any[], targetUrl: string): any[] {
  const targetDomain = new URL(targetUrl).hostname;
  const normalized = [];

  for (const cookie of cookies) {
    // Create a copy of the cookie
    const normalizedCookie = { ...cookie };

    // Fix domain - ensure it matches or is a parent of target domain
    if (cookie.domain) {
      // If cookie domain is for smoebatam.com or www.smoebatam.com
      // and we're accessing iss.smoebatam.com, we need to adjust
      if (targetDomain.includes('smoebatam.com')) {
        // Set domain to the base domain for broader applicability
        normalizedCookie.domain = '.smoebatam.com';
      }
    }

    normalized.push(normalizedCookie);
  }

  return normalized;
}

// Helper function to check if file exists
async function fileExists(filePath: string): Promise<boolean> {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

export async function waitForManualLoginIfNeeded(page: Page): Promise<void> {
  await page.goto(TARGET_URL, { waitUntil: 'networkidle' });

  const currentUrl = page.url();

  // Check if we're on a login page (URL doesn't contain the helpdesk form URL)
  if (!currentUrl.includes('/helpdesk/it/new_helpdesk')) {
    console.log('Not on helpdesk form page. Please login manually.');
    console.log('Waiting for login...');

    // Wait for URL to change to the helpdesk form
    await page.waitForURL(
      (url) => url.toString().includes('/helpdesk/it/new_helpdesk'),
      { timeout: 0 } // No timeout - wait indefinitely for manual login
    );

    console.log('Login detected. Proceeding with automation...');
  }
}

export async function selectByLabelOrValue(page: Page, selector: string, value: string): Promise<boolean> {
  try {
    const select = page.locator(selector).first();

    // Wait for select to be attached and visible
    await select.waitFor({ state: 'attached', timeout: 5000 });

    // Get all options from the select
    const options = await select.evaluate((el) => {
      return Array.from(el.options).map(opt => ({
        value: opt.value,
        text: opt.text,
      }));
    });

    // Try to find matching option
    const matchedOption = options.find(opt =>
      textEquals(opt.text, value) || textEquals(opt.value, value)
    );

    if (matchedOption) {
      await select.selectOption(matchedOption.value);
      await select.evaluate((el) => {
        el.dispatchEvent(new Event('change', { bubbles: true }));
        el.dispatchEvent(new Event('input', { bubbles: true }));
      });
      return true;
    }

    // Fallback to Select2 UI
    console.log(`No matching option found for "${value}" using ${selector}. Trying Select2 fallback...`);

    // Find the Select2 container
    const select2Container = page.locator(`${selector} + .select2, ${selector} ~ .select2`).first();

    if (await select2Container.count() > 0) {
      // Click the Select2 dropdown
      const select2Trigger = select2Container.locator('.select2-selection').first();
      await select2Trigger.click();

      // Wait for dropdown to appear
      const dropdown = page.locator('.select2-dropdown-open .select2-search__field').first();
      await dropdown.waitFor({ state: 'visible', timeout: 2000 });

      // Type the search value
      await dropdown.fill(value);

      // Wait a bit for results to appear
      await page.waitForTimeout(300);

      // Press Enter to select the first match
      await dropdown.press('Enter');

      // Wait for selection to complete
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
      el.dispatchEvent(new Event('input', { bubbles: true }));
      el.dispatchEvent(new Event('change', { bubbles: true }));
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

    // Navigate to the form
    await page.goto(TARGET_URL, { waitUntil: 'networkidle' });

    // Wait for form to be ready
    await page.waitForSelector('form', { timeout: 10000 });

    // Fill Type
    await selectByLabelOrValue(page, 'select[name="type"]', ticket.type);

    // Fill Category
    await selectByLabelOrValue(page, 'select[name="cat_id"]', ticket.Category);

    // Fill Requestor
    await fillInputIfValue(page, 'input[name="requestor"]', ticket.Requestor);

    // Fill Computer Name
    await fillInputIfValue(page, 'input[name="comp_name"]', ticket.ComputerName);

    // Fill Department
    await selectByLabelOrValue(page, 'select[name="dept"]', ticket.Department);

    // Fill Location
    await selectByLabelOrValue(page, 'select[name="loc"]', ticket.Location);

    // Fill Project
    await selectByLabelOrValue(page, 'select[name="project"]', ticket.Project);

    // Fill Description
    const descSelector = 'textarea[name="description"], #description';
    await fillInputIfValue(page, descSelector, ticket.Description);

    // Fill Priority (readonly, but try)
    await selectByLabelOrValue(page, 'select[name="prior"]', ticket.Priority || 'Medium');

    // Fill Assign
    await selectByLabelOrValue(page, 'select[name="assign"]', ticket.Assign);

    // Take screenshot before submit
    const screenshotPath = path.join(screenshotDir, `row-${rowIndex}-before-submit.png`);
    await page.screenshot({ path: screenshotPath, fullPage: true });

    if (options.dryRun) {
      console.log(`Row ${rowIndex}: Dry run - skipping submit`);
      return { success: true, screenshotPath };
    }

    // Click submit button
    const submitButton = page.locator('button[type="submit"], input[type="submit"]').filter({ hasText: /submit/i }).first();

    // Click and wait for response/navigation
    await Promise.all([
      page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => null),
      submitButton.click(),
    ]);

    // Check for error messages
    const errorSelector = '.alert-danger, .error, .alert-error, text-danger';
    const hasError = await page.locator(errorSelector).count();

    if (hasError > 0) {
      const errorText = await page.locator(errorSelector).first().textContent();
      throw new Error(`Form submission error: ${errorText}`);
    }

    // Check if we're still on the form page (success usually redirects)
    const currentUrl = page.url();
    if (currentUrl.includes('new_helpdesk')) {
      // Still on form page, might be an error
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

    // Take screenshot on failure
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

  // Create logs directory
  const logsDir = path.join(process.cwd(), 'automation-logs');
  const screenshotDir = path.join(logsDir, 'screenshots', runId);
  const runsDir = path.join(logsDir, 'runs');

  await fs.mkdir(screenshotDir, { recursive: true });
  await fs.mkdir(runsDir, { recursive: true });

  let successCount = 0;
  let failedCount = 0;
  let skippedCount = 0;

  const { browser, context, page } = await createBrowser(options);

  try {
    // Handle manual login if needed
    await waitForManualLoginIfNeeded(page);

    // Filter rows by start/end index if specified
    let filteredRows = rows.filter(row => row.validationResult.isValid);

    if (options.startRow !== undefined || options.endRow !== undefined) {
      const start = options.startRow || 0;
      const end = options.endRow || filteredRows.length;
      filteredRows = filteredRows.slice(start, end);
    }

    skippedCount = rows.length - filteredRows.length;

    console.log(`Starting automation: ${filteredRows.length} valid rows to process`);

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

      // Add delay between rows (except for the last row)
      if (i < filteredRows.length - 1 && options.delayMs > 0) {
        await page.waitForTimeout(options.delayMs);
      }
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
    };

    // Save result to JSON file
    const resultPath = path.join(runsDir, `${runId}.json`);
    await fs.writeFile(resultPath, JSON.stringify(result, null, 2));

    // Explicitly save cookies before closing
    const sessionDir = path.join(process.cwd(), 'automation-logs', 'session');
    const authStatePath = path.join(sessionDir, 'auth-state.json');

    // Save the storage state (cookies, localStorage, sessionStorage)
    await context.storageState({ path: authStatePath });
    console.log(`✅ Cookies and storage saved to: ${authStatePath}`);

    // Log info about saved cookies
    const finalCookies = await context.cookies();
    console.log(`📊 Saved ${finalCookies.length} cookies`);

    if (process.env.DEBUG === 'true') {
      const authCookies = finalCookies.filter(c =>
        c.name.toLowerCase().includes('session') ||
        c.name.toLowerCase().includes('auth') ||
        c.name.toLowerCase().includes('token') ||
        c.name.toLowerCase().includes('phpsessid') ||
        c.name.toLowerCase().includes('ci_session')
      );

      if (authCookies.length > 0) {
        console.log('🔑 Authentication cookies found:', authCookies.map(c => c.name).join(', '));
      }
    }

    console.log(`Automation completed: ${successCount} success, ${failedCount} failed, ${skippedCount} skipped`);

    return result;

  } finally {
    await context.close();
    await browser.close();
  }
}
