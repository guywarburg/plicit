import { google } from 'googleapis';
import { loadConfig } from '@plicit/config';
import type { MeetingPayload } from '@plicit/types';
import { appendMeetingNote, type MeetingInput } from './notes.js';
import { renderSourceMarkdown, type ItemSource } from '../source.js';

function hasGoogleOAuth(): boolean {
  const cfg = loadConfig();
  return Boolean(
    cfg.GOOGLE_OAUTH_CLIENT_ID && cfg.GOOGLE_OAUTH_CLIENT_SECRET && cfg.GOOGLE_OAUTH_REFRESH_TOKEN,
  );
}

function buildClient() {
  const cfg = loadConfig();
  const oauth = new google.auth.OAuth2(cfg.GOOGLE_OAUTH_CLIENT_ID, cfg.GOOGLE_OAUTH_CLIENT_SECRET);
  oauth.setCredentials({ refresh_token: cfg.GOOGLE_OAUTH_REFRESH_TOKEN });
  return google.calendar({ version: 'v3', auth: oauth });
}

async function createGoogleCalendarEvent(
  payload: MeetingInput,
  source?: ItemSource,
): Promise<string> {
  const calendar = buildClient();
  const description = source
    ? `${payload.notes ?? ''}\n\n${renderSourceMarkdown(source)}`.trim()
    : payload.notes;
  const res = await calendar.events.insert({
    calendarId: 'primary',
    requestBody: {
      summary: payload.title,
      description,
      location: payload.location,
      start: { dateTime: payload.start_iso },
      end: { dateTime: payload.end_iso },
    },
  });
  if (!res.data.id) throw new Error('Calendar event created without an id');
  return res.data.id;
}

/**
 * Phase 1: when Google OAuth is not configured, fall back to writing a
 * markdown meeting note in the notes repo. Phase 2 (with creds) will dual-write.
 */
export async function createCalendarEvent(
  payload: MeetingInput,
  source?: ItemSource,
): Promise<string> {
  const notePath = appendMeetingNote(payload, source);
  if (!hasGoogleOAuth()) return notePath;
  const eventId = await createGoogleCalendarEvent(payload, source);
  return `${eventId} | ${notePath}`;
}

export type { MeetingPayload };
