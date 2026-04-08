import * as fs from 'fs';
import { getRecentLogEntries } from './log-buffer';
import { getCurrentLogPath } from './log-paths';
import {
  isLoggingLevel,
  type LogEntry,
  type LogSourceSummary,
  type ReadLogEntriesOptions,
} from './log-types';

function parseLogLine(line: string): LogEntry | null {
  try {
    return JSON.parse(line) as LogEntry;
  } catch {
    return null;
  }
}

function readCurrentFileEntries(): LogEntry[] {
  const currentLogPath = getCurrentLogPath();
  if (!fs.existsSync(currentLogPath)) {
    return [];
  }

  return fs
    .readFileSync(currentLogPath, 'utf8')
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .map(parseLogLine)
    .filter((entry): entry is LogEntry => entry !== null);
}

function dedupeEntries(entries: LogEntry[]): LogEntry[] {
  const seen = new Map<string, LogEntry>();
  for (const entry of entries) {
    seen.set(entry.id, entry);
  }
  return [...seen.values()];
}

export function readLogEntries(options: ReadLogEntriesOptions = {}): LogEntry[] {
  const entries = dedupeEntries([...readCurrentFileEntries(), ...getRecentLogEntries()])
    .filter((entry) => (options.source ? entry.source === options.source : true))
    .filter((entry) => (options.level ? entry.level === options.level : true))
    .filter((entry) => {
      if (!options.search) {
        return true;
      }
      const search = options.search.toLowerCase();
      return (
        entry.message.toLowerCase().includes(search) ||
        entry.event.toLowerCase().includes(search) ||
        entry.source.toLowerCase().includes(search) ||
        String(entry.processId).toLowerCase().includes(search) ||
        entry.runId.toLowerCase().includes(search) ||
        JSON.stringify(entry.context || {})
          .toLowerCase()
          .includes(search)
      );
    })
    .sort((a, b) => Date.parse(b.timestamp) - Date.parse(a.timestamp));

  return entries.slice(0, options.limit ?? 200);
}

export function readLogSourceSummaries(): LogSourceSummary[] {
  const summaryMap = new Map<string, LogSourceSummary>();
  for (const entry of readLogEntries({ limit: 500 })) {
    const current = summaryMap.get(entry.source) ?? {
      source: entry.source,
      label: entry.source,
      kind: 'native' as const,
      count: 0,
      lastTimestamp: null,
    };
    current.count += 1;
    current.lastTimestamp = current.lastTimestamp ?? entry.timestamp;
    summaryMap.set(entry.source, current);
  }

  return [...summaryMap.values()].sort((a, b) => a.label.localeCompare(b.label));
}

export function normalizeLogQueryLevel(level: string | undefined) {
  return isLoggingLevel(level) ? level : undefined;
}
