// Shared domain types live here. Exports added as packages need them.

export type ConversationStatus = 'open' | 'stale' | 'analyzed';

export type ReviewItemKind = 'calendar' | 'task' | 'knowledge';

export type ReviewItemStatus = 'pending' | 'approved' | 'rejected' | 'executed';

export type AnalysisCategory = 'meeting' | 'task' | 'knowledge' | 'none';

export interface MeetingPayload {
  title: string;
  startIso: string;
  endIso: string;
  attendees: string[];
  location?: string;
  notes?: string;
}

export interface TaskPayload {
  title: string;
  dueIso?: string;
  notes?: string;
}

export interface KnowledgePayload {
  topic: string;
  contentMd: string;
  tags: string[];
}

export type ReviewPayload = MeetingPayload | TaskPayload | KnowledgePayload;
