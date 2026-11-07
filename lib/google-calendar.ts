const CALENDAR_API = 'https://www.googleapis.com/calendar/v3'

export const CALENDAR_TIME_ZONE = 'America/Chicago'
export const DEFAULT_EVENT_DURATION_MINUTES = 30

const NAIVE_LOCAL =
  /^(\d{4}-\d{2}-\d{2})[T ](\d{2}:\d{2})(?::(\d{2}))?(?:\.\d+)?$/

export type EventWindow = {
  startDateTime: string
  endDateTime: string
  timeZone: string
}

function pad(n: number): string {
  return String(n).padStart(2, '0')
}

function addMinutesToNaiveLocal(
  datePart: string,
  hourMinute: string,
  second: string,
  minutes: number,
): string {
  const [year, month, day] = datePart.split('-').map(Number)
  const [hour, minute] = hourMinute.split(':').map(Number)
  const utc = Date.UTC(year, month - 1, day, hour, minute, Number(second) || 0)
  const end = new Date(utc + minutes * 60_000)
  return `${end.getUTCFullYear()}-${pad(end.getUTCMonth() + 1)}-${pad(end.getUTCDate())}T${pad(end.getUTCHours())}:${pad(end.getUTCMinutes())}:${pad(end.getUTCSeconds())}`
}

/** Naive local datetimes (no Z / offset) are America/Chicago civil time. */
export function resolveEventWindow(
  startDateTime?: string,
  durationMinutes = DEFAULT_EVENT_DURATION_MINUTES,
): EventWindow {
  const duration =
    Number.isFinite(durationMinutes) && durationMinutes > 0
      ? durationMinutes
      : DEFAULT_EVENT_DURATION_MINUTES

  if (!startDateTime?.trim()) {
    const start = new Date()
    const end = new Date(start.getTime() + duration * 60_000)
    return {
      startDateTime: start.toISOString(),
      endDateTime: end.toISOString(),
      timeZone: CALENDAR_TIME_ZONE,
    }
  }

  const trimmed = startDateTime.trim()
  const naive = trimmed.match(NAIVE_LOCAL)
  if (naive) {
    const [, datePart, hourMinute, second = '00'] = naive
    const startLocal = `${datePart}T${hourMinute}:${second}`
    return {
      startDateTime: startLocal,
      endDateTime: addMinutesToNaiveLocal(datePart, hourMinute, second, duration),
      timeZone: CALENDAR_TIME_ZONE,
    }
  }

  const start = new Date(trimmed)
  if (Number.isNaN(start.getTime())) {
    throw new Error(`Invalid startDateTime: ${startDateTime}`)
  }
  const end = new Date(start.getTime() + duration * 60_000)
  return {
    startDateTime: start.toISOString(),
    endDateTime: end.toISOString(),
    timeZone: CALENDAR_TIME_ZONE,
  }
}

export function formatInChicago(dateTime: string): string {
  const date = new Date(dateTime)
  if (Number.isNaN(date.getTime())) {
    return dateTime
  }
  return new Intl.DateTimeFormat('en-US', {
    timeZone: CALENDAR_TIME_ZONE,
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    timeZoneName: 'short',
  }).format(date)
}

export function nowInChicagoLabel(): string {
  const now = new Date()
  const human = new Intl.DateTimeFormat('en-US', {
    timeZone: CALENDAR_TIME_ZONE,
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    timeZoneName: 'short',
  }).format(now)
  const isoDate = new Intl.DateTimeFormat('en-CA', {
    timeZone: CALENDAR_TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(now)
  return `${human} (${isoDate})`
}

export type CalendarEvent = {
  id: string
  summary: string
  htmlLink?: string
  description?: string
  location?: string
  start: { dateTime: string; timeZone?: string }
  end: { dateTime: string; timeZone?: string }
  status?: string
}

export type CreateEventInput = {
  summary: string
  description?: string
  location?: string
  startDateTime: string
  endDateTime: string
  timeZone?: string
}

async function calendarFetch(path: string, accessToken: string, options: RequestInit = {}) {
  const res = await fetch(`${CALENDAR_API}${path}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
      ...(options.headers ?? {}),
    },
  })

  if (!res.ok) {
    const error = await res.text()
    throw new Error(`Google Calendar API error ${res.status}: ${error}`)
  }

  return res.status === 204 ? null : res.json()
}

/** Token Vault pattern from https://github.com/mtliendo/auth0-calendar-workshop */
export async function createEvent(
  accessToken: string,
  input: CreateEventInput,
): Promise<CalendarEvent> {
  return calendarFetch('/calendars/primary/events', accessToken, {
    method: 'POST',
    body: JSON.stringify({
      summary: input.summary,
      description: input.description,
      location: input.location,
      start: {
        dateTime: input.startDateTime,
        timeZone: input.timeZone ?? 'UTC',
      },
      end: {
        dateTime: input.endDateTime,
        timeZone: input.timeZone ?? 'UTC',
      },
    }),
  })
}
