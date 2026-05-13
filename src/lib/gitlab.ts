import { GitLabUser, GitLabEvent, GitLabCommit, GitLabCompareResponse } from '@/types/gitlab';
import { TicketRow } from '@/types/ticket';

const GITLAB_BASE_URL = process.env.GITLAB_BASE_URL || 'http://10.5.255.167:9000';
const GITLAB_API_URL = `${GITLAB_BASE_URL}/api/v4`;
const GITLAB_TOKEN = process.env.GITLAB_TOKEN;

function getHeaders(): HeadersInit {
  const headers: HeadersInit = {
    'Content-Type': 'application/json',
  };

  if (GITLAB_TOKEN) {
    headers['PRIVATE-TOKEN'] = GITLAB_TOKEN;
  }

  return headers;
}

export async function fetchUsers(): Promise<GitLabUser[]> {
  const response = await fetch(`${GITLAB_API_URL}/users`, {
    headers: getHeaders(),
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch users: ${response.statusText}`);
  }

  return response.json();
}

export async function fetchUserEvents(
  userId: number,
  after: string,
  before: string
): Promise<GitLabEvent[]> {
  const allEvents: GitLabEvent[] = [];
  let page = 1;

  while (true) {
    const url = new URL(`${GITLAB_API_URL}/users/${userId}/events`);
    url.searchParams.append('action', 'pushed');
    url.searchParams.append('per_page', '50');
    url.searchParams.append('after', after);
    url.searchParams.append('before', before);
    url.searchParams.append('page', String(page));

    const response = await fetch(url.toString(), {
      headers: getHeaders(),
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch events for user ${userId} (page ${page}): ${response.statusText}`);
    }

    const events: GitLabEvent[] = await response.json();

    if (events.length === 0) {
      break;
    }

    allEvents.push(...events);
    page++;
  }

  return allEvents;
}

export async function fetchCommit(
  projectId: number,
  commitSha: string
): Promise<GitLabCommit> {
  const response = await fetch(
    `${GITLAB_API_URL}/projects/${projectId}/repository/commits/${commitSha}`,
    {
      headers: getHeaders(),
    }
  );

  if (!response.ok) {
    throw new Error(
      `Failed to fetch commit ${commitSha} for project ${projectId}: ${response.statusText}`
    );
  }

  return response.json();
}

export async function fetchCompareCommits(
  projectId: number,
  from: string,
  to: string
): Promise<GitLabCommit[]> {
  const url = new URL(`${GITLAB_API_URL}/projects/${projectId}/repository/compare`);
  url.searchParams.append('from', from);
  url.searchParams.append('to', to);

  const response = await fetch(url.toString(), {
    headers: getHeaders(),
  });

  if (!response.ok) {
    throw new Error(
      `Failed to fetch compare for project ${projectId} (${from}...${to}): ${response.statusText}`
    );
  }

  const data: GitLabCompareResponse = await response.json();
  return data.commits;
}

export function parseCommitMessage(message: string): string[] {
  const lines = message.split('\n');
  const bulletLines: string[] = [];

  for (const line of lines) {
    const trimmedLine = line.trim();
    if (trimmedLine.startsWith('- ')) {
      bulletLines.push(trimmedLine.substring(2).trim());
    }
  }

  return bulletLines;
}

export async function generateTicketsFromCommits(
  events: GitLabEvent[]
): Promise<TicketRow[]> {
  const tickets: TicketRow[] = [];
  const seenCommitIds = new Set<string>();

  for (const event of events) {
    const { push_data, project_id } = event;

    if (!push_data || !project_id) continue;

    const { commit_from, commit_to } = push_data;
    if (!commit_from || !commit_to) continue;

    try {
      const commits = await fetchCompareCommits(project_id, commit_from, commit_to);

      for (const commit of commits) {
        // Skip duplicate commits
        if (seenCommitIds.has(commit.id)) continue;
        seenCommitIds.add(commit.id);

        // Skip merge commits
        if (commit.title.startsWith('Merge branch')) {
          continue;
        }

        const bulletLines = parseCommitMessage(commit.message);

        if (bulletLines.length === 0) {
          continue;
        }

        for (const bulletLine of bulletLines) {
          tickets.push({
            type: 'Task',
            Category: 'Software',
            Requestor: '10031059',
            ComputerName: '-',
            Department: 'IT',
            Location: 'IT OFFICE',
            Project: 'Overhead',
            Description: `${commit.title} - ${bulletLine}`,
            Priority: 'Medium',
            Assign: event.author.name,
          });
        }
      }
    } catch (error) {
      console.error(
        `Failed to fetch compare for project ${project_id} (${commit_from}...${commit_to}):`,
        error
      );
    }
  }

  return tickets;
}

export function adjustDate(date: Date, days: number): string {
  const adjusted = new Date(date);
  adjusted.setDate(adjusted.getDate() + days);
  return adjusted.toISOString().split('T')[0];
}

export function getYesterdayDate(): string {
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  return yesterday.toISOString().split('T')[0];
}
