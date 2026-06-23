import { useEffect, useMemo, useState } from 'react';
import { collection, getDocs, query, where } from 'firebase/firestore';
import { BookOpen, CalendarCheck, FileText } from 'lucide-react';
import { Badge } from '../components/ui/Badge';
import { DataTable } from '../components/ui/DataTable';
import { EmptyState } from '../components/ui/EmptyState';
import { PageHeader } from '../components/ui/PageHeader';
import { StatCard } from '../components/ui/StatCard';
import { PLAY_APP_NAME } from '../config/brand';
import { useAuth } from '../contexts/AuthContext';
import { db } from '../lib/firebase';
import { formatFirestoreDate } from '../utils/firestoreFormat';

type StudentSection = 'attendance' | 'classReports' | 'homework';

type AttendanceRecord = {
  id: string;
  batchName?: string;
  date?: string;
  markedByName?: string;
  createdAt?: unknown;
  students?: Array<{ studentId?: string; status?: string; note?: string }>;
  entries?: Array<{ studentId?: string; status?: string; note?: string }>;
};

type BatchRecord = {
  id: string;
  name?: string;
  studentIds?: string[];
};

type ClassReportRecord = {
  id: string;
  batchId?: string;
  batchName?: string;
  coachName?: string | null;
  date?: string;
  title?: string;
  topicCovered?: string;
  classSummary?: string;
  homeworkGiven?: string;
  nextClassPlan?: string;
  studentsPresentIds?: string[];
  studentsAbsentIds?: string[];
  studentNotes?: Array<{ studentId?: string; note?: string }>;
  createdAt?: unknown;
};

function getStudentAttendanceEntry(record: AttendanceRecord, studentId: string) {
  return [...(record.students ?? []), ...(record.entries ?? [])].find((entry) => entry.studentId === studentId);
}

function statusClass(status?: string) {
  if (status === 'present') return 'bg-emerald-50 text-emerald-700';
  if (status === 'absent') return 'bg-rose-50 text-rose-700';
  return 'bg-slate-100 text-slate-600';
}

function HomeworkPlaceholder() {
  return (
    <div className="space-y-6">
      <PageHeader title="Student Homework" description={`Review homework, practice tasks, and ${PLAY_APP_NAME} access for the linked student profile.`} />
      <section className="rounded-3xl border border-slate-200 bg-white p-8 shadow-card">
        <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-blue-50 text-directBlue">
          <BookOpen size={22} />
        </div>
        <EmptyState title="Homework and practice access coming together" description={`Homework is summarized on the Student Dashboard. ${PLAY_APP_NAME} access will appear here when available.`} />
      </section>
    </div>
  );
}

function StudentAttendancePage() {
  const { userProfile } = useAuth();
  const academyId = userProfile?.academyId;
  const linkedStudentId = userProfile?.linkedStudentId;
  const [records, setRecords] = useState<AttendanceRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const loadAttendance = async () => {
      if (!academyId || !linkedStudentId) {
        setLoading(false);
        return;
      }
      setLoading(true);
      setError('');
      try {
        const snapshot = await getDocs(query(collection(db, 'academies', academyId, 'attendance'), where('studentIds', 'array-contains', linkedStudentId)));
        setRecords(
          snapshot.docs
            .map((docSnap) => ({ id: docSnap.id, ...docSnap.data() }) as AttendanceRecord)
            .filter((record) => Boolean(getStudentAttendanceEntry(record, linkedStudentId)))
            .sort((a, b) => String(b.date ?? '').localeCompare(String(a.date ?? ''))),
        );
      } catch (caught) {
        setError(caught instanceof Error ? caught.message : 'Could not load attendance records.');
      } finally {
        setLoading(false);
      }
    };

    void loadAttendance();
  }, [academyId, linkedStudentId]);

  const summary = useMemo(() => {
    const entries = linkedStudentId ? records.map((record) => getStudentAttendanceEntry(record, linkedStudentId)).filter(Boolean) : [];
    const present = entries.filter((entry) => entry?.status === 'present').length;
    const absent = entries.filter((entry) => entry?.status === 'absent').length;
    return {
      total: entries.length,
      present,
      absent,
      percentage: entries.length === 0 ? null : Math.round((present / entries.length) * 100),
    };
  }, [linkedStudentId, records]);

  if (!linkedStudentId) {
    return <EmptyState title="Your student profile is not linked yet" description="Contact your academy." />;
  }

  return (
    <div className="space-y-6">
      <PageHeader title="Student Attendance" description="Review attendance records for the linked student profile." />
      {error ? <div className="rounded-2xl bg-rose-50 px-4 py-3 text-sm font-black text-rose-700">{error}</div> : null}
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Classes Recorded" value={loading ? '...' : String(summary.total)} helper="For this student only" icon={CalendarCheck} />
        <StatCard label="Present" value={loading ? '...' : String(summary.present)} helper="Marked present" icon={CalendarCheck} />
        <StatCard label="Absent" value={loading ? '...' : String(summary.absent)} helper="Marked absent" icon={CalendarCheck} />
        <StatCard label="Attendance" value={summary.percentage === null ? 'No data' : `${summary.percentage}%`} helper="Present percentage" icon={CalendarCheck} />
      </div>
      {loading ? (
        <EmptyState title="Loading attendance" description="Checking this student's attendance records." />
      ) : records.length === 0 ? (
        <EmptyState title="No attendance records yet" description="Attendance records will appear here after classes are marked." />
      ) : (
        <DataTable columns={['Date', 'Batch', 'Status', 'Note', 'Marked By', 'Created']}>
          {records.map((record) => {
            const entry = getStudentAttendanceEntry(record, linkedStudentId);
            return (
              <tr className="border-t border-slate-100" key={record.id}>
                <td className="px-5 py-4 font-black text-navy">{record.date || 'No date'}</td>
                <td className="px-5 py-4 text-slate-600">{record.batchName || 'Batch'}</td>
                <td className="px-5 py-4"><Badge className={statusClass(entry?.status)}>{entry?.status || 'Not marked'}</Badge></td>
                <td className="px-5 py-4 text-slate-600">{entry?.note || 'No note'}</td>
                <td className="px-5 py-4 text-slate-600">{record.markedByName || 'Not available'}</td>
                <td className="px-5 py-4 text-slate-600">{formatFirestoreDate(record.createdAt)}</td>
              </tr>
            );
          })}
        </DataTable>
      )}
    </div>
  );
}

function StudentClassReportsPage() {
  const { userProfile } = useAuth();
  const academyId = userProfile?.academyId;
  const linkedStudentId = userProfile?.linkedStudentId;
  const [batches, setBatches] = useState<BatchRecord[]>([]);
  const [reports, setReports] = useState<ClassReportRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const loadReports = async () => {
      if (!academyId || !linkedStudentId) {
        setLoading(false);
        return;
      }
      setLoading(true);
      setError('');
      try {
        const batchSnapshot = await getDocs(query(collection(db, 'academies', academyId, 'batches'), where('studentIds', 'array-contains', linkedStudentId)));
        const assignedBatches = batchSnapshot.docs.map((docSnap) => ({ id: docSnap.id, ...docSnap.data() }) as BatchRecord);
        const assignedBatchIds = assignedBatches.map((batch) => batch.id);
        const reportMap = new Map<string, ClassReportRecord>();
        const [presentSnapshot, absentSnapshot] = await Promise.all([
          getDocs(query(collection(db, 'academies', academyId, 'classReports'), where('studentsPresentIds', 'array-contains', linkedStudentId))),
          getDocs(query(collection(db, 'academies', academyId, 'classReports'), where('studentsAbsentIds', 'array-contains', linkedStudentId))),
        ]);
        [...presentSnapshot.docs, ...absentSnapshot.docs].forEach((docSnap) => {
          reportMap.set(docSnap.id, { id: docSnap.id, ...docSnap.data() } as ClassReportRecord);
        });
        for (const batchId of assignedBatchIds.slice(0, 10)) {
          const batchReports = await getDocs(query(collection(db, 'academies', academyId, 'classReports'), where('batchId', '==', batchId)));
          batchReports.docs.forEach((docSnap) => {
            reportMap.set(docSnap.id, { id: docSnap.id, ...docSnap.data() } as ClassReportRecord);
          });
        }
        const relatedReports = Array.from(reportMap.values())
          .filter((report) =>
            report.studentsPresentIds?.includes(linkedStudentId)
            || report.studentsAbsentIds?.includes(linkedStudentId)
            || report.studentNotes?.some((note) => note.studentId === linkedStudentId)
            || Boolean(report.batchId && assignedBatchIds.includes(report.batchId)),
          )
          .sort((a, b) => String(b.date ?? '').localeCompare(String(a.date ?? '')));
        setBatches(assignedBatches);
        setReports(relatedReports);
      } catch (caught) {
        setError(caught instanceof Error ? caught.message : 'Could not load class reports.');
      } finally {
        setLoading(false);
      }
    };

    void loadReports();
  }, [academyId, linkedStudentId]);

  if (!linkedStudentId) {
    return <EmptyState title="Your student profile is not linked yet" description="Contact your academy." />;
  }

  const assignedBatchNames = batches.map((batch) => batch.name || 'Untitled batch').join(', ') || 'Not assigned';

  return (
    <div className="space-y-6">
      <PageHeader title="Student Class Reports" description="Review class reports and coach notes for the linked student profile." />
      {error ? <div className="rounded-2xl bg-rose-50 px-4 py-3 text-sm font-black text-rose-700">{error}</div> : null}
      <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-card">
        <div className="text-xs font-black uppercase tracking-wide text-slate-500">Assigned batch</div>
        <div className="mt-1 font-black text-navy">{assignedBatchNames}</div>
      </section>
      {loading ? (
        <EmptyState title="Loading class reports" description="Checking reports related to this student." />
      ) : reports.length === 0 ? (
        <EmptyState title="No class reports yet" description="Class reports will appear here after your academy shares them." />
      ) : (
        <div className="space-y-4">
          {reports.map((report) => {
            const studentNote = report.studentNotes?.find((note) => note.studentId === linkedStudentId);
            const status = report.studentsPresentIds?.includes(linkedStudentId) ? 'Present' : report.studentsAbsentIds?.includes(linkedStudentId) ? 'Absent' : 'Batch report';
            return (
              <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-card" key={report.id}>
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <h2 className="text-xl font-black text-navy">{report.title || 'Class Report'}</h2>
                    <p className="mt-1 text-sm font-semibold text-slate-500">{report.date || 'No date'} · {report.batchName || 'Batch'} · {report.coachName || 'Coach not recorded'}</p>
                  </div>
                  <Badge className={status === 'Present' ? 'bg-emerald-50 text-emerald-700' : status === 'Absent' ? 'bg-rose-50 text-rose-700' : 'bg-blue-50 text-directBlue'}>{status}</Badge>
                </div>
                <div className="mt-5 grid gap-4 md:grid-cols-2">
                  <Detail label="Topic covered" value={report.topicCovered} />
                  <Detail label="Class summary" value={report.classSummary} />
                  <Detail label="Homework given" value={report.homeworkGiven} />
                  <Detail label="Next class plan" value={report.nextClassPlan} />
                  <Detail label="Student-specific note" value={studentNote?.note} />
                </div>
              </section>
            );
          })}
        </div>
      )}
    </div>
  );
}

function Detail({ label, value }: { label: string; value?: string }) {
  return (
    <div className="rounded-2xl bg-slate-50 p-4">
      <div className="text-xs font-black uppercase tracking-wide text-slate-500">{label}</div>
      <div className="mt-1 text-sm font-bold leading-6 text-navy">{value || 'Not added'}</div>
    </div>
  );
}

export function StudentSectionPage({ section }: { section: StudentSection }) {
  if (section === 'attendance') return <StudentAttendancePage />;
  if (section === 'classReports') return <StudentClassReportsPage />;
  return <HomeworkPlaceholder />;
}
