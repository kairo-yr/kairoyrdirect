import { useEffect, useMemo, useState } from 'react';
import { collection, getDocs, query, where } from 'firebase/firestore';
import { BookOpen, CalendarCheck, ClipboardList, FileText, GraduationCap } from 'lucide-react';
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

type HomeworkRecord = {
  id: string;
  createdByUid?: string;
  batchId?: string | null;
  studentIds?: string[];
  dueDate?: string | null;
  status?: string;
};

export function CoachDashboard() {
  const { userProfile } = useAuth();
  const [batches, setBatches] = useState<BatchRecord[]>([]);
  const [students, setStudents] = useState<StudentRecord[]>([]);
  const [classRecords, setClassRecords] = useState<ClassRecord[]>([]);
  const [reports, setReports] = useState<ClassReportRecord[]>([]);
  const [progressRecords, setProgressRecords] = useState<ProgressRecord[]>([]);
  const [homeworkRecords, setHomeworkRecords] = useState<HomeworkRecord[]>([]);
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
        const [batchSnapshot, studentSnapshot, attendanceSnapshot, reportSnapshot] = await Promise.all([
          getDocs(query(collection(db, 'academies', academyId, 'batches'), where('coachId', '==', linkedCoachId))),
          getDocs(collection(db, 'academies', academyId, 'students')),
          getDocs(query(collection(db, 'academies', academyId, 'attendance'), where('coachId', '==', linkedCoachId))),
          getDocs(query(collection(db, 'academies', academyId, 'classReports'), where('coachId', '==', linkedCoachId))),
        ]);
        const assignedBatches = batchSnapshot.docs.map((docSnap) => ({ id: docSnap.id, ...docSnap.data() }) as BatchRecord);
        const assignedBatchIds = new Set(assignedBatches.map((batch) => batch.id));
        setBatches(assignedBatches);
        const assignedStudentIds = new Set(assignedBatches.flatMap((batch) => batch.studentIds ?? []));
        setStudents(
          studentSnapshot.docs
            .map((docSnap) => ({ id: docSnap.id, ...docSnap.data() }) as StudentRecord)
            .filter((student) => assignedStudentIds.has(student.id)),
        );
        setClassRecords(attendanceSnapshot.docs.map((docSnap) => ({ id: docSnap.id, ...docSnap.data() }) as ClassRecord));
        setReports(reportSnapshot.docs.map((docSnap) => ({ id: docSnap.id, ...docSnap.data() }) as ClassReportRecord));
        const progressMap = new Map<string, ProgressRecord>();
        for (const studentId of assignedStudentIds) {
          const progressSnapshot = await getDocs(query(collection(db, 'academies', academyId, 'progressReports'), where('studentId', '==', studentId)));
          progressSnapshot.docs.forEach((docSnap) => progressMap.set(docSnap.id, { id: docSnap.id, ...docSnap.data() } as ProgressRecord));
        }
        setProgressRecords(Array.from(progressMap.values()));

        const homeworkMap = new Map<string, HomeworkRecord>();
        const ownHomeworkSnapshot = await getDocs(query(collection(db, 'academies', academyId, 'homework'), where('createdByUid', '==', userProfile?.uid ?? '')));
        ownHomeworkSnapshot.docs.forEach((docSnap) => homeworkMap.set(docSnap.id, { id: docSnap.id, ...docSnap.data() } as HomeworkRecord));
        for (const batchId of assignedBatchIds) {
          const batchHomeworkSnapshot = await getDocs(query(collection(db, 'academies', academyId, 'homework'), where('batchId', '==', batchId)));
          batchHomeworkSnapshot.docs.forEach((docSnap) => homeworkMap.set(docSnap.id, { id: docSnap.id, ...docSnap.data() } as HomeworkRecord));
        }
        for (const studentId of assignedStudentIds) {
          const studentHomeworkSnapshot = await getDocs(query(collection(db, 'academies', academyId, 'homework'), where('studentIds', 'array-contains', studentId)));
          studentHomeworkSnapshot.docs.forEach((docSnap) => homeworkMap.set(docSnap.id, { id: docSnap.id, ...docSnap.data() } as HomeworkRecord));
        }
        setHomeworkRecords(Array.from(homeworkMap.values()));
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
  const homeworkByCoach = homeworkRecords.filter((record) => record.createdByUid === userProfile?.uid && record.status === 'active').length;
  const today = new Date().toISOString().slice(0, 10);
  const weekEnd = new Date();
  weekEnd.setDate(weekEnd.getDate() + 7);
  const weekEndString = weekEnd.toISOString().slice(0, 10);
  const homeworkDueThisWeek = homeworkRecords.filter((record) => record.status === 'active' && String(record.dueDate ?? '') >= today && String(record.dueDate ?? '') <= weekEndString).length;

  return (
    <div className="space-y-6">
      <RoleDashboard
        title="Coach Dashboard"
        role="coach"
        description="Views assigned batches, marks attendance, writes class reports, and tracks student progress."
      />

      {!linkedCoachId ? (
        <EmptyState title="Your coach profile is not linked yet" description="Contact your academy." />
      ) : (
        <>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <StatCard label="Assigned Students" value={loading ? '...' : String(students.length)} helper="Only students in assigned batches" icon={GraduationCap} />
            <StatCard label="Assigned Batches" value={loading ? '...' : String(batches.length)} helper="Coach-scoped batches" icon={ClipboardList} />
            <StatCard label="Attendance Records" value={loading ? '...' : String(classRecords.length)} helper="Submitted for assigned batches" icon={CalendarCheck} />
            <StatCard label="Reports Created" value={loading ? '...' : String(reports.length)} helper={`${reports.filter((report) => report.status === 'draft').length} drafts`} icon={FileText} />
            <StatCard label="Need Attention" value={loading ? '...' : String(studentsNeedingAttention)} helper="Assigned students" icon={GraduationCap} />
            <StatCard label="Progress Updates" value={loading ? '...' : String(progressRecords.length)} helper="Assigned students" icon={GraduationCap} />
            <StatCard label="Without Progress" value={loading ? '...' : String(students.filter((student) => !latestProgressByStudent.has(student.id)).length)} helper="Need first update" icon={GraduationCap} />
            <StatCard label="Upcoming Classes" value={nextClass?.name ?? 'No data'} helper={nextClass?.startTime ? `${nextClass.startTime} - ${nextClass.endTime ?? ''}` : 'No batch schedule yet'} icon={FileText} />
            <StatCard label="Homework Assigned" value={loading ? '...' : String(homeworkByCoach)} helper="Created by you" icon={BookOpen} />
            <StatCard label="Homework Due" value={loading ? '...' : String(homeworkDueThisWeek)} helper="Due this week" icon={BookOpen} />
          </div>

          <div className="flex flex-wrap gap-3">
            <Link className="rounded-2xl bg-directBlue px-4 py-3 text-sm font-black text-white" to="/coach/attendance">Mark Attendance</Link>
            <Link className="rounded-2xl bg-directBlue px-4 py-3 text-sm font-black text-white" to="/coach/class-reports">Write Class Report</Link>
            <Link className="rounded-2xl bg-directBlue px-4 py-3 text-sm font-black text-white" to="/coach/progress">Update Progress</Link>
            <Link className="rounded-2xl bg-directBlue px-4 py-3 text-sm font-black text-white" to="/coach/homework">Assign Homework</Link>
            <Link className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-black text-navy" to="/coach/students">View My Students</Link>
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
