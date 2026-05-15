import { GitLabEvent, GitLabCommit, GitLabSystemHookCommitPayload } from '@/types/gitlab';
import { TicketRow } from '@/types/ticket';
import { fetchCompareCommits, parseCommitMessage } from './gitlab';

const OPENAI_BASE_URL = process.env.OPENAI_BASE_URL;
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const OPENAI_MODEL = process.env.OPENAI_MODEL || 'gpt-4o';

function extractFirstJSONObject(text: string): unknown {
  const start = text.indexOf('{');
  if (start === -1) {
    throw new Error('AI API returned a non-JSON response');
  }

  let depth = 0;
  let inString = false;
  let escaped = false;

  for (let i = start; i < text.length; i++) {
    const char = text[i];

    if (escaped) {
      escaped = false;
      continue;
    }

    if (char === '\\') {
      escaped = true;
      continue;
    }

    if (char === '"') {
      inString = !inString;
      continue;
    }

    if (inString) {
      continue;
    }

    if (char === '{') {
      depth++;
    } else if (char === '}') {
      depth--;

      if (depth === 0) {
        return JSON.parse(text.slice(start, i + 1));
      }
    }
  }

  throw new Error('AI API returned incomplete JSON');
}

function parseAIResponseBody(text: string): any {
  try {
    return JSON.parse(text);
  } catch {
    return extractFirstJSONObject(text);
  }
}

async function callAI(prompt: string): Promise<string> {
  if (!OPENAI_BASE_URL || !OPENAI_API_KEY) {
    throw new Error('OPENAI_BASE_URL and OPENAI_API_KEY must be set in environment');
  }

  const response = await fetch(`${OPENAI_BASE_URL}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${OPENAI_API_KEY}`,
    },
    body: JSON.stringify({
      model: OPENAI_MODEL,
      messages: [
        { role: 'user', content: prompt },
      ],
      max_tokens: 200,
      temperature: 0.7,
      stream: false,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(
      `AI API error: ${response.status} ${response.statusText}${errorText ? ` - ${errorText.slice(0, 500)}` : ''}`
    );
  }

  const responseText = await response.text();
  const data = parseAIResponseBody(responseText);
  return data.choices?.[0]?.message?.content?.trim() || '';
}

export async function transformCommitMessage(
  commitTitle: string,
  bulletLine: string
): Promise<string> {
  const prompt = `You are a helpdesk ticket assistant. Rewrite only the work detail from the following GitLab commit message bullet to be more natural and descriptive for a helpdesk ticket description.

Commit title: ${commitTitle}
Commit message bullet: ${bulletLine}

Rules:
- Keep it concise (max 150 characters)
- Make it sound like a proper work report / ticket description
- Keep the technical meaning intact
- Do NOT include or repeat the commit title
- Do NOT include or repeat ticket/project codes from the commit title
- The final app will add the commit title as a prefix, so return only the detail after the title
- Return ONLY the rewritten text, no explanation, no prefix`;

  try {
    const result = await callAI(prompt);
    if (!result) {
      return bulletLine;
    }
    return removeCommitTitleFromAIMessage(result, commitTitle);
  } catch (error) {
    console.error('AI transform failed, using original bullet line:', error);
    return bulletLine;
  }
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function removeCommitTitleFromAIMessage(message: string, commitTitle: string): string {
  let cleanedMessage = message.trim();
  const normalizedTitle = commitTitle.trim();
  const titleCode = normalizedTitle.split(' - ')[0]?.trim();

  if (normalizedTitle) {
    cleanedMessage = cleanedMessage.replace(new RegExp(escapeRegExp(normalizedTitle), 'gi'), '').trim();
  }

  if (titleCode) {
    cleanedMessage = cleanedMessage.replace(new RegExp(`\\b${escapeRegExp(titleCode)}\\b`, 'gi'), '').trim();
  }

  return cleanedMessage
    .replace(/^[\s:;,\-.]+/, '')
    .replace(/\s{2,}/g, ' ')
    .trim() || message.trim();
}

export async function generateTicketsFromCommitsAI(
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
        if (seenCommitIds.has(commit.id)) continue;
        seenCommitIds.add(commit.id);

        if (commit.title.startsWith('Merge branch')) {
          continue;
        }

        const bulletLines = parseCommitMessage(commit.message);

        if (bulletLines.length === 0) {
          continue;
        }

        for (const bulletLine of bulletLines) {
          const aiMessage = await transformCommitMessage(commit.title, bulletLine);

          tickets.push({
            type: 'Task',
            Category: 'Software',
            Requestor: '10031059',
            ComputerName: '-',
            Department: 'IT',
            Location: 'IT OFFICE',
            Project: 'Overhead',
            Description: `${commit.title} - ${aiMessage}`,
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


export async function generateTicketsFromHookCommitsAI(
  commits: GitLabSystemHookCommitPayload[],
  assignName: string
): Promise<TicketRow[]> {
  const tickets: TicketRow[] = [];
  const seenCommitIds = new Set<string>();

  for (const commit of commits) {
    if (!commit?.id || !commit?.message) continue;
    if (seenCommitIds.has(commit.id)) continue;
    seenCommitIds.add(commit.id);

    const lines = commit.message.split('\n');
    const commitTitle = (lines[0] || '').trim();

    if (!commitTitle || commitTitle.startsWith('Merge branch')) {
      continue;
    }

    const bulletLines = parseCommitMessage(commit.message);
    if (bulletLines.length === 0) {
      continue;
    }

    for (const bulletLine of bulletLines) {
      const aiMessage = await transformCommitMessage(commitTitle, bulletLine);
      tickets.push({
        type: 'Task',
        Category: 'Software',
        Requestor: '10031059',
        ComputerName: '-',
        Department: 'IT',
        Location: 'IT OFFICE',
        Project: 'Overhead',
        Description: `${commitTitle} - ${aiMessage}`,
        Priority: 'Medium',
        Assign: assignName,
      });
    }
  }

  return tickets;
}
