import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { collection, doc, getDocs, query, serverTimestamp, updateDoc, where } from 'firebase/firestore';
import { ClipboardList, Copy, Edit3, Eye, Plus, RotateCcw, UserX } from 'lucide-react';
import { Badge } from '../components/ui/Badge';
import { EmptyState } from '../components/ui/EmptyState';
import { FormInput } from '../components/ui/FormInput';
import { Modal } from '../components/ui/Modal';
import { PageHeader } from '../components/ui/PageHeader';
import { useAuth } from '../contexts/AuthContext';
import { db } from '../lib/firebase';
import type { AcademyCoachProfile, AcademyInvite } from '../types/auth';
import { statusStyles } from '../utils/badgeStyles';
import { academyInviteLink, createAcademyCoachWithInvite } from '../utils/academyAdmin';
import { formatFirestoreDate } from '../utils/firestoreFormat';
import { createAuditLog } from '../utils/superAdminActions';

type CoachForm = { name: string; email: string; phone: string };
type BatchRecord = { id: string; coachId?: string | null };

const initialForm: CoachForm = { name: '', email: '', phone: '' };

function statusClass(status: string) {
  if (status === 'active') return statusStyles.active;
  if (status === 'disabled') return statusStyles.inactive;
  return statusStyles.pending;
}

function statusLabel(status: string) {
  return status.charAt(0).toUpperCase() + status.slice(1);
}

export function AcademyCoachesPage() {
  const { userProfile } = useAuth();
  const academyId = userProfile?.academyId;
  const [coaches, setCoaches] = useState<AcademyCoachProfile[]>([]);
  const [batches, setBatches] = useState<BatchRecord[]>([]);
  const [invites, setInvites] = useState<AcademyInvite[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [viewing, setViewing] = useState<AcademyCoachProfile | null>(null);
  const [editing, setEditing] = useState<AcademyCoachProfile | null>(null);
  const [form, setForm] = useState<CoachForm>(initialForm);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const inviteById = useMemo(() => new Map(invites.map((invite) => [invite.id, invite])), [invites]);
  const batchCountByCoach = useMemo(() => {
    const counts = new Map<string, number>();
    batches.forEach((batch) => {
      if (batch.coachId) counts.set(batch.coachId, (counts.get(batch.coachId) ?? 0) + 1);
    });
    return counts;
  }, [batches]);

  const loadCoaches = async () => {
    if (!academyId || userProfile?.app_role !== 'academy_admin') {
      setLoading(false);
      return;
    }
    setLoading(true);
    const [coachSnapshot, batchSnapshot, inviteSnapshot] = await Promise.all([
      getDocs(collection(db, 'academies', academyId, 'coaches')),
      getDocs(collection(db, 'academies', academyId, 'batches')),
      getDocs(query(collection(db, 'academyInvites'), where('academyId', '==', academyId))),
    ]);
    setCoaches(coachSnapshot.docs.map((docSnap) => ({ id: docSnap.id, ...docSnap.data() }) as AcademyCoachProfile));
    setBatches(batchSnapshot.docs.map((docSnap) => ({ id: docSnap.id, ...docSnap.data() }) as BatchRecord));
    setInvites(inviteSnapshot.docs.map((docSnap) => ({ id: docSnap.id, ...docSnap.data() }) as AcademyInvite));
    setLoading(false);
  };

  useEffect(() => {
    void loadCoaches();
  }, [academyId, userProfile?.app_role]);

  const updateField = (field: keyof CoachForm, value: string) => setForm((current) => ({ ...current, [field]: value }));

  const openAddModal = () => {
    setEditing(null);
    setForm(initialForm);
    setModalOpen(true);
  };

  const openEditModal = (coach: AcademyCoachProfile) => {
    setEditing(coach);
    setForm({
      name: coach.name,
      email: coach.email,
      phone: coach.phone ?? '',
    });
    setModalOpen(true);
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!academyId || !userProfile) return;
    if (!form.name.trim() || !form.email.trim()) {
      setError('Coach name and email are required.');
      return;
    }
    setError('');
    setMessage('');
    try {
      if (editing) {
        const previousInvite = editing.inviteId ? inviteById.get(editing.inviteId) : undefined;
        const normalizedEmail = form.email.trim().toLowerCase();
        await updateDoc(doc(db, 'academies', academyId, 'coaches', editing.id), {
          name: form.name.trim(),
          email: normalizedEmail,
          phone: form.phone.trim(),
          updatedAt: serverTimestamp(),
        });
        if (previousInvite?.status === 'pending') {
          await updateDoc(doc(db, 'academyInvites', previousInvite.id), { email: normalizedEmail });
        }
        setMessage(previousInvite?.status === 'accepted' ? 'Coach updated. Accepted invite ownership was not changed.' : 'Coach updated.');
      } else {
        const invite = await createAcademyCoachWithInvite({
          academyId,
          actor: userProfile,
          name: form.name.trim(),
          email: form.email.trim(),
          phone: form.phone.trim(),
        });
        setMessage(`Coach invite created: ${academyInviteLink('coach', invite.inviteToken)}`);
      }
      setForm(initialForm);
      setEditing(null);
      setModalOpen(false);
      await loadCoaches();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Could not save coach.');
    }
  };

  const handleDisable = async (coach: AcademyCoachProfile) => {
    if (!academyId || !userProfile) return;
    await updateDoc(doc(db, 'academies', academyId, 'coaches', coach.id), { status: 'disabled', updatedAt: serverTimestamp() });
    await createAuditLog({
      actor: userProfile,
      action: 'academy.coach.disabled',
      targetType: 'coach',
      targetId: coach.id,
      academyId,
      message: `${coach.name} coach profile disabled.`,
      metadata: { academyId },
    });
    await loadCoaches();
  };

  const handleReactivate = async (coach: AcademyCoachProfile) => {
    if (!academyId || !userProfile) return;
    await updateDoc(doc(db, 'academies', academyId, 'coaches', coach.id), { status: 'active', updatedAt: serverTimestamp() });
    await createAuditLog({
      actor: userProfile,
      action: 'academy.coach.reactivated',
      targetType: 'coach',
      targetId: coach.id,
      academyId,
      message: `${coach.name} coach profile reactivated.`,
      metadata: { academyId },
    });
    await loadCoaches();
  };

  const handleCopyInvite = async (coach: AcademyCoachProfile) => {
    const invite = coach.inviteId ? inviteById.get(coach.inviteId) : undefined;
    if (!invite) return;
    const link = academyInviteLink('coach', invite.inviteToken);
    await navigator.clipboard.writeText(link);
    setMessage(`Copied invite link: ${link}`);
  };

  if (!academyId) {
    return <EmptyState title="Academy profile not linked" description="Your academy profile is not linked correctly. Contact Kairoyr support." />;
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Academy Coaches"
        description="Manage invited and active coaches for your academy only."
        action={<button className="inline-flex items-center gap-2 rounded-2xl bg-directBlue px-4 py-3 text-sm font-black text-white" onClick={openAddModal} type="button"><Plus size={18} /> Add Coach</button>}
      />
      {message ? <div className="rounded-2xl bg-emerald-50 px-4 py-3 text-sm font-black text-emerald-700">{message}</div> : null}
      {error ? <div className="rounded-2xl bg-rose-50 px-4 py-3 text-sm font-black text-rose-700">{error}</div> : null}
      {loading ? (
        <EmptyState title="Loading coaches" description="Checking academy coach profiles." />
      ) : coaches.length === 0 ? (
        <EmptyState title="No coaches added yet" description="Add your first coach." />
      ) : (
        <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
          {coaches.map((coach) => {
            const invite = coach.inviteId ? inviteById.get(coach.inviteId) : undefined;
            return (
              <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-card" key={coach.id}>
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h2 className="text-xl font-black text-navy">{coach.name}</h2>
                    <p className="mt-1 text-sm font-semibold text-slate-500">{coach.email}</p>
                  </div>
                  <Badge className={statusClass(coach.status)}>{statusLabel(coach.status)}</Badge>
                </div>
                <div className="mt-4 text-sm font-bold text-slate-600">{coach.phone || 'No phone added'}</div>
                <div className="mt-6 flex items-center gap-2 text-sm font-bold text-slate-700">
                  <ClipboardList size={17} /> {batchCountByCoach.get(coach.id) ?? 0} assigned batches
                </div>
                <div className="mt-6 flex flex-wrap gap-2">
                  <button className="rounded-xl border border-slate-200 p-2 text-slate-600" onClick={() => setViewing(coach)} type="button" aria-label="View coach" title="View coach"><Eye size={16} /></button>
                  <button className="rounded-xl border border-slate-200 p-2 text-slate-600" onClick={() => openEditModal(coach)} type="button" aria-label="Edit coach" title="Edit coach"><Edit3 size={16} /></button>
                  {coach.status === 'invited' && invite ? <button className="rounded-xl border border-slate-200 p-2 text-slate-600" onClick={() => handleCopyInvite(coach)} type="button" aria-label="Copy invite" title="Copy invite link"><Copy size={16} /></button> : null}
                  {coach.status === 'disabled' ? (
                    <button className="rounded-xl bg-emerald-600 p-2 text-white" onClick={() => handleReactivate(coach)} type="button" aria-label="Reactivate coach" title="Reactivate coach"><RotateCcw size={16} /></button>
                  ) : (
                    <button className="rounded-xl border border-rose-100 p-2 text-rose-600" onClick={() => handleDisable(coach)} type="button" aria-label="Disable coach" title="Disable coach"><UserX size={16} /></button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
      <Modal title={editing ? 'Edit Coach' : 'Add Coach'} description={editing ? 'Update safe coach profile fields.' : 'Creates a coach profile and an email-matched invite link.'} open={modalOpen} onClose={() => setModalOpen(false)}>
        <form className="grid gap-4" onSubmit={handleSubmit}>
          <FormInput label="Coach name" value={form.name} onChange={(event) => updateField('name', event.target.value)} />
          <FormInput label="Coach email" type="email" value={form.email} onChange={(event) => updateField('email', event.target.value)} />
          <FormInput label="Phone optional" value={form.phone} onChange={(event) => updateField('phone', event.target.value)} />
          <div className="flex justify-end gap-3">
            <button className="rounded-2xl border border-slate-200 px-5 py-3 text-sm font-black text-slate-600" type="button" onClick={() => setModalOpen(false)}>Cancel</button>
            <button className="rounded-2xl bg-directBlue px-5 py-3 text-sm font-black text-white" type="submit">{editing ? 'Save Coach' : 'Add Coach'}</button>
          </div>
        </form>
      </Modal>
      <Modal title="Coach Details" description="Read-only coach profile details." open={Boolean(viewing)} onClose={() => setViewing(null)}>
        {viewing ? (
          <div className="grid gap-3 text-sm">
            {[
              ['Coach name', viewing.name],
              ['Email', viewing.email || 'Not added'],
              ['Phone', viewing.phone || 'Not added'],
              ['Status', statusLabel(viewing.status)],
              ['Assigned batches', String(batchCountByCoach.get(viewing.id) ?? 0)],
              ['Invite status/link', viewing.inviteId && inviteById.get(viewing.inviteId) ? `${inviteById.get(viewing.inviteId)?.status} · ${academyInviteLink('coach', inviteById.get(viewing.inviteId)!.inviteToken)}` : 'No invite'],
              ['Created date', formatFirestoreDate(viewing.createdAt)],
              ['Linked user UID', viewing.userUid || 'Not linked'],
            ].map(([label, value]) => (
              <div className="rounded-2xl bg-slate-50 p-4" key={label}>
                <div className="text-xs font-black uppercase tracking-wide text-slate-500">{label}</div>
                <div className="mt-1 break-words font-black text-navy">{value}</div>
              </div>
            ))}
            <div className="flex justify-end">
              <button className="rounded-2xl border border-slate-200 px-5 py-3 text-sm font-black text-slate-600" onClick={() => setViewing(null)} type="button">Close</button>
            </div>
          </div>
        ) : <EmptyState title="Profile not found" description="The selected coach profile could not be loaded." />}
      </Modal>
    </div>
  );
}
