import type {
  Academy,
  AttendanceRecord,
  AttendanceStatus,
  Batch,
  BatchMode,
  ClassReport,
  ClassReportStatus,
  Coach,
  CoachRole,
  EntityStatus,
  Feature,
  FeeRecord,
  FeeStatus,
  ParentUpdate,
  PaymentMethod,
  PlayAccess,
  Student,
  StudentLevel,
  StudentPerformance,
  TodayClass,
  UserRole,
} from '../types';
import { PLAY_APP_NAME } from '../config/brand';

export const mockRole: UserRole = 'academy_owner';

export const levelLabels: Record<StudentLevel, string> = {
  basic: 'Basic',
  beginner: 'Beginner',
  intermediate: 'Intermediate',
  advanced: 'Advanced',
  master: 'Master',
};

export const feeStatusLabels: Record<FeeStatus, string> = {
  paid: 'Paid',
  pending: 'Pending',
  overdue: 'Overdue',
  waived: 'Waived',
};

export const paymentMethodLabels: Record<PaymentMethod, string> = {
  cash: 'Cash',
  upi: 'UPI',
  bank_transfer: 'Bank Transfer',
  card: 'Card',
  other: 'Other',
};

export const statusLabels: Record<EntityStatus, string> = {
  active: 'Active',
  inactive: 'Inactive',
};

export const recordStatusLabels: Record<'completed' | 'draft', string> = {
  completed: 'Completed',
  draft: 'Draft',
};

export const classReportStatusLabels: Record<ClassReportStatus, string> = {
  draft: 'Draft',
  completed: 'Completed',
  shared: 'Shared',
};

export const performanceLabels: Record<StudentPerformance, string> = {
  excellent: 'Excellent',
  good: 'Good',
  needs_practice: 'Needs Practice',
  absent: 'Absent',
  not_observed: 'Not Observed',
};

export const coachRoleLabels: Record<CoachRole, string> = {
  head_coach: 'Head Coach',
  coach: 'Coach',
  assistant_coach: 'Assistant Coach',
};

export const modeLabels: Record<BatchMode, string> = {
  online: 'Online',
  offline: 'Offline',
  hybrid: 'Hybrid',
};

export const attendanceStatusLabels: Record<AttendanceStatus, string> = {
  present: 'Present',
  absent: 'Absent',
  late: 'Late',
  excused: 'Excused',
};

export const seedAcademy: Academy = {
  id: 'academy-kairoyr',
  name: 'Kairoyr School of Chess',
  ownerName: 'Yogendra Reddy',
  email: 'kairoyrchess@gmail.com',
  phone: '94487 26256',
  city: 'Bengaluru',
  type: 'academy',
  status: 'active',
};

export const seedCoaches: Coach[] = [
  { id: 'coach-arjun', academyId: seedAcademy.id, name: 'Arjun Mehta', email: 'arjun@kairoyr.com', phone: '98450 10001', role: 'head_coach', status: 'active', joinedAt: '2026-02-14' },
  { id: 'coach-priya', academyId: seedAcademy.id, name: 'Priya Nair', email: 'priya@kairoyr.com', phone: '98450 10002', role: 'coach', status: 'active', joinedAt: '2026-03-05' },
  { id: 'coach-vikram', academyId: seedAcademy.id, name: 'Vikram Sen', email: 'vikram@kairoyr.com', phone: '98450 10003', role: 'coach', status: 'active', joinedAt: '2026-04-09' },
  { id: 'coach-maya', academyId: seedAcademy.id, name: 'Maya Iyer', email: 'maya@kairoyr.com', phone: '98450 10004', role: 'assistant_coach', status: 'inactive', joinedAt: '2026-05-17' },
];

export const seedBatches: Batch[] = [
  { id: 'batch-saturday-knights', academyId: seedAcademy.id, name: 'Saturday Knights', level: 'beginner', coachId: 'coach-arjun', scheduleDays: ['Saturday'], startTime: '10:00', endTime: '11:30', mode: 'offline', status: 'active' },
  { id: 'batch-tactical-juniors', academyId: seedAcademy.id, name: 'Tactical Juniors', level: 'intermediate', coachId: 'coach-priya', scheduleDays: ['Tuesday', 'Thursday'], startTime: '17:30', endTime: '18:45', mode: 'hybrid', status: 'active' },
  { id: 'batch-tournament-lab', academyId: seedAcademy.id, name: 'Tournament Lab', level: 'advanced', coachId: 'coach-vikram', scheduleDays: ['Sunday'], startTime: '16:00', endTime: '18:00', mode: 'offline', status: 'active' },
  { id: 'batch-opening-builders', academyId: seedAcademy.id, name: 'Opening Builders', level: 'basic', coachId: 'coach-arjun', scheduleDays: ['Monday', 'Wednesday'], startTime: '18:00', endTime: '19:00', mode: 'online', status: 'active' },
  { id: 'batch-master-prep', academyId: seedAcademy.id, name: 'Master Prep', level: 'master', coachId: '', scheduleDays: ['Friday'], startTime: '19:00', endTime: '20:15', mode: 'online', status: 'inactive' },
];

export const seedStudents: Student[] = [
  { id: 'student-isha', academyId: seedAcademy.id, name: 'Isha Rao', age: 9, parentName: 'Meera Rao', parentEmail: 'meera.rao@example.com', parentPhone: '98450 20001', level: 'beginner', batchId: 'batch-saturday-knights', monthlyFee: 3500, feeStatus: 'paid', progress: 42, status: 'active', joinedAt: '2026-06-02', goals: 'Build confidence in tactical puzzles.', strengths: 'Curious learner with improving board vision.', improvementAreas: 'Slow down before moving pieces in tactical positions.' },
  { id: 'student-rohan', academyId: seedAcademy.id, name: 'Rohan Rao', age: 12, parentName: 'Sandeep Rao', parentEmail: 'sandeep.rao@example.com', parentPhone: '98450 20002', level: 'intermediate', batchId: 'batch-tactical-juniors', monthlyFee: 4000, feeStatus: 'pending', progress: 64, status: 'active', joinedAt: '2026-05-22', goals: 'Prepare for school tournament games.', strengths: 'Good calculation when focused.', improvementAreas: 'Needs consistency with opening principles.' },
  { id: 'student-tara', academyId: seedAcademy.id, name: 'Tara Menon', age: 13, parentName: 'Anita Menon', parentEmail: 'anita.menon@example.com', parentPhone: '98450 20003', level: 'advanced', batchId: 'batch-tournament-lab', monthlyFee: 5000, feeStatus: 'paid', progress: 78, status: 'active', joinedAt: '2026-05-14', goals: 'Strengthen endgame conversion technique.', strengths: 'Strong endgame focus and calculation.', improvementAreas: 'Time management in longer games.' },
  { id: 'student-aarav', academyId: seedAcademy.id, name: 'Aarav Kapoor', age: 11, parentName: 'Ritika Kapoor', parentEmail: 'ritika.kapoor@example.com', parentPhone: '98450 20004', level: 'intermediate', batchId: 'batch-tactical-juniors', monthlyFee: 4000, feeStatus: 'overdue', progress: 58, status: 'active', joinedAt: '2026-04-28', internalNotes: 'Follow up with parent on attendance and fee dues.', goals: 'Improve attendance rhythm and practice completion.', improvementAreas: 'Missed recent class; needs recap.' },
  { id: 'student-nila', academyId: seedAcademy.id, name: 'Nila Shah', age: 8, parentName: 'Kunal Shah', parentEmail: 'kunal.shah@example.com', parentPhone: '98450 20005', level: 'basic', batchId: 'batch-opening-builders', monthlyFee: 3000, feeStatus: 'waived', progress: 35, status: 'active', joinedAt: '2026-06-17', goals: 'Learn board coordinates and basic piece safety.', strengths: 'Eager participation.' },
  { id: 'student-dev', academyId: seedAcademy.id, name: 'Dev Iyer', age: 10, parentName: 'Lakshmi Iyer', parentEmail: 'lakshmi.iyer@example.com', parentPhone: '98450 20006', level: 'basic', batchId: '', monthlyFee: 2500, feeStatus: 'pending', progress: 18, status: 'inactive', joinedAt: '2026-06-19' },
];

export const academies: Academy[] = [
  seedAcademy,
  { id: 'academy-knights', name: 'Knight Vision Chess Studio', ownerName: 'Priya Nair', email: 'hello@knightvision.example', phone: '98450 30001', city: 'Mysuru', type: 'academy', status: 'active' },
];

export const attendanceRecords: AttendanceRecord[] = [
  {
    id: 'attendance-1',
    batchId: 'batch-saturday-knights',
    coachId: 'coach-arjun',
    date: '2026-06-20',
    entries: [
      { studentId: 'student-isha', status: 'present' },
    ],
    createdAt: '2026-06-20T10:00:00.000Z',
    updatedAt: '2026-06-20T10:10:00.000Z',
    status: 'completed',
  },
  {
    id: 'attendance-2',
    batchId: 'batch-tactical-juniors',
    coachId: 'coach-priya',
    date: '2026-06-18',
    entries: [
      { studentId: 'student-rohan', status: 'late', note: 'Joined 10 minutes late' },
      { studentId: 'student-aarav', status: 'absent' },
    ],
    createdAt: '2026-06-18T12:00:00.000Z',
    updatedAt: '2026-06-18T12:15:00.000Z',
    status: 'completed',
  },
  {
    id: 'attendance-3',
    batchId: 'batch-tournament-lab',
    coachId: 'coach-vikram',
    date: '2026-06-16',
    entries: [
      { studentId: 'student-tara', status: 'present' },
    ],
    createdAt: '2026-06-16T10:00:00.000Z',
    updatedAt: '2026-06-16T10:10:00.000Z',
    status: 'completed',
  },
];

export const classReports: ClassReport[] = [
  {
    id: 'report-1',
    batchId: 'batch-saturday-knights',
    coachId: 'coach-arjun',
    date: '2026-06-20',
    title: 'Class Report - Saturday Knights - 2026-06-20',
    topicsCovered: ['Pins and basic tactics', 'Piece safety'],
    skillsPracticed: ['Board vision', 'Tactical pattern recognition'],
    homework: 'Solve 10 pin tactic puzzles before the next class.',
    generalNotes: 'The batch responded well to simple pin positions and needs more repetition on identifying loose pieces.',
    studentNotes: [
      { studentId: 'student-isha', performance: 'good', note: 'Understood pinned pieces after guided examples.' },
    ],
    attendanceRecordId: 'attendance-1',
    status: 'completed',
    createdAt: '2026-06-20T10:20:00.000Z',
    updatedAt: '2026-06-20T10:25:00.000Z',
  },
  {
    id: 'report-2',
    batchId: 'batch-tactical-juniors',
    coachId: 'coach-priya',
    date: '2026-06-18',
    title: 'Class Report - Tactical Juniors - 2026-06-18',
    topicsCovered: ['Fork tactic', 'Opening principles'],
    skillsPracticed: ['Calculation', 'Tactical pattern recognition'],
    homework: 'Review knight fork examples and write two positions in notation.',
    generalNotes: 'Good energy overall. Late/absent attendance affected continuity for part of the group.',
    studentNotes: [
      { studentId: 'student-rohan', performance: 'good', note: 'Joined late but caught up during the puzzle round.' },
      { studentId: 'student-aarav', performance: 'absent', note: 'Absent for this class.' },
    ],
    attendanceRecordId: 'attendance-2',
    status: 'draft',
    createdAt: '2026-06-18T12:25:00.000Z',
    updatedAt: '2026-06-18T12:30:00.000Z',
  },
  {
    id: 'report-3',
    batchId: 'batch-tournament-lab',
    coachId: 'coach-vikram',
    date: '2026-06-16',
    title: 'Class Report - Tournament Lab - 2026-06-16',
    topicsCovered: ['Rook endgames', 'King activity'],
    skillsPracticed: ['Endgame technique', 'Calculation'],
    homework: 'Practice Lucena and Philidor positions from the workbook.',
    generalNotes: 'Strong focus during the endgame session. Next class should revisit defensive rook placement.',
    studentNotes: [
      { studentId: 'student-tara', performance: 'excellent', note: 'Accurately converted the sample rook ending.' },
    ],
    attendanceRecordId: 'attendance-3',
    status: 'shared',
    createdAt: '2026-06-16T10:25:00.000Z',
    updatedAt: '2026-06-16T10:40:00.000Z',
  },
];

export const feeRecords: FeeRecord[] = [
  { id: 'fee-1', studentId: 'student-isha', batchId: 'batch-saturday-knights', month: 6, year: 2026, amount: 3500, status: 'paid', paymentMethod: 'upi', paidDate: '2026-06-04', dueDate: '2026-06-05', notes: 'June fee received by UPI.', createdAt: '2026-06-01T09:00:00.000Z', updatedAt: '2026-06-04T10:00:00.000Z' },
  { id: 'fee-2', studentId: 'student-rohan', batchId: 'batch-tactical-juniors', month: 6, year: 2026, amount: 4000, status: 'pending', dueDate: '2026-06-05', notes: 'Parent requested reminder after class.', createdAt: '2026-06-01T09:05:00.000Z', updatedAt: '2026-06-01T09:05:00.000Z' },
  { id: 'fee-3', studentId: 'student-aarav', batchId: 'batch-tactical-juniors', month: 6, year: 2026, amount: 4000, status: 'overdue', dueDate: '2026-06-05', notes: 'Follow up this week.', createdAt: '2026-06-01T09:10:00.000Z', updatedAt: '2026-06-10T09:10:00.000Z' },
  { id: 'fee-4', studentId: 'student-tara', batchId: 'batch-tournament-lab', month: 6, year: 2026, amount: 5000, status: 'paid', paymentMethod: 'bank_transfer', paidDate: '2026-06-02', dueDate: '2026-06-05', createdAt: '2026-06-01T09:15:00.000Z', updatedAt: '2026-06-02T11:15:00.000Z' },
  { id: 'fee-5', studentId: 'student-nila', batchId: 'batch-opening-builders', month: 6, year: 2026, amount: 3000, status: 'waived', dueDate: '2026-06-05', notes: 'Trial month waiver.', createdAt: '2026-06-01T09:20:00.000Z', updatedAt: '2026-06-01T09:20:00.000Z' },
];

export const todayClasses: TodayClass[] = [
  { id: 'class-1', batchId: 'batch-saturday-knights', coachId: 'coach-arjun', time: '10:00 AM', room: 'Main Hall' },
  { id: 'class-2', batchId: 'batch-tactical-juniors', coachId: 'coach-priya', time: '5:30 PM', room: 'Studio 2' },
  { id: 'class-3', batchId: 'batch-opening-builders', coachId: 'coach-arjun', time: '6:00 PM', room: 'Online' },
];

export const parentUpdates: ParentUpdate[] = [
  { id: 'update-1', studentId: 'student-rohan', reason: 'Pending monthly fee reminder', priority: 'high' },
  { id: 'update-2', studentId: 'student-isha', reason: 'Share latest class report draft', priority: 'normal' },
  { id: 'update-3', studentId: 'student-nila', reason: 'Welcome note for new student', priority: 'normal' },
];

export const playAccess: PlayAccess[] = [
  { id: 'play-1', studentId: 'student-isha', status: 'ready' },
  { id: 'play-2', studentId: 'student-rohan', status: 'pending_setup' },
  { id: 'play-3', studentId: 'student-tara', status: 'future_integration' },
];

export const features: Feature[] = [
  { title: 'Student Management', description: 'Maintain student profiles, parent details, levels, batches, fee state, and progress readiness.', status: 'Mock Data' },
  { title: 'Batch Management', description: 'Create structured groups by level, coach, schedule, mode, and active status.', status: 'Mock Data' },
  { title: 'Coach Allocation', description: 'Understand assigned batches and coach workload through clean relationships.', status: 'Mock Data' },
  { title: 'Attendance Tracking', description: 'Prepare class attendance records that will later power reports and parent updates.', status: 'Phase 3' },
  { title: 'Class Reports', description: 'Keep parent communication consistent with class topics, coach notes, and progress.', status: 'Phase 4' },
  { title: 'Fee Tracker', description: 'Track monthly dues, paid records, overdue alerts, and waived fees before payment integrations.', status: 'Phase 5' },
  { title: 'Student Profiles', description: 'Bring student info, attendance, reports, fees, and notes into one focused workspace.', status: 'Phase 6' },
  { title: 'Progress Dashboard', description: 'Make student growth visible across academy, coach, and parent views.', status: 'Future Integration' },
  { title: `${PLAY_APP_NAME} Access`, description: `Prepare student access to ${PLAY_APP_NAME} as the learning layer.`, status: 'Future Integration' },
];

export const getStudentById = (id?: string) => seedStudents.find((student) => student.id === id);
export const getBatchById = (id?: string) => seedBatches.find((batch) => batch.id === id);
export const getCoachById = (id?: string) => seedCoaches.find((coach) => coach.id === id);
export const getStudentsForBatch = (batchId: string) => seedStudents.filter((student) => student.batchId === batchId);
export const getBatchesForCoach = (coachId: string) => seedBatches.filter((batch) => batch.coachId === coachId);

export const formatCurrency = (amount: number) => `₹${amount.toLocaleString('en-IN')}`;
