// Handing a hit to the rest of the phone: the calendar and the maps app.
//
// Neither needs an account or a permission prompt up front. On iOS and Android the
// calendar opens the system's own "new event" sheet, so the person sees exactly what
// is being added and can change it or cancel; nothing is written silently. On the web
// it downloads a standard .ics file, which every calendar app opens.
import { Linking, Platform } from 'react-native';
import type { HitRequest } from '@/data/types';

export type HitEvent = { title: string; start: Date; end: Date; location: string; notes: string };

export function placeOf(r: HitRequest, address?: string | null, area = 'Palo Alto, CA'): string {
  return address || `${r.courtName}, ${area}`;
}

export function eventFor(r: HitRequest, address?: string | null): HitEvent {
  const who = `${r.other.displayName}${r.other.lastInitial ? ` ${r.other.lastInitial}.` : ''}`;
  return {
    title: `Tennis with ${who}`,
    start: new Date(r.windowStart),
    end: new Date(r.windowEnd),
    location: placeOf(r, address),
    notes: 'Arranged on Hits. Court access and booking were not checked; confirm a free court on the day.',
  };
}

const icsDate = (d: Date) => d.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
const icsText = (s: string) => s.replace(/\\/g, '\\\\').replace(/\n/g, '\\n').replace(/[,;]/g, m => `\\${m}`);

export function ics(e: HitEvent, uid: string): string {
  return [
    'BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Hits//Hits//EN', 'CALSCALE:GREGORIAN', 'METHOD:PUBLISH',
    'BEGIN:VEVENT', `UID:${uid}@hits.app`, `DTSTAMP:${icsDate(new Date())}`, `DTSTART:${icsDate(e.start)}`, `DTEND:${icsDate(e.end)}`,
    `SUMMARY:${icsText(e.title)}`, `LOCATION:${icsText(e.location)}`, `DESCRIPTION:${icsText(e.notes)}`,
    'BEGIN:VALARM', 'TRIGGER:-PT2H', 'ACTION:DISPLAY', `DESCRIPTION:${icsText(e.title)}`, 'END:VALARM',
    'END:VEVENT', 'END:VCALENDAR', '',
  ].join('\r\n');
}

// Resolves to what happened, so the screen can say it honestly.
export async function addToCalendar(r: HitRequest, address?: string | null): Promise<'added' | 'opened' | 'cancelled' | 'downloaded' | 'failed'> {
  const e = eventFor(r, address);
  if (Platform.OS === 'web') {
    try {
      const blob = new Blob([ics(e, r.id)], { type: 'text/calendar;charset=utf-8' });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = `hits-${r.id}.ics`;
      document.body.appendChild(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(a.href), 4000);
      return 'downloaded';
    } catch { return 'failed'; }
  }
  try {
    const Calendar = require('expo-calendar/legacy');
    const res = await Calendar.createEventInCalendarAsync({
      title: e.title, startDate: e.start, endDate: e.end, location: e.location, notes: e.notes,
      alarms: [{ relativeOffset: -120 }],
    });
    const action = String(res?.action ?? '');
    if (action === 'saved') return 'added';
    if (action === 'canceled' || action === 'deleted') return 'cancelled';
    return 'opened';    // Android hands off to the calendar app and cannot tell us more
  } catch {
    // No native module (an old build) or no calendar app: fall back to Google Calendar.
    const q = new URLSearchParams({ action: 'TEMPLATE', text: e.title, dates: `${icsDate(e.start)}/${icsDate(e.end)}`, location: e.location, details: e.notes });
    try { await Linking.openURL(`https://calendar.google.com/calendar/render?${q.toString()}`); return 'opened'; } catch { return 'failed'; }
  }
}

// Directions by name: the court list holds names, not coordinates, so the maps app
// does the finding. Apple Maps on iOS, the default maps app on Android.
export async function directionsTo(place: string): Promise<boolean> {
  const q = encodeURIComponent(place);
  const url = Platform.OS === 'ios' ? `http://maps.apple.com/?daddr=${q}`
    : Platform.OS === 'android' ? `geo:0,0?q=${q}`
    : `https://www.google.com/maps/dir/?api=1&destination=${q}`;
  try { await Linking.openURL(url); return true; } catch { return false; }
}
