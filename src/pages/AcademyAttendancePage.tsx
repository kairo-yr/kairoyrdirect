import { useEffect, useMemo, useState } from 'react';
import { collection, doc, getDoc, getDocs, query, serverTimestamp, setDoc, updateDoc, where } from 'firebase/firestore';
import { CalendarCheck, ClipboardList, Save, Search } from 'lucide-react';
import { Badge } from '../components/ui/Badge';
import { DataTable } from '../components/ui/DataTable';
import { EmptyState } from '../components/ui/EmptyState';
import { FormInput } from '../components/ui/FormInput';
import { FormSelect } from '../components/ui/FormSelect';
import { Modal } from '../components/ui/Modal';
import { StatCard } from '../components/ui/StatCard';
import { useAuth } from '../contexts/AuthContext';
import { db } from '../lib/firebase';
import { formatFirestoreDate } from '../utils/firestoreFormat';
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
  const academyId = userProfile?.academyId;
  const linkedCoachId = userProfile?.linkedCoachId;
  const [batches, setBatches] = useState<BatchRecord[]>([]);
  const [studentsById, setStudentsById] = useState<Map<string, StudentRecord>>(new Map());
  const [attendanceRecords, setAttendanceRecords] = useState<AttendanceRecord[]>([]);
  const [selectedDate, setSelectedDate] = useState(getTodayDate());
  const [selectedBatchId, setSelectedBatchId] = useState('');
  const [status, setStatus] = useState<AttendanceStatus>('submitted');
  const [rows, setRows] = useState<AttendanceStudent[]>([]);
  const [filterDate, setFilterDate] = useState('');
  const [filterBatchId, setFilterBatchId] = useState('');
  const [filterCoachId, setFilterCoachId] = useState('');
  const [editingRecord, setEditingRecord] = useState<AttendanceRecord | null>(null);
  const [editingRows, setEditingRows] = useState<AttendanceStudent[]>([]);
  const [editingStatus, setEditingStatus] = useState<AttendanceStatus>('submitted');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const isCoachMode = mode === 'coach';
  const selectedBatch = batches.find((batch) => batch.id === selectedBatchId);
  const existingForSelection = attendanceRecords.find((record) => record.batchId === selectedBatchId && record.date === selectedDate);

  const loadAttendance = async (currentBatches: BatchRecord[]) => {
    if (!academyId) return;
    const attendanceSnapshot = isCoachMode && linkedCoachId
      ? await getDocs(query(collection(db, 'academies', academyId, 'attendance'), where('coachId', '==', linkedCoachId)))
      : await getDocs(collection(db, 'academies', academyId, 'attendance'));
    const assignedBatchIds = new Set(currentBatches.map((batch) => batch.id));
    const records = attendanceSnapshot.docs
      .map((docSnap) => ({ id: docSnap.id, ...docSnap.data() }) as AttendanceRecord)
      .filter((record) => !isCoachMode || record.coachId === linkedCoachId || assignedBatchIds.has(record.batchId))
      .sort((a, b) => b.date.localeCompare(a.date));
    setAttendanceRecords(records);
  };

  useEffect(() => {
    const loadPage = async () => {
      if (!academyId || (isCoachMode && !linkedCoachId)) {
        setLoading(false);
        return;
      }
      setLoading(true);
      try {
        const batchSnapshot = isCoachMode && linkedCoachId
          ? await getDocs(query(collection(db, 'academies', academyId, 'batches'), where('coachId', '==', linkedCoachId)))
          : await getDocs(collection(db, 'academies', academyId, 'batches'));
        const loadedBatches = batchSnapshot.docs
          .map((docSnap) => ({ id: docSnap.id, ...docSnap.data() }) as BatchRecord)
          .filter((batch) => batch.status === 'active')
          .filter((batch) => !isCoachMode || batch.coachId === linkedCoachId);
        const assignedStudentIds = new Set(loadedBatches.flatMap((batch) => batch.studentIds));
        const studentSnapshot = isCoachMode
          ? await Promise.all(Array.from(assignedStudentIds).map((studentId) => getDoc(doc(db, 'academies', academyId, 'students', studentId))))
          : (await getDocs(collection(db, 'academies', academyId, 'students'))).docs;
        const loadedStudents = new Map(
          studentSnapshot
            .filter((docSnap) => docSnap.exists())
            .map((docSnap) => ({ id: docSnap.id, ...docSnap.data() }) as StudentRecord)
            .filter((student) => student.status !== 'disabled')
            .filter((student) => !isCoachMode || assignedStudentIds.has(student.id))
            .map((student) => [student.id, student] as const),
        );
        setBatches(loadedBatches);
        setStudentsById(loadedStudents);
        setSelectedBatchId((current) => current || loadedBatches[0]?.id || '');
        await loadAttendance(loadedBatches);
      } finally {
        setLoading(false);
      }
    };

    void loadPage();
  }, [academyId, isCoachMode, linkedCoachId]);

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

  const filteredHistory = useMemo(
    () =>
      attendanceRecords.filter((record) => {
        const matchesDate = filterDate ? record.date === filterDate : true;
        const matchesBatch = filterBatchId ? record.batchId === filterBatchId : true;
        const matchesCoach = filterCoachId ? record.coachId === filterCoachId : true;
        return matchesDate && matchesBatch && matchesCoach;
      }),
    [attendanceRecords, filterBatchId, filterCoachId, filterDate],
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
    setSaving(true);
    setError('');
    try {
      const counts = countAttendance(rows);
      const recordId = existingForSelection?.id;
      const attendanceRef = recordId
        ? doc(db, 'academies', academyId, 'attendance', recordId)
        : doc(collection(db, 'academies', academyId, 'attendance'));
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
        updatedAt: serverTimestamp(),
      };
      if (recordId) {
        await updateDoc(attendanceRef, payload);
      } else {
        await setDoc(attendanceRef, { ...payload, createdAt: serverTimestamp() });
      }
      await createAuditLog({
        actor: userProfile,
        action: recordId ? 'academy.attendance.updated' : 'academy.attendance.created',
        targetType: 'attendance',
        targetId: attendanceRef.id,
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
      await updateDoc(doc(db, 'academies', academyId, 'attendance', editingRecord.id), {
        studentIds: editingRows.map((row) => row.studentId),
        students: editingRows,
        status: editingStatus,
        ...counts,
        updatedAt: serverTimestamp(),
      });
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

  if (!academyId) {
    return <EmptyState title="Academy profile not linked" description="Your account is not connected to an academy yet." />;
  }

  if (isCoachMode && !linkedCoachId) {
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
        <Badge className="bg-blue-50 text-directBlue">{isCoachMode ? 'Coach scoped' : 'Academy scoped'}</Badge>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <StatCard label="Today Submitted" value={loading ? '...' : String(todaySubmittedCount)} helper="Submitted attendance today" icon={CalendarCheck} />
        <StatCard label="Pending Today" value={loading ? '...' : String(pendingTodayCount)} helper="Active batches without submitted attendance" icon={ClipboardList} />
        <StatCard label="Classes Recorded" value={loading ? '...' : String(attendanceRecords.length)} helper={`${activeStudentCount} students in scope`} icon={Search} />
      </div>

      {error ? <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-bold text-red-700">{error}</div> : null}
      {message ? <div className="rounded-2xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm font-bold text-directBlue">{message}</div> : null}

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

      <section>
        <div className="mb-3 flex flex-wrap items-end justify-between gap-3">
          <h2 className="text-xl font-black text-navy">Attendance History</h2>
          <div className="grid w-full gap-3 md:w-auto md:grid-cols-3">
            <FormInput label="Date" type="date" value={filterDate} onChange={(event) => setFilterDate(event.target.value)} />
            <FormSelect
              label="Batch"
              value={filterBatchId}
              onChange={(event) => setFilterBatchId(event.target.value)}
              options={[{ label: 'All batches', value: '' }, ...batches.map((batch) => ({ label: batch.name, value: batch.id }))]}
            />
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
                <td className="px-5 py-4 font-black text-navy">{record.date}</td>
                <td className="px-5 py-4 text-slate-600">{record.batchName}</td>
                <td className="px-5 py-4 text-slate-600">{record.coachName ?? 'Not assigned'}</td>
                <td className="px-5 py-4 text-slate-600">{record.presentCount}</td>
                <td className="px-5 py-4 text-slate-600">{record.absentCount}</td>
                <td className="px-5 py-4 text-slate-600">{record.totalCount}</td>
                <td className="px-5 py-4 text-slate-600">{record.markedByName}</td>
                <td className="px-5 py-4 text-slate-600">{formatFirestoreDate(record.createdAt)}</td>
                <td className="px-5 py-4">
                  <button className="rounded-xl bg-blue-50 px-3 py-2 text-xs font-black text-directBlue" onClick={() => openEdit(record)} type="button">
                    View/Edit
                  </button>
                </td>
              </tr>
            ))}
          </DataTable>
        )}
      </section>

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
