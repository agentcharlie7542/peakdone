
export enum TaskType {
  PRIORITY = 'PRIORITY',
  GOAL = 'GOAL',
  SCHEDULE = 'SCHEDULE',
  ROUTINE = 'ROUTINE'
}

export interface Task {
  id: string;
  content: string;
  type: TaskType;
  timeSlot?: string;
  completed: boolean;
  date: string;
  originalDate: string;
  delayDays: number;
  delayed?: boolean; // 지연 상태 플래그
  memo?: string;
  isArchived?: boolean;
}

// ─── User Profile (Firestore: users/{uid}) ─────────────────────────────────

export interface RoutineConfig {
  time: string;       // e.g. "07:00"
  activities: string; // comma-separated list
}

export interface LifeGoalMatrix {
  text: string;
}

export interface UserProfile {
  uid: string;
  email: string;
  createdAt: number;
  isOnboarded: boolean;
  wakeRoutine: RoutineConfig;
  sleepRoutine: RoutineConfig;
  lifeGoalMatrix: LifeGoalMatrix;
  // 리포트 알림 설정 (Google API 자동화)
  reportNotification?: {
    weekly: boolean;
    monthly: boolean;
  };
  notificationToken?: string; // Firebase Cloud Messaging
}

// ─── Daily Data (Firestore: users/{uid}/dailyData/{date}) ──────────────────
// Routine settings live in UserProfile. DailyData only tracks completion.

export interface DailyData {
  date: string;
  tasks: Task[];
  wakeCompleted: boolean;
  sleepCompleted: boolean;
  updatedAt: number;
}
