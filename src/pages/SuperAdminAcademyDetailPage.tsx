import { useEffect, useState } from 'react';
import { ArrowLeft, Ban, CheckCircle2, ClipboardList, GraduationCap, KeyRound, RotateCcw, ShieldCheck, Users, XCircle } from 'lucide-react';
import { Link, useParams } from 'react-router-dom';
import { Badge } from '../components/ui/Badge';
import { EmptyState } from '../components/ui/EmptyState';
import { PageHeader } from '../components/ui/PageHeader';
import { StatCard } from '../components/ui/StatCard';
import {
  approveAcademy,
  disableAcademy,
  getAcademyById,
  reactivateAcademy,
  rejectAcademy,
  type Academy,
} from '../lib/academyApi';
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
      setAcademy(loadedAcademy);
      setCounts({ students: 0, coaches: 0, batches: 0, invites: 0 });
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Could not load academy.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadAcademy();
  }, [academyId]);

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
        <StatCard label="Students" value={String(counts.students)} helper="Next migration phase" icon={GraduationCap} />
        <StatCard label="Coaches" value={String(counts.coaches)} helper="Next migration phase" icon={Users} />
        <StatCard label="Batches" value={String(counts.batches)} helper="Next migration phase" icon={ClipboardList} />
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

      <EmptyState title="Students, coaches, batches, and invites migrate next" description="This page now reads the academy profile from Supabase. Related academy operating data will appear after the next migration phase." />
    </div>
  );
}
