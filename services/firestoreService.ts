
import { db } from './firebase';
import {
  doc, getDoc, setDoc, writeBatch,
  onSnapshot,
} from 'firebase/firestore';
import { UserProfile, DailyData, RoutineConfig, LifeGoalMatrix } from '../types';

// ─── User Profile ──────────────────────────────────────────────────────────

export const getUserProfile = async (uid: string): Promise<UserProfile | null> => {
  const snap = await getDoc(doc(db, 'users', uid));
  return snap.exists() ? (snap.data() as UserProfile) : null;
};

export const createUserProfile = async (uid: string, email: string): Promise<UserProfile> => {
  const profile: UserProfile = {
    uid,
    email,
    createdAt: Date.now(),
    isOnboarded: false,
    wakeRoutine:    { time: '07:00', activities: '' },
    sleepRoutine:   { time: '22:30', activities: '' },
    lifeGoalMatrix: { text: '' },
  };
  await setDoc(doc(db, 'users', uid), profile);
  return profile;
};

export const completeOnboarding = async (
  uid: string,
  wakeRoutine: RoutineConfig,
  sleepRoutine: RoutineConfig,
  lifeGoalMatrix: LifeGoalMatrix,
): Promise<void> => {
  // setDoc + merge: 문서가 없어도 안전하게 생성/업데이트
  await setDoc(doc(db, 'users', uid), {
    isOnboarded: true,
    wakeRoutine,
    sleepRoutine,
    lifeGoalMatrix,
  }, { merge: true });
};

export const updateUserProfile = async (
  uid: string,
  updates: Partial<Pick<UserProfile, 'wakeRoutine' | 'sleepRoutine' | 'lifeGoalMatrix'>>,
): Promise<void> => {
  await setDoc(doc(db, 'users', uid), updates, { merge: true });
};

/** Real-time listener for profile changes (cross-device) */
export const subscribeToUserProfile = (
  uid: string,
  callback: (profile: UserProfile | null) => void,
): (() => void) => {
  return onSnapshot(doc(db, 'users', uid), (snap) => {
    callback(snap.exists() ? (snap.data() as UserProfile) : null);
  });
};

// ─── Daily Data ────────────────────────────────────────────────────────────

export const getDailyData = async (uid: string, date: string): Promise<DailyData | null> => {
  const snap = await getDoc(doc(db, 'users', uid, 'dailyData', date));
  return snap.exists() ? (snap.data() as DailyData) : null;
};

export const persistDailyData = async (uid: string, data: DailyData): Promise<void> => {
  await setDoc(doc(db, 'users', uid, 'dailyData', data.date), data);
};

/** Real-time listener for a single date's data (cross-device) */
export const subscribeToDailyData = (
  uid: string,
  date: string,
  callback: (data: DailyData | null) => void,
): (() => void) => {
  return onSnapshot(
    doc(db, 'users', uid, 'dailyData', date),
    (snap) => callback(snap.exists() ? (snap.data() as DailyData) : null),
  );
};

// ─── localStorage Migration ────────────────────────────────────────────────

/**
 * 기존 localStorage 데이터를 Firestore로 마이그레이션.
 * 완료 후 localStorage 항목 삭제.
 */
export const migrateFromLocalStorage = async (uid: string, email: string): Promise<number> => {
  const prefix = `cloud_matrix_${email}_`;
  const keys = Object.keys(localStorage).filter((k) => k.startsWith(prefix));
  if (keys.length === 0) return 0;

  const batch = writeBatch(db);

  for (const key of keys) {
    const date = key.replace(prefix, '');
    try {
      const raw = localStorage.getItem(key);
      if (!raw) continue;
      const old = JSON.parse(raw);

      const newData: DailyData = {
        date,
        tasks:          old.tasks ?? [],
        wakeCompleted:  old.wakeRoutine?.completed  ?? false,
        sleepCompleted: old.sleepRoutine?.completed ?? false,
        updatedAt:      old.updatedAt ?? Date.now(),
      };
      batch.set(doc(db, 'users', uid, 'dailyData', date), newData);
    } catch {
      // 손상된 항목은 건너뜀
    }
  }

  await batch.commit();
  keys.forEach((k) => localStorage.removeItem(k));

  // 세션 정보도 제거
  localStorage.removeItem('pd_v3_session');

  return keys.length;
};
