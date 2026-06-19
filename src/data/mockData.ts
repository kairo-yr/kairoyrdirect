import type {
  Academy,
  AttendanceRecord,
  Batch,
  ClassReport,
  Coach,
  Feature,
  FeeRecord,
  ParentUpdate,
  PlayAccess,
  Stat,
  Student,
  TodayClass,
  UserRole,
} from '../types';
import { PLAY_APP_NAME } from '../config/brand';

export const mockRole: UserRole = 'academy_owner';

export const academies: Academy[] = [
  { id: 'academy-kairoyr', name: 'Kairoyr School of Chess', ownerName: 'Yogendra Reddy' },
  { id: 'academy-knights', name: 'Knight Vision Chess Studio', ownerName: 'Priya Nair' },
];

export const students: Student[] = [
  { id: 'student-isha', academyId: 'academy-kairoyr', name: 'Isha Rao', level: 'Beginner', batchId: 'batch-saturday-knights', feeStatus: 'Paid', progress: 42, joinedAt: '02 Jun 2026' },
  { id: 'student-rohan', academyId: 'academy-kairoyr', name: 'Rohan Rao', level: 'Intermediate', batchId: 'batch-tactical-juniors', feeStatus: 'Pending', progress: 64, joinedAt: '22 May 2026' },
  { id: 'student-tara', academyId: 'academy-kairoyr', name: 'Tara Menon', level: 'Advanced', batchId: 'batch-tournament-lab', feeStatus: 'Paid', progress: 78, joinedAt: '14 May 2026' },
  { id: 'student-aarav', academyId: 'academy-kairoyr', name: 'Aarav Kapoor', level: 'Intermediate', batchId: 'batch-middle-game', feeStatus: 'Overdue', progress: 58, joinedAt: '28 Apr 2026' },
  { id: 'student-nila', academyId: 'academy-kairoyr', name: 'Nila Shah', level: 'Beginner', batchId: 'batch-opening-builders', feeStatus: 'Paid', progress: 35, joinedAt: '17 Jun 2026' },
];

export const batches: Batch[] = [
  { id: 'batch-saturday-knights', academyId: 'academy-kairoyr', name: 'Saturday Knights', coachId: 'coach-arjun', schedule: 'Sat 10:00 AM', level: 'Beginner' },
  { id: 'batch-tactical-juniors', academyId: 'academy-kairoyr', name: 'Tactical Juniors', coachId: 'coach-priya', schedule: 'Tue Thu 5:30 PM', level: 'Intermediate' },
  { id: 'batch-tournament-lab', academyId: 'academy-kairoyr', name: 'Tournament Lab', coachId: 'coach-vikram', schedule: 'Sun 4:00 PM', level: 'Advanced' },
  { id: 'batch-opening-builders', academyId: 'academy-kairoyr', name: 'Opening Builders', coachId: 'coach-arjun', schedule: 'Mon Wed 6:00 PM', level: 'Beginner' },
  { id: 'batch-middle-game', academyId: 'academy-kairoyr', name: 'Middle Game Masters', coachId: 'coach-maya', schedule: 'Fri 6:30 PM', level: 'Intermediate' },
];

export const coaches: Coach[] = [
  { id: 'coach-arjun', academyId: 'academy-kairoyr', name: 'Arjun Mehta', assignedBatchIds: ['batch-saturday-knights', 'batch-opening-builders'], weeklyClasses: 8 },
  { id: 'coach-priya', academyId: 'academy-kairoyr', name: 'Priya Nair', assignedBatchIds: ['batch-tactical-juniors'], weeklyClasses: 5 },
  { id: 'coach-vikram', academyId: 'academy-kairoyr', name: 'Vikram Sen', assignedBatchIds: ['batch-tournament-lab'], weeklyClasses: 4 },
  { id: 'coach-maya', academyId: 'academy-kairoyr', name: 'Maya Iyer', assignedBatchIds: ['batch-middle-game'], weeklyClasses: 3 },
];

export const attendanceRecords: AttendanceRecord[] = [
  { id: 'attendance-1', batchId: 'batch-saturday-knights', date: '19 Jun 2026', presentCount: 16, absentCount: 2, status: 'Completed' },
  { id: 'attendance-2', batchId: 'batch-tactical-juniors', date: '18 Jun 2026', presentCount: 12, absentCount: 2, status: 'Draft' },
  { id: 'attendance-3', batchId: 'batch-tournament-lab', date: '16 Jun 2026', presentCount: 9, absentCount: 1, status: 'Completed' },
];

export const classReports: ClassReport[] = [
  { id: 'report-1', batchId: 'batch-saturday-knights', coachId: 'coach-arjun', topic: 'Pins and basic tactics', date: '19 Jun 2026', status: 'Sent' },
  { id: 'report-2', studentId: 'student-isha', coachId: 'coach-priya', topic: 'Opening principles', date: '18 Jun 2026', status: 'Draft' },
  { id: 'report-3', batchId: 'batch-tournament-lab', coachId: 'coach-vikram', topic: 'Rook endgames', date: '16 Jun 2026', status: 'Sent' },
];

export const feeRecords: FeeRecord[] = [
  { id: 'fee-1', studentId: 'student-isha', amount: 3500, status: 'Paid', dueDate: '05 Jul 2026' },
  { id: 'fee-2', studentId: 'student-rohan', amount: 4000, status: 'Pending', dueDate: '05 Jul 2026' },
  { id: 'fee-3', studentId: 'student-aarav', amount: 4000, status: 'Overdue', dueDate: '05 Jun 2026' },
];

export const todayClasses: TodayClass[] = [
  { id: 'class-1', batchId: 'batch-saturday-knights', coachId: 'coach-arjun', time: '10:00 AM', room: 'Main Hall' },
  { id: 'class-2', batchId: 'batch-tactical-juniors', coachId: 'coach-priya', time: '5:30 PM', room: 'Studio 2' },
  { id: 'class-3', batchId: 'batch-middle-game', coachId: 'coach-maya', time: '6:30 PM', room: 'Online' },
];

export const parentUpdates: ParentUpdate[] = [
  { id: 'update-1', studentId: 'student-rohan', reason: 'Pending monthly fee reminder', priority: 'High' },
  { id: 'update-2', studentId: 'student-isha', reason: 'Share latest class report draft', priority: 'Normal' },
  { id: 'update-3', studentId: 'student-nila', reason: 'Welcome note for new student', priority: 'Normal' },
];

export const playAccess: PlayAccess[] = [
  { id: 'play-1', studentId: 'student-isha', status: 'Ready' },
  { id: 'play-2', studentId: 'student-rohan', status: 'Pending Setup' },
  { id: 'play-3', studentId: 'student-tara', status: 'Future Integration' },
];

export const stats: Stat[] = [
  { label: 'Total Students', value: String(students.length), helper: '+1 recently added' },
  { label: 'Active Batches', value: String(batches.length), helper: 'Across 4 levels' },
  { label: 'Coaches', value: String(coaches.length), helper: 'Batch allocation ready' },
  { label: 'Pending Fees', value: '₹4k', helper: '1 overdue alert' },
  { label: 'Classes This Week', value: '20', helper: 'Mock schedule view' },
  { label: 'Reports Sent', value: '2', helper: '1 draft pending' },
];

export const features: Feature[] = [
  { title: 'Student Management', description: 'Maintain student profiles, levels, batches, fee status, and progress readiness.', status: 'Mock Data' },
  { title: 'Batch Management', description: 'Create structured groups by level, coach, schedule, and academy center.', status: 'Mock Data' },
  { title: 'Coach Allocation', description: 'Understand coach workload and assigned batch relationships before permissions arrive.', status: 'Mock Data' },
  { title: 'Attendance Tracking', description: 'Prepare class attendance records that will later connect to reports.', status: 'Phase 2' },
  { title: 'Class Reports', description: 'Keep parent updates consistent with class topics, coach notes, and progress.', status: 'Phase 2' },
  { title: 'Fee Tracker', description: 'Track paid, pending, and overdue fee states before payment integrations.', status: 'Coming Soon' },
  { title: 'Progress Dashboard', description: 'Make student growth visible across academy, coach, and parent views.', status: 'Future Integration' },
  { title: `${PLAY_APP_NAME} Access`, description: `Prepare student access to ${PLAY_APP_NAME} as the learning layer.`, status: 'Future Integration' },
];

export const getStudentById = (id?: string) => students.find((student) => student.id === id);
export const getBatchById = (id?: string) => batches.find((batch) => batch.id === id);
export const getCoachById = (id?: string) => coaches.find((coach) => coach.id === id);
export const getStudentsForBatch = (batchId: string) => students.filter((student) => student.batchId === batchId);
export const getBatchesForCoach = (coachId: string) => batches.filter((batch) => batch.coachId === coachId);

export const formatCurrency = (amount: number) => `₹${amount.toLocaleString('en-IN')}`;
