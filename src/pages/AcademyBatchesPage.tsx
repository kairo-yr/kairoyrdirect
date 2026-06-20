import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { collection, doc, getDocs, serverTimestamp, setDoc, updateDoc } from 'firebase/firestore';
import { Edit3, Eye, Plus, RotateCcw, UserX } from 'lucide-react';
import { Badge } from '../components/ui/Badge';
import { EmptyState } from '../components/ui/EmptyState';
import { FormInput } from '../components/ui/FormInput';
import { FormSelect } from '../components/ui/FormSelect';
import { Modal } from '../components/ui/Modal';
import { PageHeader } from '../components/ui/PageHeader';
import { useAuth } from '../contexts/AuthContext';
import { db } from '../lib/firebase';
import type { AcademyCoachProfile, AcademyStudentProfile } from '../types/auth';
import { statusStyles } from '../utils/badgeStyles';
import { createAuditLog } from '../utils/superAdminActions';
import { formatFirestoreDate } from '../utils/firestoreFormat';

type BatchRecord = {
  id: string;
  name: string;
  level: string;
  days: string[];
  startTime: string;
  endTime: string;
  coachId: string | null;
  coachName: string | null;
  studentIds: string[];
  status: 'active' | 'disabled';
  createdAt: unknown;
  updatedAt: unknown;
};

type BatchForm = {
  name: string;
  level: string;
  days: string[];
  startTime: string;
  endTime: string;
  coachId: string;
  studentIds: string[];
};

const initialForm: BatchForm = {
  name: '',
  level: 'beginner',
  days: ['Monday', 'Wednesday'],
  startTime: '17:00',
  endTime: '18:00',
  coachId: '',
  studentIds: [],
};

const dayOptions = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

function DaySelector({ selectedDays, onChange }: { selectedDays: string[]; onChange: (days: string[]) => void }) {
  const toggleDay = (day: string) => {
    onChange(selectedDays.includes(day) ? selectedDays.filter((item) => item !== day) : [...selectedDays, day]);
  };

  return (
    <div className="grid gap-2 text-sm font-bold text-slate-700">
      Class days
      <div className="flex flex-wrap gap-2">
        {dayOptions.map((day) => {
          const selected = selectedDays.includes(day);
          return (
            <button
              className={`rounded-full px-3 py-2 text-xs font-black ring-1 transition ${selected ? 'bg-directBlue text-white ring-directBlue' : 'bg-white text-slate-600 ring-slate-200 hover:bg-slate-50'}`}
              key={day}
              onClick={() => toggleDay(day)}
              type="button"
            >
              {day}
            </button>
          );
        })}
      </div>
      <div className="text-xs font-semibold text-slate-500">{selectedDays.length ? selectedDays.join(', ') : 'Select class days'}</div>
    </div>
  );
}

function statusLabel(status: string) {
  return status.charAt(0).toUpperCase() + status.slice(1);
}

export function AcademyBatchesPage() {
  const { userProfile } = useAuth();
  const academyId = userProfile?.academyId;
  const [batches, setBatches] = useState<BatchRecord[]>([]);
  const [coaches, setCoaches] = useState<AcademyCoachProfile[]>([]);
  const [students, setStudents] = useState<AcademyStudentProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [viewing, setViewing] = useState<BatchRecord | null>(null);
  const [editing, setEditing] = useState<BatchRecord | null>(null);
  const [form, setForm] = useState<BatchForm>(initialForm);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const activeCoaches = useMemo(() => coaches.filter((coach) => coach.status === 'active'), [coaches]);
  const activeStudents = useMemo(() => students.filter((student) => student.status === 'active'), [students]);

  const loadBatches = async () => {
    if (!academyId || userProfile?.role !== 'academy_admin') {
      setLoading(false);
      return;
    }
    setLoading(true);
    const [batchSnapshot, coachSnapshot, studentSnapshot] = await Promise.all([
      getDocs(collection(db, 'academies', academyId, 'batches')),
      getDocs(collection(db, 'academies', academyId, 'coaches')),
      getDocs(collection(db, 'academies', academyId, 'students')),
    ]);
    setBatches(batchSnapshot.docs.map((docSnap) => ({ id: docSnap.id, ...docSnap.data() }) as BatchRecord));
    setCoaches(coachSnapshot.docs.map((docSnap) => ({ id: docSnap.id, ...docSnap.data() }) as AcademyCoachProfile));
    setStudents(studentSnapshot.docs.map((docSnap) => ({ id: docSnap.id, ...docSnap.data() }) as AcademyStudentProfile));
    setLoading(false);
  };

  useEffect(() => {
    void loadBatches();
  }, [academyId, userProfile?.role]);

  const updateField = (field: keyof BatchForm, value: string | string[]) => setForm((current) => ({ ...current, [field]: value }));

  const openCreateModal = () => {
    setEditing(null);
    setForm(initialForm);
    setModalOpen(true);
  };

  const openEditModal = (batch: BatchRecord) => {
    setEditing(batch);
    setForm({
      name: batch.name,
      level: batch.level,
      days: Array.isArray(batch.days) ? batch.days : [],
      startTime: batch.startTime,
      endTime: batch.endTime,
      coachId: batch.coachId ?? '',
      studentIds: Array.isArray(batch.studentIds) ? batch.studentIds : [],
    });
    setModalOpen(true);
  };

  const handleStudentToggle = (studentId: string) => {
    setForm((current) => ({
      ...current,
      studentIds: current.studentIds.includes(studentId)
        ? current.studentIds.filter((id) => id !== studentId)
        : [...current.studentIds, studentId],
    }));
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!academyId || !userProfile) return;
    if (!form.name.trim()) {
      setError('Batch name is required.');
      return;
    }
    if (form.days.length === 0) {
      setError('Please select at least one class day.');
      return;
    }
    setError('');
    setMessage('');
    try {
      const coach = activeCoaches.find((item) => item.id === form.coachId);
      const payload = {
        name: form.name.trim(),
        level: form.level,
        days: form.days,
        startTime: form.startTime,
        endTime: form.endTime,
        coachId: coach?.id ?? null,
        coachName: coach?.name ?? null,
        studentIds: form.studentIds,
        updatedAt: serverTimestamp(),
      };
      if (editing) {
        await updateDoc(doc(db, 'academies', academyId, 'batches', editing.id), payload);
        await createAuditLog({
          actor: userProfile,
          action: 'academy.batch.updated',
          targetType: 'batch',
          targetId: editing.id,
          academyId,
          message: `${form.name.trim()} batch updated.`,
          metadata: { academyId, coachId: coach?.id ?? null, studentIds: form.studentIds, days: form.days },
        });
        setMessage('Batch updated.');
      } else {
        const batchRef = doc(collection(db, 'academies', academyId, 'batches'));
        await setDoc(batchRef, {
          ...payload,
        status: 'active',
        createdAt: serverTimestamp(),
        });
        await createAuditLog({
          actor: userProfile,
          action: 'academy.batch.created',
          targetType: 'batch',
          targetId: batchRef.id,
          academyId,
          message: `${form.name.trim()} batch created.`,
          metadata: { academyId, coachId: coach?.id ?? null, studentIds: form.studentIds, days: form.days },
        });
        setMessage('Batch created.');
      }
      setForm(initialForm);
      setEditing(null);
      setModalOpen(false);
      await loadBatches();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Could not save batch.');
    }
  };

  const handleDisable = async (batch: BatchRecord) => {
    if (!academyId || !userProfile) return;
    await updateDoc(doc(db, 'academies', academyId, 'batches', batch.id), { status: 'disabled', updatedAt: serverTimestamp() });
    await createAuditLog({
      actor: userProfile,
      action: 'academy.batch.disabled',
      targetType: 'batch',
      targetId: batch.id,
      academyId,
      message: `${batch.name} batch disabled.`,
      metadata: { academyId },
    });
    await loadBatches();
  };

  const handleReactivate = async (batch: BatchRecord) => {
    if (!academyId || !userProfile) return;
    await updateDoc(doc(db, 'academies', academyId, 'batches', batch.id), { status: 'active', updatedAt: serverTimestamp() });
    await createAuditLog({
      actor: userProfile,
      action: 'academy.batch.reactivated',
      targetType: 'batch',
      targetId: batch.id,
      academyId,
      message: `${batch.name} batch reactivated.`,
      metadata: { academyId },
    });
    await loadBatches();
  };

  if (!academyId) {
    return <EmptyState title="Academy profile not linked" description="Your academy profile is not linked correctly. Contact Kairoyr support." />;
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Academy Batches"
        description="Create batches and assign only active coaches and students from this academy."
        action={<button className="inline-flex items-center gap-2 rounded-2xl bg-directBlue px-4 py-3 text-sm font-black text-white" onClick={openCreateModal} type="button"><Plus size={18} /> Create Batch</button>}
      />
      {message ? <div className="rounded-2xl bg-emerald-50 px-4 py-3 text-sm font-black text-emerald-700">{message}</div> : null}
      {error ? <div className="rounded-2xl bg-rose-50 px-4 py-3 text-sm font-black text-rose-700">{error}</div> : null}
      {loading ? (
        <EmptyState title="Loading batches" description="Checking academy batches." />
      ) : batches.length === 0 ? (
        <EmptyState title="No batches created yet" description="Create your first batch." />
      ) : (
        <div className="grid gap-5 lg:grid-cols-2">
          {batches.map((batch) => (
            <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-card" key={batch.id}>
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h2 className="text-xl font-black text-navy">{batch.name}</h2>
                  <p className="mt-1 text-sm text-slate-500">{batch.level} · {batch.days?.join(', ') || 'No days set'}</p>
                </div>
                <Badge className={batch.status === 'active' ? statusStyles.active : statusStyles.inactive}>{statusLabel(batch.status)}</Badge>
              </div>
              <div className="mt-5 grid gap-3 text-sm font-bold text-slate-700 sm:grid-cols-2">
                <div className="rounded-2xl bg-slate-50 p-3">Time: <span className="text-navy">{batch.startTime} - {batch.endTime}</span></div>
                <div className="rounded-2xl bg-slate-50 p-3">Coach: <span className="text-navy">{batch.coachName || 'Not assigned'}</span></div>
                <div className="rounded-2xl bg-slate-50 p-3">Students: <span className="text-navy">{batch.studentIds?.length ?? 0}</span></div>
                <div className="rounded-2xl bg-slate-50 p-3">Created: <span className="text-navy">{formatFirestoreDate(batch.createdAt)}</span></div>
              </div>
              <div className="mt-6 flex gap-2">
                <button className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 px-4 py-2 text-sm font-black text-slate-600" onClick={() => setViewing(batch)} type="button" aria-label="View batch" title="View batch"><Eye size={16} /> View</button>
                <button className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 px-4 py-2 text-sm font-black text-slate-600" onClick={() => openEditModal(batch)} type="button" aria-label="Edit batch" title="Edit batch"><Edit3 size={16} /> Edit</button>
                {batch.status === 'active' ? (
                  <button className="inline-flex items-center gap-2 rounded-2xl border border-rose-100 px-4 py-2 text-sm font-black text-rose-600" onClick={() => handleDisable(batch)} type="button" aria-label="Disable batch" title="Disable batch"><UserX size={16} /> Disable</button>
                ) : (
                  <button className="inline-flex items-center gap-2 rounded-2xl bg-emerald-600 px-4 py-2 text-sm font-black text-white" onClick={() => handleReactivate(batch)} type="button" aria-label="Reactivate batch" title="Reactivate batch"><RotateCcw size={16} /> Reactivate</button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
      <Modal title={editing ? 'Edit Batch' : 'Create Batch'} description="Only active coaches and students from this academy can be selected." open={modalOpen} onClose={() => setModalOpen(false)}>
        <form className="grid gap-4" onSubmit={handleSubmit}>
          <FormInput label="Batch name" value={form.name} onChange={(event) => updateField('name', event.target.value)} />
          <FormSelect label="Level" value={form.level} onChange={(event) => updateField('level', event.target.value)} options={[
            { label: 'Basic', value: 'basic' },
            { label: 'Beginner', value: 'beginner' },
            { label: 'Intermediate', value: 'intermediate' },
            { label: 'Advanced', value: 'advanced' },
          ]} />
          <DaySelector selectedDays={form.days} onChange={(days) => updateField('days', days)} />
          <div className="grid gap-4 md:grid-cols-2">
            <FormInput label="Start time" type="time" value={form.startTime} onChange={(event) => updateField('startTime', event.target.value)} />
            <FormInput label="End time" type="time" value={form.endTime} onChange={(event) => updateField('endTime', event.target.value)} />
          </div>
          <FormSelect label="Assign coach optional" value={form.coachId} onChange={(event) => updateField('coachId', event.target.value)} options={[{ label: 'Unassigned', value: '' }, ...activeCoaches.map((coach) => ({ label: coach.name, value: coach.id }))]} />
          <div className="grid gap-2 text-sm font-bold text-slate-700">
            Select students optional
            <div className="max-h-48 overflow-auto rounded-2xl border border-slate-200 p-3">
              {activeStudents.length === 0 ? (
                <div className="text-sm text-slate-500">No active students yet.</div>
              ) : activeStudents.map((student) => (
                <label className="flex items-center gap-2 py-2" key={student.id}>
                  <input checked={form.studentIds.includes(student.id)} onChange={() => handleStudentToggle(student.id)} type="checkbox" />
                  <span>{student.name}</span>
                </label>
              ))}
            </div>
          </div>
          <div className="flex justify-end gap-3">
            <button className="rounded-2xl border border-slate-200 px-5 py-3 text-sm font-black text-slate-600" type="button" onClick={() => setModalOpen(false)}>Cancel</button>
            <button className="rounded-2xl bg-directBlue px-5 py-3 text-sm font-black text-white" type="submit">{editing ? 'Save Batch' : 'Create Batch'}</button>
          </div>
        </form>
      </Modal>
      <Modal title="Batch Details" description="Read-only batch details." open={Boolean(viewing)} onClose={() => setViewing(null)}>
        {viewing ? (
          <div className="grid gap-3 text-sm">
            {[
              ['Batch name', viewing.name],
              ['Level', viewing.level],
              ['Days', viewing.days?.join(', ') || 'No days set'],
              ['Time', `${viewing.startTime} - ${viewing.endTime}`],
              ['Coach', viewing.coachName || 'Not assigned'],
              ['Students', String(viewing.studentIds?.length ?? 0)],
              ['Status', statusLabel(viewing.status)],
              ['Created date', formatFirestoreDate(viewing.createdAt)],
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
        ) : <EmptyState title="Batch not found" description="The selected batch could not be loaded." />}
      </Modal>
    </div>
  );
}
