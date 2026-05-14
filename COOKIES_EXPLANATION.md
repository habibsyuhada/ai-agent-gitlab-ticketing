# Cookie Authentication in Helpdesk RPA

This application uses Playwright storage state to keep the browser logged in between automation runs. The important part of that storage state is the cookie list for the helpdesk host configured in `HELPDESK_URL`.

## What Gets Stored

After a successful manual login, the helpdesk server usually sends cookies such as:

- Session IDs
- Authentication tokens
- CSRF-related values
- User preferences or other server-side session references

Playwright saves those cookies to:

```text
automation-logs/session/auth-state.json
```

The app loads that file before opening the helpdesk pages, so later runs can reuse the same authenticated session.

## Cookies vs Browser Storage

| Storage | Sent to server automatically | Typical auth usage |
| --- | --- | --- |
| Cookies | Yes | Common for server-side sessions |
| Local Storage | No | Client-side state only |
| Session Storage | No | Client-side tab/session state only |

For this RPA flow, cookies matter most because they are sent with every request to the configured helpdesk host.

## Example Server Response

```http
HTTP/1.1 200 OK
Set-Cookie: PHPSESSID=abc123def456; Path=/; Secure; HttpOnly
Set-Cookie: user_token=jwt_token_here; Path=/; Secure; HttpOnly
```

The browser stores those cookies and sends them back on later requests. The helpdesk server then uses the cookies to identify the logged-in user.

## Example Playwright Storage State

```json
{
  "cookies": [
    {
      "name": "PHPSESSID",
      "value": "abc123def456",
      "domain": "your-helpdesk-host",
      "path": "/",
      "expires": 1234567890,
      "httpOnly": true,
      "secure": true,
      "sameSite": "Lax"
    }
  ],
  "origins": [
    {
      "origin": "https://your-helpdesk-host",
      "localStorage": []
    }
  ]
}
```

The `cookies` array is the important authentication data. Local storage may be present, but the server cannot read local storage directly.

## How to Inspect Saved Cookies

Check the saved state file:

```bash
cat automation-logs/session/auth-state.json
```

On Windows PowerShell:

```powershell
Get-Content automation-logs/session/auth-state.json
```

You can also enable debug logging:

```bash
DEBUG=true npm run dev
```

Then run the automation and inspect the cookie-related log lines.

## How to Reset Login State

Use the provided script:

```bash
npm run cookies:clear
```

Or delete the storage state manually:

```bash
rm automation-logs/session/auth-state.json
```

On Windows:

```powershell
Remove-Item automation-logs\session\auth-state.json
```

The next automation run will open the browser and wait for manual login again.

## Why a Saved Cookie Can Still Fail

A saved cookie can stop working when:

- The server-side session expires.
- The user logs out manually.
- The server invalidates old sessions.
- The cookie domain or path does not match the configured helpdesk URL.
- The portal changes its authentication mechanism.

When this happens, clear the saved state and log in again.

## Security Notes

- `auth-state.json` may contain active session cookies.
- Do not commit `automation-logs/`.
- Do not share saved auth-state files.
- Rotate or clear sessions periodically if the machine is shared.
- Keep `.env.local` out of source control.

## Summary

```text
Manual login -> server sends cookies -> Playwright saves cookies
             -> next run loads cookies -> helpdesk sees an authenticated session
```

This is cookie persistence, not browser session storage persistence.
