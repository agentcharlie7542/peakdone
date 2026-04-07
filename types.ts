
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
