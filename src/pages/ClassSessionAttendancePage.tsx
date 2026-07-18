import { useEffect, useMemo, useState } from 'react';
import { CalendarCheck, CheckCircle2, Link2, Plus, RefreshCw, RotateCcw, Save, Trash2, UserPlus, UsersRound } from 'lucide-react';
import { Link, useSearchParams } from 'react-router-dom';
import { Badge } from '../components/ui/Badge';
import { EmptyState } from '../components/ui/EmptyState';
import { FormInput } from '../components/ui/FormInput';
import { FormSelect } from '../components/ui/FormSelect';
import { Modal } from '../components/ui/Modal';
import { PageHeader } from '../components/ui/PageHeader';
import { SearchInput } from '../components/ui/SearchInput';
import { useAuth } from '../contexts/AuthContext';
import { useCurrentCoach } from '../hooks/useCurrentCoach';
import { getAcademyWorkspace, getCoachWorkspace, type CoachWorkspaceBatch } from '../lib/coachWorkspaceApi';
import {
  addBatchToSession, addStudentToSession, findOrCreateClassSession, getClassSession, getCompensationCandidates,
  listClassSessions, listClassSlots, refreshClassSessionRoster, removeBatchFromSession, removeStudentFromSession,
  reopenClassSession, saveSessionAttendance, searchStudentsForSession, type ClassSession, type ClassSlot,
  type CompensationCandidate, type ParticipantStatus, type SessionParticipant, type SessionStudentSearchResult,
} from '../lib/classSessionApi';
import { formatDateOnly } from '../lib/attendanceReportHistory';

type Mode = 'academy' | 'coach';
type AttendanceRow = { studentId: string; status: ParticipantStatus; note: string };

const weekdays = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
const reasonOptions = [
  { value: 'compensation', label: 'Compensation class' }, { value: 'rescheduled', label: 'Rescheduled class' },
  { value: 'extra_class', label: 'Extra class' }, { value: 'trial', label: 'Trial class' },
  { value: 'temporary_transfer', label: 'Temporary batch change' }, { value: 'manual_other', label: 'Other' },
];
const statusOptions: Array<{ value: ParticipantStatus; label: string }> = [
  { value: 'present', label: 'Present' }, { value: 'late', label: 'Late' }, { value: 'absent', label: 'Absent' }, { value: 'excused', label: 'Excused' },
];

function today() { return new Date().toISOString().slice(0, 10); }
function timeLabel(value: string) { return new Date(`2000-01-01T${value}`).toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit' }); }
function slotLabel(slot: ClassSlot) { return `${weekdays[slot.weekday - 1]} · ${timeLabel(slot.start_time)}–${timeLabel(slot.end_time)} · ${slot.coach?.full_name ?? 'Coach'}`; }
function sourceLabel(participant: SessionParticipant) {
  if (participant.source_type === 'batch') return participant.source_batch?.name ?? 'Batch';
  return ({ individual_schedule: 'Individual schedule', compensation: 'Compensation', extra_class: 'Extra class', rescheduled: 'Rescheduled', trial: 'Trial', temporary_transfer: 'Temporary transfer', manual_other: 'Other' } as Record<string, string>)[participant.source_type] ?? participant.source_type;
}
function sourceTone(source: string) {
  if (source === 'compensation') return 'bg-orange-50 text-orange-700 ring-orange-100';
  if (source === 'individual_schedule') return 'bg-emerald-50 text-emerald-700 ring-emerald-100';
  return source === 'batch' ? 'bg-blue-50 text-blue-700 ring-blue-100' : 'bg-slate-100 text-slate-700 ring-slate-200';
}
function statusTone(status: string) { return status === 'completed' ? 'bg-emerald-50 text-emerald-700 ring-emerald-100' : status === 'cancelled' ? 'bg-rose-50 text-rose-700 ring-rose-100' : 'bg-blue-50 text-blue-700 ring-blue-100'; }

const previewSession: ClassSession = {
  id: 'preview-session', academy_id: 'preview-academy', class_slot_id: 'preview-slot', coach_id: 'preview-coach', session_date: '2026-07-24', start_time: '17:00:00', end_time: '18:00:00', location: 'Kairoyr Chess Academy', room_name: 'Training Hall', status: 'open', completed_at: null, coach: { id: 'preview-coach', full_name: 'Coach Yogendra' },
  session_source_batches: [
    { id: 'source-a', batch_id: 'batch-a', source_type: 'automatic', batch: { id: 'batch-a', name: 'Mon/Fri Batch' } },
    { id: 'source-b', batch_id: 'batch-b', source_type: 'automatic', batch: { id: 'batch-b', name: 'Fri/Sat Batch' } },
  ],
  session_participants: [
    { id: 'p1', session_id: 'preview-session', student_id: 's1', source_type: 'batch', source_batch_id: 'batch-a', added_reason: null, added_note: null, compensation_for_session_id: null, compensation_status: 'not_applicable', attendance_status: 'present', attendance_note: null, student: { id: 's1', full_name: 'Aarav Reddy', home_batch_id: 'batch-a', parent_name: 'Ravi Reddy', parent_phone: '9000000001', home_batch: { id: 'batch-a', name: 'Mon/Fri Batch' } }, source_batch: { id: 'batch-a', name: 'Mon/Fri Batch' } },
    { id: 'p2', session_id: 'preview-session', student_id: 's2', source_type: 'batch', source_batch_id: 'batch-b', added_reason: null, added_note: null, compensation_for_session_id: null, compensation_status: 'not_applicable', attendance_status: 'late', attendance_note: 'Arrived 10 minutes late', student: { id: 's2', full_name: 'Diya Sharma', home_batch_id: 'batch-b', parent_name: 'Anita Sharma', parent_phone: '9000000002', home_batch: { id: 'batch-b', name: 'Fri/Sat Batch' } }, source_batch: { id: 'batch-b', name: 'Fri/Sat Batch' } },
    { id: 'p3', session_id: 'preview-session', student_id: 's3', source_type: 'compensation', source_batch_id: 'batch-a', added_reason: 'compensation', added_note: 'Missed last Friday', compensation_for_session_id: 'missed-session', compensation_status: 'pending', attendance_status: 'present', attendance_note: null, student: { id: 's3', full_name: 'Kabir Nair', home_batch_id: 'batch-a', parent_name: 'Meera Nair', parent_phone: '9000000003', home_batch: { id: 'batch-a', name: 'Mon/Fri Batch' } }, source_batch: { id: 'batch-a', name: 'Mon/Fri Batch' } },
    { id: 'p4', session_id: 'preview-session', student_id: 's4', source_type: 'individual_schedule', source_batch_id: 'batch-a', added_reason: null, added_note: null, compensation_for_session_id: null, compensation_status: 'not_applicable', attendance_status: 'absent', attendance_note: null, student: { id: 's4', full_name: 'Ishaan Kulkarni', home_batch_id: 'batch-a', parent_name: 'Priya Kulkarni', parent_phone: '9000000004', home_batch: { id: 'batch-a', name: 'Mon/Fri Batch' } }, source_batch: { id: 'batch-a', name: 'Mon/Fri Batch' } },
  ],
};

export function ClassSessionAttendancePage({ mode, preview = false }: { mode: Mode; preview?: boolean }) {
  const { userProfile } = useAuth();
  const isCoach = mode === 'coach';
  const { coach, loading: coachLoading } = useCurrentCoach(isCoach);
  const academyId = preview ? 'preview-academy' : isCoach ? coach?.academy_id ?? userProfile?.academyId : userProfile?.academyId;
  const [searchParams, setSearchParams] = useSearchParams();
  const [slots, setSlots] = useState<ClassSlot[]>([]);
  const [batches, setBatches] = useState<CoachWorkspaceBatch[]>([]);
  const [sessions, setSessions] = useState<ClassSession[]>([]);
  const [session, setSession] = useState<ClassSession | null>(null);
  const [rows, setRows] = useState<AttendanceRow[]>([]);
  const [selectedSlotId, setSelectedSlotId] = useState('');
  const [selectedDate, setSelectedDate] = useState(today());
  const [openClass, setOpenClass] = useState(false);
  const [addBatchOpen, setAddBatchOpen] = useState(false);
  const [addStudentOpen, setAddStudentOpen] = useState(false);
  const [selectedBatchId, setSelectedBatchId] = useState('');
  const [studentSearch, setStudentSearch] = useState('');
  const [studentResults, setStudentResults] = useState<SessionStudentSearchResult[]>([]);
  const [selectedStudent, setSelectedStudent] = useState<SessionStudentSearchResult | null>(null);
  const [reason, setReason] = useState('compensation');
  const [note, setNote] = useState('');
  const [missedSessionId, setMissedSessionId] = useState('');
  const [candidates, setCandidates] = useState<CompensationCandidate[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [searching, setSearching] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const hydrateSession = (next: ClassSession) => {
    setSession(next);
    setRows((next.session_participants ?? []).map((participant) => ({ studentId: participant.student_id, status: participant.attendance_status === 'unmarked' ? 'present' : participant.attendance_status, note: participant.attendance_note ?? '' })));
    const params = new URLSearchParams(searchParams); params.set('sessionId', next.id); setSearchParams(params, { replace: true });
  };

  const reloadSession = async (id: string) => hydrateSession(await getClassSession(id));
  const loadPage = async () => {
    if (!academyId || (isCoach && !coach?.id)) return;
    setLoading(true); setError('');
    try {
      const [loadedSlots, workspace, loadedSessions] = await Promise.all([
        listClassSlots(academyId), isCoach && coach ? getCoachWorkspace(coach.id, academyId) : getAcademyWorkspace(academyId), listClassSessions(academyId),
      ]);
      setSlots(loadedSlots); setSelectedSlotId((current) => current || loadedSlots[0]?.id || ''); setBatches(workspace.batches); setSessions(loadedSessions);
      const requested = searchParams.get('sessionId');
      if (requested) hydrateSession(await getClassSession(requested));
    } catch (caught) { setError(caught instanceof Error ? caught.message : 'Could not load attendance.'); }
    finally { setLoading(false); }
  };

  useEffect(() => {
    if (preview) {
      setSlots([{ id: 'preview-slot', academy_id: 'preview-academy', coach_id: 'preview-coach', weekday: 5, start_time: '17:00:00', end_time: '18:00:00', location: 'Kairoyr Chess Academy', room_name: 'Training Hall', name: 'Friday Evening', status: 'active', coach: { id: 'preview-coach', full_name: 'Coach Yogendra' } }]);
      setBatches([{ id: 'batch-a', name: 'Mon/Fri Batch', coachId: 'preview-coach', coachName: 'Coach Yogendra', studentIds: ['s1','s3','s4'], status: 'active' }, { id: 'batch-b', name: 'Fri/Sat Batch', coachId: 'preview-coach', coachName: 'Coach Yogendra', studentIds: ['s2'], status: 'active' }]);
      setSessions([previewSession]); hydrateSession(previewSession); setLoading(false); return;
    }
    void loadPage();
  }, [academyId, coach?.id, isCoach, preview]);

  useEffect(() => {
    if (!addStudentOpen || !session) return;
    const timer = window.setTimeout(async () => {
      setSearching(true);
      try { setStudentResults(await searchStudentsForSession(session.id, studentSearch)); }
      catch (caught) { setError(caught instanceof Error ? caught.message : 'Could not search students.'); }
      finally { setSearching(false); }
    }, 250);
    return () => window.clearTimeout(timer);
  }, [addStudentOpen, session?.id, studentSearch]);

  useEffect(() => {
    if (!session || !selectedStudent || reason !== 'compensation') { setCandidates([]); setMissedSessionId(''); return; }
    void getCompensationCandidates(session.id, selectedStudent.id).then(setCandidates).catch(() => setCandidates([]));
  }, [reason, selectedStudent?.id, session?.id]);

  const participantByStudent = useMemo(() => new Map((session?.session_participants ?? []).map((item) => [item.student_id, item])), [session]);
  const includedBatchIds = new Set((session?.session_source_batches ?? []).map((item) => item.batch_id));
  const addableBatches = batches.filter((batch) => !includedBatchIds.has(batch.id));
  const canEdit = session && session.status !== 'completed' && session.status !== 'cancelled';

  const openSelectedClass = async () => {
    if (!selectedSlotId || !selectedDate) return setError('Choose a class slot and date.');
    setSaving(true); setError('');
    try { const next = await findOrCreateClassSession(selectedSlotId, selectedDate); hydrateSession(next); setOpenClass(false); setMessage('Class session ready.'); await loadPage(); }
    catch (caught) { setError(caught instanceof Error ? caught.message : 'Could not open this class.'); }
    finally { setSaving(false); }
  };

  const addBatch = async () => {
    if (!session || !selectedBatchId) return;
    setSaving(true); setError('');
    try { const count = await addBatchToSession(session.id, selectedBatchId); await reloadSession(session.id); setAddBatchOpen(false); setSelectedBatchId(''); setMessage(`Batch added; ${count} new student${count === 1 ? '' : 's'} joined the roster.`); }
    catch (caught) { setError(caught instanceof Error ? caught.message : 'Could not add this batch.'); }
    finally { setSaving(false); }
  };

  const addStudent = async () => {
    if (!session || !selectedStudent) return setError('Choose a student.');
    if (reason === 'manual_other' && !note.trim()) return setError('A note is required for Other.');
    if (reason === 'compensation' && !missedSessionId && !note.trim()) return setError('Choose a missed class or explain why this compensation is unlinked.');
    setSaving(true); setError('');
    try {
      await addStudentToSession({ sessionId: session.id, studentId: selectedStudent.id, reason, note, missedSessionId });
      await reloadSession(session.id); setAddStudentOpen(false); setSelectedStudent(null); setStudentSearch(''); setNote(''); setMissedSessionId(''); setMessage(`${selectedStudent.full_name} added to the roster.`);
    } catch (caught) { setError(caught instanceof Error ? caught.message : 'Could not add this student.'); }
    finally { setSaving(false); }
  };

  const save = async (complete: boolean) => {
    if (!session) return;
    setSaving(true); setError('');
    try { await saveSessionAttendance(session.id, rows, complete); await reloadSession(session.id); setMessage(complete ? 'Session completed. Attendance and roster history are preserved.' : 'Attendance saved.'); }
    catch (caught) { setError(caught instanceof Error ? caught.message : 'Could not save attendance.'); }
    finally { setSaving(false); }
  };

  const updateRow = (studentId: string, patch: Partial<AttendanceRow>) => setRows((current) => current.map((row) => row.studentId === studentId ? { ...row, ...patch } : row));
  const reportBatchId = session?.session_source_batches?.[0]?.batch_id ?? '';
  const reportLink = `/${mode}/class-reports?sessionId=${session?.id ?? ''}&batchId=${reportBatchId}&date=${session?.session_date ?? ''}`;
  const homeworkLink = `/${mode}/homework?sessionId=${session?.id ?? ''}&batchId=${reportBatchId}&assignedDate=${session?.session_date ?? ''}`;

  if (loading || (isCoach && coachLoading && !preview)) return <EmptyState title="Loading class sessions" description="Checking schedules and saved attendance rosters." />;

  return <div className="space-y-6">
    <PageHeader title={isCoach ? 'Class Attendance' : 'Academy Attendance'} description="Open one class session for its real mixed-batch roster, compensation students, reports and homework." action={<button className="inline-flex items-center gap-2 rounded-xl bg-directBlue px-4 py-2.5 text-sm font-black text-white" onClick={() => setOpenClass(true)}><Plus size={18}/>Open Class</button>} />
    {message ? <p className="rounded-2xl bg-emerald-50 p-4 text-sm font-bold text-emerald-700">{message}</p> : null}
    {error ? <p className="rounded-2xl bg-rose-50 p-4 text-sm font-bold text-rose-700">{error}</p> : null}

    <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_320px]">
      <main className="min-w-0 space-y-5">
        {!session ? <EmptyState title={slots.length ? 'Open a class to mark attendance' : 'No recurring class slots are available'} description={slots.length ? 'Choose a recurring slot and date. The saved roster will combine linked batches and individual schedules.' : 'An academy admin can create recurring slots from Batch & Class Schedules.'} /> : <>
          <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex flex-wrap items-start justify-between gap-4"><div><div className="flex flex-wrap items-center gap-2"><h2 className="text-xl font-black text-navy">{formatDateOnly(session.session_date)}</h2><Badge className={statusTone(session.status)}>{session.status}</Badge></div><p className="mt-2 text-sm font-semibold text-slate-600">{timeLabel(session.start_time)}–{timeLabel(session.end_time)} · {session.coach?.full_name ?? 'Coach not assigned'} · {session.location || 'Location not set'}{session.room_name ? ` · ${session.room_name}` : ''}</p></div>
              <div className="flex flex-wrap gap-2">{session.status === 'completed' && mode === 'academy' ? <button className="inline-flex items-center gap-2 rounded-xl border px-3 py-2 text-sm font-bold" onClick={async () => { if (!window.confirm('Reopen this completed session for correction?')) return; await reopenClassSession(session.id); await reloadSession(session.id); }}><RotateCcw size={16}/>Reopen</button> : null}<Link className="inline-flex items-center gap-2 rounded-xl border px-3 py-2 text-sm font-bold" to={reportLink}><Link2 size={16}/>Class report</Link><Link className="inline-flex items-center gap-2 rounded-xl border px-3 py-2 text-sm font-bold" to={homeworkLink}><Link2 size={16}/>Homework</Link></div>
            </div>
          </section>

          <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-3"><div><h3 className="font-black text-navy">Included batches</h3><p className="mt-1 text-sm text-slate-500">Temporary session inclusion never changes home-batch membership.</p></div>{canEdit ? <button className="inline-flex items-center gap-2 rounded-xl border border-blue-200 px-3 py-2 text-sm font-black text-directBlue" onClick={() => setAddBatchOpen(true)}><UsersRound size={16}/>Add batch</button> : null}</div>
            <div className="mt-4 grid gap-2 sm:grid-cols-2">{session.session_source_batches?.map((source) => <div className="flex items-center justify-between gap-3 rounded-2xl bg-slate-50 p-3" key={source.id}><div><p className="font-bold text-navy">{source.batch?.name}</p><p className="text-xs font-semibold text-slate-500">{source.source_type === 'automatic' ? 'Linked to recurring slot' : 'Manually added'} · {(session.session_participants ?? []).filter((p) => p.source_batch_id === source.batch_id).length} students</p></div>{source.source_type === 'manual' && canEdit ? <button aria-label={`Remove ${source.batch?.name}`} className="rounded-lg p-2 text-rose-600 hover:bg-rose-50" onClick={async () => { if (!window.confirm(`Remove ${source.batch?.name} and its batch-sourced students from this draft roster?`)) return; await removeBatchFromSession(session.id, source.batch_id); await reloadSession(session.id); }}><Trash2 size={16}/></button> : null}</div>)}</div>
          </section>

          <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-3"><div><h3 className="font-black text-navy">Session roster</h3><p className="mt-1 text-sm text-slate-500">{rows.length} persistent participants · defaults remain Present until changed</p></div>{canEdit ? <div className="flex flex-wrap gap-2"><button className="inline-flex items-center gap-2 rounded-xl border px-3 py-2 text-sm font-bold" onClick={async () => { if (!window.confirm('Refresh scheduled students? Manual additions and notes will be preserved.')) return; const count = await refreshClassSessionRoster(session.id); await reloadSession(session.id); setMessage(`${count} scheduled student${count === 1 ? '' : 's'} added.`); }}><RefreshCw size={16}/>Refresh roster</button><button className="inline-flex items-center gap-2 rounded-xl bg-slate-900 px-3 py-2 text-sm font-black text-white" onClick={() => setAddStudentOpen(true)}><UserPlus size={16}/>Add student</button></div> : null}</div>
            <div className="mt-4 space-y-3">{rows.map((row) => { const participant = participantByStudent.get(row.studentId); if (!participant) return null; const manual = !['batch','individual_schedule'].includes(participant.source_type); return <article className="grid gap-3 rounded-2xl border border-slate-200 p-4 lg:grid-cols-[minmax(180px,1.2fr)_minmax(150px,.8fr)_minmax(140px,.7fr)_minmax(180px,1fr)_auto] lg:items-center" key={row.studentId}><div><p className="font-black text-navy">{participant.student?.full_name ?? 'Student'}</p><p className="text-xs font-semibold text-slate-500">Home: {participant.student?.home_batch?.name ?? 'Not assigned'}</p></div><div><Badge className={sourceTone(participant.source_type)}>{sourceLabel(participant)}</Badge>{participant.compensation_status !== 'not_applicable' ? <p className="mt-1 text-xs font-bold text-orange-700">Compensation {participant.compensation_status}</p> : null}</div><select aria-label={`Attendance for ${participant.student?.full_name}`} className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-bold" disabled={!canEdit} value={row.status} onChange={(event) => updateRow(row.studentId, { status: event.target.value as ParticipantStatus })}>{statusOptions.map((option) => <option value={option.value} key={option.value}>{option.label}</option>)}</select><input aria-label={`Attendance note for ${participant.student?.full_name}`} className="min-w-0 rounded-xl border border-slate-200 px-3 py-2 text-sm" disabled={!canEdit} placeholder={participant.added_note || 'Attendance note'} value={row.note} onChange={(event) => updateRow(row.studentId, { note: event.target.value })}/>{manual && canEdit ? <button aria-label={`Remove ${participant.student?.full_name}`} className="rounded-lg p-2 text-rose-600 hover:bg-rose-50" onClick={async () => { if (!window.confirm(`Remove ${participant.student?.full_name} from this session?`)) return; await removeStudentFromSession(session.id, row.studentId); await reloadSession(session.id); }}><Trash2 size={16}/></button> : <span/>}</article>; })}</div>
            {canEdit ? <div className="mt-5 flex flex-wrap justify-end gap-3"><button disabled={saving} className="inline-flex items-center gap-2 rounded-xl border px-4 py-2.5 text-sm font-black" onClick={() => void save(false)}><Save size={17}/>Save attendance</button><button disabled={saving || !rows.length} className="inline-flex items-center gap-2 rounded-xl bg-directBlue px-4 py-2.5 text-sm font-black text-white" onClick={() => void save(true)}><CheckCircle2 size={17}/>Complete session</button></div> : null}
          </section>
        </>}
      </main>

      <aside className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm xl:sticky xl:top-6 xl:self-start"><h3 className="font-black text-navy">Recent class sessions</h3><div className="mt-3 max-h-[65vh] space-y-2 overflow-y-auto">{sessions.length ? sessions.map((item) => <button className={`w-full rounded-2xl border p-3 text-left ${session?.id === item.id ? 'border-blue-300 bg-blue-50' : 'border-slate-100 hover:bg-slate-50'}`} key={item.id} onClick={() => void reloadSession(item.id)}><div className="flex items-center justify-between gap-2"><span className="text-sm font-black text-navy">{formatDateOnly(item.session_date)}</span><Badge className={statusTone(item.status)}>{item.status}</Badge></div><p className="mt-1 text-xs font-semibold text-slate-500">{item.start_time === '00:00:00' ? 'Legacy attendance record' : `${timeLabel(item.start_time)} · ${item.coach?.full_name ?? 'Coach'}`}</p><p className="mt-1 text-xs text-slate-500">{item.session_participants?.length ?? 0} students</p></button>) : <p className="text-sm text-slate-500">No class sessions yet.</p>}</div></aside>
    </div>

    <Modal open={openClass} title="Open class attendance" description="One slot and date always resolve to the same saved session." onClose={() => setOpenClass(false)}><div className="grid gap-4"><FormSelect label="Recurring class slot" value={selectedSlotId} onChange={(event) => setSelectedSlotId(event.target.value)} options={[{ value: '', label: slots.length ? 'Choose a slot' : 'No active slots' }, ...slots.map((slot) => ({ value: slot.id, label: slotLabel(slot) }))]}/><FormInput label="Class date" type="date" value={selectedDate} onChange={(event) => setSelectedDate(event.target.value)}/><button disabled={saving || !selectedSlotId} className="rounded-xl bg-directBlue px-4 py-3 text-sm font-black text-white disabled:opacity-50" onClick={() => void openSelectedClass()}><CalendarCheck className="mr-2 inline" size={17}/>Open attendance</button></div></Modal>

    <Modal open={addBatchOpen} title="Add batch" description="Eligible active students are added once; home batches do not change." onClose={() => setAddBatchOpen(false)}><div className="grid gap-4"><FormSelect label="Academy batch" value={selectedBatchId} onChange={(event) => setSelectedBatchId(event.target.value)} options={[{ value: '', label: addableBatches.length ? 'Choose a batch' : 'No additional permitted batches' }, ...addableBatches.map((batch) => ({ value: batch.id, label: `${batch.name} · ${batch.studentIds.length} students` }))]}/><button disabled={saving || !selectedBatchId} className="rounded-xl bg-directBlue px-4 py-3 text-sm font-black text-white disabled:opacity-50" onClick={() => void addBatch()}>Add batch and students</button></div></Modal>

    <Modal open={addStudentOpen} title="Add student" description="Search is restricted to this session’s academy and excludes existing participants." onClose={() => setAddStudentOpen(false)}><div className="space-y-4"><SearchInput autoFocus placeholder="Search student, parent or phone" value={studentSearch} onChange={(event) => { setStudentSearch(event.target.value); setSelectedStudent(null); }}/>{searching ? <p className="text-sm text-slate-500">Searching academy students…</p> : studentResults.length ? <div className="max-h-52 space-y-2 overflow-y-auto rounded-2xl border p-2">{studentResults.map((student) => <button className={`w-full rounded-xl p-3 text-left ${selectedStudent?.id === student.id ? 'bg-blue-50 ring-2 ring-blue-200' : 'hover:bg-slate-50'}`} key={student.id} onClick={() => setSelectedStudent(student)}><p className="font-bold text-navy">{student.full_name}</p><p className="text-xs text-slate-500">{student.home_batch_name || 'No home batch'}{student.parent_name ? ` · ${student.parent_name}` : ''}{student.parent_phone ? ` · ${student.parent_phone}` : ''}</p></button>)}</div> : <p className="text-sm text-slate-500">{studentSearch ? 'No matching students found.' : 'Start typing or choose from the academy list.'}</p>}<FormSelect label="Reason" value={reason} onChange={(event) => setReason(event.target.value)} options={reasonOptions}/>{reason === 'compensation' && selectedStudent ? <FormSelect label="Missed class (optional only when none is suitable)" value={missedSessionId} onChange={(event) => setMissedSessionId(event.target.value)} options={[{ value: '', label: candidates.length ? 'Unlinked compensation' : 'No eligible missed class found' }, ...candidates.map((candidate) => ({ value: candidate.session_id, label: `${formatDateOnly(candidate.session_date)} · ${timeLabel(candidate.start_time)} · ${candidate.batch_name ?? 'Class'} · ${candidate.attendance_status}` }))]}/> : null}<label className="grid gap-2 text-sm font-bold text-slate-700">Note {reason === 'manual_other' || (reason === 'compensation' && !missedSessionId) ? '(required)' : '(optional)'}<textarea className="min-h-24 rounded-2xl border border-slate-200 p-3 text-sm font-medium outline-none focus:border-directBlue" value={note} onChange={(event) => setNote(event.target.value)}/></label><button disabled={saving || !selectedStudent} className="w-full rounded-xl bg-directBlue px-4 py-3 text-sm font-black text-white disabled:opacity-50" onClick={() => void addStudent()}>Add student to session</button></div></Modal>
  </div>;
}
