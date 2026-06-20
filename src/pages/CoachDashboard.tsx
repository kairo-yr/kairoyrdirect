import { useEffect, useMemo, useState } from 'react';
import { collection, getDocs, query, where } from 'firebase/firestore';
import { CalendarCheck, ClipboardList, FileText, GraduationCap } from 'lucide-react';
import { Link } from 'react-router-dom';
import { DataTable } from '../components/ui/DataTable';
import { EmptyState } from '../components/ui/EmptyState';
import { StatCard } from '../components/ui/StatCard';
import { useAuth } from '../contexts/AuthContext';
import { db } from '../lib/firebase';
import { RoleDashboard } from './RoleDashboard';

type BatchRecord = {
  id: string;
  name?: string;
  coachId?: string;
  assignedCoachId?: string;
  days?: string[];
  scheduleDays?: string[];
  startTime?: string;
  endTime?: string;
  studentIds?: string[];
};

type StudentRecord = {
  id: string;
  name?: string;
  batchId?: string;
};

type ClassRecord = {
  id: string;
  coachId?: string;
  date?: string;
};

type ClassReportRecord = ClassRecord & {
  title?: string;
  batchName?: string;
  status?: 'draft' | 'submitted';
};

type ProgressRecord = {
  id: string;
  studentId?: string;
  createdByUid?: string;
  ratings?: { overall?: number; calculation?: number; homework?: number };
};

export function CoachDashboard() {
  const { userProfile } = useAuth();
  const [batches, setBatches] = useState<BatchRecord[]>([]);
  const [students, setStudents] = useState<StudentRecord[]>([]);
  const [classRecords, setClassRecords] = useState<ClassRecord[]>([]);
  const [reports, setReports] = useState<ClassReportRecord[]>([]);
  const [progressRecords, setProgressRecords] = useState<ProgressRecord[]>([]);
  const [loading, setLoading] = useState(true);

  const academyId = userProfile?.academyId;
  const linkedCoachId = userProfile?.linkedCoachId;

  useEffect(() => {
    const loadDashboard = async () => {
      if (!academyId || !linkedCoachId) {
        setLoading(false);
        return;
      }
      setLoading(true);
      try {
        const [batchSnapshot, studentSnapshot, attendanceSnapshot, reportSnapshot, progressSnapshot] = await Promise.all([
          getDocs(collection(db, 'academies', academyId, 'batches')),
          getDocs(collection(db, 'academies', academyId, 'students')),
          getDocs(query(collection(db, 'academies', academyId, 'attendance'), where('coachId', '==', linkedCoachId))),
          getDocs(query(collection(db, 'academies', academyId, 'classReports'), where('coachId', '==', linkedCoachId))),
          getDocs(collection(db, 'academies', academyId, 'progressReports')),
        ]);
        const assignedBatches = batchSnapshot.docs
          .map((docSnap) => ({ id: docSnap.id, ...docSnap.data() }) as BatchRecord)
          .filter((batch) => batch.coachId === linkedCoachId || batch.assignedCoachId === linkedCoachId);
        const assignedBatchIds = new Set(assignedBatches.map((batch) => batch.id));
        setBatches(assignedBatches);
        const assignedStudentIds = new Set(assignedBatches.flatMap((batch) => batch.studentIds ?? []));
        setStudents(
          studentSnapshot.docs
            .map((docSnap) => ({ id: docSnap.id, ...docSnap.data() }) as StudentRecord)
            .filter((student) => assignedStudentIds.has(student.id) || Boolean(student.batchId && assignedBatchIds.has(student.batchId))),
        );
        setClassRecords(attendanceSnapshot.docs.map((docSnap) => ({ id: docSnap.id, ...docSnap.data() }) as ClassRecord));
        setReports(reportSnapshot.docs.map((docSnap) => ({ id: docSnap.id, ...docSnap.data() }) as ClassReportRecord));
        setProgressRecords(
          progressSnapshot.docs
            .map((docSnap) => ({ id: docSnap.id, ...docSnap.data() }) as ProgressRecord)
            .filter((record) => Boolean(record.studentId && assignedStudentIds.has(record.studentId))),
        );
      } finally {
        setLoading(false);
      }
    };

    void loadDashboard();
  }, [academyId, linkedCoachId]);

  const nextClass = useMemo(() => batches.find((batch) => batch.days?.length || batch.scheduleDays?.length), [batches]);
  const recentSubmittedReports = useMemo(
    () => reports.filter((report) => report.status === 'submitted').sort((a, b) => String(b.date ?? '').localeCompare(String(a.date ?? ''))).slice(0, 5),
    [reports],
  );
  const latestProgressByStudent = useMemo(() => new Map(progressRecords.map((record) => [record.studentId, record])), [progressRecords]);
  const studentsNeedingAttention = progressRecords.filter((record) => {
    const ratings = record.ratings;
    return Number(ratings?.overall ?? 5) <= 2 || Number(ratings?.calculation ?? 5) <= 2 || Number(ratings?.homework ?? 5) <= 2;
  }).length;

  return (
    <div className="space-y-6">
      <RoleDashboard
        title="Coach Dashboard"
        role="coach"
        description="Views assigned batches, marks attendance, writes class reports, and tracks student progress."
      />

      {!linkedCoachId ? (
        <EmptyState title="No coach profile linked yet" description="Accept a coach invite to link this account with an academy coach profile." />
      ) : (
        <>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <StatCard label="Assigned Students" value={loading ? '...' : String(students.length)} helper="Only students in assigned batches" icon={GraduationCap} />
            <StatCard label="Assigned Batches" value={loading ? '...' : String(batches.length)} helper="Coach-scoped batches" icon={ClipboardList} />
            <StatCard label="Classes Taken" value={loading ? '...' : String(classRecords.length)} helper="Attendance records" icon={CalendarCheck} />
            <StatCard label="Reports Created" value={loading ? '...' : String(reports.length)} helper={`${reports.filter((report) => report.status === 'draft').length} drafts`} icon={FileText} />
            <StatCard label="Need Attention" value={loading ? '...' : String(studentsNeedingAttention)} helper="Assigned students" icon={GraduationCap} />
            <StatCard label="Progress Updates" value={loading ? '...' : String(progressRecords.length)} helper="Assigned students" icon={GraduationCap} />
            <StatCard label="Without Progress" value={loading ? '...' : String(students.filter((student) => !latestProgressByStudent.has(student.id)).length)} helper="Need first update" icon={GraduationCap} />
            <StatCard label="Next Class" value={nextClass?.name ?? 'No data'} helper={nextClass?.startTime ? `${nextClass.startTime} - ${nextClass.endTime ?? ''}` : 'No batch schedule yet'} icon={FileText} />
          </div>

          <div className="flex flex-wrap gap-3">
            <Link className="rounded-2xl bg-directBlue px-4 py-3 text-sm font-black text-white" to="/coach/attendance">Mark Attendance</Link>
            <Link className="rounded-2xl bg-directBlue px-4 py-3 text-sm font-black text-white" to="/coach/class-reports">Write Class Report</Link>
            <Link className="rounded-2xl bg-directBlue px-4 py-3 text-sm font-black text-white" to="/coach/progress">Update Progress</Link>
            <Link className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-black text-navy" to="/students">View Students</Link>
          </div>

          <section>
            <h2 className="mb-3 text-xl font-black text-navy">Recent Submitted Reports</h2>
            {loading ? (
              <EmptyState title="Loading reports" description="Checking reports created by this coach." />
            ) : recentSubmittedReports.length === 0 ? (
              <EmptyState title="No submitted reports yet" description="Submitted class reports will appear here." />
            ) : (
              <DataTable columns={['Date', 'Batch', 'Title']}>
                {recentSubmittedReports.map((report) => (
                  <tr className="border-t border-slate-100" key={report.id}>
                    <td className="px-5 py-4 font-black text-navy">{report.date ?? 'No date'}</td>
                    <td className="px-5 py-4 text-slate-600">{report.batchName ?? 'Batch'}</td>
                    <td className="px-5 py-4 text-slate-600">{report.title ?? 'Class report'}</td>
                  </tr>
                ))}
              </DataTable>
            )}
          </section>

          <section>
            <h2 className="mb-3 text-xl font-black text-navy">Assigned Batches</h2>
            {loading ? (
              <EmptyState title="Loading batches" description="Checking batches assigned to this coach." />
            ) : batches.length === 0 ? (
              <EmptyState title="No batches assigned yet" description="Assigned batches will appear here after academy admin setup." />
            ) : (
              <DataTable columns={['Batch', 'Schedule', 'Time']}>
                {batches.map((batch) => (
                  <tr className="border-t border-slate-100" key={batch.id}>
                    <td className="px-5 py-4 font-black text-navy">{batch.name ?? 'Untitled batch'}</td>
                    <td className="px-5 py-4 text-slate-600">{(batch.days ?? batch.scheduleDays)?.join(', ') || 'No data yet'}</td>
                    <td className="px-5 py-4 text-slate-600">{batch.startTime ? `${batch.startTime} - ${batch.endTime ?? ''}` : 'No data yet'}</td>
                  </tr>
                ))}
              </DataTable>
            )}
          </section>
        </>
      )}
    </div>
  );
}
