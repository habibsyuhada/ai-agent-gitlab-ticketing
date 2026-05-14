const HELPDESK_NEW_TICKET_PATH = 'new_helpdesk';
const HELPDESK_LIST_PATH = 'it_helpdesk';
const HELPDESK_PROCESS_ADD_PATH = 'process_add_helpdesk';

function getHelpdeskUrlFromEnv(): string {
  const helpdeskUrl = process.env.HELPDESK_URL || process.env.NEXT_PUBLIC_HELPDESK_URL;

  if (!helpdeskUrl) {
    throw new Error('HELPDESK_URL must be set in environment');
  }

  return helpdeskUrl;
}

function trimKnownHelpdeskPage(pathname: string): string {
  const parts = pathname.split('/').filter(Boolean);
  const lastPart = parts[parts.length - 1];

  if (
    lastPart === HELPDESK_NEW_TICKET_PATH ||
    lastPart === HELPDESK_LIST_PATH ||
    lastPart === HELPDESK_PROCESS_ADD_PATH
  ) {
    parts.pop();
  }

  return `/${parts.join('/')}`;
}

function getHelpdeskBaseUrl(): URL {
  const configuredUrl = new URL(getHelpdeskUrlFromEnv());
  const basePath = trimKnownHelpdeskPage(configuredUrl.pathname);

  configuredUrl.pathname = basePath.endsWith('/') ? basePath : `${basePath}/`;
  configuredUrl.search = '';
  configuredUrl.hash = '';

  return configuredUrl;
}

export function getHelpdeskNewTicketUrl(): string {
  return new URL(HELPDESK_NEW_TICKET_PATH, getHelpdeskBaseUrl()).toString();
}

export function getHelpdeskListUrl(): string {
  return new URL(HELPDESK_LIST_PATH, getHelpdeskBaseUrl()).toString();
}

export function getHelpdeskProcessAddUrl(): string {
  return new URL(HELPDESK_PROCESS_ADD_PATH, getHelpdeskBaseUrl()).toString();
}

export function getHelpdeskHostname(): string {
  return getHelpdeskBaseUrl().hostname;
}
