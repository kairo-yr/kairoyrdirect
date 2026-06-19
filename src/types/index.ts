export type UserRole = 'academy_owner' | 'coach' | 'student' | 'parent';

export type StudentLevel = 'Beginner' | 'Intermediate' | 'Advanced' | 'Tournament';

export type Status = 'Active' | 'Pending' | 'Completed' | 'Draft' | 'Sent' | 'Paid' | 'Overdue';

export type RoadmapStatus = 'Mock Data' | 'Coming Soon' | 'Phase 2' | 'Future Integration';

export interface Academy {
  id: string;
  name: string;
  ownerName: string;
}

export interface Student {
  id: string;
  academyId: string;
  name: string;
  level: StudentLevel;
  batchId: string;
  feeStatus: 'Paid' | 'Pending' | 'Overdue';
  progress: number;
  joinedAt: string;
}

export interface Batch {
  id: string;
  academyId: string;
  name: string;
  coachId: string;
  schedule: string;
  level: StudentLevel;
}

export interface Coach {
  id: string;
  academyId: string;
  name: string;
  assignedBatchIds: string[];
  weeklyClasses: number;
}

export interface AttendanceRecord {
  id: string;
  batchId: string;
  date: string;
  presentCount: number;
  absentCount: number;
  status: 'Draft' | 'Completed';
}

export interface ClassReport {
  id: string;
  studentId?: string;
  batchId?: string;
  coachId: string;
  topic: string;
  date: string;
  status: 'Draft' | 'Sent';
}

export interface FeeRecord {
  id: string;
  studentId: string;
  amount: number;
  status: 'Paid' | 'Pending' | 'Overdue';
  dueDate: string;
}

export interface Stat {
  label: string;
  value: string;
  helper: string;
}

export interface Feature {
  title: string;
  description: string;
  status?: RoadmapStatus;
}

export interface TodayClass {
  id: string;
  batchId: string;
  coachId: string;
  time: string;
  room: string;
}

export interface ParentUpdate {
  id: string;
  studentId: string;
  reason: string;
  priority: 'Normal' | 'High';
}

export interface PlayAccess {
  id: string;
  studentId: string;
  status: 'Ready' | 'Pending Setup' | 'Future Integration';
}
