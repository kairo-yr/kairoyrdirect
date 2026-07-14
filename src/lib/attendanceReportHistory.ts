export type AttendanceEntryLike = {
  studentId: string;
  studentName: string;
  status: 'present' | 'absent';
  note?: string;
};

export type AttendanceSessionLike = {
  id: string;
  batchId: string;
  date: string;
  students: AttendanceEntryLike[];
};

export type StudentAttendanceSummary = {
  studentId: string;
  studentName: string;
  presentCount: number;
  absentCount: number;
  totalClasses: number;
  percentage: number | null;
  lastAttendedDate: string | null;
  history: Array<{ sessionId: string; date: string; status: 'present' | 'absent'; note: string }>;
};

export function currentMonthValue(date = new Date()) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
}

export function monthDateRange(month: string) {
  const match = /^(\d{4})-(\d{2})$/.exec(month);
  if (!match) return { start: '', end: '' };
  const year = Number(match[1]);
  const monthIndex = Number(match[2]);
  const lastDay = new Date(year, monthIndex, 0).getDate();
  return { start: `${match[1]}-${match[2]}-01`, end: `${match[1]}-${match[2]}-${String(lastDay).padStart(2, '0')}` };
}

export function isDateInRange(date: string, start: string, end: string) {
  return (!start || date >= start) && (!end || date <= end);
}

export function getAttendanceSessions<T extends AttendanceSessionLike>(
  sessions: T[],
  batchId: string,
  start: string,
  end: string,
) {
  return sessions
    .filter((session) => (!batchId || session.batchId === batchId) && isDateInRange(session.date, start, end))
    .sort((left, right) => right.date.localeCompare(left.date));
}

export function getBatchAttendanceSummary<T extends AttendanceSessionLike>(
  sessions: T[],
  batchId: string,
  start: string,
  end: string,
  currentStudents: Array<{ id: string; name: string }>,
) {
  const scopedSessions = getAttendanceSessions(sessions, batchId, start, end);
  const summaries = new Map<string, StudentAttendanceSummary>();

  currentStudents.forEach((student) => summaries.set(student.id, {
    studentId: student.id,
    studentName: student.name,
    presentCount: 0,
    absentCount: 0,
    totalClasses: 0,
    percentage: null,
    lastAttendedDate: null,
    history: [],
  }));

  scopedSessions.forEach((session) => {
    session.students.forEach((entry) => {
      const summary = summaries.get(entry.studentId) ?? {
        studentId: entry.studentId,
        studentName: entry.studentName,
        presentCount: 0,
        absentCount: 0,
        totalClasses: 0,
        percentage: null,
        lastAttendedDate: null,
        history: [],
      };
      summary.totalClasses += 1;
      if (entry.status === 'present') {
        summary.presentCount += 1;
        if (!summary.lastAttendedDate || session.date > summary.lastAttendedDate) summary.lastAttendedDate = session.date;
      } else {
        summary.absentCount += 1;
      }
      summary.history.push({ sessionId: session.id, date: session.date, status: entry.status, note: entry.note ?? '' });
      summaries.set(entry.studentId, summary);
    });
  });

  return Array.from(summaries.values())
    .map((summary) => ({
      ...summary,
      percentage: summary.totalClasses ? Math.round((summary.presentCount / summary.totalClasses) * 100) : null,
      history: summary.history.sort((left, right) => right.date.localeCompare(left.date)),
    }))
    .sort((left, right) => left.studentName.localeCompare(right.studentName));
}

export function groupReportsByBatch<T extends { batchId: string; batchName: string; date: string }>(reports: T[]) {
  const groups = new Map<string, { batchId: string; batchName: string; reports: T[] }>();
  reports.forEach((report) => {
    const group = groups.get(report.batchId) ?? { batchId: report.batchId, batchName: report.batchName, reports: [] };
    group.reports.push(report);
    groups.set(report.batchId, group);
  });
  return Array.from(groups.values())
    .map((group) => ({ ...group, reports: group.reports.sort((left, right) => right.date.localeCompare(left.date)) }))
    .sort((left, right) => (right.reports[0]?.date ?? '').localeCompare(left.reports[0]?.date ?? ''));
}

export function formatDateOnly(date: string) {
  if (!date) return 'Not available';
  const [year, month, day] = date.split('-').map(Number);
  if (!year || !month || !day) return date;
  return new Intl.DateTimeFormat('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }).format(new Date(year, month - 1, day));
}
