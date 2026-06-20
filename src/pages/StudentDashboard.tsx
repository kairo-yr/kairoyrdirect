import { useEffect, useMemo, useState } from 'react';
import { collection, doc, getDoc, getDocs, query, where } from 'firebase/firestore';
import { BarChart3, BookOpen, CalendarCheck, ClipboardList } from 'lucide-react';
import { Link } from 'react-router-dom';
import { EmptyState } from '../components/ui/EmptyState';
import { StatCard } from '../components/ui/StatCard';
import { PLAY_APP_NAME } from '../config/brand';
import { useAuth } from '../contexts/AuthContext';
import { db } from '../lib/firebase';
import { RoleDashboard } from './RoleDashboard';

type StudentProfile = {
  id: string;
  name?: string;
  batchId?: string;
  progress?: number;
};

type AttendanceRecord = {
  id: string;
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

type FeeRecord = {
  id: string;
  month?: string;
  amount?: number;
  paidAmount?: number;
  status?: string;
  dueDate?: string;
  paidDate?: string | null;
};

function getCurrentMonth() {
  const date = new Date();
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat('en-IN', { currency: 'INR', maximumFractionDigits: 0, style: 'currency' }).format(value);
}

export function StudentDashboard() {
  const { userProfile } = useAuth();
  const [student, setStudent] = useState<StudentProfile | null>(null);
  const [attendanceRecords, setAttendanceRecords] = useState<AttendanceRecord[]>([]);
  const [classReports, setClassReports] = useState<ClassReportRecord[]>([]);
  const [progressRecords, setProgressRecords] = useState<ProgressRecord[]>([]);
  const [feeRecords, setFeeRecords] = useState<FeeRecord[]>([]);
  const [batchName, setBatchName] = useState('');
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
        const studentSnapshot = await getDoc(doc(db, 'academies', academyId, 'students', linkedStudentId));
        const loadedStudent = studentSnapshot.exists() ? ({ id: studentSnapshot.id, ...studentSnapshot.data() } as StudentProfile) : null;
        const [attendanceSnapshot, presentReportSnapshot, absentReportSnapshot, progressSnapshot, feeSnapshot] = await Promise.all([
          getDocs(collection(db, 'academies', academyId, 'attendance')),
          getDocs(query(collection(db, 'academies', academyId, 'classReports'), where('studentsPresentIds', 'array-contains', linkedStudentId))),
          getDocs(query(collection(db, 'academies', academyId, 'classReports'), where('studentsAbsentIds', 'array-contains', linkedStudentId))),
          getDocs(query(collection(db, 'academies', academyId, 'progressReports'), where('studentId', '==', linkedStudentId))),
          getDocs(query(collection(db, 'academies', academyId, 'fees'), where('studentId', '==', linkedStudentId))),
        ]);
        const reportMap = new Map<string, ClassReportRecord>();
        [...presentReportSnapshot.docs, ...absentReportSnapshot.docs].forEach((docSnap) => {
          reportMap.set(docSnap.id, { id: docSnap.id, ...docSnap.data() } as ClassReportRecord);
        });
        setStudent(loadedStudent);
        setAttendanceRecords(
          attendanceSnapshot.docs
            .map((docSnap) => ({ id: docSnap.id, ...docSnap.data() }) as AttendanceRecord)
            .filter((record) => [...(record.students ?? []), ...(record.entries ?? [])].some((entry) => entry.studentId === linkedStudentId)),
        );
        setClassReports(
          Array.from(reportMap.values())
            .filter((report) =>
              report.studentsPresentIds?.includes(linkedStudentId)
              || report.studentsAbsentIds?.includes(linkedStudentId)
              || report.studentNotes?.some((note) => note.studentId === linkedStudentId),
            )
            .sort((a, b) => String(b.date ?? '').localeCompare(String(a.date ?? ''))),
        );
        setProgressRecords(
          progressSnapshot.docs
            .map((docSnap) => ({ id: docSnap.id, ...docSnap.data() }) as ProgressRecord)
            .sort((a, b) => String(b.date ?? '').localeCompare(String(a.date ?? ''))),
        );
        setFeeRecords(
          feeSnapshot.docs
            .map((docSnap) => ({ id: docSnap.id, ...docSnap.data() }) as FeeRecord)
            .sort((a, b) => String(b.month ?? '').localeCompare(String(a.month ?? ''))),
        );
        if (loadedStudent?.batchId) {
          const batchSnapshot = await getDoc(doc(db, 'academies', academyId, 'batches', loadedStudent.batchId));
          setBatchName(batchSnapshot.exists() ? String(batchSnapshot.data().name ?? 'Assigned batch') : '');
        }
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
  const currentFee = feeRecords.find((record) => record.month === getCurrentMonth());
  const pendingBalance = feeRecords.reduce((total, record) => total + Math.max(0, Number(record.amount ?? 0) - Number(record.paidAmount ?? 0)), 0);

  return (
    <div className="space-y-6">
      <RoleDashboard
        title="Student Dashboard"
        role="student"
        description="Views homework, assigned chess practice, reports, and the future access path to Kairoyr Play."
      />

      {!linkedStudentId ? (
        <EmptyState title="No student profile linked yet" description="Accept a student invite to link this account with an academy student profile." />
      ) : (
        <>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <StatCard label="Classes Attended" value={loading ? '...' : String(attendanceStats.total)} helper={attendanceStats.total ? 'Attendance entries found' : 'No attendance records yet'} icon={CalendarCheck} />
            <StatCard label="Attendance" value={attendanceStats.percentage === null ? 'No data' : `${attendanceStats.percentage}%`} helper="Based on this student only" icon={BarChart3} />
            <StatCard label="Assigned Batch" value={batchName || 'No data'} helper={student?.batchId ? 'Batch linked' : 'No assigned batch yet'} icon={ClipboardList} />
            <StatCard label="Progress" value={latestProgress?.ratings?.overall ? `${latestProgress.ratings.overall}/5` : 'No data'} helper={latestProgress?.nextFocus || 'No progress updates yet'} icon={BookOpen} />
          </div>

          <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-card">
            <h2 className="text-xl font-black text-navy">Fee Status</h2>
            {feeRecords.length === 0 ? (
              <EmptyState title="No fee records yet" description="Fee status will appear here when your academy generates monthly fees." />
            ) : (
              <div className="mt-3 grid gap-3 md:grid-cols-3">
                <div className="rounded-2xl bg-slate-50 p-4">
                  <div className="text-xs font-black uppercase tracking-wide text-slate-400">Current Month</div>
                  <div className="mt-1 font-black text-navy">{currentFee?.status ?? 'No record'}</div>
                </div>
                <div className="rounded-2xl bg-slate-50 p-4">
                  <div className="text-xs font-black uppercase tracking-wide text-slate-400">Pending Balance</div>
                  <div className="mt-1 font-black text-navy">{formatCurrency(pendingBalance)}</div>
                </div>
                <div className="rounded-2xl bg-slate-50 p-4">
                  <div className="text-xs font-black uppercase tracking-wide text-slate-400">Payment History</div>
                  <div className="mt-1 font-black text-navy">{feeRecords.length} records</div>
                </div>
              </div>
            )}
          </section>

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
            {latestReport?.homeworkGiven || latestReport?.homework ? (
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
