import { useEffect, useMemo, useState } from 'react';
import { Badge } from '../components/ui/Badge';
import { DataTable } from '../components/ui/DataTable';
import { EmptyState } from '../components/ui/EmptyState';
import { PageHeader } from '../components/ui/PageHeader';
import { useAuth } from '../contexts/AuthContext';
import { getBatchStudents, getBatchesByCoach, type Batch, type BatchStudent } from '../lib/batchApi';
import { getCurrentUserCoach, type Coach } from '../lib/coachApi';
import { statusStyles } from '../utils/badgeStyles';

function labelize(value?: string | null) {
  if (!value) return 'Not set';
  return value.split('_').map((part) => part.charAt(0).toUpperCase() + part.slice(1)).join(' ');
}

export function CoachBatchesPage() {
  const { userProfile } = useAuth();
  const [coach, setCoach] = useState<Coach | null>(null);
  const [batches, setBatches] = useState<Batch[]>([]);
  const [assignments, setAssignments] = useState<BatchStudent[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadBatches = async () => {
      setLoading(true);
      try {
        const currentCoach = await getCurrentUserCoach(userProfile?.academyId);
        setCoach(currentCoach);
        if (!currentCoach) {
          setBatches([]);
          setAssignments([]);
          return;
        }
        const assignedBatches = await getBatchesByCoach(currentCoach.id);
        setBatches(assignedBatches);
        const loadedAssignments = await Promise.all(assignedBatches.map((batch) => getBatchStudents(batch.id)));
        setAssignments(loadedAssignments.flat());
      } finally {
        setLoading(false);
      }
    };

    void loadBatches();
  }, [userProfile?.academyId, userProfile?.id]);

  const assignmentsByBatch = useMemo(() => {
    const map = new Map<string, BatchStudent[]>();
    assignments.forEach((assignment) => {
      map.set(assignment.batch_id, [...(map.get(assignment.batch_id) ?? []), assignment]);
    });
    return map;
  }, [assignments]);

  if (!coach && !loading) {
    return <EmptyState title="Your coach profile is not linked yet" description="Contact your academy." />;
  }

  return (
    <div className="space-y-6">
      <PageHeader title="My Batches" description="View-only Supabase batches assigned to your coach profile." />
      {loading ? (
        <EmptyState title="Loading batches" description="Checking assigned batches." />
      ) : batches.length === 0 ? (
        <EmptyState title="No batches assigned yet" description="Assigned batches will appear here after academy admin setup." />
      ) : (
        <div className="grid gap-5 xl:grid-cols-2">
          {batches.map((batch) => {
            const batchAssignments = assignmentsByBatch.get(batch.id) ?? [];
            return (
              <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-card" key={batch.id}>
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <h2 className="text-xl font-black text-navy">{batch.name}</h2>
                    <p className="mt-1 text-sm font-semibold text-slate-500">{labelize(batch.level)} · {batch.schedule_label || 'Schedule not set'}</p>
                  </div>
                  <Badge className={batch.status === 'active' ? statusStyles.active : statusStyles.pending}>{labelize(batch.status)}</Badge>
                </div>
                <div className="mt-5 grid gap-3 text-sm font-bold text-slate-700 sm:grid-cols-2">
                  <div className="rounded-2xl bg-slate-50 p-3">Location: <span className="text-navy">{batch.location || 'Not set'}</span></div>
                  <div className="rounded-2xl bg-slate-50 p-3">Students: <span className="text-navy">{batchAssignments.length}</span></div>
                </div>
                <div className="mt-5">
                  <DataTable columns={['Student', 'Parent Phone', 'Level']}>
                    {batchAssignments.map((assignment) => (
                      <tr className="border-t border-slate-100" key={assignment.id}>
                        <td className="px-5 py-4 font-black text-navy">{assignment.student?.full_name ?? 'Student'}</td>
                        <td className="px-5 py-4 text-slate-600">{assignment.student?.parent_phone || assignment.student?.phone || 'Not added'}</td>
                        <td className="px-5 py-4 text-slate-600">{assignment.student?.level || 'Not set'}</td>
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
