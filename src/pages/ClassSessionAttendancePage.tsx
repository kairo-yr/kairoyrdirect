import { useEffect, useState } from 'react';
import { CalendarCheck, CheckCircle2, Plus, RotateCcw, Save, Trash2, UserPlus } from 'lucide-react';
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
  addStudentToSession,
  findOrCreateBatchSession,
  getClassSession,
  listClassSessions,
  refreshClassSessionRoster,
  removeStudentFromSession,
  reopenClassSession,
  saveSessionAttendance,
  searchStudentsForSession,
  type ClassSession,
  type ParticipantStatus,
  type SessionParticipant,
  type SessionStudentSearchResult,
} from '../lib/classSessionApi';
import { formatDateOnly } from '../lib/attendanceReportHistory';

type Mode = 'academy' | 'coach';
type AttendanceRow = { studentId: string; status: ParticipantStatus; note: string };

const reasons = [
  { value: 'makeup', label: 'Makeup class' },
  { value: 'extra_class', label: 'Extra class' },
  { value: 'temporary', label: 'Temporary schedule change' },
  { value: 'trial', label: 'Trial class' },
  { value: 'other', label: 'Other' },
];
const statuses: Array<{ value: ParticipantStatus; label: string }> = [
  { value: 'present', label: 'Present' },
  { value: 'late', label: 'Late' },
  { value: 'absent', label: 'Absent' },
  { value: 'excused', label: 'Excused' },
];

function today() { return new Date().toISOString().slice(0, 10); }
function timeLabel(value: string) { return new Date(`2000-01-01T${value}`).toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit' }); }
function participantBadge(participant: SessionParticipant) {
  const labels: Record<string, string> = {
    makeup: 'Makeup', compensation: 'Makeup', extra_class: 'Extra', temporary: 'Temporary',
    temporary_transfer: 'Temporary', rescheduled: 'Temporary', trial: 'Trial', other: 'Added student', manual_other: 'Added student',
  };
  return labels[participant.source_type] ?? null;
}
function isScheduled(participant: SessionParticipant) {
  return participant.source_type === 'scheduled' || participant.source_type === 'batch' || participant.source_type === 'individual_schedule';
}

function StatusButtons({ disabled, value, onChange }: { disabled: boolean; value: ParticipantStatus; onChange: (status: ParticipantStatus) => void }) {
  return <div>
    <p className="mb-2 text-xs font-black uppercase tracking-wide text-slate-500">Attendance</p>
    <div className="flex flex-wrap gap-1.5">{statuses.map((status) => <button
      className={`rounded-lg border px-2.5 py-2 text-xs font-black transition ${value === status.value ? 'border-directBlue bg-directBlue text-white shadow-sm' : 'border-slate-200 bg-white text-slate-600 hover:border-blue-300'} disabled:cursor-not-allowed disabled:opacity-60`}
      disabled={disabled}
      key={status.value}
      onClick={() => onChange(status.value)}
      type="button"
    >{status.label}</button>)}</div>
  </div>;
}

export function ClassSessionAttendancePage({ mode }: { mode: Mode }) {
  const { userProfile } = useAuth();
  const isCoach = mode === 'coach';
  const { coach, loading: coachLoading } = useCurrentCoach(isCoach);
  const academyId = isCoach ? coach?.academy_id ?? userProfile?.academyId : userProfile?.academyId;
  const [searchParams, setSearchParams] = useSearchParams();
  const [batches, setBatches] = useState<CoachWorkspaceBatch[]>([]);
  const [sessions, setSessions] = useState<ClassSession[]>([]);
  const [session, setSession] = useState<ClassSession | null>(null);
  const [rows, setRows] = useState<AttendanceRow[]>([]);
  const [selectedBatchId, setSelectedBatchId] = useState('');
  const [selectedDate, setSelectedDate] = useState(today());
  const [selectedStartTime, setSelectedStartTime] = useState('17:00');
  const [selectedEndTime, setSelectedEndTime] = useState('18:00');
  const [openClass, setOpenClass] = useState(false);
  const [addStudentOpen, setAddStudentOpen] = useState(false);
  const [studentSearch, setStudentSearch] = useState('');
  const [studentResults, setStudentResults] = useState<SessionStudentSearchResult[]>([]);
  const [selectedStudent, setSelectedStudent] = useState<SessionStudentSearchResult | null>(null);
  const [reason, setReason] = useState('makeup');
  const [note, setNote] = useState('');
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [participantsLoading, setParticipantsLoading] = useState(false);
  const [participantsError, setParticipantsError] = useState('');
  const [saving, setSaving] = useState(false);
  const [searching, setSearching] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const hydrateSession = (next: ClassSession) => {
    setParticipantsError('');
    setSession(next);
    setRows((next.session_participants ?? []).map((participant) => ({
      studentId: participant.student_id,
      status: participant.attendance_status === 'unmarked' ? 'present' : participant.attendance_status,
      note: participant.attendance_note ?? '',
    })));
    const params = new URLSearchParams(searchParams);
    params.set('sessionId', next.id);
    setSearchParams(params, { replace: true });
  };

  const reloadSession = async (id: string) => {
    setParticipantsLoading(true);
    setParticipantsError('');
    try { hydrateSession(await getClassSession(id)); }
    catch (caught) {
      const message = caught instanceof Error ? caught.message : 'Could not load session participants.';
      setParticipantsError(message);
      throw caught;
    } finally { setParticipantsLoading(false); }
  };
  const reloadSessionAndHistory = async (id: string) => {
    await reloadSession(id);
    if (academyId) setSessions(await listClassSessions(academyId));
  };
  const loadPage = async () => {
    if (!academyId || (isCoach && !coach?.id)) return;
    setLoading(true);
    setError('');
    setLoadError('');
    try {
      const [workspace, loadedSessions] = await Promise.all([
        isCoach && coach ? getCoachWorkspace(coach.id, academyId) : getAcademyWorkspace(academyId),
        listClassSessions(academyId),
      ]);
      setBatches(workspace.batches);
      setSelectedBatchId((current) => current || workspace.batches[0]?.id || '');
      setSessions(loadedSessions);
      const requested = searchParams.get('sessionId');
      if (requested) hydrateSession(await getClassSession(requested));
    } catch (caught) {
      const message = caught instanceof Error ? caught.message : 'Could not load class sessions.';
      setLoadError(message);
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void loadPage(); }, [academyId, coach?.id]);
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

  const canEdit = Boolean(session && session.status !== 'completed' && session.status !== 'cancelled');
  const scheduledParticipants = (session?.session_participants ?? []).filter(isScheduled);
  const addedParticipants = (session?.session_participants ?? []).filter((participant) => !isScheduled(participant));
  const sessionBatchId = session?.session_source_batches?.[0]?.batch_id ?? '';
  const activeBatchStudentCount = batches.find((batch) => batch.id === sessionBatchId)?.studentIds.length ?? 0;
  const canComplete = canEdit && !saving && !participantsLoading && !participantsError && rows.length>0 && !(activeBatchStudentCount>0 && scheduledParticipants.length===0);

  const openSelectedClass = async () => {
    if (!selectedBatchId || !selectedDate || !selectedStartTime || !selectedEndTime) return setError('Choose a batch, class date, start time, and end time.');
    if (selectedEndTime <= selectedStartTime) return setError('End time must be later than start time.');
    setSaving(true);
    setError('');
    try {
      const next = await findOrCreateBatchSession(selectedBatchId, selectedDate, selectedStartTime, selectedEndTime);
      hydrateSession(next);
      setOpenClass(false);
      setSessions(await listClassSessions(academyId!));
    } catch (caught) { setError(caught instanceof Error ? caught.message : 'Could not open attendance.'); }
    finally { setSaving(false); }
  };

  const addSelectedStudent = async () => {
    if (!session || !selectedStudent) return setError('Choose a student.');
    if (reason === 'other' && !note.trim()) return setError('A note is required for Other.');
    setSaving(true);
    setError('');
    try {
      await addStudentToSession({ sessionId: session.id, studentId: selectedStudent.id, reason, note });
      await reloadSessionAndHistory(session.id);
      setSelectedStudent(null); setStudentSearch(''); setNote(''); setReason('makeup'); setAddStudentOpen(false);
      setMessage(`${selectedStudent.full_name} was added to this class only.`);
    } catch (caught) { setError(caught instanceof Error ? caught.message : 'Could not add this student.'); }
    finally { setSaving(false); }
  };

  const persistAttendance = async (complete: boolean) => {
    if (!session) return;
    if (complete && participantsLoading) return setError('Wait for session participants to finish loading.');
    if (complete && participantsError) return setError('Participants could not be loaded. Retry before completing attendance.');
    if (complete && rows.length===0) return setError(activeBatchStudentCount ? 'Scheduled batch students have not loaded. Refresh the roster before completing attendance.' : 'This batch has no active students. Add students to the batch or add a student to this class.');
    if (complete && activeBatchStudentCount>0 && scheduledParticipants.length===0) return setError('Scheduled batch students have not loaded. Refresh the roster before completing attendance.');
    setSaving(true);
    setError('');
    try {
      await saveSessionAttendance(session.id, rows, complete);
      await reloadSession(session.id);
      setSessions(await listClassSessions(academyId!));
      setMessage(complete ? 'Attendance completed.' : 'Attendance draft saved.');
    } catch (caught) { setError(caught instanceof Error ? caught.message : 'Could not save attendance.'); }
    finally { setSaving(false); }
  };

  if (loading || (isCoach && coachLoading)) return <EmptyState title="Loading attendance" description="Loading batches and class history." />;

  return <div className="space-y-6">
    <PageHeader
      title="Attendance"
      description="Open a batch class, mark its scheduled students, and add an academy student to this class only."
      action={<button className="inline-flex items-center gap-2 rounded-xl bg-directBlue px-4 py-3 text-sm font-black text-white" onClick={() => setOpenClass(true)}><Plus size={18}/>Open class</button>}
    />
    {error ? <div className="rounded-2xl bg-rose-50 p-4 text-sm font-bold text-rose-700">{error}</div> : null}
    {message ? <div className="rounded-2xl bg-emerald-50 p-4 text-sm font-bold text-emerald-700">{message}</div> : null}

    <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_340px]">
      <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
        {loadError ? <EmptyState title="Could not load class sessions" description={loadError} /> : !session ? <EmptyState title="Open a batch class to mark attendance" description="Choose a batch and date. Its active students will be loaded automatically." /> : <>
          <div className="flex flex-wrap items-start justify-between gap-3 border-b border-slate-100 pb-4">
            <div>
              <h2 className="text-xl font-black text-navy">{session.session_source_batches?.[0]?.batch?.name ?? 'Class attendance'}</h2>
              <p className="mt-1 text-sm font-semibold text-slate-500">{formatDateOnly(session.session_date)} · {timeLabel(session.start_time)}–{timeLabel(session.end_time)} · {session.session_source_batches?.[0]?.batch?.schedule_label || 'Batch schedule'}</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Badge className={session.status === 'completed' ? 'bg-emerald-50 text-emerald-700 ring-emerald-100' : 'bg-blue-50 text-blue-700 ring-blue-100'}>{session.status}</Badge>
              {canEdit ? <button className="inline-flex items-center gap-2 rounded-xl border border-slate-200 px-3 py-2 text-sm font-black text-navy" onClick={() => { setError(''); setAddStudentOpen(true); }}><UserPlus size={16}/>Add student</button> : null}
            </div>
          </div>
          {participantsError ? <div className="mt-4 rounded-2xl bg-rose-50 p-4 text-sm font-bold text-rose-700">{participantsError}</div> : null}
          {participantsLoading ? <div className="mt-4 rounded-2xl bg-slate-50 p-4 text-sm font-semibold text-slate-600">Loading session participants…</div> : null}
          {!participantsLoading && !participantsError && (session.session_participants ?? []).length===0 ? <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm font-bold text-amber-800">This batch has no active students. Add students to the batch or add a student to this class.</div> : null}
          {[{ title: 'Scheduled students', participants: scheduledParticipants }, { title: 'Additional students', participants: addedParticipants }].map((group) => group.participants.length ? <div className="mt-5" key={group.title}>
            <h3 className="text-sm font-black uppercase tracking-wide text-slate-500">{group.title}</h3>
            <div className="mt-3 space-y-3">{group.participants.map((participant) => {
              const row = rows.find((item) => item.studentId === participant.student_id);
              const addedBadge = participantBadge(participant);
              return <div className="grid gap-3 rounded-2xl border border-slate-100 p-4 lg:grid-cols-[minmax(180px,1fr)_minmax(300px,1.4fr)_minmax(180px,1fr)_auto] lg:items-center" key={participant.id}>
                <div>
                  <div className="flex flex-wrap items-center gap-2"><span className="font-black text-navy">{participant.student?.full_name ?? 'Student'}</span>{addedBadge ? <Badge className="bg-amber-50 text-amber-700 ring-amber-100">{addedBadge}</Badge> : null}</div>
                  <p className="mt-1 text-xs text-slate-500">{isScheduled(participant) ? 'Scheduled student' : `${participant.student?.home_batch?.name ?? 'No current batch'}${participant.added_note ? ` · ${participant.added_note}` : ''}`}</p>
                </div>
                <StatusButtons disabled={!canEdit} value={row?.status ?? 'present'} onChange={(status) => setRows((current) => current.map((item) => item.studentId === participant.student_id ? { ...item, status } : item))}/>
                <FormInput label="Attendance note" disabled={!canEdit} value={row?.note ?? ''} onChange={(event) => setRows((current) => current.map((item) => item.studentId === participant.student_id ? { ...item, note: event.target.value } : item))}/>
                {!isScheduled(participant) && canEdit ? <button aria-label={`Remove ${participant.student?.full_name ?? 'student'}`} className="rounded-xl p-2 text-rose-600 hover:bg-rose-50" onClick={async () => { if (!window.confirm('Remove this added student from this class?')) return; setSaving(true); setError(''); try { await removeStudentFromSession(session.id, participant.student_id); await reloadSessionAndHistory(session.id); } catch (caught) { setError(caught instanceof Error ? caught.message : 'Could not remove this student.'); } finally { setSaving(false); } }}><Trash2 size={18}/></button> : <span/>}
              </div>;
            })}</div>
          </div> : null)}
          {canEdit ? <div className="mt-5 flex flex-wrap justify-end gap-2">
            <button disabled={saving || participantsLoading} className="inline-flex items-center gap-2 rounded-xl border border-slate-200 px-4 py-3 text-sm font-black text-navy disabled:opacity-50" onClick={async () => { setSaving(true); setError(''); try { await refreshClassSessionRoster(session.id); await reloadSessionAndHistory(session.id); } catch (caught) { setError(caught instanceof Error ? caught.message : 'Could not refresh batch students.'); } finally { setSaving(false); } }}><RotateCcw size={17}/>Refresh batch students</button>
            <button disabled={saving || participantsLoading || Boolean(participantsError) || rows.length===0} className="inline-flex items-center gap-2 rounded-xl border border-blue-200 px-4 py-3 text-sm font-black text-directBlue disabled:opacity-50" onClick={() => void persistAttendance(false)}><Save size={17}/>Save draft</button>
            <button disabled={!canComplete} className="inline-flex items-center gap-2 rounded-xl bg-directBlue px-4 py-3 text-sm font-black text-white disabled:cursor-not-allowed disabled:opacity-50" onClick={() => void persistAttendance(true)}><CheckCircle2 size={17}/>Complete attendance</button>
          </div> : <div className="mt-5 flex flex-wrap justify-end gap-2">
            {mode === 'academy' ? <button className="rounded-xl border border-slate-200 px-4 py-3 text-sm font-black text-navy" onClick={async () => { setSaving(true); setError(''); try { await reopenClassSession(session.id); await refreshClassSessionRoster(session.id); await reloadSessionAndHistory(session.id); } catch (caught) { setError(caught instanceof Error ? caught.message : 'Could not reopen attendance.'); } finally { setSaving(false); } }}>Reopen attendance</button> : null}
            <Link className="rounded-xl bg-directBlue px-4 py-3 text-sm font-black text-white" to={`/${mode === 'coach' ? 'coach' : 'academy'}/class-reports?sessionId=${session.id}&batchId=${session.session_source_batches?.[0]?.batch_id ?? ''}`}>Create class report</Link>
          </div>}
        </>}
      </section>

      <aside className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm xl:sticky xl:top-6 xl:self-start">
        <h3 className="font-black text-navy">Class history</h3>
        <div className="mt-3 max-h-[70vh] space-y-2 overflow-y-auto">{loadError ? <p className="text-sm font-semibold text-rose-600">Could not load class sessions.</p> : sessions.length ? sessions.map((item) => <button className={`w-full rounded-2xl border p-3 text-left ${session?.id === item.id ? 'border-blue-300 bg-blue-50' : 'border-slate-100 hover:bg-slate-50'}`} key={item.id} onClick={() => void reloadSession(item.id)}>
          <div className="flex items-center justify-between gap-2"><span className="text-sm font-black text-navy">{item.session_source_batches?.[0]?.batch?.name ?? 'Historical class'}</span><Badge className="bg-slate-100 text-slate-700 ring-slate-200">{item.status}</Badge></div>
          <p className="mt-1 text-xs font-semibold text-slate-500">{formatDateOnly(item.session_date)} · {timeLabel(item.start_time)}–{timeLabel(item.end_time)}</p>
          <p className="mt-1 text-xs text-slate-500">{item.session_participants?.length ?? 0} participants · {(item.session_participants ?? []).filter((p) => !isScheduled(p)).length} added</p>
        </button>) : <p className="text-sm text-slate-500">No class sessions yet.</p>}</div>
      </aside>
    </div>

    <Modal open={openClass} title="Open class attendance" description="Scheduled students come from the selected batch." onClose={() => setOpenClass(false)}>
      <div className="grid gap-4 sm:grid-cols-2"><FormSelect className="sm:col-span-2" label="Batch" value={selectedBatchId} onChange={(event) => setSelectedBatchId(event.target.value)} options={[{ value: '', label: batches.length ? 'Choose a batch' : 'No assigned batches' }, ...batches.map((batch) => ({ value: batch.id, label: `${batch.name} · ${batch.coachName}` }))]}/><FormInput className="sm:col-span-2" label="Class date" type="date" value={selectedDate} onChange={(event) => setSelectedDate(event.target.value)}/><FormInput label="Start time" type="time" value={selectedStartTime} onChange={(event) => setSelectedStartTime(event.target.value)}/><FormInput label="End time" type="time" value={selectedEndTime} onChange={(event) => setSelectedEndTime(event.target.value)}/><button disabled={saving || !selectedBatchId} className="rounded-xl bg-directBlue px-4 py-3 text-sm font-black text-white disabled:opacity-50 sm:col-span-2" onClick={() => void openSelectedClass()}><CalendarCheck className="mr-2 inline" size={17}/>Open attendance</button></div>
    </Modal>

    <Modal open={addStudentOpen} title="Add student" description="Adds an active academy student to this attendance session only." onClose={() => setAddStudentOpen(false)}>
      <div className="space-y-4">
        <SearchInput value={studentSearch} onChange={(event) => { setStudentSearch(event.target.value); setSelectedStudent(null); }} placeholder="Search by student name"/>
        <div className="max-h-52 space-y-2 overflow-y-auto">{searching ? <p className="text-sm text-slate-500">Searching…</p> : studentResults.map((student) => <button className={`w-full rounded-xl border p-3 text-left ${selectedStudent?.id === student.id ? 'border-blue-300 bg-blue-50' : 'border-slate-200'}`} key={student.id} onClick={() => setSelectedStudent(student)}><span className="block font-black text-navy">{student.full_name}</span><span className="text-xs text-slate-500">Current batch: {student.home_batch_name ?? 'Not assigned'}</span></button>)}</div>
        <FormSelect label="Reason" value={reason} onChange={(event) => setReason(event.target.value)} options={reasons}/>
        <FormInput label={reason === 'other' ? 'Note (required)' : 'Note (optional)'} value={note} onChange={(event) => setNote(event.target.value)}/>
        <button disabled={saving || !selectedStudent} className="w-full rounded-xl bg-directBlue px-4 py-3 text-sm font-black text-white disabled:opacity-50" onClick={() => void addSelectedStudent()}><UserPlus className="mr-2 inline" size={17}/>Add student to this class</button>
      </div>
    </Modal>
  </div>;
}
