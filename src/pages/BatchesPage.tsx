import { useMemo, useState, type FormEvent } from 'react';
import { CalendarDays, Edit3, Plus, Trash2, UsersRound } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Badge } from '../components/ui/Badge';
import { EmptyState } from '../components/ui/EmptyState';
import { FilterSelect } from '../components/ui/FilterSelect';
import { FormInput } from '../components/ui/FormInput';
import { FormSelect } from '../components/ui/FormSelect';
import { Modal } from '../components/ui/Modal';
import { PageHeader } from '../components/ui/PageHeader';
import { RoadmapBadge } from '../components/ui/RoadmapBadge';
import { SearchInput } from '../components/ui/SearchInput';
import { formatCurrency, levelLabels, modeLabels, statusLabels } from '../data/mockData';
import { useAppData } from '../hooks/useAppData';
import type { Batch, BatchMode, EntityStatus, StudentLevel } from '../types';
import { levelStyles, modeStyles, statusStyles } from '../utils/badgeStyles';

type BatchForm = {
  name: string;
  level: StudentLevel;
  coachId: string;
  scheduleDays: string;
  startTime: string;
  endTime: string;
  mode: BatchMode;
  status: EntityStatus;
};

const initialForm: BatchForm = {
  name: '',
  level: 'basic',
  coachId: '',
  scheduleDays: 'Monday, Wednesday',
  startTime: '17:00',
  endTime: '18:00',
  mode: 'offline',
  status: 'active',
};

function toForm(batch: Batch): BatchForm {
  return {
    name: batch.name,
    level: batch.level,
    coachId: batch.coachId,
    scheduleDays: batch.scheduleDays.join(', '),
    startTime: batch.startTime,
    endTime: batch.endTime,
    mode: batch.mode,
    status: batch.status,
  };
}

export function BatchesPage() {
  const {
    academy,
    batches,
    coaches,
    getCoachName,
    getStudentCountForBatch,
    getStudentsByBatch,
    getLatestFeeRecordForStudent,
    addBatch,
    updateBatch,
    deleteBatch,
  } = useAppData();
  const [query, setQuery] = useState('');
  const [levelFilter, setLevelFilter] = useState('all');
  const [modeFilter, setModeFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Batch | null>(null);
  const [form, setForm] = useState<BatchForm>(initialForm);

  const filteredBatches = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    return batches.filter((batch) => {
      const matchesSearch = batch.name.toLowerCase().includes(normalizedQuery) || getCoachName(batch.coachId).toLowerCase().includes(normalizedQuery);
      const matchesLevel = levelFilter === 'all' || batch.level === levelFilter;
      const matchesMode = modeFilter === 'all' || batch.mode === modeFilter;
      const matchesStatus = statusFilter === 'all' || batch.status === statusFilter;
      return matchesSearch && matchesLevel && matchesMode && matchesStatus;
    });
  }, [batches, getCoachName, levelFilter, modeFilter, query, statusFilter]);

  const openAddModal = () => {
    setEditing(null);
    setForm(initialForm);
    setModalOpen(true);
  };

  const openEditModal = (batch: Batch) => {
    setEditing(batch);
    setForm(toForm(batch));
    setModalOpen(true);
  };

  const updateField = (field: keyof BatchForm, value: string) => {
    setForm((current) => ({ ...current, [field]: value }));
  };

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!form.name.trim() || !form.level) {
      alert('Batch name and level are required.');
      return;
    }

    const payload = {
      academyId: academy.id,
      name: form.name.trim(),
      level: form.level,
      coachId: form.coachId,
      scheduleDays: form.scheduleDays.split(',').map((day) => day.trim()).filter(Boolean),
      startTime: form.startTime,
      endTime: form.endTime,
      mode: form.mode,
      status: form.status,
    };

    if (editing) {
      updateBatch(editing.id, payload);
    } else {
      addBatch(payload);
    }
    setModalOpen(false);
  };

  const handleDelete = (batch: Batch) => {
    if (window.confirm(`Delete ${batch.name}? Students in this batch will become unassigned.`)) {
      deleteBatch(batch.id);
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Batches"
        description="Create batches, assign coaches, manage schedule details, and view enrolled students."
        action={<div className="flex flex-wrap gap-2"><RoadmapBadge status="Mock Data" /><button className="inline-flex items-center gap-2 rounded-2xl bg-directBlue px-4 py-3 text-sm font-black text-white" onClick={openAddModal}><Plus size={18} /> Create Batch</button></div>}
      />

      <div className="grid gap-3 rounded-3xl border border-slate-200 bg-white p-4 shadow-card lg:grid-cols-[1fr_auto_auto_auto]">
        <SearchInput value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search batch or coach" />
        <FilterSelect value={levelFilter} onChange={(event) => setLevelFilter(event.target.value)} options={[{ label: 'All levels', value: 'all' }, ...Object.entries(levelLabels).map(([value, label]) => ({ value, label }))]} />
        <FilterSelect value={modeFilter} onChange={(event) => setModeFilter(event.target.value)} options={[{ label: 'All modes', value: 'all' }, ...Object.entries(modeLabels).map(([value, label]) => ({ value, label }))]} />
        <FilterSelect value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)} options={[{ label: 'All status', value: 'all' }, ...Object.entries(statusLabels).map(([value, label]) => ({ value, label }))]} />
      </div>

      {filteredBatches.length === 0 ? (
        <EmptyState title="No batches found" description="Create your first batch, assign a coach, then place students into it from the Students page." />
      ) : (
        <div className="grid gap-5 lg:grid-cols-2">
          {filteredBatches.map((batch) => {
            const batchStudents = getStudentsByBatch(batch.id);
            const feeRecords = batchStudents.map((student) => getLatestFeeRecordForStudent(student.id)).filter(Boolean);
            const pendingFeeRecords = feeRecords.filter((record) => record?.status === 'pending' || record?.status === 'overdue');
            const overdueFeeRecords = feeRecords.filter((record) => record?.status === 'overdue');
            const pendingAmount = pendingFeeRecords.reduce((total, record) => total + (record?.amount ?? 0), 0);
            return (
              <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-card" key={batch.id}>
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <h2 className="text-xl font-black text-navy">{batch.name}</h2>
                    <p className="mt-1 text-sm text-slate-500">Coach: {getCoachName(batch.coachId)}</p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Badge className={levelStyles[batch.level]}>{levelLabels[batch.level]}</Badge>
                    <Badge className={statusStyles[batch.status]}>{statusLabels[batch.status]}</Badge>
                  </div>
                </div>
                <div className="mt-6 grid gap-3 text-sm font-bold text-slate-700 sm:grid-cols-3">
                  <div className="flex items-center gap-2"><UsersRound size={17} /> {getStudentCountForBatch(batch.id)} students</div>
                  <div className="flex items-center gap-2"><CalendarDays size={17} /> {batch.scheduleDays.join(', ')}</div>
                  <Badge className={modeStyles[batch.mode]}>{modeLabels[batch.mode]}</Badge>
                </div>
                <div className="mt-4 grid gap-3 text-sm font-bold text-slate-700 sm:grid-cols-3">
                  <div className="rounded-2xl bg-slate-50 p-3">Pending fees: <span className="text-navy">{pendingFeeRecords.length}</span></div>
                  <div className="rounded-2xl bg-slate-50 p-3">Pending amount: <span className="text-navy">{formatCurrency(pendingAmount)}</span></div>
                  <Badge className={overdueFeeRecords.length === 0 && pendingFeeRecords.length === 0 ? statusStyles.active : statusStyles.pending}>
                    {overdueFeeRecords.length === 0 && pendingFeeRecords.length === 0 ? 'Good fee health' : 'Fee attention'}
                  </Badge>
                </div>
                <div className="mt-5 rounded-2xl bg-slate-50 p-4">
                  <div className="text-xs font-black uppercase tracking-wide text-slate-400">Students</div>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {batchStudents.length === 0 ? (
                      <span className="text-sm font-semibold text-slate-500">No students assigned yet.</span>
                    ) : batchStudents.map((student) => (
                      <Link className="rounded-full bg-white px-3 py-1 text-xs font-bold text-slate-700 ring-1 ring-slate-200 hover:text-directBlue" key={student.id} to={`/students/${student.id}`}>{student.name}</Link>
                    ))}
                  </div>
                </div>
                <div className="mt-6 flex gap-2">
                  <button className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 px-4 py-2 text-sm font-black text-slate-600" onClick={() => openEditModal(batch)}><Edit3 size={16} /> Edit</button>
                  <button className="inline-flex items-center gap-2 rounded-2xl border border-rose-100 px-4 py-2 text-sm font-black text-rose-600" onClick={() => handleDelete(batch)}><Trash2 size={16} /> Delete</button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <Modal title={editing ? 'Edit Batch' : 'Create Batch'} description="Students are assigned from the Students page; this keeps batch membership tied to student records." open={modalOpen} onClose={() => setModalOpen(false)}>
        <form className="grid gap-4" onSubmit={handleSubmit}>
          <div className="grid gap-4 md:grid-cols-2">
            <FormInput label="Batch name" value={form.name} onChange={(event) => updateField('name', event.target.value)} />
            <FormSelect label="Level" value={form.level} onChange={(event) => updateField('level', event.target.value)} options={Object.entries(levelLabels).map(([value, label]) => ({ value, label }))} />
            <FormSelect label="Coach" value={form.coachId} onChange={(event) => updateField('coachId', event.target.value)} options={[{ label: 'Unassigned', value: '' }, ...coaches.map((coach) => ({ label: coach.name, value: coach.id }))]} />
            <FormInput label="Schedule days" value={form.scheduleDays} onChange={(event) => updateField('scheduleDays', event.target.value)} />
            <FormInput label="Start time" type="time" value={form.startTime} onChange={(event) => updateField('startTime', event.target.value)} />
            <FormInput label="End time" type="time" value={form.endTime} onChange={(event) => updateField('endTime', event.target.value)} />
            <FormSelect label="Mode" value={form.mode} onChange={(event) => updateField('mode', event.target.value)} options={Object.entries(modeLabels).map(([value, label]) => ({ value, label }))} />
            <FormSelect label="Status" value={form.status} onChange={(event) => updateField('status', event.target.value)} options={Object.entries(statusLabels).map(([value, label]) => ({ value, label }))} />
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <button className="rounded-2xl border border-slate-200 px-5 py-3 text-sm font-black text-slate-600" type="button" onClick={() => setModalOpen(false)}>Cancel</button>
            <button className="rounded-2xl bg-directBlue px-5 py-3 text-sm font-black text-white" type="submit">{editing ? 'Save Batch' : 'Create Batch'}</button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
