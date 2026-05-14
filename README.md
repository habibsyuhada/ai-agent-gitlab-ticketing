# Helpdesk RPA Automation

A Next.js application for automating helpdesk ticket creation from Excel files using Playwright. This internal RPA tool helps streamline bulk ticket creation for the configured helpdesk system.

## Features

- 📊 **Excel Upload**: Upload `.xlsx` or `.xls` files containing ticket information
- ✅ **Validation**: Automatic validation of required fields before processing
- 🔄 **Dry Run Mode**: Test your data without actually submitting tickets
- 🤖 **Browser Automation**: Uses Playwright to fill and submit helpdesk forms
- 📝 **Logging**: Detailed logs and screenshots for troubleshooting
- 🎯 **Select2 Support**: Handles both native selects and Select2 dropdowns
- 📈 **Progress Tracking**: Real-time status updates during automation

## Tech Stack

- **Next.js 14** with App Router
- **TypeScript**
- **Tailwind CSS**
- **Playwright** for browser automation
- **XLSX** for Excel parsing
- **Zod** for validation

## Prerequisites

- Node.js 18+ and npm
- Chromium browser (installed via Playwright)

## Installation

1. Clone the repository:
```bash
git clone <repository-url>
cd bot-ticketing
```

2. Install dependencies:
```bash
npm install
```

3. Install Playwright browsers:
```bash
npm run playwright:install
```

4. Run the development server:
```bash
npm run dev
```

5. Open [http://localhost:3000](http://localhost:3000) in your browser

## Excel File Format

Your Excel file must contain the following columns (headers are case-insensitive):

| Column | Required | Description | Example |
|--------|----------|-------------|---------|
| type | Yes | Ticket type | Hardware, Software |
| Category | Yes | Ticket category | Laptop, Monitor, Software |
| Requestor | Yes | Name of the person requesting | John Doe |
| Computer Name | Yes | Computer name/ID | LT-JDOE-001 |
| Department | Yes | Department name | IT, HR, Finance |
| Location | Yes | Office location | Head Office, Branch A |
| Project | Yes | Project name | General, Project X |
| Description | Yes | Detailed description | Need new laptop for dev work |
| Priority | No | Priority level | Low, Medium, High |
| Assign | Yes | Assigned to | IT Support, John Smith |

### Sample Excel Template

You can download a sample template from the upload page, or create your own with these columns:

```
type | Category | Requestor | Computer Name | Department | Location | Project | Description | Priority | Assign
Hardware | Laptop | John Doe | LT-JDOE-001 | IT | Head Office | General | Need new laptop | Medium | IT Support
```

## Usage

### 1. Prepare Your Excel File

Create an Excel file with the required columns listed above. Make sure all required fields are filled.

### 2. Login to Helpdesk

Before starting automation, make sure you're logged in to the helpdesk portal configured in `HELPDESK_URL`. The automation will wait for manual login if needed.

### 3. Upload and Configure

1. Go to the upload page
2. Drag & drop your Excel file or click to select
3. Configure automation options:
   - **Dry Run**: Enable to test without submitting (recommended first)
   - **Headless**: Run browser in background (not recommended for first use)
   - **Delay**: Time between tickets (default 3000ms)
   - **Start/End Row**: Process a subset of rows
4. Click "Upload and Preview"

### 4. Preview and Validate

The preview page shows:
- Total rows, valid rows, and invalid rows
- All parsed data with validation errors highlighted
- Automation options summary

Options:
- **Process Valid Rows Only**: Skip rows with validation errors
- **Process All Rows**: Process all rows (may fail for invalid rows)

### 5. Monitor Progress

The status page shows:
- Real-time progress
- Success/failure counts
- Detailed error messages
- Screenshot links for failed rows
- Download results as JSON

## Configuration

### Automation Options

- **dryRun** (default: `true`): When enabled, fills the form but doesn't submit
- **headless** (default: `false`): Run browser without visible window
- **delayMs** (default: `3000`): Delay between tickets in milliseconds
- **startRow**: Optional start row index (0-based)
- **endRow**: Optional end row index (0-based)

### Environment Variables

Create a `.env.local` file:

```env
# Enable debug logging
DEBUG=true

# Helpdesk portal URL
HELPDESK_URL=https://your-helpdesk-host/helpdesk/it/new_helpdesk

# Client-visible helpdesk URL for the login link shown in the UI
NEXT_PUBLIC_HELPDESK_URL=https://your-helpdesk-host/helpdesk/it/new_helpdesk
```

## Troubleshooting

### Select Dropdowns Not Working

If dropdowns aren't being selected:

1. Check that the value in Excel matches the option label or value in the form
2. The system tries multiple matching strategies:
   - Exact label match
   - Trimmed label match
   - Value match
   - Select2 search fallback

### Login Issues

The automation waits for manual login if:
- You're not logged in when the browser opens
- The URL doesn't contain `/helpdesk/it/new_helpdesk`

**Session Persistence**: After your first login, the browser will save your session cookies to `automation-logs/session/auth-state.json`. Subsequent runs will use this saved session, so you won't need to login again unless your session expires.

### Cookie Management

Check saved cookies:
```bash
npm run cookies:check
```

Clear saved cookies (force new login):
```bash
npm run cookies:clear
# Or manually:
rm automation-logs/session/auth-state.json
# Windows:
del automation-logs\session\auth-state.json
```

For more details about how cookie authentication works, see [COOKIES_EXPLANATION.md](COOKIES_EXPLANATION.md).
```

### Timeout Errors

If you get timeout errors:

1. Increase the delay between tickets
2. Check your internet connection
3. Make sure the helpdesk site is accessible
4. Try with headless mode disabled to see what's happening

### Screenshots

Failed rows are saved with screenshots to:
```
automation-logs/screenshots/{runId}/
```

JSON logs are saved to:
```
automation-logs/runs/{runId}.json
```

## Development

### Build for Production

```bash
npm run build
npm start
```

### Project Structure

```
src/
├── app/
│   ├── api/
│   │   ├── automation/run/route.ts    # Automation API endpoint
│   │   └── excel/parse/route.ts       # Excel parsing API
│   ├── globals.css
│   ├── layout.tsx
│   ├── page.tsx                       # Upload page
│   ├── preview/page.tsx               # Preview page
│   └── status/page.tsx                # Status page
├── lib/
│   ├── excel.ts                       # Excel parsing utilities
│   ├── helpdesk-rpa.ts                # Playwright automation
│   ├── logger.ts                      # Logging utilities
│   ├── utils.ts                       # General utilities
│   └── validation.ts                  # Validation schemas
└── types/
    └── ticket.ts                      # TypeScript types
```

## Security Considerations

- **No credentials in code**: The app doesn't hardcode login credentials
- **Manual login required**: You must be logged in to use the automation
- **Visible by default**: Automation runs in visible browser mode (unless headless is enabled)
- **Dry run mode**: Test your data before actual submission
- **Local file storage**: Temporary files are stored locally only

## Important Notes

1. **Always run dry run first**: Test your data with dry run mode before actual submission
2. **Use appropriate delays**: Don't set delay too low to avoid overwhelming the server
3. **Validate your data**: Check the preview page for validation errors
4. **Monitor the process**: Watch the browser automation to ensure it's working correctly
5. **Check logs**: Review logs and screenshots if errors occur

## License

This is an internal tool for valid work reporting purposes only.

## Support

For issues or questions:
1. Check the troubleshooting section above
2. Review logs in `automation-logs/runs/`
3. Check screenshots in `automation-logs/screenshots/`
4. Verify your Excel file format matches the required columns
