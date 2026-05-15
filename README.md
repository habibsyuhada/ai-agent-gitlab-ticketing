# AI Agent GitLab Ticketing

A Next.js application that turns GitLab activity or Excel rows into helpdesk tickets, then automates ticket creation and optional ticket solving through Playwright. The helpdesk portal URL is configured through environment variables, so no portal host is hardcoded in the application.

## Screenshot
<img width="1920" height="1080" alt="image" src="https://github.com/user-attachments/assets/a49c5346-de8a-4d30-80e0-9af69f8dba49" />

## Features

- Import tickets from Excel files.
- Import GitLab commit activity and convert it into ticket rows.
- Use an AI agent to rewrite GitLab commit bullets into concise helpdesk-ready descriptions.
- Create helpdesk tickets through browser automation.
- Optionally solve inserted tickets after creation.
- Batch solve tickets by assignee to reduce repeated status updates.
- Persist browser cookies between runs for manual-login sessions.
- Save run results and screenshots for troubleshooting.

## AI Agent Workflow

The application has two automation-assisted flows:

### GitLab Ticket Agent

When AI mode is enabled on the GitLab import page:

1. The app fetches GitLab push events and commit details.
2. Each commit message is parsed into work-report bullet lines.
3. The AI agent rewrites each bullet into a concise helpdesk ticket detail.
4. The final ticket description keeps the commit title as the prefix and appends only the rewritten detail.

Example output:

```text
UP-PORTAL-BE000001 - Initial NestJS backend setup
```

The AI prompt explicitly prevents repeating the commit title or project/ticket code inside the rewritten detail.

### Helpdesk Solve Agent

When `solveAfterInsert` is enabled:

1. The app creates all valid helpdesk tickets first.
2. It opens the helpdesk list page and filters tickets to `On Progress`.
3. It sets the DataTables page length to the maximum available value.
4. It groups inserted tickets by `Assign`.
5. For each assignee, it searches the DataTable by assignee name.
6. It matches visible rows by normalized description and ticket key.
7. It checks all matching tickets on the current page and changes their status to `Solved` in one batch.
8. If the assignee search spans multiple pages, it repeats per page because server-side DataTables only submits checkboxes currently rendered in the DOM.

## Tech Stack

- Next.js 14 with App Router
- TypeScript
- Tailwind CSS
- Playwright
- XLSX
- Zod
- OpenAI-compatible chat completion API

## Prerequisites

- Node.js 18 or newer
- npm
- Chromium browser installed through Playwright
- Access to the target helpdesk portal
- Optional: GitLab access token for GitLab import
- Optional: OpenAI-compatible API key for AI commit rewriting

## Installation

```bash
git clone <repository-url>
cd bot-ticketing
npm install
npm run playwright:install
```

Create `.env.local` from `.env.example`, then start the app:

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Environment Variables

```env
# Debug logging
DEBUG=false

# GitLab import
GITLAB_BASE_URL=http://your-gitlab-host
GITLAB_TOKEN=your-gitlab-token

# Helpdesk portal
HELPDESK_URL=https://your-helpdesk-host/helpdesk/it/new_helpdesk
NEXT_PUBLIC_HELPDESK_URL=https://your-helpdesk-host/helpdesk/it/new_helpdesk

# Optional browser override
PLAYWRIGHT_BROWSER_PATH=

# AI commit-message rewriting
OPENAI_BASE_URL=https://your-openai-compatible-host/v1
OPENAI_API_KEY=your-api-key-here
OPENAI_MODEL=gpt-4o
```

`HELPDESK_URL` should point to the new-ticket page. The app derives the list and process URLs from the same base path.

`NEXT_PUBLIC_HELPDESK_URL` is used only for the client-side login link shown in the UI.

## Excel File Format

Your Excel file must contain these columns. Headers are case-insensitive.

| Column | Required | Description | Example |
| --- | --- | --- | --- |
| type | Yes | Ticket type | Task |
| Category | Yes | Ticket category | Software |
| Requestor | Yes | Requestor name or ID | 10031059 |
| Computer Name | Yes | Computer name or placeholder | - |
| Department | Yes | Department name | IT |
| Location | Yes | Office location | IT OFFICE |
| Project | Yes | Project name | Overhead |
| Description | Yes | Ticket description | UP-PORTAL-BE000001 - Initial setup |
| Priority | No | Priority level | Medium |
| Assign | Yes | Assigned technician | Jane Smith |

## Usage

1. Configure `.env.local`.
2. Start the app with `npm run dev`.
3. Log in manually to the configured helpdesk portal if needed.
4. Import tickets from Excel or from GitLab.
5. Review parsed rows on the preview page.
6. Choose dry run or real submission.
7. Enable solve-after-insert if tickets should be moved to `Solved` after creation.
8. Monitor the run on the status page.

## GitLab Import

The GitLab page can fetch commits for selected users and date ranges. In non-AI mode, ticket descriptions are built directly from commit titles and parsed bullet lines. In AI mode, each bullet line is rewritten through the configured OpenAI-compatible API before becoming a helpdesk ticket description.

## Helpdesk Automation

The Playwright automation:

- Loads saved cookies from `automation-logs/session/auth-state.json`.
- Waits for manual login when the session is missing or expired.
- Fills the helpdesk form using the parsed ticket rows.
- Supports native select fields and Select2-style dropdowns.
- Saves screenshots before submit and on failures.
- Stores run results in `automation-logs/runs/`.

## Scripts

```bash
npm run dev
npm run build
npm start
npm run playwright:install
npm run cookies:check
npm run cookies:clear
```

## Docker Compose (Production)

This project includes a single production-oriented Docker Compose setup.

1. Build local image:

```bash
docker build -t ai-agent-gitlab-ticketing:1.0.0 .
```

2. Tag and push to Docker Hub:

```bash
docker login
docker tag ai-agent-gitlab-ticketing:1.0.0 habibsyuhada/ai-agent-gitlab-ticketing:latest
docker push habibsyuhada/ai-agent-gitlab-ticketing:latest
```

3. Set the Docker Hub image in [`docker-compose.yml`](docker-compose.yml):

```yaml
image: habibsyuhada/ai-agent-gitlab-ticketing:latest
```

4. Edit inline environment values in `docker-compose.yml`.
5. Pull and run:

```bash
docker compose pull
docker compose up -d
```

6. View logs:

```bash
docker compose logs -f app
```

7. Stop:

```bash
docker compose down
```

Notes:

- Environment variables are defined directly under `environment` in `docker-compose.yml`.
- When values change, recreate the service with `docker compose up -d`.
- `automation-logs` is mounted as a persistent host volume.
- For long-term production, move sensitive secrets to a secret manager.

## Troubleshooting

### Dropdowns Are Not Selected

Check that the Excel value matches the visible option label or the option value. The automation tries exact text, normalized text, value matching, and Select2 search fallback.

### Login Is Requested Again

The saved cookie session may be expired or invalidated by the server. Clear saved cookies and log in again:

```bash
npm run cookies:clear
```

### Solve Phase Reports Not Found

Check the automation logs. The solve agent logs the assignee search, visible candidates, ticket IDs, descriptions, requestors, assignees, and statuses. A common cause is a description mismatch between the inserted ticket and the row shown by the helpdesk table.

## Project Structure

```text
src/
  app/
    api/
      automation/run/route.ts
      excel/parse/route.ts
      gitlab/parse/route.ts
      gitlab/users/route.ts
    gitlab/page.tsx
    preview/page.tsx
    status/page.tsx
    page.tsx
  lib/
    excel.ts
    gitlab.ts
    gitlab-ai.ts
    helpdesk-ai-solve.ts
    helpdesk-config.ts
    helpdesk-rpa.ts
    logger.ts
    validation.ts
  types/
    gitlab.ts
    ticket.ts
```

## Security Notes

- Do not commit `.env.local`.
- Do not commit `automation-logs/`.
- Saved Playwright auth state contains active session cookies.
- Use dry run before real submissions when validating new input data.
- Keep API tokens out of source code.
