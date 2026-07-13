import { useEffect, useMemo, useState } from 'react';
import { ClipboardList, GraduationCap } from 'lucide-react';
import { DataTable } from '../components/ui/DataTable';
import { EmptyState } from '../components/ui/EmptyState';
import { StatCard } from '../components/ui/StatCard';
import { useAuth } from '../contexts/AuthContext';
import { getBatchStudents, getBatchesByCoach, type Batch } from '../lib/batchApi';
import { getCurrentUserCoach, type Coach } from '../lib/coachApi';
import type { Student } from '../lib/studentApi';
import { RoleDashboard } from './RoleDashboard';

export function CoachDashboard() {
  const { userProfile } = useAuth();
  const [coach, setCoach] = useState<Coach | null>(null);
  const [batches, setBatches] = useState<Batch[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadDashboard = async () => {
      setLoading(true);
      try {
        const currentCoach = await getCurrentUserCoach(userProfile?.academyId);
        setCoach(currentCoach);
        if (!currentCoach) {
          setBatches([]);
          setStudents([]);
          return;
        }

        const assignedBatches = await getBatchesByCoach(currentCoach.id);
        setBatches(assignedBatches);
        const assignments = await Promise.all(assignedBatches.map((batch) => getBatchStudents(batch.id)));
        const uniqueStudents = new Map<string, Student>();
        assignments.flat().forEach((assignment) => {
          if (assignment.student) uniqueStudents.set(assignment.student.id, assignment.student);
        });
        setStudents(Array.from(uniqueStudents.values()));
      } finally {
        setLoading(false);
      }
    };

    void loadDashboard();
  }, [userProfile?.academyId, userProfile?.id]);

  const nextBatch = useMemo(() => batches.find((batch) => batch.status === 'active'), [batches]);

  return (
    <div className="space-y-6">
      <RoleDashboard
        title="Coach Dashboard"
        role="coach"
        description="View assigned batches and students from Supabase."
      />

      {!coach && !loading ? (
        <EmptyState title="Your coach profile is not linked yet" description="Contact your academy." />
      ) : (
        <>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <StatCard label="Assigned Students" value={loading ? '...' : String(students.length)} helper="Students in assigned batches" icon={GraduationCap} />
            <StatCard label="Assigned Batches" value={loading ? '...' : String(batches.length)} helper="Coach-scoped batches" icon={ClipboardList} />
            <StatCard label="Active Batches" value={loading ? '...' : String(batches.filter((batch) => batch.status === 'active').length)} helper="Ready for classes" icon={ClipboardList} />
            <StatCard label="Next Batch" value={nextBatch?.name ?? 'No data'} helper={nextBatch?.schedule_label ?? 'No schedule yet'} icon={ClipboardList} />
          </div>

          <section>
            <h2 className="mb-3 text-xl font-black text-navy">Assigned Batches</h2>
            {loading ? (
              <EmptyState title="Loading batches" description="Checking batches assigned to this coach." />
            ) : batches.length === 0 ? (
              <EmptyState title="No batches assigned yet" description="Assigned batches will appear here after academy admin setup." />
            ) : (
              <DataTable columns={['Batch', 'Level', 'Schedule', 'Students']}>
                {batches.map((batch) => (
                  <tr className="border-t border-slate-100" key={batch.id}>
                    <td className="px-5 py-4 font-black text-navy">{batch.name}</td>
                    <td className="px-5 py-4 text-slate-600">{batch.level ?? 'Not set'}</td>
                    <td className="px-5 py-4 text-slate-600">{batch.schedule_label || 'No schedule yet'}</td>
                    <td className="px-5 py-4 text-slate-600">{batch.student_count ?? 0}</td>
                  </tr>
                ))}
              </DataTable>
            )}
          </section>

          <section>
            <h2 className="mb-3 text-xl font-black text-navy">Assigned Students</h2>
            {loading ? (
              <EmptyState title="Loading students" description="Checking students in assigned batches." />
            ) : students.length === 0 ? (
              <EmptyState title="No assigned students yet" description="Students will appear after batch assignment." />
            ) : (
              <DataTable columns={['Student', 'Parent', 'Phone', 'Level']}>
                {students.map((student) => (
                  <tr className="border-t border-slate-100" key={student.id}>
                    <td className="px-5 py-4 font-black text-navy">{student.full_name}</td>
                    <td className="px-5 py-4 text-slate-600">{student.parent_name || 'Not added'}</td>
                    <td className="px-5 py-4 text-slate-600">{student.parent_phone || student.phone || 'Not added'}</td>
                    <td className="px-5 py-4 text-slate-600">{student.level || 'Not set'}</td>
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
