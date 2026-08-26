const CALENDAR_API = 'https://www.googleapis.com/calendar/v3'

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
