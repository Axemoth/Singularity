export type EventStatus = 'confirmed' | 'tentative' | 'cancelled';

export interface Attendee {
  email: string;
  name?: string;
  responseStatus: 'needsAction' | 'declined' | 'tentative' | 'accepted';
}

export interface CalendarEvent {
  id: string;
  calendarId: string;
  title: string;
  description?: string;
  location?: string;
  start: string; // ISO 8601
  end: string; // ISO 8601
  allDay: boolean;
  status: EventStatus;
  attendees: Attendee[];
  color?: string;
  accountId: string;
}

export interface Calendar {
  id: string;
  name: string;
  color: string;
  accountId: string;
  isVisible: boolean;
}
