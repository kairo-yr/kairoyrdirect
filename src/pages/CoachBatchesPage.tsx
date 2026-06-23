import { useEffect, useMemo, useState } from 'react';
import { collection, doc, getDoc, getDocs, query, where } from 'firebase/firestore';
import { Badge } from '../components/ui/Badge';
import { DataTable } from '../components/ui/DataTable';
import { EmptyState } from '../components/ui/EmptyState';
import { PageHeader } from '../components/ui/PageHeader';
import { useAuth } from '../contexts/AuthContext';
import { db } from '../lib/firebase';
import type { AcademyStudentProfile } from '../types/auth';
import { statusStyles } from '../utils/badgeStyles';

type BatchRecord = {
  id: string;
  name?: string;
  level?: string;
  days?: string[];
  startTime?: string;
  endTime?: string;
  coachId?: string | null;
  studentIds?: string[];
  status?: 'active' | 'disabled';
};

function statusLabel(status?: string) {
  if (!status) return 'Active';
  return status.charAt(0).toUpperCase() + status.slice(1);
}

export function CoachBatchesPage() {
  const { userProfile } = useAuth();
  const academyId = userProfile?.academyId;
  const linkedCoachId = userProfile?.linkedCoachId;
  const [batches, setBatches] = useState<BatchRecord[]>([]);
  const [students, setStudents] = useState<AcademyStudentProfile[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadBatches = async () => {
      if (!academyId || !linkedCoachId) {
        setLoading(false);
        return;
      }
      setLoading(true);
      try {
        const batchSnapshot = await getDocs(query(collection(db, 'academies', academyId, 'batches'), where('coachId', '==', linkedCoachId)));
        const assignedBatches = batchSnapshot.docs.map((docSnap) => ({ id: docSnap.id, ...docSnap.data() }) as BatchRecord);
        const assignedStudentIds = new Set(assignedBatches.flatMap((batch) => batch.studentIds ?? []));
        const studentSnapshots = await Promise.all(
          Array.from(assignedStudentIds).map((studentId) => getDoc(doc(db, 'academies', academyId, 'students', studentId))),
        );
        setBatches(assignedBatches);
        setStudents(
          studentSnapshots
            .filter((docSnap) => docSnap.exists())
            .map((docSnap) => ({ id: docSnap.id, ...docSnap.data() }) as AcademyStudentProfile),
        );
      } finally {
        setLoading(false);
      }
    };

    void loadBatches();
  }, [academyId, linkedCoachId]);

  const studentsById = useMemo(() => new Map(students.map((student) => [student.id, student])), [students]);

  if (!linkedCoachId) {
    return <EmptyState title="Your coach profile is not linked yet" description="Contact your academy." />;
  }

  return (
    <div className="space-y-6">
      <PageHeader title="My Batches" description="View-only batches assigned to your coach profile." />
      {loading ? (
        <EmptyState title="Loading batches" description="Checking assigned batches." />
      ) : batches.length === 0 ? (
        <EmptyState title="No batches assigned yet" description="Assigned batches will appear here after academy admin setup." />
      ) : (
        <div className="grid gap-5 xl:grid-cols-2">
          {batches.map((batch) => {
            const batchStudents = (batch.studentIds ?? []).map((studentId) => studentsById.get(studentId)).filter(Boolean);
            return (
              <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-card" key={batch.id}>
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <h2 className="text-xl font-black text-navy">{batch.name || 'Untitled batch'}</h2>
                    <p className="mt-1 text-sm font-semibold text-slate-500">{batch.level || 'Level not set'} · {(batch.days ?? []).join(', ') || 'Days not set'}</p>
                  </div>
                  <Badge className={batch.status === 'disabled' ? statusStyles.inactive : statusStyles.active}>{statusLabel(batch.status)}</Badge>
                </div>
                <div className="mt-5 grid gap-3 text-sm font-bold text-slate-700 sm:grid-cols-2">
                  <div className="rounded-2xl bg-slate-50 p-3">Time: <span className="text-navy">{batch.startTime && batch.endTime ? `${batch.startTime} - ${batch.endTime}` : 'Not set'}</span></div>
                  <div className="rounded-2xl bg-slate-50 p-3">Students: <span className="text-navy">{batchStudents.length}</span></div>
                </div>
                <div className="mt-5">
                  <DataTable columns={['Student', 'Phone', 'Login Email']}>
                    {batchStudents.map((student) => (
                      <tr className="border-t border-slate-100" key={student!.id}>
                        <td className="px-5 py-4 font-black text-navy">{student!.name}</td>
                        <td className="px-5 py-4 text-slate-600">{student!.phone || 'Not added'}</td>
                        <td className="px-5 py-4 text-slate-600">{student!.email || 'Not added'}</td>
                      </tr>
                    ))}
                  </DataTable>
                </div>
              </section>
            );
          })}
        </div>
      )}
    </div>
  );
}
