import { useEffect, useState, type FormEvent } from 'react';
import { Edit3, Eye, Plus, RotateCcw, UserX } from 'lucide-react';
import { Badge } from '../ui/Badge';
import { DataTable } from '../ui/DataTable';
import { EmptyState } from '../ui/EmptyState';
import { FormInput } from '../ui/FormInput';
import { FormSelect } from '../ui/FormSelect';
import { Modal } from '../ui/Modal';
import {
  createCoach,
  disableCoach,
  getCoachesByAcademy,
  reactivateCoach,
  updateCoach,
  type Coach,
  type CoachEmploymentType,
} from '../../lib/coachApi';
import { statusStyles } from '../../utils/badgeStyles';
import { formatFirestoreDate } from '../../utils/firestoreFormat';
import { useRefreshOnFocus } from '../../hooks/useRefreshOnFocus';

type CoachForm = {
  full_name: string;
  email: string;
  phone: string;
  specialization: string;
  employment_type: CoachEmploymentType;
  notes: string;
};

const initialForm: CoachForm = {
  full_name: '',
  email: '',
  phone: '',
  specialization: '',
  employment_type: 'part_time',
  notes: '',
};

function statusClass(status: string) {
  if (status === 'active') return statusStyles.active;
  if (status === 'disabled' || status === 'removed') return statusStyles.inactive;
  return statusStyles.pending;
}

function statusLabel(status: string) {
  return status.charAt(0).toUpperCase() + status.slice(1).replace('_', ' ');
}

export function CoachManager({
  academyId,
  canManage,
  title = 'Coaches',
  description = 'Coach profiles connected to this academy.',
  onCountChange,
}: {
  academyId: string;
  canManage: boolean;
  title?: string;
  description?: string;
  onCountChange?: (count: number) => void;
}) {
  const [coaches, setCoaches] = useState<Coach[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [viewing, setViewing] = useState<Coach | null>(null);
  const [editing, setEditing] = useState<Coach | null>(null);
  const [form, setForm] = useState<CoachForm>(initialForm);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const loadCoaches = async () => {
    setLoading(true);
    setError('');
    try {
      const loadedCoaches = await getCoachesByAcademy(academyId);
      setCoaches(loadedCoaches);
      onCountChange?.(loadedCoaches.length);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Could not load coaches.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadCoaches();
  }, [academyId]);

  useRefreshOnFocus(loadCoaches, Boolean(academyId));

  const updateField = (field: keyof CoachForm, value: string) => {
    setForm((current) => ({ ...current, [field]: value }));
  };

  const openAddModal = () => {
    setEditing(null);
    setForm(initialForm);
    setModalOpen(true);
  };

  const openEditModal = (coach: Coach) => {
    setEditing(coach);
    setForm({
      full_name: coach.full_name,
      email: coach.email ?? '',
      phone: coach.phone ?? '',
      specialization: coach.specialization ?? '',
      employment_type: coach.employment_type ?? 'part_time',
      notes: coach.notes ?? '',
    });
    setModalOpen(true);
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!form.full_name.trim() || !form.email.trim()) {
      setError('Coach name and email are required.');
      return;
    }

    setError('');
    setMessage('');
    try {
      if (editing) {
        await updateCoach(editing.id, {
          full_name: form.full_name,
          email: form.email,
          phone: form.phone,
          specialization: form.specialization,
          employment_type: form.employment_type,
          notes: form.notes,
        });
        setMessage('Coach updated.');
      } else {
        await createCoach({
          academy_id: academyId,
          full_name: form.full_name,
          email: form.email,
          phone: form.phone,
          specialization: form.specialization,
          employment_type: form.employment_type,
          notes: form.notes,
        });
        setMessage('Coach added. Ask the coach to log in with this same Google email. Their account will be linked automatically.');
      }
      setForm(initialForm);
      setEditing(null);
      setModalOpen(false);
      await loadCoaches();
    } catch (caught) {
      console.error('Could not save coach:', caught);
      const debugMessage = caught instanceof Error ? caught.message : '';
      setError(debugMessage ? `Could not save coach. ${debugMessage}` : 'Could not save coach.');
    }
  };

  const runCoachAction = async (action: () => Promise<Coach>, success: string) => {
    setError('');
    setMessage('');
    try {
      await action();
      setMessage(success);
      await loadCoaches();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Coach action failed.');
    }
  };

  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="text-xl font-black text-navy">{title}</h2>
          <p className="mt-1 text-sm leading-6 text-slate-500">{description}</p>
        </div>
        {canManage ? (
          <button className="inline-flex items-center gap-2 rounded-2xl bg-directBlue px-4 py-3 text-sm font-black text-white" onClick={openAddModal} type="button">
            <Plus size={18} /> Add Coach
          </button>
        ) : null}
      </div>

      {message ? <div className="rounded-2xl bg-emerald-50 px-4 py-3 text-sm font-black text-emerald-700">{message}</div> : null}
      {error ? <div className="rounded-2xl bg-rose-50 px-4 py-3 text-sm font-black text-rose-700">{error}</div> : null}

      {loading ? (
        <EmptyState title="Loading coaches" description="Checking Supabase coach profiles." />
      ) : coaches.length === 0 ? (
        <EmptyState title="No coaches added yet" description="Coach profiles for this academy will appear here." />
      ) : (
        <DataTable columns={['Coach', 'Contact', 'Specialization', 'Type', 'Status', 'Linked', 'Actions']}>
          {coaches.map((coach) => (
            <tr className="border-t border-slate-100" key={coach.id}>
              <td className="px-5 py-4">
                <div className="font-black text-navy">{coach.full_name}</div>
                <div className="mt-1 text-xs font-semibold text-slate-500">{formatFirestoreDate(coach.created_at)}</div>
              </td>
              <td className="px-5 py-4 text-slate-600">
                <div>{coach.email || 'No email'}</div>
                <div className="mt-1 text-xs font-semibold">{coach.phone || 'No phone'}</div>
              </td>
              <td className="px-5 py-4 text-slate-600">{coach.specialization || 'Not added'}</td>
              <td className="px-5 py-4 text-slate-600">{statusLabel(coach.employment_type || 'part_time')}</td>
              <td className="px-5 py-4"><Badge className={statusClass(coach.status)}>{statusLabel(coach.status)}</Badge></td>
              <td className="px-5 py-4 text-slate-600">{coach.user_id ? 'Profile linked' : 'No profile yet'}</td>
              <td className="px-5 py-4">
                <div className="flex flex-wrap gap-2">
                  <button className="rounded-xl border border-slate-200 p-2 text-slate-600" onClick={() => setViewing(coach)} type="button" aria-label="View coach" title="View coach"><Eye size={16} /></button>
                  {canManage ? (
                    <>
                      <button className="rounded-xl border border-slate-200 p-2 text-slate-600" onClick={() => openEditModal(coach)} type="button" aria-label="Edit coach" title="Edit coach"><Edit3 size={16} /></button>
                      {coach.status === 'disabled' ? (
                        <button className="rounded-xl bg-emerald-600 p-2 text-white" onClick={() => runCoachAction(() => reactivateCoach(coach.id), `${coach.full_name} reactivated.`)} type="button" aria-label="Reactivate coach" title="Reactivate coach"><RotateCcw size={16} /></button>
                      ) : (
                        <button className="rounded-xl border border-rose-100 p-2 text-rose-600" onClick={() => runCoachAction(() => disableCoach(coach.id), `${coach.full_name} disabled.`)} type="button" aria-label="Disable coach" title="Disable coach"><UserX size={16} /></button>
                      )}
                    </>
                  ) : null}
                </div>
              </td>
            </tr>
          ))}
        </DataTable>
      )}

      <Modal title={editing ? 'Edit Coach' : 'Add Coach'} description={editing ? 'Update Supabase coach profile fields.' : 'Ask the coach to log in with this same Google email. Their account will be linked automatically.'} open={modalOpen} onClose={() => setModalOpen(false)}>
        <form className="grid gap-4" onSubmit={handleSubmit}>
          <FormInput label="Coach name" value={form.full_name} onChange={(event) => updateField('full_name', event.target.value)} />
          <FormInput label="Coach Google email" required type="email" value={form.email} onChange={(event) => updateField('email', event.target.value)} />
          <FormInput label="Phone optional" value={form.phone} onChange={(event) => updateField('phone', event.target.value)} />
          <FormInput label="Specialization optional" value={form.specialization} onChange={(event) => updateField('specialization', event.target.value)} />
          <FormSelect
            label="Employment type"
            value={form.employment_type}
            onChange={(event) => updateField('employment_type', event.target.value)}
            options={[
              { label: 'Part time', value: 'part_time' },
              { label: 'Full time', value: 'full_time' },
              { label: 'Freelance', value: 'freelance' },
              { label: 'Trial', value: 'trial' },
            ]}
          />
          <FormInput label="Notes optional" value={form.notes} onChange={(event) => updateField('notes', event.target.value)} />
          <div className="flex justify-end gap-3">
            <button className="rounded-2xl border border-slate-200 px-5 py-3 text-sm font-black text-slate-600" type="button" onClick={() => setModalOpen(false)}>Cancel</button>
            <button className="rounded-2xl bg-directBlue px-5 py-3 text-sm font-black text-white" type="submit">{editing ? 'Save Coach' : 'Add Coach'}</button>
          </div>
        </form>
      </Modal>

      <Modal title="Coach Details" description="Supabase coach profile details." open={Boolean(viewing)} onClose={() => setViewing(null)}>
        {viewing ? (
          <div className="grid gap-3 text-sm">
            {[
              ['Coach name', viewing.full_name],
              ['Email', viewing.email || 'Not added'],
              ['Phone', viewing.phone || 'Not added'],
              ['Specialization', viewing.specialization || 'Not added'],
              ['Employment type', statusLabel(viewing.employment_type || 'part_time')],
              ['Status', statusLabel(viewing.status)],
              ['Joined', formatFirestoreDate(viewing.joined_at)],
              ['Created', formatFirestoreDate(viewing.created_at)],
              ['Linked profile', viewing.user_id || 'Not linked'],
              ['Membership', viewing.membership_id || 'Not linked'],
              ['Notes', viewing.notes || 'Not added'],
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
    </section>
  );
}
