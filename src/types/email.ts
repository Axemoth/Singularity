export type Priority = 'urgent' | 'normal' | 'low';

export interface EmailAddress {
  name: string;
  email: string;
}

export interface Attachment {
  id: string;
  filename: string;
  mimeType: string;
  size: number;
}

export interface EmailMessage {
  id: string;
  threadId: string;
  from: EmailAddress;
  to: EmailAddress[];
  cc?: EmailAddress[];
  bcc?: EmailAddress[];
  subject: string;
  body: string;
  bodyHtml?: string;
  date: string;
  isRead: boolean;
  labels: string[];
  attachments: Attachment[];
}

export interface EmailThread {
  id: string;
  subject: string;
  snippet: string;
  messages: EmailMessage[];
  lastMessageDate: string;
  isRead: boolean;
  isStarred: boolean;
  labels: string[];
  priority: Priority;
  accountId: string;
}

export interface EmailAccount {
  id: string;
  email: string;
  name: string;
  avatar?: string;
  color: string; // For UI badge color
}

export interface EmailLabel {
  id: string;
  name: string;
  color?: string;
  type: 'system' | 'user';
}
