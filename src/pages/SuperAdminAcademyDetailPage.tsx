import { useCallback, useEffect, useState } from 'react';
import { ArrowLeft, Ban, CheckCircle2, ClipboardList, GraduationCap, KeyRound, RotateCcw, ShieldCheck, Users, XCircle } from 'lucide-react';
import { Link, useParams } from 'react-router-dom';
import { Badge } from '../components/ui/Badge';
import { CoachManager } from '../components/coaches/CoachManager';
import { DataTable } from '../components/ui/DataTable';
import { EmptyState } from '../components/ui/EmptyState';
import { PageHeader } from '../components/ui/PageHeader';
import { StatCard } from '../components/ui/StatCard';
import { StudentManager } from '../components/students/StudentManager';
import {
  approveAcademy,
  disableAcademy,
  getAcademyById,
  reactivateAcademy,
  rejectAcademy,
  type Academy,
} from '../lib/academyApi';
import { getBatchesByAcademy, type Batch } from '../lib/batchApi';
import { getAcademyStatusClass } from '../utils/academyStatus';
import { formatFirestoreDate } from '../utils/firestoreFormat';

type AcademyCounts = {
  students: number;
  coaches: number;
  batches: number;
  invites: number;
};

export function SuperAdminAcademyDetailPage() {
  const { academyId } = useParams();
  const [academy, setAcademy] = useState<Academy | null>(null);
  const [batches, setBatches] = useState<Batch[]>([]);
  const [counts, setCounts] = useState<AcademyCounts>({ students: 0, coaches: 0, batches: 0, invites: 0 });
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const loadAcademy = async () => {
    if (!academyId) {
      setLoading(false);
      return;
    }

    setLoading(true);
    setError('');
    try {
      const loadedAcademy = await getAcademyById(academyId);
      const loadedBatches = loadedAcademy ? await getBatchesByAcademy(academyId) : [];
      setAcademy(loadedAcademy);
      setBatches(loadedBatches);
      setCounts((current) => ({ ...current, batches: loadedBatches.length, invites: 0 }));
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Could not load academy.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadAcademy();
  }, [academyId]);

  const updateCoachCount = useCallback((coachCount: number) => {
    setCounts((current) => ({ ...current, coaches: coachCount }));
  }, []);

  const updateStudentCount = useCallback((studentCount: number) => {
    setCounts((current) => ({ ...current, students: studentCount }));
  }, []);

  const runAction = async (action: () => Promise<void>, success: string) => {
    setError('');
    setMessage('');
    try {
      await action();
      setMessage(success);
      await loadAcademy();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Action failed.');
    }
  };

  const handleReject = async () => {
    if (!academy) return;
    const reason = window.prompt(`Reason for rejecting ${academy.name}?`);
    if (!reason?.trim()) return;
    await runAction(() => rejectAcademy(academy.id, reason.trim()).then(() => undefined), `${academy.name} rejected.`);
  };

  if (loading) return <EmptyState title="Loading academy" description="Checking academy profile and counts." />;
  if (!academy) return <EmptyState title="Academy not found" description="This academy may have been removed or the link is invalid." />;

  return (
    <div className="space-y-6">
      <PageHeader
        title={academy.name}
        description="Platform-level academy details for super admins only."
        action={<Link className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-black text-slate-700" to="/super-admin/academies"><ArrowLeft size={18} /> Back to academies</Link>}
      />

      {message ? <div className="rounded-2xl bg-emerald-50 px-4 py-3 text-sm font-black text-emerald-700">{message}</div> : null}
      {error ? <div className="rounded-2xl bg-rose-50 px-4 py-3 text-sm font-black text-rose-700">{error}</div> : null}

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
        <StatCard label="Students" value={String(counts.students)} helper="Supabase students" icon={GraduationCap} />
        <StatCard label="Coaches" value={String(counts.coaches)} helper="Supabase coaches" icon={Users} />
        <StatCard label="Batches" value={String(counts.batches)} helper="Supabase batches" icon={ClipboardList} />
        <StatCard label="Invites" value={String(counts.invites)} helper="Next migration phase" icon={KeyRound} />
        <StatCard label="Status" value={academy.status} helper="Current academy state" icon={ShieldCheck} />
      </div>

      <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-card">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h2 className="text-xl font-black text-navy">Academy Profile</h2>
            <p className="mt-1 text-sm leading-6 text-slate-500">Read-only platform view for this academy.</p>
          </div>
          <Badge className={getAcademyStatusClass(academy.status)}>{academy.status}</Badge>
        </div>
        <div className="mt-6 grid gap-4 md:grid-cols-2">
          {[
            ['Academy name', academy.name],
            ['City', academy.city || 'Not available'],
            ['Phone', academy.primary_phone || 'Not available'],
            ['Owner name', academy.owner_name || 'Not available'],
            ['Owner email', academy.owner_email || 'Not available'],
            ['Status', academy.status],
            ['Created', formatFirestoreDate(academy.created_at)],
            ['Approved', formatFirestoreDate(academy.approved_at)],
            ['Approved by', academy.approved_by || 'Not available'],
            ['Notes', academy.notes || 'Not available'],
          ].map(([label, value]) => (
            <div className="rounded-2xl bg-slate-50 p-4" key={label}>
              <div className="text-xs font-black uppercase tracking-wide text-slate-500">{label}</div>
              <div className="mt-1 break-words font-black text-navy">{value}</div>
            </div>
          ))}
        </div>
      </section>

      <div className="flex flex-wrap gap-3">
        {academy.status === 'pending' ? (
          <>
            <button className="inline-flex items-center gap-2 rounded-2xl bg-emerald-600 px-4 py-3 text-sm font-black text-white" onClick={() => runAction(() => approveAcademy(academy.id).then(() => undefined), `${academy.name} approved.`)} type="button">
              <CheckCircle2 size={18} /> Approve
            </button>
            <button className="inline-flex items-center gap-2 rounded-2xl border border-rose-100 bg-white px-4 py-3 text-sm font-black text-rose-600" onClick={handleReject} type="button">
              <XCircle size={18} /> Reject
            </button>
          </>
        ) : null}
        {academy.status === 'active' ? (
          <button className="inline-flex items-center gap-2 rounded-2xl border border-rose-100 bg-white px-4 py-3 text-sm font-black text-rose-600" onClick={() => runAction(() => disableAcademy(academy.id).then(() => undefined), `${academy.name} disabled.`)} type="button">
            <Ban size={18} /> Disable
          </button>
        ) : null}
        {academy.status === 'disabled' ? (
          <button className="inline-flex items-center gap-2 rounded-2xl bg-emerald-600 px-4 py-3 text-sm font-black text-white" onClick={() => runAction(() => reactivateAcademy(academy.id).then(() => undefined), `${academy.name} reactivated.`)} type="button">
            <RotateCcw size={18} /> Reactivate
          </button>
        ) : null}
      </div>

      <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-card">
        <StudentManager
          academyId={academy.id}
          canManage
          title="Academy Students"
          description="Supabase student records for this academy. Batches, attendance, reports, homework, and fees remain for later phases."
          onCountChange={updateStudentCount}
        />
      </section>

      <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-card">
        <CoachManager
          academyId={academy.id}
          canManage
          title="Academy Coaches"
          description="Supabase coach records for this academy. Students, batches, and invites remain for later phases."
          onCountChange={updateCoachCount}
        />
      </section>

      <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-card">
        <div className="mb-4">
          <h2 className="text-xl font-black text-navy">Academy Batches</h2>
          <p className="mt-1 text-sm leading-6 text-slate-500">Supabase batch records for this academy.</p>
        </div>
        {batches.length === 0 ? (
          <EmptyState title="No batches yet" description="Batches created by the academy admin will appear here." />
        ) : (
          <DataTable columns={['Batch', 'Coach', 'Schedule', 'Students', 'Status']}>
            {batches.map((batch) => (
              <tr className="border-t border-slate-100" key={batch.id}>
                <td className="px-5 py-4 font-black text-navy">{batch.name}</td>
                <td className="px-5 py-4 text-slate-600">{batch.primary_coach?.full_name ?? 'Not assigned'}</td>
                <td className="px-5 py-4 text-slate-600">{batch.schedule_label || 'Not set'}</td>
                <td className="px-5 py-4 text-slate-600">{batch.student_count ?? 0}</td>
                <td className="px-5 py-4 text-slate-600">{batch.status}</td>
              </tr>
            ))}
          </DataTable>
        )}
      </section>

      <EmptyState title="Attendance, reports, homework, fees, and invites migrate next" description="This page now reads academy profile, coach, student, and batch records from Supabase. Related academy operating data will appear after later migration phases." />
    </div>
  );
}
