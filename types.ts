
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
  timeSlot?: string; // e.g., "08:30"
  completed: boolean;
  date: string; // YYYY-MM-DD
  originalDate: string;
  delayDays: number;
  memo?: string;
  isArchived?: boolean;
}

export interface DailyVision {
  text: string;
  targetWeight?: string;
  targetAssets?: string;
}

export interface Routine {
  id: string;
  type: 'wake' | 'sleep';
  time: string;
  activities: string;
  completed: boolean;
}

export interface DailyData {
  date: string;
  tasks: Task[];
  wakeRoutine: Routine;
  sleepRoutine: Routine;
  vision: DailyVision;
  updatedAt: number; // Added for sync priority logic
}

export interface User {
  email: string;
  token: string;
  lastSync: string;
  isLoggedIn: boolean;
}
