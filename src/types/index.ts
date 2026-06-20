export type UserRole = 'academy_owner' | 'coach' | 'student' | 'parent';

export type AcademyType = 'academy' | 'independent_coach';
export type EntityStatus = 'active' | 'inactive';
export type StudentLevel = 'basic' | 'beginner' | 'intermediate' | 'advanced' | 'master';
export type FeeStatus = 'paid' | 'pending' | 'overdue' | 'waived';
export type PaymentMethod = 'cash' | 'upi' | 'bank_transfer' | 'card' | 'other';
export type CoachRole = 'head_coach' | 'coach' | 'assistant_coach';
export type BatchMode = 'online' | 'offline' | 'hybrid';
export type AttendanceStatus = 'present' | 'absent' | 'late' | 'excused';
export type ClassReportStatus = 'draft' | 'completed' | 'shared';
export type StudentPerformance = 'excellent' | 'good' | 'needs_practice' | 'absent' | 'not_observed';
export type RoadmapStatus = 'Mock Data' | 'Coming Soon' | 'Phase 2' | 'Phase 3' | 'Phase 4' | 'Phase 5' | 'Phase 6' | 'Future Integration';

export type Status =
  | EntityStatus
  | FeeStatus
  | 'draft'
  | 'completed'
  | 'shared'
  | 'sent'
  | 'ready'
  | 'pending_setup'
  | 'future_integration'
  | AttendanceStatus;

export interface Academy {
  id: string;
  name: string;
  ownerName: string;
  email: string;
  phone: string;
  city: string;
  type: AcademyType;
  status: EntityStatus;
}

export interface Student {
  id: string;
  academyId: string;
  name: string;
  age: number;
  parentName: string;
  parentEmail: string;
  parentPhone: string;
  level: StudentLevel;
  batchId: string;
  monthlyFee: number;
  feeStatus: FeeStatus;
  progress: number;
  status: EntityStatus;
  joinedAt: string;
  internalNotes?: string;
  goals?: string;
  strengths?: string;
  improvementAreas?: string;
}

export interface Coach {
  id: string;
  academyId: string;
  name: string;
  email: string;
  phone: string;
  role: CoachRole;
  status: EntityStatus;
  joinedAt: string;
}

export interface Batch {
  id: string;
  academyId: string;
  name: string;
  level: StudentLevel;
  coachId: string;
  scheduleDays: string[];
  startTime: string;
  endTime: string;
  mode: BatchMode;
  status: EntityStatus;
}

export interface AttendanceRecord {
  id: string;
  batchId: string;
  coachId: string;
  date: string;
  entries: AttendanceEntry[];
  createdAt: string;
  updatedAt: string;
  status: 'draft' | 'completed';
}

export interface AttendanceEntry {
  studentId: string;
  status: AttendanceStatus;
  note?: string;
}

export interface ClassReport {
  id: string;
  batchId: string;
  coachId: string;
  date: string;
  title: string;
  topicsCovered: string[];
  skillsPracticed: string[];
  homework: string;
  generalNotes: string;
  studentNotes: StudentReportNote[];
  attendanceRecordId?: string;
  status: ClassReportStatus;
  createdAt: string;
  updatedAt: string;
}

export interface StudentReportNote {
  studentId: string;
  note: string;
  performance: StudentPerformance;
}

export interface FeeRecord {
  id: string;
  studentId: string;
  batchId?: string;
  month: number;
  year: number;
  amount: number;
  status: FeeStatus;
  paymentMethod?: PaymentMethod;
  paidDate?: string;
  dueDate: string;
  notes?: string;
  createdAt: string;
  updatedAt: string;
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
  priority: 'normal' | 'high';
}

export interface PlayAccess {
  id: string;
  studentId: string;
  status: 'ready' | 'pending_setup' | 'future_integration';
}
