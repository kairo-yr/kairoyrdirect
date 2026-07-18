import { useEffect, useState, type FormEvent } from 'react';
import { Edit3, Eye, Plus, RotateCcw, UserX } from 'lucide-react';
import { Badge } from '../ui/Badge';
import { DataTable } from '../ui/DataTable';
import { EmptyState } from '../ui/EmptyState';
import { FormInput } from '../ui/FormInput';
import { FormSelect } from '../ui/FormSelect';
import { Modal } from '../ui/Modal';
import {
  createStudent,
  disableStudent,
  getStudentsByAcademy,
  reactivateStudent,
  updateStudent,
  type Student,
  type StudentLevel,
} from '../../lib/studentApi';
import { statusStyles } from '../../utils/badgeStyles';
import { formatDateTime } from '../../utils/dateFormat';
import { useRefreshOnFocus } from '../../hooks/useRefreshOnFocus';
import { assignStudentToBatch, getBatchesByAcademy, type Batch } from '../../lib/batchApi';
import { getStudentScheduleSlotIds, listClassSlots, updateStudentSchedule, type ClassSlot } from '../../lib/classSessionApi';

type StudentForm = {
  full_name: string;
  email: string;
  phone: string;
  school_name: string;
  grade: string;
  parent_name: string;
  parent_email: string;
  parent_phone: string;
  level: StudentLevel;
  notes: string;
  home_batch_id: string;
  expected_weekly_frequency: '1' | '2' | '3' | '4' | 'flexible';
  schedule_mode: 'inherited' | 'custom' | 'flexible';
  class_slot_ids: string[];
};

const initialForm: StudentForm = {
  full_name: '',
  email: '',
  phone: '',
  school_name: '',
  grade: '',
  parent_name: '',
  parent_email: '',
  parent_phone: '',
  level: 'beginner',
  notes: '',
  home_batch_id: '',
  expected_weekly_frequency: '2',
  schedule_mode: 'inherited',
  class_slot_ids: [],
};

function statusClass(status: string) {
  if (status === 'active') return statusStyles.active;
  if (status === 'disabled' || status === 'removed' || status === 'inactive') return statusStyles.inactive;
  return statusStyles.pending;
}

function labelize(value: string) {
  return value.split('_').map((part) => part.charAt(0).toUpperCase() + part.slice(1)).join(' ');
}

export function StudentManager({
  academyId,
  canManage,
  title = 'Students',
  description = 'Student profiles connected to this academy.',
  onCountChange,
}: {
  academyId: string;
  canManage: boolean;
  title?: string;
  description?: string;
  onCountChange?: (count: number) => void;
}) {
  const [students, setStudents] = useState<Student[]>([]);
  const [batches, setBatches] = useState<Batch[]>([]);
  const [classSlots, setClassSlots] = useState<ClassSlot[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [viewing, setViewing] = useState<Student | null>(null);
  const [editing, setEditing] = useState<Student | null>(null);
  const [form, setForm] = useState<StudentForm>(initialForm);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const loadStudents = async () => {
    setLoading(true);
    setError('');
    try {
      const [loadedStudents, loadedBatches, loadedSlots] = await Promise.all([getStudentsByAcademy(academyId), getBatchesByAcademy(academyId), listClassSlots(academyId)]);
      setStudents(loadedStudents);
      setBatches(loadedBatches.filter((batch) => batch.status === 'active'));
      setClassSlots(loadedSlots);
      onCountChange?.(loadedStudents.length);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Could not load students.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadStudents();
  }, [academyId]);

  useRefreshOnFocus(loadStudents, Boolean(academyId));

  const updateField = (field: keyof StudentForm, value: string) => {
    setForm((current) => ({ ...current, [field]: value }));
  };

  const openAddModal = () => {
    setEditing(null);
    setForm(initialForm);
    setModalOpen(true);
  };

  const openEditModal = async (student: Student) => {
    const classSlotIds = student.schedule_mode === 'custom' ? await getStudentScheduleSlotIds(student.id) : [];
    setEditing(student);
    setForm({
      full_name: student.full_name,
      email: student.email ?? '',
      phone: student.phone ?? '',
      school_name: student.school_name ?? '',
      grade: student.grade ?? '',
      parent_name: student.parent_name ?? '',
      parent_email: student.parent_email ?? '',
      parent_phone: student.parent_phone ?? '',
      level: student.level ?? 'beginner',
      notes: student.notes ?? '',
      home_batch_id: student.home_batch_id ?? '',
      expected_weekly_frequency: student.expected_weekly_frequency ?? '2',
      schedule_mode: student.schedule_mode ?? 'inherited',
      class_slot_ids: classSlotIds,
    });
    setModalOpen(true);
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!form.full_name.trim()) {
      setError('Student name is required.');
      return;
    }

    setError('');
    setMessage('');
    try {
      const { home_batch_id, expected_weekly_frequency, schedule_mode, class_slot_ids, ...profileForm } = form;
      let savedStudent: Student;
      if (editing) {
        savedStudent = await updateStudent(editing.id, profileForm);
        setMessage('Student updated.');
      } else {
        savedStudent = await createStudent({ academy_id: academyId, ...profileForm });
        if (home_batch_id) await assignStudentToBatch(home_batch_id, savedStudent.id);
        setMessage('Student added.');
      }
      await updateStudentSchedule({ studentId: savedStudent.id, academyId, homeBatchId: home_batch_id || null, frequency: expected_weekly_frequency, mode: schedule_mode, classSlotIds: class_slot_ids });
      setForm(initialForm);
      setEditing(null);
      setModalOpen(false);
      await loadStudents();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Could not save student.');
    }
  };

  const runStudentAction = async (action: () => Promise<Student>, success: string) => {
    setError('');
    setMessage('');
    try {
      await action();
      setMessage(success);
      await loadStudents();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Student action failed.');
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
            <Plus size={18} /> Add Student
          </button>
        ) : null}
      </div>

      {message ? <div className="rounded-2xl bg-emerald-50 px-4 py-3 text-sm font-black text-emerald-700">{message}</div> : null}
      {error ? <div className="rounded-2xl bg-rose-50 px-4 py-3 text-sm font-black text-rose-700">{error}</div> : null}

      {loading ? (
        <EmptyState title="Loading students" description="Checking Supabase student profiles." />
      ) : students.length === 0 ? (
        <EmptyState title="No students added yet" description="Student profiles for this academy will appear here." />
      ) : (
        <DataTable columns={['Student', 'Contact', 'Parent / Guardian', 'Level', 'Status', 'Linked', 'Actions']}>
          {students.map((student) => (
            <tr className="border-t border-slate-100" key={student.id}>
              <td className="px-5 py-4">
                <div className="font-black text-navy">{student.full_name}</div>
                <div className="mt-1 text-xs font-semibold text-slate-500">{formatDateTime(student.created_at)}</div>
              </td>
              <td className="px-5 py-4 text-slate-600">
                <div>{student.email || 'No login email'}</div>
                <div className="mt-1 text-xs font-semibold">{student.phone || 'No phone'}</div>
              </td>
              <td className="px-5 py-4 text-slate-600">
                <div>{student.parent_name || 'Not added'}</div>
                <div className="mt-1 text-xs font-semibold">{student.parent_phone || student.parent_email || 'No parent contact'}</div>
              </td>
              <td className="px-5 py-4 text-slate-600">{labelize(student.level || 'beginner')}</td>
              <td className="px-5 py-4"><Badge className={statusClass(student.status)}>{labelize(student.status)}</Badge></td>
              <td className="px-5 py-4 text-slate-600">{student.user_id ? 'Profile linked' : 'No profile yet'}</td>
              <td className="px-5 py-4">
                <div className="flex flex-wrap gap-2">
                  <button className="rounded-xl border border-slate-200 p-2 text-slate-600" onClick={() => setViewing(student)} type="button" aria-label="View student" title="View student"><Eye size={16} /></button>
                  {canManage ? (
                    <>
                      <button className="rounded-xl border border-slate-200 p-2 text-slate-600" onClick={() => void openEditModal(student)} type="button" aria-label="Edit student" title="Edit student"><Edit3 size={16} /></button>
                      {student.status === 'disabled' ? (
                        <button className="rounded-xl bg-emerald-600 p-2 text-white" onClick={() => runStudentAction(() => reactivateStudent(student.id), `${student.full_name} reactivated.`)} type="button" aria-label="Reactivate student" title="Reactivate student"><RotateCcw size={16} /></button>
                      ) : (
                        <button className="rounded-xl border border-rose-100 p-2 text-rose-600" onClick={() => runStudentAction(() => disableStudent(student.id), `${student.full_name} disabled.`)} type="button" aria-label="Disable student" title="Disable student"><UserX size={16} /></button>
                      )}
                    </>
                  ) : null}
                </div>
              </td>
            </tr>
          ))}
        </DataTable>
      )}

      <Modal title={editing ? 'Edit Student' : 'Add Student'} description={editing ? 'Update Supabase student profile fields.' : 'Creates a student row and links an existing profile by student email when one exists.'} open={modalOpen} onClose={() => setModalOpen(false)}>
        <form className="grid gap-4" onSubmit={handleSubmit}>
          <FormInput label="Student name" value={form.full_name} onChange={(event) => updateField('full_name', event.target.value)} />
          <FormInput label="Student login email optional" type="email" value={form.email} onChange={(event) => updateField('email', event.target.value)} />
          <FormInput label="Student phone optional" value={form.phone} onChange={(event) => updateField('phone', event.target.value)} />
          <div className="grid gap-4 md:grid-cols-2">
            <FormInput label="School optional" value={form.school_name} onChange={(event) => updateField('school_name', event.target.value)} />
            <FormInput label="Grade optional" value={form.grade} onChange={(event) => updateField('grade', event.target.value)} />
          </div>
          <FormSelect
            label="Level"
            value={form.level}
            onChange={(event) => updateField('level', event.target.value)}
            options={[
              { label: 'Absolute beginner', value: 'absolute_beginner' },
              { label: 'Beginner', value: 'beginner' },
              { label: 'Intermediate', value: 'intermediate' },
              { label: 'Advanced', value: 'advanced' },
              { label: 'Tournament', value: 'tournament' },
            ]}
          />
          <div className="rounded-2xl border border-slate-200 p-4">
            <h3 className="text-sm font-black text-navy">Weekly Class Schedule</h3>
            <p className="mt-1 text-xs leading-5 text-slate-500">The home batch stays administrative. A custom schedule controls which recurring sessions expect this student.</p>
            <div className="mt-4 grid gap-4 md:grid-cols-2">
              <FormSelect label="Home batch" value={form.home_batch_id} onChange={(event) => updateField('home_batch_id', event.target.value)} options={[{ label: 'Not assigned', value: '' }, ...batches.map((batch) => ({ label: batch.name, value: batch.id }))]} />
              <FormSelect label="Expected classes per week" value={form.expected_weekly_frequency} onChange={(event) => updateField('expected_weekly_frequency', event.target.value)} options={[{ label: '1 class per week', value: '1' }, { label: '2 classes per week', value: '2' }, { label: '3 classes per week', value: '3' }, { label: '4 classes per week', value: '4' }, { label: 'Flexible', value: 'flexible' }]} />
              <FormSelect className="md:col-span-2" label="Schedule source" value={form.schedule_mode} onChange={(event) => updateField('schedule_mode', event.target.value)} options={[{ label: 'Inherited from home batch', value: 'inherited' }, { label: 'Individually customised', value: 'custom' }, { label: 'Flexible / added when attending', value: 'flexible' }]} />
            </div>
            {form.schedule_mode === 'custom' ? <div className="mt-4 grid gap-2 sm:grid-cols-2">{classSlots.map((slot) => <label className="flex items-start gap-2 rounded-xl bg-slate-50 p-3 text-sm font-bold" key={slot.id}><input className="mt-1" type="checkbox" checked={form.class_slot_ids.includes(slot.id)} onChange={(event) => setForm((current) => ({ ...current, class_slot_ids: event.target.checked ? [...current.class_slot_ids, slot.id] : current.class_slot_ids.filter((id) => id !== slot.id) }))}/><span>{['Mon','Tue','Wed','Thu','Fri','Sat','Sun'][slot.weekday - 1]} · {slot.start_time.slice(0,5)}–{slot.end_time.slice(0,5)}<span className="block text-xs font-medium text-slate-500">{slot.coach?.full_name} · {slot.location || 'Location not set'}</span></span></label>)}</div> : null}
          </div>
          <div className="rounded-2xl border border-slate-200 p-4">
            <h3 className="text-sm font-black text-navy">Parent / Guardian Details</h3>
            <div className="mt-4 grid gap-4">
              <FormInput label="Parent name optional" value={form.parent_name} onChange={(event) => updateField('parent_name', event.target.value)} />
              <FormInput label="Parent email optional" type="email" value={form.parent_email} onChange={(event) => updateField('parent_email', event.target.value)} />
              <FormInput label="Parent phone optional" value={form.parent_phone} onChange={(event) => updateField('parent_phone', event.target.value)} />
            </div>
          </div>
          <FormInput label="Notes optional" value={form.notes} onChange={(event) => updateField('notes', event.target.value)} />
          <div className="flex justify-end gap-3">
            <button className="rounded-2xl border border-slate-200 px-5 py-3 text-sm font-black text-slate-600" type="button" onClick={() => setModalOpen(false)}>Cancel</button>
            <button className="rounded-2xl bg-directBlue px-5 py-3 text-sm font-black text-white" type="submit">{editing ? 'Save Student' : 'Add Student'}</button>
          </div>
        </form>
      </Modal>

      <Modal title="Student Details" description="Supabase student profile details." open={Boolean(viewing)} onClose={() => setViewing(null)}>
        {viewing ? (
          <div className="grid gap-3 text-sm">
            {[
              ['Student name', viewing.full_name],
              ['Email / login email', viewing.email || 'Not added'],
              ['Phone number', viewing.phone || 'Not added'],
              ['School', viewing.school_name || 'Not added'],
              ['Grade', viewing.grade || 'Not added'],
              ['Level', labelize(viewing.level || 'beginner')],
              ['Home batch', batches.find((batch) => batch.id === viewing.home_batch_id)?.name || 'Not assigned'],
              ['Expected frequency', viewing.expected_weekly_frequency === 'flexible' ? 'Flexible' : `${viewing.expected_weekly_frequency || '2'} classes per week`],
              ['Schedule source', labelize(viewing.schedule_mode || 'inherited')],
              ['Parent / guardian name', viewing.parent_name || 'Not added'],
              ['Parent / guardian phone', viewing.parent_phone || 'Not added'],
              ['Parent / guardian email', viewing.parent_email || 'Not added'],
              ['Status', labelize(viewing.status)],
              ['Joined', formatDateTime(viewing.joined_at)],
              ['Created', formatDateTime(viewing.created_at)],
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
        ) : <EmptyState title="Profile not found" description="The selected student profile could not be loaded." />}
      </Modal>
    </section>
  );
}
