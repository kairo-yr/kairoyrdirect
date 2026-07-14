import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { Edit3, Eye, Plus, RotateCcw, UserPlus, UserX } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Badge } from '../components/ui/Badge';
import { DataTable } from '../components/ui/DataTable';
import { EmptyState } from '../components/ui/EmptyState';
import { FormInput } from '../components/ui/FormInput';
import { FormSelect } from '../components/ui/FormSelect';
import { Modal } from '../components/ui/Modal';
import { PageHeader } from '../components/ui/PageHeader';
import { useAuth } from '../contexts/AuthContext';
import {
  assignStudentToBatch,
  createBatch,
  disableBatch,
  getBatchStudents,
  getBatchesByAcademy,
  reactivateBatch,
  removeStudentFromBatch,
  updateBatch,
  type Batch,
  type BatchLevel,
  type BatchStudent,
} from '../lib/batchApi';
import { getCoachesByAcademy, type Coach } from '../lib/coachApi';
import { getStudentsByAcademy, type Student } from '../lib/studentApi';
import { statusStyles } from '../utils/badgeStyles';
import { formatFirestoreDate } from '../utils/firestoreFormat';
import { useRefreshOnFocus } from '../hooks/useRefreshOnFocus';

type BatchForm = {
  name: string;
  level: BatchLevel;
  primary_coach_id: string;
  schedule_label: string;
  location: string;
  max_students: string;
  notes: string;
};

const initialForm: BatchForm = {
  name: '',
  level: 'beginner',
  primary_coach_id: '',
  schedule_label: '',
  location: '',
  max_students: '',
  notes: '',
};

function labelize(value?: string | null) {
  if (!value) return 'Not set';
  return value.split('_').map((part) => part.charAt(0).toUpperCase() + part.slice(1)).join(' ');
}

function statusClass(status: string) {
  if (status === 'active') return statusStyles.active;
  if (status === 'disabled' || status === 'archived' || status === 'completed') return statusStyles.inactive;
  return statusStyles.pending;
}

export function AcademyBatchesPage() {
  const { userProfile } = useAuth();
  const academyId = userProfile?.academyId;
  const [batches, setBatches] = useState<Batch[]>([]);
  const [coaches, setCoaches] = useState<Coach[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [assignments, setAssignments] = useState<BatchStudent[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [assignModalOpen, setAssignModalOpen] = useState(false);
  const [viewing, setViewing] = useState<Batch | null>(null);
  const [editing, setEditing] = useState<Batch | null>(null);
  const [assigningBatch, setAssigningBatch] = useState<Batch | null>(null);
  const [selectedStudentIds, setSelectedStudentIds] = useState<string[]>([]);
  const [form, setForm] = useState<BatchForm>(initialForm);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [savingBatch, setSavingBatch] = useState(false);

  const activeCoaches = useMemo(() => coaches.filter((coach) => coach.status === 'active'), [coaches]);
  const activeStudents = useMemo(() => students.filter((student) => student.status === 'active'), [students]);

  const loadBatches = async (showLoading = true) => {
    if (!academyId || userProfile?.app_role !== 'academy_admin') {
      setLoading(false);
      return;
    }
    if (showLoading) setLoading(true);
    setError('');
    try {
      const [loadedBatches, loadedCoaches, loadedStudents] = await Promise.all([
        getBatchesByAcademy(academyId),
        getCoachesByAcademy(academyId),
        getStudentsByAcademy(academyId),
      ]);
      setBatches(loadedBatches);
      setCoaches(loadedCoaches);
      setStudents(loadedStudents);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Could not load batches.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadBatches();
  }, [academyId, userProfile?.app_role]);

  useRefreshOnFocus(() => loadBatches(false), Boolean(academyId));

  const openCreateModal = () => {
    setEditing(null);
    setForm(initialForm);
    setModalOpen(true);
  };

  const openEditModal = (batch: Batch) => {
    setEditing(batch);
    setForm({
      name: batch.name,
      level: batch.level ?? 'beginner',
      primary_coach_id: batch.primary_coach_id ?? '',
      schedule_label: batch.schedule_label ?? '',
      location: batch.location ?? '',
      max_students: batch.max_students ? String(batch.max_students) : '',
      notes: batch.notes ?? '',
    });
    setModalOpen(true);
  };

  const closeBatchModal = () => {
    setModalOpen(false);
    setEditing(null);
    setForm(initialForm);
  };

  const openAssignModal = async (batch: Batch) => {
    setAssigningBatch(batch);
    setAssignModalOpen(true);
    setError('');
    const loadedAssignments = await getBatchStudents(batch.id);
    setAssignments(loadedAssignments);
    setSelectedStudentIds(loadedAssignments.map((assignment) => assignment.student_id));
  };

  const updateField = (field: keyof BatchForm, value: string) => {
    setForm((current) => ({ ...current, [field]: value }));
  };

  const toggleStudent = (studentId: string) => {
    setSelectedStudentIds((current) => (
      current.includes(studentId) ? current.filter((id) => id !== studentId) : [...current, studentId]
    ));
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (savingBatch) return;
    if (!academyId) return;
    if (!form.name.trim()) {
      setError('Batch name is required.');
      return;
    }

    const batchBeingEdited = editing;
    setSavingBatch(true);
    setError('');
    setMessage('');
    try {
      const payload = {
        academy_id: academyId,
        name: form.name,
        level: form.level,
        primary_coach_id: form.primary_coach_id || null,
        schedule_label: form.schedule_label || null,
        location: form.location || null,
        max_students: form.max_students ? Number(form.max_students) : null,
        notes: form.notes || null,
      };

      if (batchBeingEdited) {
        const updatedBatch = await updateBatch(batchBeingEdited.id, payload);
        setBatches((current) => current.map((batch) => (
          batch.id === updatedBatch.id
            ? { ...updatedBatch, student_count: batch.student_count ?? 0 }
            : batch
        )));
        setViewing((current) => current?.id === updatedBatch.id
          ? { ...updatedBatch, student_count: current.student_count ?? 0 }
          : current);
        closeBatchModal();
        setMessage('Batch updated successfully');
        await loadBatches(false);
      } else {
        await createBatch(payload);
        closeBatchModal();
        setMessage('Batch created successfully');
        await loadBatches(false);
      }
    } catch (caught) {
      if (import.meta.env.DEV) {
        const supabaseError = caught as Partial<{ code: string; message: string; details: string; hint: string }>;
        console.error(batchBeingEdited ? 'Could not update batch.' : 'Could not create batch.', {
          batchId: batchBeingEdited?.id,
          code: supabaseError.code,
          message: supabaseError.message,
          details: supabaseError.details,
          hint: supabaseError.hint,
        });
      }
      setError(batchBeingEdited ? 'Could not update batch' : 'Could not create batch');
    } finally {
      setSavingBatch(false);
    }
  };

  const saveAssignments = async () => {
    if (!assigningBatch) return;
    setError('');
    setMessage('');
    try {
      const existing = await getBatchStudents(assigningBatch.id);
      const existingIds = new Set(existing.map((assignment) => assignment.student_id));
      const selectedIds = new Set(selectedStudentIds);

      await Promise.all(selectedStudentIds.filter((studentId) => !existingIds.has(studentId)).map((studentId) => assignStudentToBatch(assigningBatch.id, studentId)));
      await Promise.all(existing.filter((assignment) => !selectedIds.has(assignment.student_id)).map((assignment) => removeStudentFromBatch(assigningBatch.id, assignment.student_id)));

      setAssignModalOpen(false);
      setAssigningBatch(null);
      setAssignments([]);
      setSelectedStudentIds([]);
      setMessage('Batch students updated.');
      await loadBatches();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Could not update batch students.');
    }
  };

  const runBatchAction = async (action: () => Promise<Batch>, success: string) => {
    setError('');
    setMessage('');
    try {
      await action();
      setMessage(success);
      await loadBatches();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Batch action failed.');
    }
  };

  if (!academyId) {
    return <EmptyState title="Academy profile not linked" description="Your academy profile is not linked correctly. Contact Kairoyr support." />;
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Academy Batches"
        description="Create Supabase batches and assign active students from this academy."
        action={<button className="inline-flex items-center gap-2 rounded-2xl bg-directBlue px-4 py-3 text-sm font-black text-white" onClick={openCreateModal} type="button"><Plus size={18} /> Create Batch</button>}
      />

      {message ? <div className="rounded-2xl bg-emerald-50 px-4 py-3 text-sm font-black text-emerald-700">{message}</div> : null}
      {error ? <div className="rounded-2xl bg-rose-50 px-4 py-3 text-sm font-black text-rose-700">{error}</div> : null}

      {loading ? (
        <EmptyState title="Loading batches" description="Checking Supabase batches." />
      ) : batches.length === 0 ? (
        <EmptyState title="No batches created yet" description="Create your first batch." />
      ) : (
        <DataTable columns={['Batch', 'Coach', 'Schedule', 'Students', 'Status', 'Created', 'Actions']}>
          {batches.map((batch) => (
            <tr className="border-t border-slate-100" key={batch.id}>
              <td className="px-5 py-4">
                <div className="font-black text-navy">{batch.name}</div>
                <div className="mt-1 text-xs font-semibold text-slate-500">{labelize(batch.level)}</div>
              </td>
              <td className="px-5 py-4 text-slate-600">{batch.primary_coach?.full_name ?? 'Unassigned'}</td>
              <td className="px-5 py-4 text-slate-600">{batch.schedule_label || 'Not set'}</td>
              <td className="px-5 py-4 text-slate-600">{batch.student_count ?? 0}</td>
              <td className="px-5 py-4"><Badge className={statusClass(batch.status)}>{labelize(batch.status)}</Badge></td>
              <td className="px-5 py-4 text-slate-600">{formatFirestoreDate(batch.created_at)}</td>
              <td className="px-5 py-4">
                <div className="flex flex-wrap gap-2">
                  <button className="rounded-xl border border-slate-200 p-2 text-slate-600" onClick={() => setViewing(batch)} type="button" aria-label="View batch" title="View batch"><Eye size={16} /></button>
                  <button className="rounded-xl border border-slate-200 p-2 text-slate-600" onClick={() => openEditModal(batch)} type="button" aria-label="Edit batch" title="Edit batch"><Edit3 size={16} /></button>
                  <button className="rounded-xl border border-slate-200 p-2 text-slate-600" onClick={() => void openAssignModal(batch)} type="button" aria-label="Assign students" title="Assign students"><UserPlus size={16} /></button>
                  {batch.status === 'disabled' ? (
                    <button className="rounded-xl bg-emerald-600 p-2 text-white" onClick={() => runBatchAction(() => reactivateBatch(batch.id), `${batch.name} reactivated.`)} type="button" aria-label="Reactivate batch" title="Reactivate batch"><RotateCcw size={16} /></button>
                  ) : (
                    <button className="rounded-xl border border-rose-100 p-2 text-rose-600" onClick={() => runBatchAction(() => disableBatch(batch.id), `${batch.name} disabled.`)} type="button" aria-label="Disable batch" title="Disable batch"><UserX size={16} /></button>
                  )}
                </div>
              </td>
            </tr>
          ))}
        </DataTable>
      )}

      <Modal title={editing ? 'Edit Batch' : 'Create Batch'} description="Only active coaches from this academy can be assigned." open={modalOpen} onClose={closeBatchModal}>
        <form className="grid gap-4" onSubmit={handleSubmit}>
          <FormInput label="Batch name" value={form.name} onChange={(event) => updateField('name', event.target.value)} />
          <FormSelect label="Level" value={form.level} onChange={(event) => updateField('level', event.target.value)} options={[
            { label: 'Absolute beginner', value: 'absolute_beginner' },
            { label: 'Beginner', value: 'beginner' },
            { label: 'Intermediate', value: 'intermediate' },
            { label: 'Advanced', value: 'advanced' },
            { label: 'Tournament', value: 'tournament' },
          ]} />
          <FormSelect label="Primary coach optional" value={form.primary_coach_id} onChange={(event) => updateField('primary_coach_id', event.target.value)} options={[{ label: 'Unassigned', value: '' }, ...activeCoaches.map((coach) => ({ label: coach.full_name, value: coach.id }))]} />
          <FormInput label="Schedule optional" value={form.schedule_label} placeholder="Mon, Wed 5:00 PM" onChange={(event) => updateField('schedule_label', event.target.value)} />
          <FormInput label="Location optional" value={form.location} onChange={(event) => updateField('location', event.target.value)} />
          <FormInput label="Max students optional" type="number" value={form.max_students} onChange={(event) => updateField('max_students', event.target.value)} />
          <FormInput label="Notes optional" value={form.notes} onChange={(event) => updateField('notes', event.target.value)} />
          <div className="flex justify-end gap-3">
            <button className="rounded-2xl border border-slate-200 px-5 py-3 text-sm font-black text-slate-600 disabled:opacity-60" disabled={savingBatch} type="button" onClick={closeBatchModal}>Cancel</button>
            <button className="rounded-2xl bg-directBlue px-5 py-3 text-sm font-black text-white disabled:opacity-60" disabled={savingBatch} type="submit">
              {savingBatch ? (editing ? 'Saving Batch...' : 'Creating Batch...') : (editing ? 'Save Batch' : 'Create Batch')}
            </button>
          </div>
        </form>
      </Modal>

      <Modal title="Assign Students" description={assigningBatch?.name} open={assignModalOpen} onClose={() => setAssignModalOpen(false)}>
        <div className="grid gap-4">
          <div className="max-h-72 overflow-auto rounded-2xl border border-slate-200 p-3">
            {activeStudents.length === 0 ? (
              <div className="text-sm text-slate-500">No active students yet.</div>
            ) : activeStudents.map((student) => (
              <label className="flex items-center gap-2 py-2 text-sm font-bold text-slate-700" key={student.id}>
                <input checked={selectedStudentIds.includes(student.id)} onChange={() => toggleStudent(student.id)} type="checkbox" />
                <span>{student.full_name}</span>
                <span className="text-xs text-slate-500">{student.parent_phone || student.email || ''}</span>
              </label>
            ))}
          </div>
          <div className="flex justify-end gap-3">
            <button className="rounded-2xl border border-slate-200 px-5 py-3 text-sm font-black text-slate-600" type="button" onClick={() => setAssignModalOpen(false)}>Cancel</button>
            <button className="rounded-2xl bg-directBlue px-5 py-3 text-sm font-black text-white" type="button" onClick={saveAssignments}>Save Assignments</button>
          </div>
        </div>
      </Modal>

      <Modal title="Batch Details" description="Supabase batch details." open={Boolean(viewing)} onClose={() => setViewing(null)}>
        {viewing ? (
          <div className="grid gap-3 text-sm">
            {[
              ['Batch name', viewing.name],
              ['Level', labelize(viewing.level)],
              ['Coach', viewing.primary_coach?.full_name ?? 'Unassigned'],
              ['Schedule', viewing.schedule_label || 'Not set'],
              ['Location', viewing.location || 'Not set'],
              ['Max students', viewing.max_students ? String(viewing.max_students) : 'Not set'],
              ['Students', String(viewing.student_count ?? 0)],
              ['Status', labelize(viewing.status)],
              ['Created', formatFirestoreDate(viewing.created_at)],
            ].map(([label, value]) => (
              <div className="rounded-2xl bg-slate-50 p-3" key={label}>
                <div className="text-xs font-black uppercase text-slate-500">{label}</div>
                <div className="mt-1 font-black text-navy">{value}</div>
              </div>
            ))}
            <div className="mt-2 grid gap-2 sm:grid-cols-2">
              <Link className="rounded-2xl bg-directBlue px-4 py-3 text-center text-sm font-black text-white" onClick={() => setViewing(null)} to={`/academy/attendance?batchId=${viewing.id}`}>View Attendance</Link>
              <Link className="rounded-2xl border border-slate-200 px-4 py-3 text-center text-sm font-black text-navy" onClick={() => setViewing(null)} to={`/academy/class-reports?batchId=${viewing.id}`}>View Class Reports</Link>
            </div>
          </div>
        ) : <EmptyState title="Batch not found" description="The selected batch could not be loaded." />}
      </Modal>
    </div>
  );
}
