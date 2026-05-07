import { GitLabUser, GitLabEvent, GitLabCommit } from '@/types/gitlab';
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
  const url = new URL(`${GITLAB_API_URL}/users/${userId}/events`);
  url.searchParams.append('action', 'pushed');
  url.searchParams.append('per_page', '50');
  url.searchParams.append('after', after);
  url.searchParams.append('before', before);

  const response = await fetch(url.toString(), {
    headers: getHeaders(),
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch events for user ${userId}: ${response.statusText}`);
  }

  return response.json();
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

  for (const event of events) {
    const { push_data, project_id, author } = event;

    if (!push_data || !project_id) continue;

    const commitTitle = push_data.commit_title;

    if (commitTitle && commitTitle.startsWith('Merge branch')) {
      continue;
    }

    const commitSha = push_data.commit_to;
    if (!commitSha) continue;

    try {
      const commit = await fetchCommit(project_id, commitSha);
      const bulletLines = parseCommitMessage(commit.message);

      if (bulletLines.length === 0) {
      } else {
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
            Assign: commit.author_name,
          });
        }
      }
    } catch (error) {
      console.error(
        `Failed to fetch commit ${commitSha} for project ${project_id}:`,
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
