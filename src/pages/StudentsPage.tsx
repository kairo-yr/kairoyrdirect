import { useMemo, useState, type FormEvent } from 'react';
import { Edit3, Eye, Plus, Trash2 } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Badge } from '../components/ui/Badge';
import { DataTable } from '../components/ui/DataTable';
import { EmptyState } from '../components/ui/EmptyState';
import { FilterSelect } from '../components/ui/FilterSelect';
import { FormInput } from '../components/ui/FormInput';
import { FormSelect } from '../components/ui/FormSelect';
import { Modal } from '../components/ui/Modal';
import { PageHeader } from '../components/ui/PageHeader';
import { RoadmapBadge } from '../components/ui/RoadmapBadge';
import { SearchInput } from '../components/ui/SearchInput';
import { feeStatusLabels, formatCurrency, levelLabels, statusLabels } from '../data/mockData';
import { useAppData } from '../hooks/useAppData';
import type { EntityStatus, FeeStatus, Student, StudentLevel } from '../types';
import { feeStyles, levelStyles, statusStyles } from '../utils/badgeStyles';

type StudentForm = {
  name: string;
  age: string;
  parentName: string;
  parentEmail: string;
  parentPhone: string;
  level: StudentLevel;
  batchId: string;
  monthlyFee: string;
  feeStatus: FeeStatus;
  progress: string;
  status: EntityStatus;
};

const initialForm: StudentForm = {
  name: '',
  age: '10',
  parentName: '',
  parentEmail: '',
  parentPhone: '',
  level: 'basic',
  batchId: '',
  monthlyFee: '2000',
  feeStatus: 'pending',
  progress: '0',
  status: 'active',
};

function toForm(student: Student): StudentForm {
  return {
    name: student.name,
    age: String(student.age),
    parentName: student.parentName,
    parentEmail: student.parentEmail,
    parentPhone: student.parentPhone,
    level: student.level,
    batchId: student.batchId,
    monthlyFee: String(student.monthlyFee),
    feeStatus: student.feeStatus,
    progress: String(student.progress),
    status: student.status,
  };
}

export function StudentsPage() {
  const {
    academy,
    students,
    batches,
    addStudent,
    updateStudent,
    deleteStudent,
    getBatchName,
    getStudentAttendancePercentage,
    getStudentCurrentFeeStatus,
    getLatestFeeRecordForStudent,
  } = useAppData();
  const [query, setQuery] = useState('');
  const [levelFilter, setLevelFilter] = useState('all');
  const [feeFilter, setFeeFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Student | null>(null);
  const [form, setForm] = useState<StudentForm>(initialForm);

  const filteredStudents = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    return students.filter((student) => {
      const matchesSearch = [student.name, student.parentName, student.parentPhone].some((value) => value.toLowerCase().includes(normalizedQuery));
      const matchesLevel = levelFilter === 'all' || student.level === levelFilter;
      const matchesFee = feeFilter === 'all' || getStudentCurrentFeeStatus(student.id) === feeFilter;
      const matchesStatus = statusFilter === 'all' || student.status === statusFilter;
      return matchesSearch && matchesLevel && matchesFee && matchesStatus;
    });
  }, [feeFilter, getStudentCurrentFeeStatus, levelFilter, query, statusFilter, students]);

  const openAddModal = () => {
    setEditing(null);
    setForm(initialForm);
    setModalOpen(true);
  };

  const openEditModal = (student: Student) => {
    setEditing(student);
    setForm(toForm(student));
    setModalOpen(true);
  };

  const updateField = (field: keyof StudentForm, value: string) => {
    setForm((current) => ({ ...current, [field]: value }));
  };

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const age = Number(form.age);
    const progress = Number(form.progress);
    const monthlyFee = Number(form.monthlyFee);
    if (!form.name.trim() || !form.level) {
      alert('Student name and level are required.');
      return;
    }
    if (!Number.isFinite(age) || age < 4 || age > 25) {
      alert('Student age should be between 4 and 25.');
      return;
    }
    if (!Number.isFinite(monthlyFee) || monthlyFee < 0) {
      alert('Monthly fee should be 0 or more.');
      return;
    }

    const payload = {
      academyId: academy.id,
      name: form.name.trim(),
      age,
      parentName: form.parentName.trim(),
      parentEmail: form.parentEmail.trim(),
      parentPhone: form.parentPhone.trim(),
      level: form.level,
      batchId: form.batchId,
      monthlyFee,
      feeStatus: form.feeStatus,
      progress: Math.min(100, Math.max(0, progress || 0)),
      status: form.status,
    };

    if (editing) {
      updateStudent(editing.id, payload);
    } else {
      addStudent(payload);
    }
    setModalOpen(false);
  };

  const handleDelete = (student: Student) => {
    if (window.confirm(`Delete ${student.name}? This removes the local mock record.`)) {
      deleteStudent(student.id);
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Students"
        description="Manage student profiles, parent details, level placement, batch assignment, fee state, and progress."
        action={<div className="flex flex-wrap gap-2"><RoadmapBadge status="Phase 6" /><button className="inline-flex items-center gap-2 rounded-2xl bg-directBlue px-4 py-3 text-sm font-black text-white" onClick={openAddModal}><Plus size={18} /> Add Student</button></div>}
      />

      <div className="grid gap-3 rounded-3xl border border-slate-200 bg-white p-4 shadow-card lg:grid-cols-[1fr_auto_auto_auto]">
        <SearchInput value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search student, parent, or phone" />
        <FilterSelect value={levelFilter} onChange={(event) => setLevelFilter(event.target.value)} options={[{ label: 'All levels', value: 'all' }, ...Object.entries(levelLabels).map(([value, label]) => ({ value, label }))]} />
        <FilterSelect value={feeFilter} onChange={(event) => setFeeFilter(event.target.value)} options={[{ label: 'All fees', value: 'all' }, ...Object.entries(feeStatusLabels).map(([value, label]) => ({ value, label }))]} />
        <FilterSelect value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)} options={[{ label: 'All status', value: 'all' }, ...Object.entries(statusLabels).map(([value, label]) => ({ value, label }))]} />
      </div>

      {filteredStudents.length === 0 ? (
        <EmptyState title="No students found" description="Start by adding your first student and assigning them to the right batch." />
      ) : (
        <DataTable columns={['Name', 'Parent', 'Level', 'Batch', 'Monthly Fee', 'Fee Status', 'Latest Fee', 'Attendance', 'Progress', 'Status', 'Actions']}>
          {filteredStudents.map((student) => {
            const currentFeeStatus = getStudentCurrentFeeStatus(student.id) ?? student.feeStatus;
            const latestFee = getLatestFeeRecordForStudent(student.id);
            return (
            <tr className="border-t border-slate-100" key={student.id}>
              <td className="px-5 py-4">
                <Link className="font-black text-navy hover:text-directBlue" to={`/students/${student.id}`}>{student.name}</Link>
                <div className="text-xs font-bold text-slate-500">{student.age} years</div>
              </td>
              <td className="px-5 py-4 text-slate-600">{student.parentName || 'Not added'}</td>
              <td className="px-5 py-4"><Badge className={levelStyles[student.level]}>{levelLabels[student.level]}</Badge></td>
              <td className="px-5 py-4 text-slate-600">{getBatchName(student.batchId)}</td>
              <td className="px-5 py-4 font-black text-navy">{formatCurrency(student.monthlyFee)}</td>
              <td className="px-5 py-4"><Badge className={feeStyles[currentFeeStatus]}>{feeStatusLabels[currentFeeStatus]}</Badge></td>
              <td className="px-5 py-4 text-slate-600">{latestFee ? `${latestFee.month}/${latestFee.year}` : 'No fee record'}</td>
              <td className="px-5 py-4 font-black text-navy">
                {getStudentAttendancePercentage(student.id) === null ? 'No data' : `${getStudentAttendancePercentage(student.id)}%`}
              </td>
              <td className="px-5 py-4">
                <div className="h-2 w-28 overflow-hidden rounded-full bg-slate-100">
                  <div className="h-full rounded-full bg-directBlue" style={{ width: `${student.progress}%` }} />
                </div>
                <span className="mt-1 block text-xs font-bold text-slate-500">{student.progress}%</span>
              </td>
              <td className="px-5 py-4"><Badge className={statusStyles[student.status]}>{statusLabels[student.status]}</Badge></td>
              <td className="px-5 py-4">
                <div className="flex gap-2">
                  <Link className="rounded-xl border border-slate-200 p-2 text-slate-600 hover:bg-slate-50" to={`/students/${student.id}`} aria-label={`View ${student.name} profile`}>
                    <Eye size={16} />
                  </Link>
                  <button className="rounded-xl border border-slate-200 p-2 text-slate-600 hover:bg-slate-50" onClick={() => openEditModal(student)} aria-label={`Edit ${student.name}`}>
                    <Edit3 size={16} />
                  </button>
                  <button className="rounded-xl border border-rose-100 p-2 text-rose-600 hover:bg-rose-50" onClick={() => handleDelete(student)} aria-label={`Delete ${student.name}`}>
                    <Trash2 size={16} />
                  </button>
                </div>
              </td>
            </tr>
            );
          })}
        </DataTable>
      )}

      <Modal title={editing ? 'Edit Student' : 'Add Student'} description={`Records are stored locally for ${academy.name}.`} open={modalOpen} onClose={() => setModalOpen(false)}>
        <form className="grid gap-4" onSubmit={handleSubmit}>
          <div className="grid gap-4 md:grid-cols-2">
            <FormInput label="Student name" value={form.name} onChange={(event) => updateField('name', event.target.value)} />
            <FormInput label="Age" type="number" min="4" max="25" value={form.age} onChange={(event) => updateField('age', event.target.value)} />
            <FormInput label="Parent name" value={form.parentName} onChange={(event) => updateField('parentName', event.target.value)} />
            <FormInput label="Parent email" type="email" value={form.parentEmail} onChange={(event) => updateField('parentEmail', event.target.value)} />
            <FormInput label="Parent phone" value={form.parentPhone} onChange={(event) => updateField('parentPhone', event.target.value)} />
            <FormSelect label="Level" value={form.level} onChange={(event) => updateField('level', event.target.value)} options={Object.entries(levelLabels).map(([value, label]) => ({ value, label }))} />
            <FormSelect label="Batch" value={form.batchId} onChange={(event) => updateField('batchId', event.target.value)} options={[{ label: 'Unassigned', value: '' }, ...batches.map((batch) => ({ label: batch.name, value: batch.id }))]} />
            <FormInput label="Monthly fee" type="number" min="0" value={form.monthlyFee} onChange={(event) => updateField('monthlyFee', event.target.value)} />
            <FormSelect label="Fee status" value={form.feeStatus} onChange={(event) => updateField('feeStatus', event.target.value)} options={Object.entries(feeStatusLabels).map(([value, label]) => ({ value, label }))} />
            <FormInput label="Progress" type="number" min="0" max="100" value={form.progress} onChange={(event) => updateField('progress', event.target.value)} />
            <FormSelect label="Status" value={form.status} onChange={(event) => updateField('status', event.target.value)} options={Object.entries(statusLabels).map(([value, label]) => ({ value, label }))} />
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <button className="rounded-2xl border border-slate-200 px-5 py-3 text-sm font-black text-slate-600" type="button" onClick={() => setModalOpen(false)}>Cancel</button>
            <button className="rounded-2xl bg-directBlue px-5 py-3 text-sm font-black text-white" type="submit">{editing ? 'Save Student' : 'Add Student'}</button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
