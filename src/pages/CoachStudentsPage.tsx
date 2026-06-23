import { useEffect, useMemo, useState } from 'react';
import { collection, doc, getDoc, getDocs, query, where } from 'firebase/firestore';
import { Eye } from 'lucide-react';
import { DataTable } from '../components/ui/DataTable';
import { EmptyState } from '../components/ui/EmptyState';
import { PageHeader } from '../components/ui/PageHeader';
import { useAuth } from '../contexts/AuthContext';
import { db } from '../lib/firebase';
import type { AcademyStudentProfile } from '../types/auth';

type BatchRecord = {
  id: string;
  name?: string;
  coachId?: string | null;
  studentIds?: string[];
  status?: 'active' | 'disabled';
};

type AttendanceRecord = {
  id: string;
  students?: Array<{ studentId?: string; status?: string }>;
};

type ProgressRecord = {
  id: string;
  studentId?: string;
  date?: string;
  ratings?: { overall?: number };
};

function attendanceSummary(studentId: string, records: AttendanceRecord[]) {
  const entries = records.flatMap((record) => (record.students ?? []).filter((entry) => entry.studentId === studentId));
  if (entries.length === 0) return 'No data';
  const present = entries.filter((entry) => entry.status === 'present').length;
  return `${Math.round((present / entries.length) * 100)}%`;
}

export function CoachStudentsPage() {
  const { userProfile } = useAuth();
  const academyId = userProfile?.academyId;
  const linkedCoachId = userProfile?.linkedCoachId;
  const [batches, setBatches] = useState<BatchRecord[]>([]);
  const [students, setStudents] = useState<AcademyStudentProfile[]>([]);
  const [attendanceRecords, setAttendanceRecords] = useState<AttendanceRecord[]>([]);
  const [progressRecords, setProgressRecords] = useState<ProgressRecord[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadStudents = async () => {
      if (!academyId || !linkedCoachId) {
        setLoading(false);
        return;
      }
      setLoading(true);
      try {
        const batchSnapshot = await getDocs(query(collection(db, 'academies', academyId, 'batches'), where('coachId', '==', linkedCoachId)));
        const assignedBatches = batchSnapshot.docs.map((docSnap) => ({ id: docSnap.id, ...docSnap.data() }) as BatchRecord);
        const assignedStudentIds = new Set(assignedBatches.flatMap((batch) => batch.studentIds ?? []));
        const [studentSnapshots, attendanceSnapshot] = await Promise.all([
          Promise.all(Array.from(assignedStudentIds).map((studentId) => getDoc(doc(db, 'academies', academyId, 'students', studentId)))),
          getDocs(query(collection(db, 'academies', academyId, 'attendance'), where('coachId', '==', linkedCoachId))),
        ]);
        setBatches(assignedBatches);
        setStudents(
          studentSnapshots
            .filter((docSnap) => docSnap.exists())
            .map((docSnap) => ({ id: docSnap.id, ...docSnap.data() }) as AcademyStudentProfile),
        );
        setAttendanceRecords(attendanceSnapshot.docs.map((docSnap) => ({ id: docSnap.id, ...docSnap.data() }) as AttendanceRecord));
        const progressMap = new Map<string, ProgressRecord>();
        for (const studentId of assignedStudentIds) {
          const progressSnapshot = await getDocs(query(collection(db, 'academies', academyId, 'progressReports'), where('studentId', '==', studentId)));
          progressSnapshot.docs.forEach((docSnap) => progressMap.set(docSnap.id, { id: docSnap.id, ...docSnap.data() } as ProgressRecord));
        }
        setProgressRecords(Array.from(progressMap.values()));
      } finally {
        setLoading(false);
      }
    };

    void loadStudents();
  }, [academyId, linkedCoachId]);

  const batchNamesByStudent = useMemo(() => {
    const map = new Map<string, string[]>();
    batches.forEach((batch) => {
      (batch.studentIds ?? []).forEach((studentId) => {
        map.set(studentId, [...(map.get(studentId) ?? []), batch.name || 'Untitled batch']);
      });
    });
    return map;
  }, [batches]);

  const latestProgressByStudent = useMemo(() => {
    const map = new Map<string, ProgressRecord>();
    progressRecords.forEach((record) => {
      if (!record.studentId) return;
      const current = map.get(record.studentId);
      if (!current || String(record.date ?? '').localeCompare(String(current.date ?? '')) > 0) map.set(record.studentId, record);
    });
    return map;
  }, [progressRecords]);

  if (!linkedCoachId) {
    return <EmptyState title="Your coach profile is not linked yet" description="Contact your academy." />;
  }

  return (
    <div className="space-y-6">
      <PageHeader title="My Students" description="View-only students from your assigned batches." />
      {loading ? (
        <EmptyState title="Loading students" description="Checking assigned batches and students." />
      ) : students.length === 0 ? (
        <EmptyState title="No assigned students yet" description="Students will appear here after academy admin assigns them to your batches." />
      ) : (
        <DataTable columns={['Student', 'Phone', 'Login Email', 'Batch', 'Attendance', 'Latest Progress', 'Action']}>
          {students.map((student) => {
            const batchNames = batchNamesByStudent.get(student.id) ?? [];
            const latestProgress = latestProgressByStudent.get(student.id);
            return (
              <tr className="border-t border-slate-100" key={student.id}>
                <td className="px-5 py-4 font-black text-navy">{student.name}</td>
                <td className="px-5 py-4 text-slate-600">{student.phone || 'Not added'}</td>
                <td className="px-5 py-4 text-slate-600">{student.email || 'Not added'}</td>
                <td className="px-5 py-4 text-slate-600" title={batchNames.join(', ') || undefined}>{batchNames.length > 1 ? `${batchNames.length} batches` : batchNames[0] ?? 'Not assigned'}</td>
                <td className="px-5 py-4 text-slate-600">{attendanceSummary(student.id, attendanceRecords)}</td>
                <td className="px-5 py-4 text-slate-600">{latestProgress?.ratings?.overall ? `${latestProgress.ratings.overall}/5` : 'No progress'}</td>
                <td className="px-5 py-4 text-slate-600"><Eye size={16} aria-label="View only" /></td>
              </tr>
            );
          })}
        </DataTable>
      )}
    </div>
  );
}
