import { google } from 'googleapis';
import readline from 'node:readline/promises';
import { stdin, stdout } from 'node:process';
import { loadConfig, requireConfig } from '@plicit/config';

/**
 * One-shot script to obtain a Google Calendar refresh token.
 *
 * Prereqs in .env:
 *   GOOGLE_OAUTH_CLIENT_ID
 *   GOOGLE_OAUTH_CLIENT_SECRET
 *
 * Run:
 *   pnpm tsx scripts/google-oauth.ts
 *
 * Then paste the printed refresh token into .env as GOOGLE_OAUTH_REFRESH_TOKEN.
 */
async function main() {
  loadConfig();
  const clientId = requireConfig('GOOGLE_OAUTH_CLIENT_ID');
  const clientSecret = requireConfig('GOOGLE_OAUTH_CLIENT_SECRET');
  const oauth = new google.auth.OAuth2(clientId, clientSecret, 'urn:ietf:wg:oauth:2.0:oob');
  const url = oauth.generateAuthUrl({
    access_type: 'offline',
    prompt: 'consent',
    scope: ['https://www.googleapis.com/auth/calendar.events'],
  });
  // eslint-disable-next-line no-console
  console.log(`\nOpen this URL in a browser, approve, and paste the resulting code below:\n${url}\n`);
  const rl = readline.createInterface({ input: stdin, output: stdout });
  const code = (await rl.question('Code: ')).trim();
  rl.close();
  const { tokens } = await oauth.getToken(code);
  // eslint-disable-next-line no-console
  console.log('\nAdd this to .env:\n');
  // eslint-disable-next-line no-console
  console.log(`GOOGLE_OAUTH_REFRESH_TOKEN=${tokens.refresh_token ?? '(none — re-run with prompt=consent)'}\n`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
