import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { collection, doc, getDocs, query, serverTimestamp, setDoc, updateDoc, where } from 'firebase/firestore';
import { Archive, BookOpen, CalendarClock, Edit3, Eye, Link as LinkIcon, Plus, Users } from 'lucide-react';
import { Badge } from '../components/ui/Badge';
import { DataTable } from '../components/ui/DataTable';
import { EmptyState } from '../components/ui/EmptyState';
import { FilterSelect } from '../components/ui/FilterSelect';
import { FormInput } from '../components/ui/FormInput';
import { FormSelect } from '../components/ui/FormSelect';
import { Modal } from '../components/ui/Modal';
import { PageHeader } from '../components/ui/PageHeader';
import { SearchInput } from '../components/ui/SearchInput';
import { StatCard } from '../components/ui/StatCard';
import { PLAY_APP_NAME } from '../config/brand';
import { useAuth } from '../contexts/AuthContext';
import { useCurrentCoach } from '../hooks/useCurrentCoach';
import { db } from '../lib/firebase';
import { formatFirestoreDate } from '../utils/firestoreFormat';
import { createAuditLog } from '../utils/superAdminActions';

type HomeworkMode = 'academy' | 'coach' | 'student';
type AssignType = 'batch' | 'student';
type PracticeType = 'general' | 'opening' | 'tactics' | 'endgame' | 'game_review' | 'kairoyr_play';
type HomeworkStatus = 'active' | 'completed' | 'archived';

type BatchRecord = {
  id: string;
  name?: string;
  coachId?: string | null;
  studentIds?: string[];
  status?: string;
};

type StudentRecord = {
  id: string;
  name?: string;
  status?: string;
};

type HomeworkRecord = {
  id: string;
  academyId: string;
  title: string;
  description: string;
  assignType: AssignType;
  batchId: string | null;
  batchName: string | null;
  studentIds: string[];
  studentNames: string[];
  dueDate: string | null;
  status: HomeworkStatus;
  practiceType: PracticeType;
  kairoyrPlayLink: string | null;
  createdByUid: string;
  createdByName: string;
  createdByRole: 'academy_admin' | 'coach';
  createdAt: unknown;
  updatedAt: unknown;
};

type HomeworkForm = {
  title: string;
  description: string;
  assignType: AssignType;
  batchId: string;
  studentIds: string[];
  dueDate: string;
  practiceType: PracticeType;
  kairoyrPlayLink: string;
};

const initialForm: HomeworkForm = {
  title: '',
  description: '',
  assignType: 'batch',
  batchId: '',
  studentIds: [],
  dueDate: '',
  practiceType: 'general',
  kairoyrPlayLink: '',
};

const practiceOptions: Array<{ value: PracticeType | 'all'; label: string }> = [
  { value: 'all', label: 'All practice types' },
  { value: 'general', label: 'General' },
  { value: 'opening', label: 'Opening' },
  { value: 'tactics', label: 'Tactics' },
  { value: 'endgame', label: 'Endgame' },
  { value: 'game_review', label: 'Game Review' },
  { value: 'kairoyr_play', label: PLAY_APP_NAME },
];

function practiceLabel(type: PracticeType) {
  return practiceOptions.find((option) => option.value === type)?.label ?? 'General';
}

function statusClass(status: HomeworkStatus) {
  if (status === 'active') return 'bg-emerald-50 text-emerald-700';
  if (status === 'completed') return 'bg-blue-50 text-directBlue';
  return 'bg-slate-100 text-slate-600';
}

function dueThisWeek(homework: HomeworkRecord) {
  if (!homework.dueDate || homework.status !== 'active') return false;
  const dueDate = new Date(`${homework.dueDate}T00:00:00`);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const weekEnd = new Date(today);
  weekEnd.setDate(today.getDate() + 7);
  return dueDate >= today && dueDate <= weekEnd;
}

function studentNamesForIds(ids: string[], students: StudentRecord[]) {
  const names = ids
    .map((id) => students.find((student) => student.id === id)?.name)
    .filter(Boolean) as string[];
  return names;
}

function HomeworkDetail({ homework }: { homework: HomeworkRecord }) {
  return (
    <div className="grid gap-4">
      <Detail label="Title" value={homework.title} />
      <Detail label="Description" value={homework.description} />
      <div className="grid gap-4 sm:grid-cols-2">
        <Detail label="Practice type" value={practiceLabel(homework.practiceType)} />
        <Detail label="Due date" value={homework.dueDate ?? 'No due date'} />
        <Detail label="Assigned to" value={homework.assignType === 'batch' ? homework.batchName ?? 'Batch' : `${homework.studentNames.length} student(s)`} />
        <Detail label="Created by" value={homework.createdByName || homework.createdByRole} />
        <Detail label="Created at" value={formatFirestoreDate(homework.createdAt)} />
        <Detail label="Status" value={homework.status} />
      </div>
      {homework.assignType === 'student' ? <Detail label="Students" value={homework.studentNames.join(', ') || 'No students'} /> : null}
      {homework.kairoyrPlayLink ? (
        <a className="inline-flex items-center gap-2 rounded-2xl bg-directBlue px-4 py-3 text-sm font-black text-white" href={homework.kairoyrPlayLink} rel="noreferrer" target="_blank">
          <LinkIcon size={18} /> Open {PLAY_APP_NAME}
        </a>
      ) : null}
    </div>
  );
}

function Detail({ label, value }: { label: string; value?: string }) {
  return (
    <div className="rounded-2xl bg-slate-50 p-4">
      <div className="text-xs font-black uppercase tracking-wide text-slate-500">{label}</div>
      <div className="mt-1 whitespace-pre-wrap text-sm font-bold leading-6 text-navy">{value || 'Not added'}</div>
    </div>
  );
}

export function HomeworkPage({ mode }: { mode: HomeworkMode }) {
  const { userProfile } = useAuth();
  const isCoachMode = mode === 'coach';
  const { coach: currentCoach, error: coachResolutionError, loading: coachResolutionLoading } = useCurrentCoach(isCoachMode);
  const academyId = isCoachMode ? currentCoach?.academy_id ?? userProfile?.academyId : userProfile?.academyId;
  const coachId = currentCoach?.id ?? null;
  const linkedStudentId = userProfile?.linkedStudentId;
  const canCreate = mode !== 'student';
  const [batches, setBatches] = useState<BatchRecord[]>([]);
  const [students, setStudents] = useState<StudentRecord[]>([]);
  const [homework, setHomework] = useState<HomeworkRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<HomeworkForm>(initialForm);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<HomeworkRecord | null>(null);
  const [viewing, setViewing] = useState<HomeworkRecord | null>(null);
  const [statusFilter, setStatusFilter] = useState<'active' | 'archived' | 'all'>('active');
  const [practiceFilter, setPracticeFilter] = useState<PracticeType | 'all'>('all');
  const [batchFilter, setBatchFilter] = useState('all');
  const [search, setSearch] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const activeBatches = useMemo(() => batches.filter((batch) => batch.status === 'active'), [batches]);
  const activeStudents = useMemo(() => students.filter((student) => student.status !== 'disabled'), [students]);
  const visibleStudentIds = useMemo(() => new Set(activeStudents.map((student) => student.id)), [activeStudents]);

  const loadPage = async () => {
    if (!academyId || (mode === 'coach' && !coachId) || (mode === 'student' && !linkedStudentId)) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError('');
    try {
      if (mode === 'student' && linkedStudentId) {
        const [batchSnapshot, directHomeworkSnapshot] = await Promise.all([
          getDocs(query(collection(db, 'academies', academyId, 'batches'), where('studentIds', 'array-contains', linkedStudentId))),
          getDocs(query(collection(db, 'academies', academyId, 'homework'), where('studentIds', 'array-contains', linkedStudentId))),
        ]);
        const assignedBatches = batchSnapshot.docs.map((docSnap) => ({ id: docSnap.id, ...docSnap.data() }) as BatchRecord);
        const homeworkMap = new Map<string, HomeworkRecord>();
        directHomeworkSnapshot.docs.forEach((docSnap) => homeworkMap.set(docSnap.id, { id: docSnap.id, ...docSnap.data() } as HomeworkRecord));
        for (const batch of assignedBatches.slice(0, 10)) {
          const batchHomeworkSnapshot = await getDocs(query(collection(db, 'academies', academyId, 'homework'), where('batchId', '==', batch.id)));
          batchHomeworkSnapshot.docs.forEach((docSnap) => homeworkMap.set(docSnap.id, { id: docSnap.id, ...docSnap.data() } as HomeworkRecord));
        }
        setBatches(assignedBatches);
        setStudents([]);
        setHomework(
          Array.from(homeworkMap.values())
            .filter((item) => item.status !== 'archived')
            .sort((a, b) => String(a.dueDate ?? '9999-12-31').localeCompare(String(b.dueDate ?? '9999-12-31'))),
        );
        return;
      }

      const [batchSnapshot, studentSnapshot] = await Promise.all([
        isCoachMode && coachId
          ? getDocs(query(collection(db, 'academies', academyId, 'batches'), where('coachId', '==', coachId)))
          : getDocs(collection(db, 'academies', academyId, 'batches')),
        getDocs(collection(db, 'academies', academyId, 'students')),
      ]);
      const loadedBatches = batchSnapshot.docs.map((docSnap) => ({ id: docSnap.id, ...docSnap.data() }) as BatchRecord);
      const assignedStudentIds = new Set(loadedBatches.flatMap((batch) => batch.studentIds ?? []));
      const loadedStudents = studentSnapshot.docs
        .map((docSnap) => ({ id: docSnap.id, ...docSnap.data() }) as StudentRecord)
        .filter((student) => !isCoachMode || assignedStudentIds.has(student.id));
      const loadedHomework = new Map<string, HomeworkRecord>();
      if (isCoachMode) {
        const ownHomeworkSnapshot = await getDocs(query(collection(db, 'academies', academyId, 'homework'), where('createdByUid', '==', userProfile?.uid ?? '')));
        ownHomeworkSnapshot.docs.forEach((docSnap) => loadedHomework.set(docSnap.id, { id: docSnap.id, ...docSnap.data() } as HomeworkRecord));
        for (const batch of loadedBatches) {
          const batchHomeworkSnapshot = await getDocs(query(collection(db, 'academies', academyId, 'homework'), where('batchId', '==', batch.id)));
          batchHomeworkSnapshot.docs.forEach((docSnap) => loadedHomework.set(docSnap.id, { id: docSnap.id, ...docSnap.data() } as HomeworkRecord));
        }
        for (const studentId of assignedStudentIds) {
          const studentHomeworkSnapshot = await getDocs(query(collection(db, 'academies', academyId, 'homework'), where('studentIds', 'array-contains', studentId)));
          studentHomeworkSnapshot.docs.forEach((docSnap) => loadedHomework.set(docSnap.id, { id: docSnap.id, ...docSnap.data() } as HomeworkRecord));
        }
      } else {
        const homeworkSnapshot = await getDocs(collection(db, 'academies', academyId, 'homework'));
        homeworkSnapshot.docs.forEach((docSnap) => loadedHomework.set(docSnap.id, { id: docSnap.id, ...docSnap.data() } as HomeworkRecord));
      }
      setBatches(loadedBatches);
      setStudents(loadedStudents);
      setHomework(Array.from(loadedHomework.values()).sort((a, b) => String(b.createdAt ?? '').localeCompare(String(a.createdAt ?? ''))));
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Could not load homework.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadPage();
  }, [academyId, coachId, linkedStudentId, mode]);

  const filteredHomework = useMemo(() => homework.filter((item) => {
    const searchText = `${item.title} ${item.description} ${item.studentNames.join(' ')} ${item.batchName ?? ''}`.toLowerCase();
    return (statusFilter === 'all' || item.status === statusFilter)
      && (practiceFilter === 'all' || item.practiceType === practiceFilter)
      && (batchFilter === 'all' || item.batchId === batchFilter)
      && (!search.trim() || searchText.includes(search.trim().toLowerCase()));
  }), [batchFilter, homework, practiceFilter, search, statusFilter]);

  const stats = useMemo(() => {
    const active = homework.filter((item) => item.status === 'active');
    return {
      active: active.length,
      dueThisWeek: homework.filter(dueThisWeek).length,
      archived: homework.filter((item) => item.status === 'archived').length,
      students: new Set(active.flatMap((item) => item.studentIds)).size,
    };
  }, [homework]);

  const pageTitle = mode === 'academy' ? 'Academy Homework' : mode === 'coach' ? 'Coach Homework' : 'Student Homework';
  const pageDescription = mode === 'student'
    ? `View assigned practice tasks and ${PLAY_APP_NAME} links.`
    : `Assign homework and practice tasks to batches or individual students.`;

  const updateField = (field: keyof HomeworkForm, value: string | string[]) => setForm((current) => ({ ...current, [field]: value }));

  const openCreate = () => {
    setEditing(null);
    setForm({ ...initialForm, batchId: activeBatches[0]?.id ?? '' });
    setModalOpen(true);
  };

  const openEdit = (item: HomeworkRecord) => {
    setEditing(item);
    setForm({
      title: item.title,
      description: item.description,
      assignType: item.assignType,
      batchId: item.batchId ?? '',
      studentIds: item.studentIds,
      dueDate: item.dueDate ?? '',
      practiceType: item.practiceType,
      kairoyrPlayLink: item.kairoyrPlayLink ?? '',
    });
    setModalOpen(true);
  };

  const canEditHomework = (item: HomeworkRecord) => mode === 'academy' || (mode === 'coach' && item.createdByUid === userProfile?.uid);

  const selectedBatch = activeBatches.find((batch) => batch.id === form.batchId);
  const selectedStudentIds = form.assignType === 'batch' ? selectedBatch?.studentIds ?? [] : form.studentIds;

  const saveHomework = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!academyId || !userProfile || mode === 'student') return;
    if (!form.title.trim() || !form.description.trim()) {
      setError('Title and description are required.');
      return;
    }
    if (form.assignType === 'batch' && !selectedBatch) {
      setError('Select an active batch.');
      return;
    }
    if (form.assignType === 'student' && selectedStudentIds.length === 0) {
      setError('Select at least one student.');
      return;
    }
    if (isCoachMode && selectedStudentIds.some((studentId) => !visibleStudentIds.has(studentId))) {
      setError('Coach homework can only be assigned to students in assigned batches.');
      return;
    }

    setSaving(true);
    setError('');
    setMessage('');
    try {
      const studentNames = studentNamesForIds(selectedStudentIds, activeStudents);
      const payload = {
        academyId,
        title: form.title.trim(),
        description: form.description.trim(),
        assignType: form.assignType,
        batchId: form.assignType === 'batch' ? selectedBatch?.id ?? null : null,
        batchName: form.assignType === 'batch' ? selectedBatch?.name ?? null : null,
        studentIds: selectedStudentIds,
        studentNames,
        dueDate: form.dueDate || null,
        practiceType: form.practiceType,
        kairoyrPlayLink: form.kairoyrPlayLink.trim() || null,
        updatedAt: serverTimestamp(),
      };

      if (editing) {
        await updateDoc(doc(db, 'academies', academyId, 'homework', editing.id), payload);
        await createAuditLog({
          actor: userProfile,
          action: 'academy.homework.updated',
          targetType: 'homework',
          targetId: editing.id,
          academyId,
          message: `${form.title.trim()} homework updated.`,
          metadata: { academyId, homeworkId: editing.id, assignType: form.assignType, batchId: payload.batchId, studentIds: selectedStudentIds, createdByUid: editing.createdByUid },
        });
        setMessage('Homework updated.');
      } else {
        const homeworkRef = doc(collection(db, 'academies', academyId, 'homework'));
        await setDoc(homeworkRef, {
          ...payload,
          status: 'active',
          createdByUid: userProfile.uid,
          createdByName: userProfile.name,
          createdByRole: isCoachMode ? 'coach' : 'academy_admin',
          createdAt: serverTimestamp(),
        });
        await createAuditLog({
          actor: userProfile,
          action: 'academy.homework.created',
          targetType: 'homework',
          targetId: homeworkRef.id,
          academyId,
          message: `${form.title.trim()} homework created.`,
          metadata: { academyId, homeworkId: homeworkRef.id, assignType: form.assignType, batchId: payload.batchId, studentIds: selectedStudentIds, createdByUid: userProfile.uid },
        });
        setMessage('Homework created.');
      }
      setModalOpen(false);
      setEditing(null);
      setForm(initialForm);
      await loadPage();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Could not save homework.');
    } finally {
      setSaving(false);
    }
  };

  const archiveHomework = async (item: HomeworkRecord) => {
    if (!academyId || !userProfile || !canEditHomework(item)) return;
    setError('');
    setMessage('');
    try {
      await updateDoc(doc(db, 'academies', academyId, 'homework', item.id), {
        status: 'archived',
        updatedAt: serverTimestamp(),
      });
      await createAuditLog({
        actor: userProfile,
        action: 'academy.homework.archived',
        targetType: 'homework',
        targetId: item.id,
        academyId,
        message: `${item.title} homework archived.`,
        metadata: { academyId, homeworkId: item.id, assignType: item.assignType, batchId: item.batchId, studentIds: item.studentIds, createdByUid: item.createdByUid },
      });
      setMessage('Homework archived.');
      await loadPage();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Could not archive homework.');
    }
  };

  if (isCoachMode && coachResolutionLoading) {
    return <EmptyState title="Loading coach profile" description="Verifying your coach membership and academy assignments." />;
  }

  if (isCoachMode && coachResolutionError) {
    return <EmptyState title="Could not load coach profile" description={coachResolutionError} />;
  }

  if (!academyId) {
    return <EmptyState title="Academy profile not linked" description="Your profile is not linked to an academy yet." />;
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title={pageTitle}
        description={pageDescription}
        action={canCreate ? <button className="inline-flex items-center gap-2 rounded-2xl bg-directBlue px-4 py-3 text-sm font-black text-white" onClick={openCreate} type="button"><Plus size={18} /> Create Homework</button> : undefined}
      />

      {message ? <div className="rounded-2xl bg-emerald-50 px-4 py-3 text-sm font-black text-emerald-700">{message}</div> : null}
      {error ? <div className="rounded-2xl bg-rose-50 px-4 py-3 text-sm font-black text-rose-700">{error}</div> : null}

      {mode !== 'student' ? (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <StatCard label="Active Homework" value={loading ? '...' : String(stats.active)} helper="Currently assigned" icon={BookOpen} />
          <StatCard label="Due This Week" value={loading ? '...' : String(stats.dueThisWeek)} helper="Active homework" icon={CalendarClock} />
          <StatCard label="Archived" value={loading ? '...' : String(stats.archived)} helper="Kept for history" icon={Archive} />
          <StatCard label="Students Assigned" value={loading ? '...' : String(stats.students)} helper="Across active homework" icon={Users} />
        </div>
      ) : null}

      {mode !== 'student' ? (
        <section className="grid gap-3 rounded-3xl border border-slate-200 bg-white p-4 shadow-card md:grid-cols-4">
          <SearchInput placeholder="Search title or student" value={search} onChange={(event) => setSearch(event.target.value)} />
          <FilterSelect value={statusFilter} onChange={(event) => setStatusFilter(event.target.value as 'active' | 'archived' | 'all')} options={[
            { value: 'active', label: 'Active' },
            { value: 'archived', label: 'Archived' },
            { value: 'all', label: 'All status' },
          ]} />
          <FilterSelect value={practiceFilter} onChange={(event) => setPracticeFilter(event.target.value as PracticeType | 'all')} options={practiceOptions} />
          <FilterSelect value={batchFilter} onChange={(event) => setBatchFilter(event.target.value)} options={[
            { value: 'all', label: 'All batches' },
            ...activeBatches.map((batch) => ({ value: batch.id, label: batch.name ?? 'Untitled batch' })),
          ]} />
        </section>
      ) : null}

      {loading ? (
        <EmptyState title="Loading homework" description="Checking assigned homework and practice tasks." />
      ) : filteredHomework.length === 0 ? (
        <EmptyState title={mode === 'student' ? 'No homework assigned yet' : 'No homework found'} description={mode === 'student' ? 'New assignments will appear here.' : 'Create homework or adjust filters.'} />
      ) : mode === 'student' ? (
        <div className="grid gap-4">
          {filteredHomework.map((item) => (
            <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-card" key={item.id}>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h2 className="text-xl font-black text-navy">{item.title}</h2>
                  <p className="mt-1 text-sm font-semibold text-slate-500">{practiceLabel(item.practiceType)} · {item.dueDate ?? 'No due date'} · {item.createdByName || 'Academy'}</p>
                </div>
                <Badge className={statusClass(item.status)}>{item.status}</Badge>
              </div>
              <p className="mt-4 whitespace-pre-wrap text-sm leading-6 text-slate-600">{item.description}</p>
              {item.kairoyrPlayLink ? (
                <a className="mt-5 inline-flex items-center gap-2 rounded-2xl bg-directBlue px-4 py-3 text-sm font-black text-white" href={item.kairoyrPlayLink} rel="noreferrer" target="_blank">
                  <LinkIcon size={18} /> Open {PLAY_APP_NAME}
                </a>
              ) : null}
            </section>
          ))}
        </div>
      ) : (
        <DataTable columns={['Title', 'Practice', 'Assigned To', 'Due Date', 'Created By', 'Status', 'Actions']}>
          {filteredHomework.map((item) => (
            <tr className="border-t border-slate-100" key={item.id}>
              <td className="px-5 py-4 font-black text-navy">{item.title}</td>
              <td className="px-5 py-4 text-slate-600">{practiceLabel(item.practiceType)}</td>
              <td className="px-5 py-4 text-slate-600">{item.assignType === 'batch' ? item.batchName ?? 'Batch' : `${item.studentIds.length} student(s)`}</td>
              <td className="px-5 py-4 text-slate-600">{item.dueDate ?? 'No due date'}</td>
              <td className="px-5 py-4 text-slate-600">{item.createdByName || item.createdByRole}</td>
              <td className="px-5 py-4"><Badge className={statusClass(item.status)}>{item.status}</Badge></td>
              <td className="px-5 py-4">
                <div className="flex flex-wrap gap-2">
                  <button className="rounded-xl border border-slate-200 p-2 text-slate-600" onClick={() => setViewing(item)} type="button" aria-label="View homework" title="View homework"><Eye size={16} /></button>
                  {canEditHomework(item) ? <button className="rounded-xl border border-slate-200 p-2 text-slate-600" onClick={() => openEdit(item)} type="button" aria-label="Edit homework" title="Edit homework"><Edit3 size={16} /></button> : null}
                  {canEditHomework(item) && item.status !== 'archived' ? <button className="rounded-xl border border-rose-100 p-2 text-rose-600" onClick={() => archiveHomework(item)} type="button" aria-label="Archive homework" title="Archive homework"><Archive size={16} /></button> : null}
                </div>
              </td>
            </tr>
          ))}
        </DataTable>
      )}

      <Modal title={editing ? 'Edit Homework' : 'Create Homework'} description="Assign practice to an active batch or selected students." open={modalOpen} onClose={() => setModalOpen(false)}>
        <form className="grid gap-4" onSubmit={saveHomework}>
          <FormInput label="Title" value={form.title} onChange={(event) => updateField('title', event.target.value)} required />
          <label className="grid gap-2 text-sm font-bold text-slate-700">
            Description
            <textarea className="min-h-28 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-navy outline-none transition focus:border-directBlue focus:ring-4 focus:ring-blue-100" value={form.description} onChange={(event) => updateField('description', event.target.value)} required />
          </label>
          <div className="grid gap-4 md:grid-cols-2">
            <FormSelect label="Assign type" value={form.assignType} onChange={(event) => updateField('assignType', event.target.value as AssignType)} options={[
              { value: 'batch', label: 'Batch' },
              { value: 'student', label: 'Individual Student' },
            ]} />
            <FormSelect label="Practice type" value={form.practiceType} onChange={(event) => updateField('practiceType', event.target.value as PracticeType)} options={practiceOptions.filter((option) => option.value !== 'all') as Array<{ value: string; label: string }>} />
          </div>
          {form.assignType === 'batch' ? (
            <FormSelect label="Batch" value={form.batchId} onChange={(event) => updateField('batchId', event.target.value)} options={[
              { value: '', label: 'Select batch' },
              ...activeBatches.map((batch) => ({ value: batch.id, label: `${batch.name ?? 'Untitled batch'} (${batch.studentIds?.length ?? 0} students)` })),
            ]} />
          ) : (
            <div className="grid gap-2 text-sm font-bold text-slate-700">
              Students
              <div className="max-h-52 overflow-y-auto rounded-2xl border border-slate-200 p-3">
                {activeStudents.length === 0 ? <div className="text-sm font-semibold text-slate-500">No active students available.</div> : activeStudents.map((student) => (
                  <label className="flex items-center gap-3 rounded-xl px-2 py-2 text-sm font-bold text-navy hover:bg-slate-50" key={student.id}>
                    <input
                      checked={form.studentIds.includes(student.id)}
                      className="h-4 w-4 accent-directBlue"
                      onChange={() => updateField('studentIds', form.studentIds.includes(student.id) ? form.studentIds.filter((id) => id !== student.id) : [...form.studentIds, student.id])}
                      type="checkbox"
                    />
                    {student.name ?? 'Unnamed student'}
                  </label>
                ))}
              </div>
            </div>
          )}
          <div className="grid gap-4 md:grid-cols-2">
            <FormInput label="Due date" type="date" value={form.dueDate} onChange={(event) => updateField('dueDate', event.target.value)} />
            <FormInput label={`${PLAY_APP_NAME} link`} value={form.kairoyrPlayLink} onChange={(event) => updateField('kairoyrPlayLink', event.target.value)} placeholder="https://" />
          </div>
          <button className="rounded-2xl bg-directBlue px-4 py-3 text-sm font-black text-white disabled:opacity-60" disabled={saving} type="submit">
            {saving ? 'Saving...' : editing ? 'Update Homework' : 'Create Homework'}
          </button>
        </form>
      </Modal>

      <Modal title="Homework Details" open={Boolean(viewing)} onClose={() => setViewing(null)}>
        {viewing ? <HomeworkDetail homework={viewing} /> : null}
      </Modal>
    </div>
  );
}
