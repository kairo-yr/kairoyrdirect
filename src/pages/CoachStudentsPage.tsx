import { useEffect, useMemo, useState } from 'react';
import { Eye } from 'lucide-react';
import { DataTable } from '../components/ui/DataTable';
import { EmptyState } from '../components/ui/EmptyState';
import { PageHeader } from '../components/ui/PageHeader';
import { useAuth } from '../contexts/AuthContext';
import { getBatchStudents, getBatchesByCoach, type Batch, type BatchStudent } from '../lib/batchApi';
import { getCurrentUserCoach, type Coach } from '../lib/coachApi';
import type { Student } from '../lib/studentApi';

function labelize(value?: string | null) {
  if (!value) return 'Not set';
  return value.split('_').map((part) => part.charAt(0).toUpperCase() + part.slice(1)).join(' ');
}

export function CoachStudentsPage() {
  const { userProfile } = useAuth();
  const [coach, setCoach] = useState<Coach | null>(null);
  const [batches, setBatches] = useState<Batch[]>([]);
  const [assignments, setAssignments] = useState<BatchStudent[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadStudents = async () => {
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
        const loadedAssignments = await Promise.all(assignedBatches.map((batch) => getBatchStudents(batch.id)));
        setBatches(assignedBatches);
        setAssignments(loadedAssignments.flat());
      } finally {
        setLoading(false);
      }
    };

    void loadStudents();
  }, [userProfile?.academyId, userProfile?.id]);

  const students = useMemo(() => {
    const map = new Map<string, Student>();
    assignments.forEach((assignment) => {
      if (assignment.student) map.set(assignment.student.id, assignment.student);
    });
    return Array.from(map.values());
  }, [assignments]);

  const batchNamesByStudent = useMemo(() => {
    const batchNames = new Map(batches.map((batch) => [batch.id, batch.name]));
    const map = new Map<string, string[]>();
    assignments.forEach((assignment) => {
      const name = batchNames.get(assignment.batch_id) ?? 'Untitled batch';
      map.set(assignment.student_id, [...(map.get(assignment.student_id) ?? []), name]);
    });
    return map;
  }, [assignments, batches]);

  if (!coach && !loading) {
    return <EmptyState title="Your coach profile is not linked yet" description="Contact your academy." />;
  }

  return (
    <div className="space-y-6">
      <PageHeader title="My Students" description="View-only students from your assigned Supabase batches." />
      {loading ? (
        <EmptyState title="Loading students" description="Checking assigned batches and students." />
      ) : students.length === 0 ? (
        <EmptyState title="No assigned students yet" description="Students will appear here after academy admin assigns them to your batches." />
      ) : (
        <DataTable columns={['Student', 'Phone', 'Login Email', 'Parent / Guardian', 'Batch', 'Level', 'Action']}>
          {students.map((student) => {
            const batchNames = batchNamesByStudent.get(student.id) ?? [];
            return (
              <tr className="border-t border-slate-100" key={student.id}>
                <td className="px-5 py-4 font-black text-navy">{student.full_name}</td>
                <td className="px-5 py-4 text-slate-600">{student.phone || 'Not added'}</td>
                <td className="px-5 py-4 text-slate-600">{student.email || 'Not added'}</td>
                <td className="px-5 py-4 text-slate-600">
                  <div>{student.parent_name || 'Not added'}</div>
                  <div className="mt-1 text-xs font-semibold">{student.parent_phone || student.parent_email || 'No parent contact'}</div>
                </td>
                <td className="px-5 py-4 text-slate-600" title={batchNames.join(', ') || undefined}>{batchNames.length > 1 ? `${batchNames.length} batches` : batchNames[0] ?? 'Not assigned'}</td>
                <td className="px-5 py-4 text-slate-600">{labelize(student.level)}</td>
                <td className="px-5 py-4 text-slate-600"><Eye size={16} aria-label="View only" /></td>
              </tr>
            );
          })}
        </DataTable>
      )}
    </div>
  );
}
