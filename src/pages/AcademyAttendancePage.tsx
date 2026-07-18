import { useEffect, useMemo, useState } from 'react';
import { CalendarCheck, ClipboardList, Eye, Plus, RotateCcw, Save, Search } from 'lucide-react';
import { useSearchParams } from 'react-router-dom';
import { Badge } from '../components/ui/Badge';
import { DataTable } from '../components/ui/DataTable';
import { EmptyState } from '../components/ui/EmptyState';
import { FormInput } from '../components/ui/FormInput';
import { FormSelect } from '../components/ui/FormSelect';
import { Modal } from '../components/ui/Modal';
import { StatCard } from '../components/ui/StatCard';
import { useAuth } from '../contexts/AuthContext';
import { useCurrentCoach } from '../hooks/useCurrentCoach';
import { useRefreshOnFocus } from '../hooks/useRefreshOnFocus';
import { getAcademyWorkspace, getCoachWorkspace } from '../lib/coachWorkspaceApi';
import { listAttendance, saveAttendance as saveAttendanceRecord } from '../lib/operationsApi';
import {
  currentMonthValue,
  formatDateOnly,
  getAttendanceSessions,
  getBatchAttendanceSummary,
  monthDateRange,
  type StudentAttendanceSummary,
} from '../lib/attendanceReportHistory';
import { formatDateTime } from '../utils/dateFormat';
import { createAuditLog } from '../utils/superAdminActions';

type AttendanceMode = 'academy' | 'coach';
type AttendanceStatus = 'submitted' | 'draft';
type StudentAttendanceStatus = 'present' | 'absent';

type BatchRecord = {
  id: string;
  name: string;
  days?: string[];
  startTime?: string;
  endTime?: string;
  coachId: string | null;
  coachName: string | null;
  studentIds: string[];
  status?: 'active' | 'disabled';
};

type StudentRecord = {
  id: string;
  name: string;
  status?: string;
};

type AttendanceStudent = {
  studentId: string;
  studentName: string;
  status: StudentAttendanceStatus;
  note: string;
};

type AttendanceRecord = {
  id: string;
  academyId: string;
  batchId: string;
  batchName: string;
  coachId: string | null;
  coachName: string | null;
  date: string;
  status: AttendanceStatus;
  markedByUid: string;
  markedByName: string;
  markedByRole: 'academy_admin' | 'coach';
  students: AttendanceStudent[];
  presentCount: number;
  absentCount: number;
  totalCount: number;
  createdAt: unknown;
  updatedAt: unknown;
};

function getTodayDate() {
  const date = new Date();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${date.getFullYear()}-${month}-${day}`;
}

function studentRowsForBatch(batch: BatchRecord | undefined, studentsById: Map<string, StudentRecord>): AttendanceStudent[] {
  if (!batch) return [];
  return batch.studentIds
    .map((studentId) => studentsById.get(studentId))
    .filter((student): student is StudentRecord => Boolean(student))
    .map((student) => ({
      studentId: student.id,
      studentName: student.name || 'Unnamed student',
      status: 'present',
      note: '',
    }));
}

function countAttendance(students: AttendanceStudent[]) {
  const presentCount = students.filter((student) => student.status === 'present').length;
  const absentCount = students.filter((student) => student.status === 'absent').length;
  return { presentCount, absentCount, totalCount: students.length };
}

function AttendanceSystemPage({ mode }: { mode: AttendanceMode }) {
  const { userProfile } = useAuth();
  const isCoachMode = mode === 'coach';
  const { coach: currentCoach, error: coachResolutionError, loading: coachResolutionLoading } = useCurrentCoach(isCoachMode);
  const [searchParams, setSearchParams] = useSearchParams();
  const academyId = isCoachMode ? currentCoach?.academy_id ?? userProfile?.academyId : userProfile?.academyId;
  const coachId = currentCoach?.id ?? null;
  const [batches, setBatches] = useState<BatchRecord[]>([]);
  const [studentsById, setStudentsById] = useState<Map<string, StudentRecord>>(new Map());
  const [attendanceRecords, setAttendanceRecords] = useState<AttendanceRecord[]>([]);
  const [selectedDate, setSelectedDate] = useState(getTodayDate());
  const [selectedBatchId, setSelectedBatchId] = useState('');
  const [status, setStatus] = useState<AttendanceStatus>('submitted');
  const [rows, setRows] = useState<AttendanceStudent[]>([]);
  const [overviewBatchId, setOverviewBatchId] = useState(searchParams.get('batchId') ?? '');
  const [month, setMonth] = useState(currentMonthValue());
  const [studentSearch, setStudentSearch] = useState('');
  const [filterCoachId, setFilterCoachId] = useState('');
  const [selectedStudent, setSelectedStudent] = useState<StudentAttendanceSummary | null>(null);
  const [markAttendanceOpen, setMarkAttendanceOpen] = useState(isCoachMode);
  const [editingRecord, setEditingRecord] = useState<AttendanceRecord | null>(null);
  const [editingRows, setEditingRows] = useState<AttendanceStudent[]>([]);
  const [editingStatus, setEditingStatus] = useState<AttendanceStatus>('submitted');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [loadError, setLoadError] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [reloadToken, setReloadToken] = useState(0);

  useRefreshOnFocus(() => setReloadToken((value) => value + 1), Boolean(academyId) && !markAttendanceOpen && !editingRecord && !saving);

  const selectedBatch = batches.find((batch) => batch.id === selectedBatchId);
  const existingForSelection = attendanceRecords.find((record) => record.batchId === selectedBatchId && record.date === selectedDate);

  const loadAttendance = async (currentBatches: BatchRecord[]) => {
    if (!academyId) return;
    const attendanceSnapshot = await listAttendance(academyId);
    const assignedBatchIds = new Set(currentBatches.map((batch) => batch.id));
    const records = attendanceSnapshot
      .map((row) => row as unknown as AttendanceRecord)
      .filter((record) => !isCoachMode || record.coachId === coachId)
      .filter((record) => !isCoachMode || record.coachId === coachId || assignedBatchIds.has(record.batchId))
      .sort((a, b) => b.date.localeCompare(a.date));
    setAttendanceRecords(records);
  };

  useEffect(() => {
    const loadPage = async () => {
      if (!academyId || (isCoachMode && !coachId)) {
        setLoading(false);
        return;
      }
      setLoading(true);
      setLoadError('');
      try {
        let loadedBatches: BatchRecord[];
        let loadedStudents: Map<string, StudentRecord>;
        if (isCoachMode && coachId) {
          const workspace = await getCoachWorkspace(coachId, academyId);
          loadedBatches = workspace.batches;
          loadedStudents = new Map(workspace.students.map((student) => [student.id, student]));
        } else {
          const workspace = await getAcademyWorkspace(academyId);
          loadedBatches = workspace.batches;
          loadedStudents = new Map(workspace.students.map((student) => [student.id, student]));
        }
        setBatches(loadedBatches);
        setStudentsById(loadedStudents);
        const requestedBatchId = searchParams.get('batchId') ?? '';
        const initialBatchId = loadedBatches.some((batch) => batch.id === requestedBatchId) ? requestedBatchId : loadedBatches[0]?.id ?? '';
        setOverviewBatchId((current) => loadedBatches.some((batch) => batch.id === current) ? current : initialBatchId);
        setSelectedBatchId((current) => loadedBatches.some((batch) => batch.id === current) ? current : initialBatchId);
        await loadAttendance(loadedBatches);
      } catch (caught) {
        setLoadError(caught instanceof Error ? caught.message : 'Could not load attendance history.');
      } finally {
        setLoading(false);
      }
    };

    void loadPage();
  }, [academyId, coachId, isCoachMode, reloadToken]);

  useEffect(() => {
    if (!selectedBatchId) {
      setRows([]);
      return;
    }
    if (existingForSelection) {
      setRows(existingForSelection.students ?? []);
      setStatus(existingForSelection.status ?? 'submitted');
      setMessage('Attendance for this batch and date already exists. Editing existing record.');
      return;
    }
    setRows(studentRowsForBatch(selectedBatch, studentsById));
    setStatus('submitted');
    setMessage('');
  }, [existingForSelection, selectedBatch, selectedBatchId, studentsById]);

  const coachOptions = useMemo(() => {
    const coaches = new Map<string, string>();
    batches.forEach((batch) => {
      if (batch.coachId) coaches.set(batch.coachId, batch.coachName || 'Assigned coach');
    });
    return Array.from(coaches, ([value, label]) => ({ value, label }));
  }, [batches]);

  const period = useMemo(() => monthDateRange(month), [month]);
  const selectedOverviewBatch = batches.find((batch) => batch.id === overviewBatchId);
  const attendanceSummary = useMemo(() => {
    const currentStudents = (selectedOverviewBatch?.studentIds ?? [])
      .map((studentId) => studentsById.get(studentId))
      .filter((student): student is StudentRecord => Boolean(student));
    const normalizedSearch = studentSearch.trim().toLowerCase();
    return getBatchAttendanceSummary(attendanceRecords, overviewBatchId, period.start, period.end, currentStudents)
      .filter((student) => !normalizedSearch || student.studentName.toLowerCase().includes(normalizedSearch));
  }, [attendanceRecords, overviewBatchId, period.end, period.start, selectedOverviewBatch?.studentIds, studentSearch, studentsById]);
  const filteredHistory = useMemo(
    () => getAttendanceSessions(attendanceRecords, overviewBatchId, period.start, period.end)
      .filter((record) => !filterCoachId || record.coachId === filterCoachId)
      .slice(0, 50),
    [attendanceRecords, filterCoachId, overviewBatchId, period.end, period.start],
  );

  const todaySubmittedCount = attendanceRecords.filter((record) => record.date === getTodayDate() && record.status === 'submitted').length;
  const pendingTodayCount = Math.max(0, batches.length - todaySubmittedCount);
  const activeStudentCount = useMemo(() => new Set(batches.flatMap((batch) => batch.studentIds)).size, [batches]);

  const setRowStatus = (studentId: string, nextStatus: StudentAttendanceStatus) => {
    setRows((current) => current.map((row) => (row.studentId === studentId ? { ...row, status: nextStatus } : row)));
  };

  const setRowNote = (studentId: string, note: string) => {
    setRows((current) => current.map((row) => (row.studentId === studentId ? { ...row, note } : row)));
  };

  const setAllRows = (nextStatus: StudentAttendanceStatus) => {
    setRows((current) => current.map((row) => ({ ...row, status: nextStatus })));
  };

  const resetRows = () => {
    if (existingForSelection) {
      setRows(existingForSelection.students ?? []);
    } else {
      setRows(studentRowsForBatch(selectedBatch, studentsById));
    }
  };

  const changeOverviewBatch = (batchId: string) => {
    setOverviewBatchId(batchId);
    setSelectedBatchId(batchId);
    const next = new URLSearchParams(searchParams);
    if (batchId) next.set('batchId', batchId); else next.delete('batchId');
    setSearchParams(next, { replace: true });
  };

  const setEditingRowStatus = (studentId: string, nextStatus: StudentAttendanceStatus) => {
    setEditingRows((current) => current.map((row) => (row.studentId === studentId ? { ...row, status: nextStatus } : row)));
  };

  const setEditingRowNote = (studentId: string, note: string) => {
    setEditingRows((current) => current.map((row) => (row.studentId === studentId ? { ...row, note } : row)));
  };

  const saveAttendance = async () => {
    if (!academyId || !userProfile || !selectedBatch) return;
    if (!rows.length) {
      setError('No students found in this batch.');
      return;
    }
    if (existingForSelection && !window.confirm(`Update attendance for ${selectedBatch.name} on ${formatDateOnly(selectedDate)}?`)) return;
    setSaving(true);
    setError('');
    try {
      const counts = countAttendance(rows);
      const recordId = existingForSelection?.id;
      const payload = {
        academyId,
        batchId: selectedBatch.id,
        batchName: selectedBatch.name,
        coachId: selectedBatch.coachId ?? null,
        coachName: selectedBatch.coachName ?? null,
        date: selectedDate,
        status,
        markedByUid: userProfile.uid,
        markedByName: userProfile.name,
        markedByRole: (isCoachMode ? 'coach' : 'academy_admin') as 'academy_admin' | 'coach',
        studentIds: rows.map((row) => row.studentId),
        students: rows,
        ...counts,
      };
      const savedAttendance = await saveAttendanceRecord(payload, recordId);
      await createAuditLog({
        actor: userProfile,
        action: recordId ? 'academy.attendance.updated' : 'academy.attendance.created',
        targetType: 'attendance',
        targetId: String(savedAttendance.id),
        academyId,
        message: `${selectedBatch.name} attendance ${recordId ? 'updated' : 'created'} for ${selectedDate}.`,
        metadata: {
          batchId: selectedBatch.id,
          date: selectedDate,
          presentCount: counts.presentCount,
          absentCount: counts.absentCount,
          markedByUid: userProfile.uid,
        },
      });
      await loadAttendance(batches);
      setMessage(recordId ? 'Attendance updated.' : 'Attendance submitted.');
      if (!isCoachMode) setMarkAttendanceOpen(false);
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : 'Unable to save attendance.');
    } finally {
      setSaving(false);
    }
  };

  const openEdit = (record: AttendanceRecord) => {
    setEditingRecord(record);
    setEditingRows(record.students ?? []);
    setEditingStatus(record.status ?? 'submitted');
    setError('');
  };

  const saveEdit = async () => {
    if (!academyId || !userProfile || !editingRecord) return;
    setSaving(true);
    setError('');
    try {
      const counts = countAttendance(editingRows);
      await saveAttendanceRecord({
        ...editingRecord,
        studentIds: editingRows.map((row) => row.studentId),
        students: editingRows,
        status: editingStatus,
        ...counts,
      }, editingRecord.id);
      await createAuditLog({
        actor: userProfile,
        action: 'academy.attendance.updated',
        targetType: 'attendance',
        targetId: editingRecord.id,
        academyId,
        message: `${editingRecord.batchName} attendance updated for ${editingRecord.date}.`,
        metadata: {
          batchId: editingRecord.batchId,
          date: editingRecord.date,
          presentCount: counts.presentCount,
          absentCount: counts.absentCount,
          markedByUid: userProfile.uid,
        },
      });
      setEditingRecord(null);
      setEditingRows([]);
      await loadAttendance(batches);
      setMessage('Attendance updated.');
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : 'Unable to update attendance.');
    } finally {
      setSaving(false);
    }
  };

  if (isCoachMode && coachResolutionLoading) {
    return <EmptyState title="Loading coach profile" description="Verifying your coach membership and academy assignments." />;
  }

  if (isCoachMode && coachResolutionError) {
    return <EmptyState title="Could not load coach profile" description={coachResolutionError} />;
  }

  if (!academyId) {
    return <EmptyState title="Academy profile not linked" description="Your account is not connected to an academy yet." />;
  }

  if (isCoachMode && !coachId) {
    return <EmptyState title="No coach profile linked yet" description="Log in with the Google email your academy pre-authorized for coach access." />;
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-sm font-black uppercase tracking-wide text-directBlue">Attendance</p>
          <h1 className="mt-2 text-3xl font-black text-navy">{isCoachMode ? 'Coach Attendance' : 'Academy Attendance'}</h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">
            Mark batch-wise attendance, review class history, and keep academy records tied to the right batch and date.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Badge className="bg-blue-50 text-directBlue">{isCoachMode ? 'Coach scoped' : 'Academy scoped'}</Badge>
          {!isCoachMode ? <button className="inline-flex items-center gap-2 rounded-2xl bg-directBlue px-5 py-3 text-sm font-black text-white" onClick={() => setMarkAttendanceOpen(true)} type="button">
            <Plus size={18} /> Mark Attendance
          </button> : null}
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <StatCard label="Today Submitted" value={loading ? '...' : String(todaySubmittedCount)} helper="Submitted attendance today" icon={CalendarCheck} />
        <StatCard label="Pending Today" value={loading ? '...' : String(pendingTodayCount)} helper="Active batches without submitted attendance" icon={ClipboardList} />
        <StatCard label="Classes Recorded" value={loading ? '...' : String(attendanceRecords.length)} helper={`${activeStudentCount} students in scope`} icon={Search} />
      </div>

      {error ? <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-bold text-red-700">{error}</div> : null}
      {message ? <div className="rounded-2xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm font-bold text-directBlue">{message}</div> : null}

      <section className="space-y-4 rounded-3xl border border-slate-200 bg-white p-5 shadow-card md:p-6">
        <div>
          <h2 className="text-xl font-black text-navy">Batch Attendance Overview</h2>
          <p className="mt-1 text-sm text-slate-500">Student totals for the selected batch and month.</p>
        </div>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-[minmax(220px,280px)_180px_minmax(240px,1fr)]">
            <FormSelect label="Batch" value={overviewBatchId} onChange={(event) => changeOverviewBatch(event.target.value)} options={[{ label: 'Select batch', value: '' }, ...batches.map((batch) => ({ label: batch.name, value: batch.id }))]} />
            <FormInput label="Month" type="month" value={month} onChange={(event) => setMonth(event.target.value)} />
            <FormInput label="Student search" value={studentSearch} onChange={(event) => setStudentSearch(event.target.value)} placeholder="Search this batch" />
        </div>

        {loading ? (
          <EmptyState title="Loading attendance" description="Checking batch history and students." />
        ) : loadError ? (
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm font-bold text-rose-700"><span>{loadError}</span><button className="rounded-xl bg-white px-3 py-2 text-xs font-black" onClick={() => setReloadToken((value) => value + 1)} type="button">Retry</button></div>
        ) : !overviewBatchId ? (
          <EmptyState title={batches.length ? 'Select a batch' : isCoachMode ? 'No batches are currently assigned to you.' : 'No active batches have been created for this academy yet.'} description={batches.length ? 'Choose a batch to inspect attendance history.' : 'Attendance will be available after an active batch is assigned.'} />
        ) : filteredHistory.length === 0 ? (
          <EmptyState title="No attendance records found" description="No attendance records were found for the selected batch and month." />
        ) : attendanceSummary.length === 0 ? (
          <EmptyState title="No matching students" description="Try a different student search." />
        ) : (
          <DataTable columns={['Student', 'Present', 'Absent', 'Classes', 'Attendance', 'Last attended', 'Action']}>
            {attendanceSummary.map((student) => (
              <tr className="border-t border-slate-100" key={student.studentId}>
                <td className="sticky left-0 bg-white px-5 py-4 font-black text-navy">{student.studentName}</td>
                <td className="px-5 py-4 text-emerald-700">{student.presentCount}</td>
                <td className="px-5 py-4 text-rose-700">{student.absentCount}</td>
                <td className="px-5 py-4 text-slate-600">{student.totalClasses}</td>
                <td className="px-5 py-4"><Badge className={student.percentage !== null && student.percentage >= 75 ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'}>{student.percentage === null ? 'No classes' : `${student.percentage}%`}</Badge></td>
                <td className="px-5 py-4 text-slate-600">{student.lastAttendedDate ? formatDateOnly(student.lastAttendedDate) : 'Not attended'}</td>
                <td className="px-5 py-4"><button className="inline-flex items-center gap-1 rounded-xl bg-blue-50 px-3 py-2 text-xs font-black text-directBlue" onClick={() => setSelectedStudent(student)} type="button"><Eye size={14} /> Details</button></td>
              </tr>
            ))}
          </DataTable>
        )}
      </section>

      {markAttendanceOpen ? (
      <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-card">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h2 className="text-xl font-black text-navy">Mark Attendance</h2>
            <p className="mt-1 text-sm leading-6 text-slate-500">Selecting an existing batch/date loads that attendance for editing instead of creating a duplicate.</p>
          </div>
          {existingForSelection ? <Badge className="bg-amber-50 text-amber-700">Existing record</Badge> : null}
        </div>

        <div className="mt-5 grid gap-4 md:grid-cols-3">
          <FormInput label="Date" type="date" value={selectedDate} onChange={(event) => setSelectedDate(event.target.value)} />
          <FormSelect
            label="Batch"
            value={selectedBatchId}
            onChange={(event) => setSelectedBatchId(event.target.value)}
            options={[{ label: batches.length ? 'Select batch' : 'No active batches', value: '' }, ...batches.map((batch) => ({ label: batch.name, value: batch.id }))]}
          />
          <FormSelect
            label="Status"
            value={status}
            onChange={(event) => setStatus(event.target.value as AttendanceStatus)}
            options={[
              { label: 'Submitted', value: 'submitted' },
              { label: 'Draft', value: 'draft' },
            ]}
          />
        </div>

        <div className="mt-5 flex flex-wrap gap-2">
          <button className="rounded-xl bg-emerald-50 px-3 py-2 text-xs font-black text-emerald-700" onClick={() => setAllRows('present')} type="button">Mark all present</button>
          <button className="rounded-xl bg-rose-50 px-3 py-2 text-xs font-black text-rose-700" onClick={() => setAllRows('absent')} type="button">Mark all absent</button>
          <button className="inline-flex items-center gap-1 rounded-xl bg-slate-100 px-3 py-2 text-xs font-black text-slate-700" onClick={resetRows} type="button"><RotateCcw size={14} /> Reset</button>
          {!isCoachMode ? <button className="ml-auto rounded-xl border border-slate-200 px-3 py-2 text-xs font-black text-slate-600" onClick={() => setMarkAttendanceOpen(false)} type="button">Close</button> : null}
        </div>

        <div className="mt-5 space-y-3">
          {loading ? (
            <EmptyState title="Loading attendance" description="Checking batches and students." />
          ) : !selectedBatchId ? (
            <EmptyState title="No batch selected" description="Choose an active batch to load its students." />
          ) : rows.length === 0 ? (
            <EmptyState title="No students in this batch" description="Add students to this batch before marking attendance." />
          ) : (
            rows.map((row) => (
              <div className="grid gap-3 rounded-2xl border border-slate-200 p-4 md:grid-cols-[1fr_auto_1.4fr]" key={row.studentId}>
                <div className="font-black text-navy">{row.studentName}</div>
                <div className="flex rounded-2xl border border-slate-200 bg-slate-50 p-1">
                  {(['present', 'absent'] as StudentAttendanceStatus[]).map((nextStatus) => (
                    <button
                      className={`rounded-xl px-3 py-2 text-xs font-black capitalize ${
                        row.status === nextStatus ? 'bg-directBlue text-white' : 'text-slate-600 hover:bg-white'
                      }`}
                      key={nextStatus}
                      onClick={() => setRowStatus(row.studentId, nextStatus)}
                      type="button"
                    >
                      {nextStatus}
                    </button>
                  ))}
                </div>
                <input
                  className="rounded-2xl border border-slate-200 px-4 py-3 text-sm font-semibold text-navy outline-none focus:border-directBlue focus:ring-4 focus:ring-blue-100"
                  onChange={(event) => setRowNote(row.studentId, event.target.value)}
                  placeholder="Note"
                  value={row.note}
                />
              </div>
            ))
          )}
        </div>

        <div className="mt-5 flex justify-end">
          <button
            className="inline-flex items-center gap-2 rounded-2xl bg-directBlue px-5 py-3 text-sm font-black text-white disabled:cursor-not-allowed disabled:opacity-60"
            disabled={saving || !selectedBatchId || rows.length === 0}
            onClick={saveAttendance}
            type="button"
          >
            <Save size={16} /> {saving ? 'Saving...' : existingForSelection ? 'Update Attendance' : 'Submit Attendance'}
          </button>
        </div>
      </section>
      ) : null}

      {!loadError ? <section>
        <div className="mb-3 flex flex-wrap items-end justify-between gap-3">
          <div><h2 className="text-xl font-black text-navy">Session History</h2><p className="mt-1 text-sm text-slate-500">Newest 50 sessions in the selected period.</p></div>
          <div className="grid w-full gap-3 md:w-auto md:grid-cols-1">
            <FormSelect
              label="Coach"
              value={filterCoachId}
              onChange={(event) => setFilterCoachId(event.target.value)}
              options={[{ label: 'All coaches', value: '' }, ...coachOptions]}
              disabled={isCoachMode}
            />
          </div>
        </div>
        {filteredHistory.length === 0 ? (
          <EmptyState title="No attendance records yet" description="Marked attendance will appear in this history table." />
        ) : (
          <DataTable columns={['Date', 'Batch', 'Coach', 'Present', 'Absent', 'Total', 'Marked By', 'Created', 'Action']}>
            {filteredHistory.map((record) => (
              <tr className="border-t border-slate-100" key={record.id}>
                <td className="px-5 py-4 font-black text-navy">{formatDateOnly(record.date)}</td>
                <td className="px-5 py-4 text-slate-600">{record.batchName}</td>
                <td className="px-5 py-4 text-slate-600">{record.coachName ?? 'Not assigned'}</td>
                <td className="px-5 py-4 text-slate-600">{record.presentCount}</td>
                <td className="px-5 py-4 text-slate-600">{record.absentCount}</td>
                <td className="px-5 py-4 text-slate-600">{record.totalCount}</td>
                <td className="px-5 py-4 text-slate-600">{record.markedByName}</td>
                <td className="px-5 py-4 text-slate-600">{formatDateTime(record.createdAt)}</td>
                <td className="px-5 py-4">
                  <button className="rounded-xl bg-blue-50 px-3 py-2 text-xs font-black text-directBlue" onClick={() => openEdit(record)} type="button">
                    View/Edit
                  </button>
                </td>
              </tr>
            ))}
          </DataTable>
        )}
      </section> : null}

      <Modal title={selectedStudent?.studentName ?? 'Student attendance'} description={`${formatDateOnly(period.start)} – ${formatDateOnly(period.end)}`} open={Boolean(selectedStudent)} onClose={() => setSelectedStudent(null)}>
        {selectedStudent ? (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              {[
                ['Present', String(selectedStudent.presentCount)],
                ['Absent', String(selectedStudent.absentCount)],
                ['Classes', String(selectedStudent.totalClasses)],
                ['Attendance', selectedStudent.percentage === null ? 'No classes' : `${selectedStudent.percentage}%`],
              ].map(([label, value]) => <div className="rounded-2xl bg-slate-50 p-3" key={label}><div className="text-xs font-black uppercase text-slate-500">{label}</div><div className="mt-1 text-lg font-black text-navy">{value}</div></div>)}
            </div>
            <div className="space-y-2">
              {selectedStudent.history.map((entry) => (
                <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200 p-3" key={`${entry.sessionId}-${entry.date}`}>
                  <div><div className="font-black text-navy">{formatDateOnly(entry.date)}</div>{entry.note ? <div className="text-sm text-slate-500">{entry.note}</div> : null}</div>
                  <Badge className={entry.status === 'present' ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-700'}>{entry.status}</Badge>
                </div>
              ))}
            </div>
          </div>
        ) : null}
      </Modal>

      <Modal
        description={editingRecord ? `${editingRecord.batchName} · ${editingRecord.date}` : undefined}
        onClose={() => setEditingRecord(null)}
        open={Boolean(editingRecord)}
        title="Edit Attendance"
      >
        <div className="space-y-4">
          <FormSelect
            label="Status"
            value={editingStatus}
            onChange={(event) => setEditingStatus(event.target.value as AttendanceStatus)}
            options={[
              { label: 'Submitted', value: 'submitted' },
              { label: 'Draft', value: 'draft' },
            ]}
          />
          {editingRows.map((row) => (
            <div className="grid gap-3 rounded-2xl border border-slate-200 p-4 md:grid-cols-[1fr_auto_1.3fr]" key={row.studentId}>
              <div className="font-black text-navy">{row.studentName}</div>
              <div className="flex rounded-2xl border border-slate-200 bg-slate-50 p-1">
                {(['present', 'absent'] as StudentAttendanceStatus[]).map((nextStatus) => (
                  <button
                    className={`rounded-xl px-3 py-2 text-xs font-black capitalize ${
                      row.status === nextStatus ? 'bg-directBlue text-white' : 'text-slate-600 hover:bg-white'
                    }`}
                    key={nextStatus}
                    onClick={() => setEditingRowStatus(row.studentId, nextStatus)}
                    type="button"
                  >
                    {nextStatus}
                  </button>
                ))}
              </div>
              <input
                className="rounded-2xl border border-slate-200 px-4 py-3 text-sm font-semibold text-navy outline-none focus:border-directBlue focus:ring-4 focus:ring-blue-100"
                onChange={(event) => setEditingRowNote(row.studentId, event.target.value)}
                placeholder="Note"
                value={row.note}
              />
            </div>
          ))}
          <div className="flex justify-end">
            <button
              className="rounded-2xl bg-directBlue px-5 py-3 text-sm font-black text-white disabled:cursor-not-allowed disabled:opacity-60"
              disabled={saving}
              onClick={saveEdit}
              type="button"
            >
              {saving ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}

export function AcademyAttendancePage() {
  return <AttendanceSystemPage mode="academy" />;
}

export function CoachAttendancePage() {
  return <AttendanceSystemPage mode="coach" />;
}
