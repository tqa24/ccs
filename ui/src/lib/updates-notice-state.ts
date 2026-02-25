import { type SupportNotice, type SupportStatus } from '@/lib/support-updates-catalog';

export type NoticeProgressState = 'new' | 'seen' | 'done' | 'dismissed';

export type NoticeProgressMap = Record<string, NoticeProgressState>;

const NOTICE_PROGRESS_STORAGE_KEY = 'ccs:updates:notice-progress:v1';

export function getDefaultNoticeProgress(status: SupportStatus): NoticeProgressState {
  return status === 'new' ? 'new' : 'seen';
}

export function getNoticeProgress(
  notice: Pick<SupportNotice, 'id' | 'status'>,
  progressMap: NoticeProgressMap
): NoticeProgressState {
  return progressMap[notice.id] ?? getDefaultNoticeProgress(notice.status);
}

export function isActionableNoticeState(progress: NoticeProgressState): boolean {
  return progress !== 'done' && progress !== 'dismissed';
}

export function readNoticeProgressMap(): NoticeProgressMap {
  if (typeof window === 'undefined') {
    return {};
  }

  try {
    const rawValue = window.localStorage.getItem(NOTICE_PROGRESS_STORAGE_KEY);
    if (!rawValue) {
      return {};
    }

    const parsed = JSON.parse(rawValue);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      return {};
    }

    const normalized: NoticeProgressMap = {};
    for (const [key, value] of Object.entries(parsed)) {
      if (typeof key !== 'string') {
        continue;
      }

      if (value === 'new' || value === 'seen' || value === 'done' || value === 'dismissed') {
        normalized[key] = value;
      }
    }

    return normalized;
  } catch {
    return {};
  }
}

export function writeNoticeProgressMap(progressMap: NoticeProgressMap): void {
  if (typeof window === 'undefined') {
    return;
  }

  window.localStorage.setItem(NOTICE_PROGRESS_STORAGE_KEY, JSON.stringify(progressMap));
}
