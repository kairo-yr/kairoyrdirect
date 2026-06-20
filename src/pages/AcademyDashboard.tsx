import { useEffect, useMemo, useState } from 'react';
import { collection, doc, getDoc, getDocs, query, where } from 'firebase/firestore';
import { CalendarCheck, ClipboardList, FileText, KeyRound, School, UserPlus, Users } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Badge } from '../components/ui/Badge';
import { DataTable } from '../components/ui/DataTable';
import { EmptyState } from '../components/ui/EmptyState';
import { StatCard } from '../components/ui/StatCard';
import { useAuth } from '../contexts/AuthContext';
import { db } from '../lib/firebase';
import type { AcademyCoachProfile, AcademyInvite, AcademyRegistration, AcademyStudentProfile } from '../types/auth';
import { getAcademyStatusClass } from '../utils/academyStatus';
import { formatFirestoreDate } from '../utils/firestoreFormat';
import { RoleDashboard } from './RoleDashboard';

type BatchRecord = { id: string; status?: string };
type AttendanceRecord = { id: string; date?: string; status?: string };
type ClassReportRecord = { id: string; date?: string; status?: string; title?: string; batchName?: string; createdAt?: unknown };
type ProgressRecord = { id: string; date?: string; ratings?: { overall?: number; calculation?: number; homework?: number } };

function getTodayDate() {
  const date = new Date();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${date.getFullYear()}-${month}-${day}`;
}

export function AcademyDashboard() {
  const { userProfile } = useAuth();
  const academyId = userProfile?.academyId;
  const [academy, setAcademy] = useState<AcademyRegistration | null>(null);
  const [students, setStudents] = useState<AcademyStudentProfile[]>([]);
  const [coaches, setCoaches] = useState<AcademyCoachProfile[]>([]);
  const [batches, setBatches] = useState<BatchRecord[]>([]);
  const [attendanceRecords, setAttendanceRecords] = useState<AttendanceRecord[]>([]);
  const [classReports, setClassReports] = useState<ClassReportRecord[]>([]);
  const [progressRecords, setProgressRecords] = useState<ProgressRecord[]>([]);
  const [invites, setInvites] = useState<AcademyInvite[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadDashboard = async () => {
      if (!academyId || userProfile?.role !== 'academy_admin') {
        setLoading(false);
        return;
      }
      setLoading(true);
      const [academySnapshot, studentSnapshot, coachSnapshot, batchSnapshot, attendanceSnapshot, reportSnapshot, progressSnapshot, inviteSnapshot] = await Promise.all([
        getDoc(doc(db, 'academies', academyId)),
        getDocs(collection(db, 'academies', academyId, 'students')),
        getDocs(collection(db, 'academies', academyId, 'coaches')),
        getDocs(collection(db, 'academies', academyId, 'batches')),
        getDocs(collection(db, 'academies', academyId, 'attendance')),
        getDocs(collection(db, 'academies', academyId, 'classReports')),
        getDocs(collection(db, 'academies', academyId, 'progressReports')),
        getDocs(query(collection(db, 'academyInvites'), where('academyId', '==', academyId))),
      ]);
      setAcademy(academySnapshot.exists() ? ({ id: academySnapshot.id, ...academySnapshot.data() } as AcademyRegistration) : null);
      setStudents(studentSnapshot.docs.map((docSnap) => ({ id: docSnap.id, ...docSnap.data() }) as AcademyStudentProfile));
      setCoaches(coachSnapshot.docs.map((docSnap) => ({ id: docSnap.id, ...docSnap.data() }) as AcademyCoachProfile));
      setBatches(batchSnapshot.docs.map((docSnap) => ({ id: docSnap.id, ...docSnap.data() }) as BatchRecord));
      setAttendanceRecords(attendanceSnapshot.docs.map((docSnap) => ({ id: docSnap.id, ...docSnap.data() }) as AttendanceRecord));
      setClassReports(reportSnapshot.docs.map((docSnap) => ({ id: docSnap.id, ...docSnap.data() }) as ClassReportRecord));
      setProgressRecords(progressSnapshot.docs.map((docSnap) => ({ id: docSnap.id, ...docSnap.data() }) as ProgressRecord));
      setInvites(inviteSnapshot.docs.map((docSnap) => ({ id: docSnap.id, ...docSnap.data() }) as AcademyInvite));
      setLoading(false);
    };

    void loadDashboard();
  }, [academyId, userProfile?.role]);

  const recentStudents = useMemo(() => students.slice(0, 5), [students]);
  const recentCoaches = useMemo(() => coaches.slice(0, 5), [coaches]);
  const recentReports = useMemo(() => [...classReports].sort((a, b) => String(b.date ?? '').localeCompare(String(a.date ?? ''))).slice(0, 5), [classReports]);
  const pendingInvites = invites.filter((invite) => invite.status === 'pending');
  const activeBatchCount = batches.filter((batch) => batch.status === 'active').length;
  const todaySubmittedCount = attendanceRecords.filter((record) => record.date === getTodayDate() && record.status === 'submitted').length;
  const pendingAttendanceToday = Math.max(0, activeBatchCount - todaySubmittedCount);
  const weekAgo = new Date();
  weekAgo.setDate(weekAgo.getDate() - 7);
  const weekAgoString = weekAgo.toISOString().slice(0, 10);
  const reportsSubmittedThisWeek = classReports.filter((report) => report.status === 'submitted' && String(report.date ?? '') >= weekAgoString).length;
  const monthStart = new Date();
  monthStart.setDate(1);
  const monthStartString = monthStart.toISOString().slice(0, 10);
  const progressThisMonth = progressRecords.filter((record) => String(record.date ?? '') >= monthStartString).length;
  const progressWithOverall = progressRecords.filter((record) => Number(record.ratings?.overall ?? 0) > 0);
  const averageProgress = progressWithOverall.length
    ? Math.round((progressWithOverall.reduce((total, record) => total + Number(record.ratings?.overall ?? 0), 0) / progressWithOverall.length) * 10) / 10
    : null;
  const studentsNeedingAttention = progressRecords.filter((record) => {
    const ratings = record.ratings;
    return Number(ratings?.overall ?? 5) <= 2 || Number(ratings?.calculation ?? 5) <= 2 || Number(ratings?.homework ?? 5) <= 2;
  }).length;

  if (!academyId) {
    return <EmptyState title="Academy profile not linked" description="Your academy profile is not linked correctly. Contact Kairoyr support." />;
  }

  return (
    <div className="space-y-6">
      <RoleDashboard
        title="Academy Dashboard"
        role="academy_admin"
        description="Academy-scoped overview for students, coaches, batches, and invites."
      />

      <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-card">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 text-navy">
              <School size={22} />
              <h2 className="text-xl font-black">{academy?.name ?? 'Academy'}</h2>
            </div>
            <p className="mt-2 text-sm leading-6 text-slate-600">{academy?.city || 'City not set'} · {academy?.phone || 'Phone not set'}</p>
          </div>
          {academy ? <Badge className={getAcademyStatusClass(academy.status)}>{academy.status}</Badge> : null}
        </div>
      </section>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Total Students" value={loading ? '...' : String(students.length)} helper={`${students.filter((student) => student.status === 'active').length} active`} icon={Users} />
        <StatCard label="Invited Students" value={loading ? '...' : String(students.filter((student) => student.status === 'invited').length)} helper="Awaiting invite acceptance" icon={UserPlus} />
        <StatCard label="Total Coaches" value={loading ? '...' : String(coaches.length)} helper={`${coaches.filter((coach) => coach.status === 'active').length} active`} icon={UserPlus} />
        <StatCard label="Invited Coaches" value={loading ? '...' : String(coaches.filter((coach) => coach.status === 'invited').length)} helper="Awaiting invite acceptance" icon={UserPlus} />
        <StatCard label="Total Batches" value={loading ? '...' : String(batches.length)} helper={batches.length ? 'Academy batches' : 'No data yet'} icon={ClipboardList} />
        <StatCard label="Pending Invites" value={loading ? '...' : String(pendingInvites.length)} helper="Student and coach invites" icon={KeyRound} />
        <StatCard label="Today Attendance" value={loading ? '...' : String(todaySubmittedCount)} helper="Submitted records today" icon={CalendarCheck} />
        <StatCard label="Pending Attendance" value={loading ? '...' : String(pendingAttendanceToday)} helper="Active batches pending today" icon={CalendarCheck} />
        <StatCard label="Classes Recorded" value={loading ? '...' : String(attendanceRecords.length)} helper="Total attendance records" icon={ClipboardList} />
        <StatCard label="Class Reports" value={loading ? '...' : String(classReports.length)} helper="Total report records" icon={FileText} />
        <StatCard label="Reports This Week" value={loading ? '...' : String(reportsSubmittedThisWeek)} helper="Submitted reports" icon={FileText} />
        <StatCard label="Draft Reports" value={loading ? '...' : String(classReports.filter((report) => report.status === 'draft').length)} helper="Need completion" icon={FileText} />
        <StatCard label="Needs Attention" value={loading ? '...' : String(studentsNeedingAttention)} helper="Low progress ratings" icon={Users} />
        <StatCard label="Progress This Month" value={loading ? '...' : String(progressThisMonth)} helper="Manual updates" icon={ClipboardList} />
        <StatCard label="Avg Progress" value={averageProgress === null ? 'No data' : String(averageProgress)} helper="Overall rating" icon={ClipboardList} />
      </div>

      <section className="grid gap-3 md:grid-cols-7">
        <Link className="rounded-2xl bg-directBlue px-4 py-3 text-center text-sm font-black text-white" to="/academy/students">Add Student</Link>
        <Link className="rounded-2xl bg-directBlue px-4 py-3 text-center text-sm font-black text-white" to="/academy/coaches">Add Coach</Link>
        <Link className="rounded-2xl bg-directBlue px-4 py-3 text-center text-sm font-black text-white" to="/academy/batches">Create Batch</Link>
        <Link className="rounded-2xl bg-directBlue px-4 py-3 text-center text-sm font-black text-white" to="/academy/attendance">Attendance</Link>
        <Link className="rounded-2xl bg-directBlue px-4 py-3 text-center text-sm font-black text-white" to="/academy/class-reports">Class Reports</Link>
        <Link className="rounded-2xl bg-directBlue px-4 py-3 text-center text-sm font-black text-white" to="/academy/progress">Progress</Link>
        <Link className="rounded-2xl bg-directBlue px-4 py-3 text-center text-sm font-black text-white" to="/academy/invites">View Invites</Link>
      </section>

      <div className="grid gap-6 xl:grid-cols-2">
        <section>
          <h2 className="mb-3 text-xl font-black text-navy">Recent Students Added</h2>
          {loading ? (
            <EmptyState title="Loading students" description="Checking recent student profiles." />
          ) : recentStudents.length === 0 ? (
            <EmptyState title="No students added yet" description="Add your first student." />
          ) : (
            <DataTable columns={['Name', 'Email', 'Status', 'Created']}>
              {recentStudents.map((student) => (
                <tr className="border-t border-slate-100" key={student.id}>
                  <td className="px-5 py-4 font-black text-navy">{student.name}</td>
                  <td className="px-5 py-4 text-slate-600">{student.email}</td>
                  <td className="px-5 py-4 text-slate-600">{student.status}</td>
                  <td className="px-5 py-4 text-slate-600">{formatFirestoreDate(student.createdAt)}</td>
                </tr>
              ))}
            </DataTable>
          )}
        </section>

        <section>
          <h2 className="mb-3 text-xl font-black text-navy">Recent Class Reports</h2>
          {loading ? (
            <EmptyState title="Loading reports" description="Checking recent class reports." />
          ) : recentReports.length === 0 ? (
            <EmptyState title="No class reports yet" description="Create class reports after batch sessions." />
          ) : (
            <DataTable columns={['Date', 'Batch', 'Title', 'Status']}>
              {recentReports.map((report) => (
                <tr className="border-t border-slate-100" key={report.id}>
                  <td className="px-5 py-4 font-black text-navy">{report.date ?? 'No date'}</td>
                  <td className="px-5 py-4 text-slate-600">{report.batchName ?? 'Batch'}</td>
                  <td className="px-5 py-4 text-slate-600">{report.title ?? 'Class report'}</td>
                  <td className="px-5 py-4 text-slate-600">{report.status ?? 'draft'}</td>
                </tr>
              ))}
            </DataTable>
          )}
        </section>
      </div>
    </div>
  );
}
