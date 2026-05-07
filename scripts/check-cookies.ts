#!/usr/bin/env tsx

/**
 * CLI script to check saved cookies
 * Usage: npx tsx scripts/check-cookies.ts
 */

import { printCookieInfo, clearSavedCookies } from '../src/lib/cookie-utils.js';

const command = process.argv[2];

async function main() {
  switch (command) {
    case 'clear':
      await clearSavedCookies();
      break;

    case 'check':
    default:
      await printCookieInfo();
      break;
  }
}

main().catch(console.error);
