import { GoogleAuthProvider, signInWithPopup, getAuth } from 'firebase/auth';
import { doc, setDoc, getDoc } from 'firebase/firestore';
import { auth, db } from './firebase';
import { Task } from '../types';

const CALENDAR_SCOPE = 'https://www.googleapis.com/auth/calendar.events';

// ─── OAuth 토큰 관리 ─────────────────────────────────────────────────────────

/**
 * Google Calendar 권한 요청.
 * signInWithPopup으로 calendar.events scope 추가 동의를 받고
 * access token을 Firestore에 저장.
 */
export const requestCalendarAccess = async (): Promise<string> => {
  const provider = new GoogleAuthProvider();
  provider.addScope(CALENDAR_SCOPE);
  provider.setCustomParameters({ prompt: 'consent' });

  const result = await signInWithPopup(auth, provider);
  const credential = GoogleAuthProvider.credentialFromResult(result);
  const accessToken = credential?.accessToken;

  if (!accessToken) throw new Error('Access token을 가져올 수 없습니다.');

  // Firestore에 저장 (보안: 실제 서비스에서는 서버사이드에서 처리 권장)
  const uid = result.user.uid;
  await setDoc(
    doc(db, 'users', uid),
    { googleCalendarToken: accessToken, googleCalendarEnabled: true },
    { merge: true }
  );

  return accessToken;
};

/**
 * 유저의 Calendar 연동 여부 확인
 */
export const getCalendarStatus = async (uid: string): Promise<boolean> => {
  const snap = await getDoc(doc(db, 'users', uid));
  return snap.data()?.googleCalendarEnabled === true;
};

/**
 * Calendar 연동 해제
 */
export const disconnectCalendar = async (uid: string): Promise<void> => {
  await setDoc(
    doc(db, 'users', uid),
    { googleCalendarEnabled: false, googleCalendarToken: null },
    { merge: true }
  );
};

// ─── 캘린더 이벤트 생성 ──────────────────────────────────────────────────────

interface CalendarEvent {
  summary: string
  description?: string
  start: { dateTime: string; timeZone: string }
  end:   { dateTime: string; timeZone: string }
  colorId?: string
}

/** Task → Google Calendar 이벤트 변환 */
const taskToEvent = (task: Task, date: string, timeZone: string): CalendarEvent => {
  const timeSlot = task.timeSlot ?? '09:00';
  const [hour, minute] = timeSlot.split(':').map(Number);

  const start = new Date(`${date}T${timeSlot}:00`);
  const end   = new Date(start.getTime() + 30 * 60 * 1000); // 30분 블록

  const pad = (n: number) => String(n).padStart(2, '0');
  const fmt = (d: Date) =>
    `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}:00`;

  // 타입별 색상 (Google Calendar colorId)
  const colorMap: Record<string, string> = {
    PRIORITY: '11', // 토마토 빨강
    GOAL:     '6',  // 감귤 오렌지
    SCHEDULE: '7',  // 공작 파랑
    ROUTINE:  '2',  // 세이지 초록
  };

  return {
    summary:     task.content,
    description: `[PeakDone] ${task.type} 타임블록${task.delayDays > 0 ? ` (${task.delayDays}일 지연)` : ''}`,
    start: { dateTime: fmt(start), timeZone },
    end:   { dateTime: fmt(end),   timeZone },
    colorId: colorMap[task.type] ?? '1',
  };
};

/**
 * 특정 날짜의 태스크 목록을 Google Calendar에 일괄 등록
 */
export const syncTasksToCalendar = async (
  tasks: Task[],
  date: string,
  accessToken: string,
): Promise<{ success: number; failed: number }> => {
  const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
  const scheduledTasks = tasks.filter((t) => t.timeSlot && !t.isArchived);

  let success = 0;
  let failed  = 0;

  await Promise.all(
    scheduledTasks.map(async (task) => {
      try {
        const event = taskToEvent(task, date, timeZone);
        const res = await fetch(
          'https://www.googleapis.com/calendar/v3/calendars/primary/events',
          {
            method: 'POST',
            headers: {
              Authorization: `Bearer ${accessToken}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify(event),
          }
        );
        if (res.ok) {
          success++;
        } else {
          const err = await res.json();
          console.error('캘린더 등록 실패:', err);
          failed++;
        }
      } catch {
        failed++;
      }
    })
  );

  return { success, failed };
};
