import { useMemo, useState, type FormEvent } from 'react';
import { ClipboardList, Edit3, Plus, Trash2, UsersRound } from 'lucide-react';
import { Badge } from '../components/ui/Badge';
import { EmptyState } from '../components/ui/EmptyState';
import { FilterSelect } from '../components/ui/FilterSelect';
import { FormInput } from '../components/ui/FormInput';
import { FormSelect } from '../components/ui/FormSelect';
import { Modal } from '../components/ui/Modal';
import { PageHeader } from '../components/ui/PageHeader';
import { RoadmapBadge } from '../components/ui/RoadmapBadge';
import { SearchInput } from '../components/ui/SearchInput';
import { coachRoleLabels, statusLabels } from '../data/mockData';
import { useAppData } from '../hooks/useAppData';
import type { Coach, CoachRole, EntityStatus } from '../types';
import { roleStyles, statusStyles } from '../utils/badgeStyles';

type CoachForm = {
  name: string;
  email: string;
  phone: string;
  role: CoachRole;
  status: EntityStatus;
};

const initialForm: CoachForm = {
  name: '',
  email: '',
  phone: '',
  role: 'coach',
  status: 'active',
};

function toForm(coach: Coach): CoachForm {
  return {
    name: coach.name,
    email: coach.email,
    phone: coach.phone,
    role: coach.role,
    status: coach.status,
  };
}

export function CoachesPage() {
  const { academy, coaches, addCoach, updateCoach, deleteCoach, getBatchesByCoach, getStudentCountForCoach } = useAppData();
  const [query, setQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Coach | null>(null);
  const [form, setForm] = useState<CoachForm>(initialForm);

  const filteredCoaches = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    return coaches.filter((coach) => {
      const matchesSearch = [coach.name, coach.email, coach.phone].some((value) => value.toLowerCase().includes(normalizedQuery));
      const matchesRole = roleFilter === 'all' || coach.role === roleFilter;
      const matchesStatus = statusFilter === 'all' || coach.status === statusFilter;
      return matchesSearch && matchesRole && matchesStatus;
    });
  }, [coaches, query, roleFilter, statusFilter]);

  const openAddModal = () => {
    setEditing(null);
    setForm(initialForm);
    setModalOpen(true);
  };

  const openEditModal = (coach: Coach) => {
    setEditing(coach);
    setForm(toForm(coach));
    setModalOpen(true);
  };

  const updateField = (field: keyof CoachForm, value: string) => {
    setForm((current) => ({ ...current, [field]: value }));
  };

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!form.name.trim()) {
      alert('Coach name is required.');
      return;
    }

    const payload = {
      academyId: academy.id,
      name: form.name.trim(),
      email: form.email.trim(),
      phone: form.phone.trim(),
      role: form.role,
      status: form.status,
    };

    if (editing) {
      updateCoach(editing.id, payload);
    } else {
      addCoach(payload);
    }
    setModalOpen(false);
  };

  const handleDelete = (coach: Coach) => {
    if (window.confirm(`Delete ${coach.name}? Assigned batches will become unassigned.`)) {
      deleteCoach(coach.id);
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Coaches"
        description="Manage coaches and view their assigned batches and total student load from batch relationships."
        action={<div className="flex flex-wrap gap-2"><RoadmapBadge status="Mock Data" /><button className="inline-flex items-center gap-2 rounded-2xl bg-directBlue px-4 py-3 text-sm font-black text-white" onClick={openAddModal}><Plus size={18} /> Add Coach</button></div>}
      />

      <div className="grid gap-3 rounded-3xl border border-slate-200 bg-white p-4 shadow-card lg:grid-cols-[1fr_auto_auto]">
        <SearchInput value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search coach by name, email, or phone" />
        <FilterSelect value={roleFilter} onChange={(event) => setRoleFilter(event.target.value)} options={[{ label: 'All roles', value: 'all' }, ...Object.entries(coachRoleLabels).map(([value, label]) => ({ value, label }))]} />
        <FilterSelect value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)} options={[{ label: 'All status', value: 'all' }, ...Object.entries(statusLabels).map(([value, label]) => ({ value, label }))]} />
      </div>

      {filteredCoaches.length === 0 ? (
        <EmptyState title="No coaches found" description="Add your first coach, then assign batches from the Batches page." />
      ) : (
        <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
          {filteredCoaches.map((coach) => {
            const assignedBatches = getBatchesByCoach(coach.id);
            return (
              <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-card" key={coach.id}>
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h2 className="text-xl font-black text-navy">{coach.name}</h2>
                    <p className="mt-1 text-sm font-semibold text-slate-500">{coach.email || 'No email added'}</p>
                  </div>
                  <Badge className={statusStyles[coach.status]}>{statusLabels[coach.status]}</Badge>
                </div>
                <div className="mt-4 flex flex-wrap gap-2">
                  <Badge className={roleStyles[coach.role]}>{coachRoleLabels[coach.role]}</Badge>
                  {assignedBatches.length === 0 ? <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-600">No batches</span> : assignedBatches.map((batch) => (
                    <span className="rounded-full bg-blue-50 px-3 py-1 text-xs font-bold text-directBlue" key={batch.id}>{batch.name}</span>
                  ))}
                </div>
                <div className="mt-6 grid gap-3 text-sm font-bold text-slate-700">
                  <div className="flex items-center gap-2"><UsersRound size={17} /> {getStudentCountForCoach(coach.id)} students</div>
                  <div className="flex items-center gap-2"><ClipboardList size={17} /> {assignedBatches.length} assigned batches</div>
                </div>
                <div className="mt-6 flex gap-2">
                  <button className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 px-4 py-2 text-sm font-black text-slate-600" onClick={() => openEditModal(coach)}><Edit3 size={16} /> Edit</button>
                  <button className="inline-flex items-center gap-2 rounded-2xl border border-rose-100 px-4 py-2 text-sm font-black text-rose-600" onClick={() => handleDelete(coach)}><Trash2 size={16} /> Delete</button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <Modal title={editing ? 'Edit Coach' : 'Add Coach'} description="Batch assignment is managed from the Batches page to keep relationships clean." open={modalOpen} onClose={() => setModalOpen(false)}>
        <form className="grid gap-4" onSubmit={handleSubmit}>
          <div className="grid gap-4 md:grid-cols-2">
            <FormInput label="Coach name" value={form.name} onChange={(event) => updateField('name', event.target.value)} />
            <FormInput label="Email" type="email" value={form.email} onChange={(event) => updateField('email', event.target.value)} />
            <FormInput label="Phone" value={form.phone} onChange={(event) => updateField('phone', event.target.value)} />
            <FormSelect label="Role" value={form.role} onChange={(event) => updateField('role', event.target.value)} options={Object.entries(coachRoleLabels).map(([value, label]) => ({ value, label }))} />
            <FormSelect label="Status" value={form.status} onChange={(event) => updateField('status', event.target.value)} options={Object.entries(statusLabels).map(([value, label]) => ({ value, label }))} />
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <button className="rounded-2xl border border-slate-200 px-5 py-3 text-sm font-black text-slate-600" type="button" onClick={() => setModalOpen(false)}>Cancel</button>
            <button className="rounded-2xl bg-directBlue px-5 py-3 text-sm font-black text-white" type="submit">{editing ? 'Save Coach' : 'Add Coach'}</button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
