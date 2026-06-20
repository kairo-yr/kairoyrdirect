import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { CalendarCheck, Edit3, Save, Trash2, UsersRound } from 'lucide-react';
import { Badge } from '../components/ui/Badge';
import { DataTable } from '../components/ui/DataTable';
import { EmptyState } from '../components/ui/EmptyState';
import { FormInput } from '../components/ui/FormInput';
import { FormSelect } from '../components/ui/FormSelect';
import { PageHeader } from '../components/ui/PageHeader';
import { RoadmapBadge } from '../components/ui/RoadmapBadge';
import { attendanceStatusLabels, levelLabels, recordStatusLabels } from '../data/mockData';
import { useAppData } from '../hooks/useAppData';
import type { AttendanceEntry, AttendanceRecord, AttendanceStatus } from '../types';
import { attendanceStyles, levelStyles, statusStyles } from '../utils/badgeStyles';

const today = new Date().toISOString().slice(0, 10);

const countEntries = (record: AttendanceRecord, status: AttendanceStatus) =>
  record.entries.filter((entry) => entry.status === status).length;

const getPercentage = (record: AttendanceRecord) => {
  if (record.entries.length === 0) return 0;
  const attended = countEntries(record, 'present') + countEntries(record, 'late');
  return Math.round((attended / record.entries.length) * 100);
};

export function AttendancePage() {
  const {
    attendanceRecords,
    batches,
    students,
    addAttendanceRecord,
    updateAttendanceRecord,
    deleteAttendanceRecord,
    getAttendanceRecord,
    getAttendanceSummaryForDate,
    getBatchName,
    getCoachName,
    getStudentsByBatch,
  } = useAppData();
  const [selectedBatchId, setSelectedBatchId] = useState('');
  const [selectedDate, setSelectedDate] = useState(today);
  const [entries, setEntries] = useState<AttendanceEntry[]>([]);
  const [status, setStatus] = useState<'completed' | 'draft'>('completed');
  const [savedMessage, setSavedMessage] = useState('');

  const selectedBatch = batches.find((batch) => batch.id === selectedBatchId);
  const batchStudents = useMemo(() => (selectedBatchId ? getStudentsByBatch(selectedBatchId) : []), [getStudentsByBatch, selectedBatchId, students]);
  const existingRecord = selectedBatchId && selectedDate ? getAttendanceRecord(selectedBatchId, selectedDate) : undefined;
  const summary = getAttendanceSummaryForDate(today);

  useEffect(() => {
    if (!selectedBatchId || !selectedDate) {
      setEntries([]);
      return;
    }

    if (existingRecord) {
      setEntries(
        batchStudents.map((student) => existingRecord.entries.find((entry) => entry.studentId === student.id) ?? { studentId: student.id, status: 'present' }),
      );
      setStatus(existingRecord.status);
      return;
    }

    setEntries(batchStudents.map((student) => ({ studentId: student.id, status: 'present' })));
    setStatus('completed');
  }, [batchStudents, existingRecord, selectedBatchId, selectedDate]);

  const history = useMemo(
    () => [...attendanceRecords].sort((a, b) => `${b.date}-${b.updatedAt}`.localeCompare(`${a.date}-${a.updatedAt}`)),
    [attendanceRecords],
  );

  const averageAttendance = useMemo(() => {
    const totalEntries = attendanceRecords.reduce((total, record) => total + record.entries.length, 0);
    if (totalEntries === 0) return null;
    const attended = attendanceRecords.reduce(
      (total, record) => total + record.entries.filter((entry) => entry.status === 'present' || entry.status === 'late').length,
      0,
    );
    return Math.round((attended / totalEntries) * 100);
  }, [attendanceRecords]);

  const updateEntry = (studentId: string, field: 'status' | 'note', value: string) => {
    setSavedMessage('');
    setEntries((current) =>
      current.map((entry) => (entry.studentId === studentId ? { ...entry, [field]: field === 'status' ? value as AttendanceStatus : value } : entry)),
    );
  };

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!selectedBatchId || !selectedDate) {
      alert('Select a batch and date before saving attendance.');
      return;
    }
    if (!selectedBatch) {
      alert('The selected batch is no longer available.');
      return;
    }
    if (batchStudents.length === 0) {
      alert('Cannot save attendance because this batch has no students.');
      return;
    }
    if (entries.some((entry) => !entry.status)) {
      alert('Every student needs an attendance status.');
      return;
    }

    const payload = {
      batchId: selectedBatchId,
      coachId: selectedBatch.coachId,
      date: selectedDate,
      entries: entries.map((entry) => ({ ...entry, note: entry.note?.trim() || undefined })),
      status,
    };

    if (existingRecord) {
      updateAttendanceRecord(existingRecord.id, payload);
      setSavedMessage('Attendance updated locally.');
    } else {
      addAttendanceRecord(payload);
      setSavedMessage('Attendance saved locally.');
    }
  };

  const loadRecord = (record: AttendanceRecord) => {
    setSelectedBatchId(record.batchId);
    setSelectedDate(record.date);
    setSavedMessage('Loaded attendance record for editing.');
  };

  const handleDelete = (record: AttendanceRecord) => {
    if (window.confirm(`Delete attendance for ${getBatchName(record.batchId)} on ${record.date}?`)) {
      deleteAttendanceRecord(record.id);
      if (record.batchId === selectedBatchId && record.date === selectedDate) {
        setEntries(batchStudents.map((student) => ({ studentId: student.id, status: 'present' })));
      }
    }
  };

  const summaryCards = [
    { label: 'Records Today', value: String(summary.records), helper: 'Saved batch records' },
    { label: 'Present Today', value: String(summary.present), helper: 'Present entries' },
    { label: 'Absent Today', value: String(summary.absent), helper: 'Absent entries' },
    { label: 'Late Today', value: String(summary.late), helper: 'Late arrivals' },
    { label: 'Average Attendance', value: averageAttendance === null ? 'No data' : `${averageAttendance}%`, helper: 'Across all saved records' },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Attendance"
        description="Mark and review student attendance by batch and date."
        action={<RoadmapBadge status="Phase 2" />}
      />

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
        {summaryCards.map((card) => (
          <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-card" key={card.label}>
            <div className="text-sm font-black uppercase tracking-wide text-slate-400">{card.label}</div>
            <div className="mt-3 text-3xl font-black text-navy">{card.value}</div>
            <div className="mt-1 text-sm font-semibold text-slate-500">{card.helper}</div>
          </div>
        ))}
      </div>

      <form className="rounded-3xl border border-slate-200 bg-white p-6 shadow-card" onSubmit={handleSubmit}>
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h2 className="text-xl font-black text-navy">Mark Attendance</h2>
            <p className="mt-1 text-sm leading-6 text-slate-500">Select a batch and date, then mark every assigned student.</p>
          </div>
          {savedMessage ? <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-black text-emerald-700">{savedMessage}</span> : null}
        </div>

        <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <FormSelect
            label="Batch"
            value={selectedBatchId}
            onChange={(event) => {
              setSavedMessage('');
              setSelectedBatchId(event.target.value);
            }}
            options={[{ label: 'Select batch', value: '' }, ...batches.map((batch) => ({ label: batch.name, value: batch.id }))]}
          />
          <FormInput
            label="Date"
            type="date"
            value={selectedDate}
            onChange={(event) => {
              setSavedMessage('');
              setSelectedDate(event.target.value);
            }}
          />
          <FormSelect
            label="Record status"
            value={status}
            onChange={(event) => setStatus(event.target.value as 'completed' | 'draft')}
            options={[
              { label: 'Completed', value: 'completed' },
              { label: 'Draft', value: 'draft' },
            ]}
          />
          <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
            <div className="text-xs font-black uppercase tracking-wide text-slate-400">Coach</div>
            <div className="mt-1 text-sm font-black text-navy">{getCoachName(selectedBatch?.coachId)}</div>
          </div>
        </div>

        {selectedBatch ? (
          <div className="mt-4 flex flex-wrap gap-2 text-sm font-bold text-slate-600">
            <span className="rounded-full bg-blue-50 px-3 py-1 text-directBlue">{selectedBatch.scheduleDays.join(', ')}</span>
            <span className="rounded-full bg-slate-100 px-3 py-1">{selectedBatch.startTime} - {selectedBatch.endTime}</span>
            <span className="rounded-full bg-slate-100 px-3 py-1">{batchStudents.length} students</span>
          </div>
        ) : null}

        <div className="mt-6">
          {!selectedBatchId ? (
            <EmptyState title="Select a batch" description="Choose a batch and date to load assigned students for attendance." />
          ) : batchStudents.length === 0 ? (
            <EmptyState title="No students assigned to this batch" description="Assign students to this batch from the Students page before marking attendance." />
          ) : (
            <div className="grid gap-3">
              {batchStudents.map((student) => {
                const entry = entries.find((item) => item.studentId === student.id) ?? { studentId: student.id, status: 'present' };
                return (
                  <div className="grid gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-4 lg:grid-cols-[1.2fr_180px_1fr]" key={student.id}>
                    <div>
                      <div className="font-black text-navy">{student.name}</div>
                      <div className="mt-1 flex flex-wrap items-center gap-2 text-sm text-slate-500">
                        <Badge className={levelStyles[student.level]}>{levelLabels[student.level]}</Badge>
                        <span>{student.parentName || getBatchName(student.batchId)}</span>
                      </div>
                    </div>
                    <FormSelect
                      label="Status"
                      value={entry.status}
                      onChange={(event) => updateEntry(student.id, 'status', event.target.value)}
                      options={Object.entries(attendanceStatusLabels).map(([value, label]) => ({ value, label }))}
                    />
                    <FormInput
                      label="Note"
                      value={entry.note ?? ''}
                      placeholder="Optional"
                      onChange={(event) => updateEntry(student.id, 'note', event.target.value)}
                    />
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div className="mt-6 flex justify-end">
          <button className="inline-flex items-center gap-2 rounded-2xl bg-directBlue px-5 py-3 text-sm font-black text-white shadow-card" type="submit">
            <Save size={18} />
            {existingRecord ? 'Update Attendance' : 'Save Attendance'}
          </button>
        </div>
      </form>

      <section>
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-xl font-black text-navy">Attendance History</h2>
          <div className="inline-flex items-center gap-2 text-sm font-bold text-slate-500"><CalendarCheck size={17} /> {history.length} records</div>
        </div>
        {history.length === 0 ? (
          <EmptyState title="No attendance records yet" description="Saved attendance records will appear here for review and editing." />
        ) : (
          <DataTable columns={['Date', 'Batch', 'Coach', 'Present', 'Absent', 'Late', 'Excused', 'Attendance', 'Status', 'Actions']}>
            {history.map((record) => (
              <tr className="border-t border-slate-100" key={record.id}>
                <td className="px-5 py-4 font-black text-navy">{record.date}</td>
                <td className="px-5 py-4 text-slate-600">{getBatchName(record.batchId)}</td>
                <td className="px-5 py-4 text-slate-600">{getCoachName(record.coachId)}</td>
                <td className="px-5 py-4"><Badge className={attendanceStyles.present}>{countEntries(record, 'present')}</Badge></td>
                <td className="px-5 py-4"><Badge className={attendanceStyles.absent}>{countEntries(record, 'absent')}</Badge></td>
                <td className="px-5 py-4"><Badge className={attendanceStyles.late}>{countEntries(record, 'late')}</Badge></td>
                <td className="px-5 py-4"><Badge className={attendanceStyles.excused}>{countEntries(record, 'excused')}</Badge></td>
                <td className="px-5 py-4 text-slate-600">{getPercentage(record)}%</td>
                <td className="px-5 py-4"><Badge className={statusStyles[record.status]}>{recordStatusLabels[record.status]}</Badge></td>
                <td className="px-5 py-4">
                  <div className="flex gap-2">
                    <button className="rounded-xl border border-slate-200 p-2 text-slate-600 hover:bg-slate-50" onClick={() => loadRecord(record)} type="button" aria-label="View or edit attendance">
                      <Edit3 size={16} />
                    </button>
                    <button className="rounded-xl border border-rose-100 p-2 text-rose-600 hover:bg-rose-50" onClick={() => handleDelete(record)} type="button" aria-label="Delete attendance">
                      <Trash2 size={16} />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </DataTable>
        )}
      </section>

      <div className="rounded-3xl border border-blue-100 bg-blue-50 p-5 text-sm font-semibold leading-6 text-slate-700">
        <div className="flex items-center gap-2 font-black text-navy"><UsersRound size={18} /> Phase 3 rule</div>
        <p className="mt-2">Attendance is stored by batch and date. Students moved later will not break older records because each saved record keeps its own student-wise entries.</p>
      </div>
    </div>
  );
}
