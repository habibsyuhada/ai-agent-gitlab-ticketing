import fs from 'fs/promises';
import path from 'path';

export interface CookieInfo {
  name: string;
  value: string;
  domain: string;
  path: string;
  expires: number | -1;
  httpOnly: boolean;
  secure: boolean;
  sameSite: 'Strict' | 'Lax' | 'None';
}

export interface StorageState {
  cookies: CookieInfo[];
  origins: Array<{
    origin: string;
    localStorage: Array<{ name: string; value: string }>;
  }>;
}

/**
 * Read saved cookies from auth-state.json
 */
export async function readSavedCookies(): Promise<StorageState | null> {
  const authStatePath = path.join(process.cwd(), 'automation-logs', 'session', 'auth-state.json');

  try {
    const content = await fs.readFile(authStatePath, 'utf-8');
    return JSON.parse(content);
  } catch (error) {
    return null;
  }
}

/**
 * Get authentication-related cookies
 */
export async function getAuthCookies(): Promise<CookieInfo[]> {
  const state = await readSavedCookies();

  if (!state) {
    return [];
  }

  return state.cookies.filter(cookie => {
    const name = cookie.name.toLowerCase();
    return name.includes('session') ||
           name.includes('auth') ||
           name.includes('token') ||
           name.includes('phpsessid') ||
           name.includes('ci_session') ||
           name.includes('remember') ||
           name.includes('login') ||
           name.includes('portal') ||
           name.includes('csrf');
  });
}

/**
 * Print cookie information for debugging
 */
export async function printCookieInfo(): Promise<void> {
  const state = await readSavedCookies();

  if (!state) {
    console.log('❌ No saved cookies found. Please login first.');
    return;
  }

  const authCookies = await getAuthCookies();

  console.log('\n📊 Cookie Information:');
  console.log('='.repeat(60));
  console.log(`Total cookies: ${state.cookies.length}`);
  console.log(`Auth-related cookies: ${authCookies.length}`);
  console.log('\n🔑 Authentication Cookies:');

  if (authCookies.length === 0) {
    console.log('  ⚠️  No authentication cookies found');
    console.log('  This might mean you are not logged in.');
  } else {
    authCookies.forEach(cookie => {
      const valuePreview = cookie.value.length > 20
        ? `${cookie.value.substring(0, 20)}...`
        : cookie.value;

      console.log(`  • ${cookie.name}`);
      console.log(`    Value: ${valuePreview}`);
      console.log(`    Domain: ${cookie.domain}`);
      console.log(`    Expires: ${cookie.expires === -1 ? 'Session' : new Date(cookie.expires * 1000).toISOString()}`);
      console.log(`    Secure: ${cookie.secure ? 'Yes' : 'No'}`);
      console.log(`    HttpOnly: ${cookie.httpOnly ? 'Yes' : 'No'}`);
    });
  }

  console.log('\n📁 Storage file: automation-logs/session/auth-state.json');
  console.log('='.repeat(60) + '\n');
}

/**
 * Clear saved cookies
 */
export async function clearSavedCookies(): Promise<void> {
  const authStatePath = path.join(process.cwd(), 'automation-logs', 'session', 'auth-state.json');

  try {
    await fs.unlink(authStatePath);
    console.log('✅ Saved cookies cleared successfully.');
  } catch (error) {
    console.log('❌ No saved cookies to clear.');
  }
}
