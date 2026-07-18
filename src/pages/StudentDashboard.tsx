import { useEffect, useMemo, useState } from 'react';
import { BarChart3, BookOpen, CalendarCheck, ClipboardList, Gamepad2 } from 'lucide-react';
import { Link } from 'react-router-dom';
import { EmptyState } from '../components/ui/EmptyState';
import { StatCard } from '../components/ui/StatCard';
import { PLAY_APP_NAME } from '../config/brand';
import { useAuth } from '../contexts/AuthContext';
import { getAcademyWorkspace } from '../lib/coachWorkspaceApi';
import { listMyHomework } from '../lib/homeworkApi';
import { listAttendance, listClassReports, listProgressReports } from '../lib/operationsApi';
import { getCurrentUserStudent } from '../lib/studentApi';
import { RoleDashboard } from './RoleDashboard';

type StudentProfile = {
  id: string;
  name?: string;
  progress?: number;
};

type BatchRecord = {
  id: string;
  name?: string;
  studentIds?: string[];
};

type AttendanceRecord = {
  id: string;
  studentIds?: string[];
  entries?: Array<{ studentId?: string; status?: string }>;
  students?: Array<{ studentId?: string; status?: string }>;
};

type ClassReportRecord = {
  id: string;
  title?: string;
  date?: string;
  homework?: string;
  homeworkGiven?: string;
  topicCovered?: string;
  batchName?: string;
  studentNotes?: Array<{ studentId?: string; note?: string }>;
  studentsPresentIds?: string[];
  studentsAbsentIds?: string[];
};

type ProgressRecord = {
  id: string;
  date?: string;
  ratings?: { overall?: number };
  nextFocus?: string;
};

type HomeworkRecord = {
  id: string;
  title?: string;
  dueDate?: string | null;
  status?: string;
  batchId?: string | null;
  studentIds?: string[];
};

export function StudentDashboard() {
  const { userProfile } = useAuth();
  const [student, setStudent] = useState<StudentProfile | null>(null);
  const [batches, setBatches] = useState<BatchRecord[]>([]);
  const [attendanceRecords, setAttendanceRecords] = useState<AttendanceRecord[]>([]);
  const [classReports, setClassReports] = useState<ClassReportRecord[]>([]);
  const [progressRecords, setProgressRecords] = useState<ProgressRecord[]>([]);
  const [homeworkRecords, setHomeworkRecords] = useState<HomeworkRecord[]>([]);
  const [loading, setLoading] = useState(true);

  const academyId = userProfile?.academyId;
  const linkedStudentId = userProfile?.linkedStudentId;

  useEffect(() => {
    const loadDashboard = async () => {
      if (!academyId || !linkedStudentId) {
        setLoading(false);
        return;
      }
      setLoading(true);
      try {
        const [studentRow, workspace, attendanceSnapshot, reportRows, progressSnapshot, homeworkAssignments] = await Promise.all([getCurrentUserStudent(academyId), getAcademyWorkspace(academyId), listAttendance(academyId), listClassReports(academyId), listProgressReports(academyId), listMyHomework()]);
        const loadedStudent = studentRow ? ({ id: studentRow.id, name: studentRow.full_name } as StudentProfile) : null;
        const loadedBatches = workspace.batches.filter((batch) => batch.studentIds.includes(linkedStudentId));
        const assignedBatchIds = new Set(loadedBatches.map((batch) => batch.id));
        setStudent(loadedStudent);
        setBatches(loadedBatches);
        setAttendanceRecords(
          attendanceSnapshot
            .map((row) => row as AttendanceRecord)
            .filter((record) => [...(record.students ?? []), ...(record.entries ?? [])].some((entry) => entry.studentId === linkedStudentId)),
        );
        setClassReports(
          reportRows.map((row) => row as ClassReportRecord)
            .filter((report) =>
              report.studentsPresentIds?.includes(linkedStudentId)
              || report.studentsAbsentIds?.includes(linkedStudentId)
              || report.studentNotes?.some((note) => note.studentId === linkedStudentId),
            )
            .sort((a, b) => String(b.date ?? '').localeCompare(String(a.date ?? ''))),
        );
        setProgressRecords(
          progressSnapshot
            .map((row) => row as ProgressRecord)
            .sort((a, b) => String(b.date ?? '').localeCompare(String(a.date ?? ''))),
        );
        setHomeworkRecords(
          homeworkAssignments.filter((assignment) => Boolean(assignment.homework)).map((assignment) => ({ id: assignment.homework!.id, title: assignment.homework!.title, dueDate: assignment.homework!.due_date, status: assignment.status, batchId: assignment.batch_id }) as HomeworkRecord)
            .filter((record) => Boolean(record.batchId && assignedBatchIds.has(record.batchId)))
            .sort((a, b) => String(a.dueDate ?? '9999-12-31').localeCompare(String(b.dueDate ?? '9999-12-31'))),
        );
      } finally {
        setLoading(false);
      }
    };

    void loadDashboard();
  }, [academyId, linkedStudentId]);

  const attendanceStats = useMemo(() => {
    const entries = attendanceRecords.flatMap((record) =>
      [...(record.students ?? []), ...(record.entries ?? [])].filter((entry) => entry.studentId === linkedStudentId),
    );
    const attended = entries.filter((entry) => entry.status === 'present' || entry.status === 'late').length;
    return {
      total: entries.length,
      percentage: entries.length === 0 ? null : Math.round((attended / entries.length) * 100),
    };
  }, [attendanceRecords, linkedStudentId]);
  const latestReport = classReports[0];
  const latestProgress = progressRecords[0];
  const nextHomework = homeworkRecords[0];
  const batchNames = batches.map((batch) => batch.name || 'Untitled batch');
  const assignedBatchLabel = batchNames.join(', ') || 'Not assigned';

  return (
    <div className="space-y-6">
      <RoleDashboard
        title="Student Dashboard"
        role="student"
        description="Track attendance, class reports, progress, homework, and fees."
      />

      {!linkedStudentId ? (
        <EmptyState title="Your student profile is not linked yet" description="Contact your academy." />
      ) : (
        <>
          <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-card">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <div className="text-xs font-black uppercase tracking-wide text-slate-400">Student</div>
                <h2 className="mt-1 text-2xl font-black text-navy">{student?.name || userProfile?.name || 'Student'}</h2>
                <p className="mt-2 text-sm font-semibold text-slate-500">{assignedBatchLabel}</p>
              </div>
              <Link className="inline-flex items-center gap-2 rounded-2xl bg-directBlue px-4 py-3 text-sm font-black text-white" to="/student/homework">
                <Gamepad2 size={18} /> {PLAY_APP_NAME}
              </Link>
            </div>
          </section>

          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <StatCard label="Classes Attended" value={loading ? '...' : String(attendanceStats.total)} helper={attendanceStats.total ? 'Attendance entries found' : 'No attendance records yet'} icon={CalendarCheck} />
            <StatCard label="Attendance" value={attendanceStats.percentage === null ? 'No data' : `${attendanceStats.percentage}%`} helper="Based on this student only" icon={BarChart3} />
            <StatCard label="Assigned Batch" value={assignedBatchLabel} helper={batches.length > 1 ? `${batches.length} assigned batches` : 'From batch membership'} icon={ClipboardList} />
            <StatCard label="Progress" value={latestProgress?.ratings?.overall ? `${latestProgress.ratings.overall}/5` : 'No data'} helper={latestProgress?.nextFocus || 'No progress updates yet'} icon={BookOpen} />
            <StatCard label="Active Homework" value={loading ? '...' : String(homeworkRecords.length)} helper="Practice tasks" icon={Gamepad2} />
            <StatCard label="Next Due" value={nextHomework?.dueDate ?? 'No data'} helper={nextHomework?.title ?? 'No active homework'} icon={Gamepad2} />
          </div>

          <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-card">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h2 className="text-xl font-black text-navy">Latest Progress</h2>
                <p className="mt-2 text-sm leading-6 text-slate-600">
                  {latestProgress ? `${latestProgress.date ?? 'No date'} · Overall ${latestProgress.ratings?.overall ?? 'No data'}/5 · ${latestProgress.nextFocus || 'No next focus added.'}` : 'No progress updates yet.'}
                </p>
              </div>
              <Link className="rounded-2xl bg-directBlue px-4 py-3 text-sm font-black text-white" to="/student/progress">View Progress</Link>
            </div>
          </section>

          <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-card">
            <h2 className="text-xl font-black text-navy">Recent Class Reports</h2>
            {latestReport ? (
              <div className="mt-3 space-y-4 text-sm leading-6 text-slate-600">
                {classReports.slice(0, 5).map((report) => (
                  <div className="rounded-2xl border border-slate-200 p-4" key={report.id}>
                    <div className="font-black text-navy">{report.date ?? 'No date'} · {report.batchName ?? 'Batch'}</div>
                    <div>{report.topicCovered ?? report.title ?? 'Class report'}</div>
                    <div className="mt-2"><span className="font-black text-navy">Homework:</span> {report.homeworkGiven ?? report.homework ?? 'No homework added.'}</div>
                    <div><span className="font-black text-navy">Note:</span> {report.studentNotes?.find((note) => note.studentId === linkedStudentId)?.note ?? 'No student note added.'}</div>
                  </div>
                ))}
              </div>
            ) : (
              <EmptyState title="No class reports yet" description="Reports shared for this student will appear here." />
            )}
          </section>

          <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-card">
            <h2 className="text-xl font-black text-navy">Homework / Practice</h2>
            {nextHomework ? (
              <div className="mt-3 flex flex-wrap items-start justify-between gap-3">
                <p className="text-sm leading-6 text-slate-600">{nextHomework.title} · {nextHomework.dueDate ?? 'No due date'}</p>
                <Link className="rounded-2xl bg-directBlue px-4 py-3 text-sm font-black text-white" to="/student/homework">View Homework</Link>
              </div>
            ) : latestReport?.homeworkGiven || latestReport?.homework ? (
              <p className="mt-3 text-sm leading-6 text-slate-600">{latestReport.homeworkGiven ?? latestReport.homework}</p>
            ) : (
              <EmptyState title="No progress updates yet" description={`Homework and ${PLAY_APP_NAME} practice access will appear when available.`} />
            )}
          </section>
        </>
      )}
    </div>
  );
}
