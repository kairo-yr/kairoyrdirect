import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { Eye, FileText, Plus, Save, Trash2 } from 'lucide-react';
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
import { attendanceStatusLabels, classReportStatusLabels, levelLabels, performanceLabels } from '../data/mockData';
import { useAppData } from '../hooks/useAppData';
import type { AttendanceRecord, ClassReport, ClassReportStatus, StudentPerformance, StudentReportNote } from '../types';
import { attendanceStyles, levelStyles, statusStyles } from '../utils/badgeStyles';

const today = new Date().toISOString().slice(0, 10);

type ReportForm = {
  batchId: string;
  date: string;
  title: string;
  topicsCovered: string;
  skillsPracticed: string;
  homework: string;
  generalNotes: string;
  status: ClassReportStatus;
  studentNotes: StudentReportNote[];
};

const initialForm: ReportForm = {
  batchId: '',
  date: today,
  title: '',
  topicsCovered: '',
  skillsPracticed: '',
  homework: '',
  generalNotes: '',
  status: 'draft',
  studentNotes: [],
};

const splitTags = (value: string) => value.split(',').map((item) => item.trim()).filter(Boolean);
const joinTags = (values: string[]) => values.join(', ');

const getAttendanceSummary = (record?: AttendanceRecord) => {
  if (!record) return null;
  const present = record.entries.filter((entry) => entry.status === 'present').length;
  const absent = record.entries.filter((entry) => entry.status === 'absent').length;
  const late = record.entries.filter((entry) => entry.status === 'late').length;
  const excused = record.entries.filter((entry) => entry.status === 'excused').length;
  const total = record.entries.length;
  return {
    present,
    absent,
    late,
    excused,
    total,
    percentage: total === 0 ? null : Math.round(((present + late) / total) * 100),
  };
};

function getDefaultPerformance(record: AttendanceRecord | undefined, studentId: string): StudentPerformance {
  const entry = record?.entries.find((item) => item.studentId === studentId);
  if (!entry) return 'not_observed';
  if (entry.status === 'absent') return 'absent';
  return 'good';
}

function reportToForm(report: ClassReport): ReportForm {
  return {
    batchId: report.batchId,
    date: report.date,
    title: report.title,
    topicsCovered: joinTags(report.topicsCovered),
    skillsPracticed: joinTags(report.skillsPracticed),
    homework: report.homework,
    generalNotes: report.generalNotes,
    status: report.status,
    studentNotes: report.studentNotes,
  };
}

export function ReportsPage() {
  const {
    batches,
    classReports,
    students,
    addClassReport,
    updateClassReport,
    deleteClassReport,
    getAttendanceRecord,
    getBatchName,
    getClassReport,
    getCoachName,
    getReportAttendanceSummary,
    getStudentsByBatch,
  } = useAppData();
  const [form, setForm] = useState<ReportForm>(initialForm);
  const [savedMessage, setSavedMessage] = useState('');
  const [detailReport, setDetailReport] = useState<ClassReport | null>(null);
  const [query, setQuery] = useState('');
  const [batchFilter, setBatchFilter] = useState('all');
  const [coachFilter, setCoachFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');

  const selectedBatch = batches.find((batch) => batch.id === form.batchId);
  const batchStudents = useMemo(() => (form.batchId ? getStudentsByBatch(form.batchId) : []), [form.batchId, getStudentsByBatch, students]);
  const attendanceRecord = form.batchId && form.date ? getAttendanceRecord(form.batchId, form.date) : undefined;
  const attendanceSummary = getAttendanceSummary(attendanceRecord);
  const existingReport = form.batchId && form.date ? getClassReport(form.batchId, form.date) : undefined;
  const history = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    return [...classReports]
      .filter((report) => {
        const haystack = [
          report.title,
          report.date,
          getBatchName(report.batchId),
          getCoachName(report.coachId),
          report.homework,
          report.generalNotes,
          report.topicsCovered.join(' '),
          report.skillsPracticed.join(' '),
        ]
          .join(' ')
          .toLowerCase();
        const matchesSearch = !normalizedQuery || haystack.includes(normalizedQuery);
        const matchesBatch = batchFilter === 'all' || report.batchId === batchFilter;
        const matchesCoach = coachFilter === 'all' || report.coachId === coachFilter;
        const matchesStatus = statusFilter === 'all' || report.status === statusFilter;
        return matchesSearch && matchesBatch && matchesCoach && matchesStatus;
      })
      .sort((a, b) => `${b.date}-${b.updatedAt}`.localeCompare(`${a.date}-${a.updatedAt}`));
  }, [batchFilter, classReports, coachFilter, getBatchName, getCoachName, query, statusFilter]);

  const reportStats = [
    { label: 'Total Reports', value: String(classReports.length), helper: 'Saved locally' },
    { label: 'Draft Reports', value: String(classReports.filter((report) => report.status === 'draft').length), helper: 'Need review' },
    { label: 'Completed', value: String(classReports.filter((report) => report.status === 'completed').length), helper: 'Ready to share' },
    { label: 'Shared', value: String(classReports.filter((report) => report.status === 'shared').length), helper: 'Parent-ready' },
  ];

  useEffect(() => {
    if (!form.batchId || !form.date) {
      return;
    }

    if (existingReport) {
      setForm(reportToForm(existingReport));
      return;
    }

    const suggestedTitle = `Class Report - ${getBatchName(form.batchId)} - ${form.date}`;
    setForm((current) => ({
      ...current,
      title: current.title && !current.title.startsWith('Class Report -') ? current.title : suggestedTitle,
      studentNotes: batchStudents.map((student) => ({
        studentId: student.id,
        note: '',
        performance: getDefaultPerformance(attendanceRecord, student.id),
      })),
    }));
  }, [attendanceRecord, batchStudents, existingReport, form.batchId, form.date, getBatchName]);

  const updateField = (field: keyof ReportForm, value: string) => {
    setSavedMessage('');
    setForm((current) => ({ ...current, [field]: value }));
  };

  const updateStudentNote = (studentId: string, field: 'performance' | 'note', value: string) => {
    setSavedMessage('');
    setForm((current) => ({
      ...current,
      studentNotes: current.studentNotes.some((note) => note.studentId === studentId)
        ? current.studentNotes.map((note) =>
          note.studentId === studentId ? { ...note, [field]: field === 'performance' ? value as StudentPerformance : value } : note,
        )
        : [
          ...current.studentNotes,
          {
            studentId,
            performance: field === 'performance' ? value as StudentPerformance : getDefaultPerformance(attendanceRecord, studentId),
            note: field === 'note' ? value : '',
          },
        ],
    }));
  };

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const topicsCovered = splitTags(form.topicsCovered);
    const skillsPracticed = splitTags(form.skillsPracticed);

    if (!form.batchId || !form.date) {
      alert('Batch and date are required.');
      return;
    }
    if (!selectedBatch) {
      alert('Selected batch is no longer available.');
      return;
    }
    if (!form.title.trim()) {
      alert('Report title is required.');
      return;
    }
    if (topicsCovered.length === 0) {
      alert('Add at least one topic covered.');
      return;
    }

    const payload = {
      batchId: form.batchId,
      coachId: selectedBatch.coachId,
      date: form.date,
      title: form.title.trim(),
      topicsCovered,
      skillsPracticed,
      homework: form.homework.trim(),
      generalNotes: form.generalNotes.trim(),
      studentNotes: form.studentNotes.map((note) => ({ ...note, note: note.note.trim() })),
      attendanceRecordId: attendanceRecord?.id,
      status: form.status,
    };

    if (existingReport) {
      updateClassReport(existingReport.id, payload);
      setSavedMessage('Class report updated locally.');
    } else {
      addClassReport(payload);
      setSavedMessage('Class report saved locally.');
    }
  };

  const loadReport = (report: ClassReport) => {
    setForm(reportToForm(report));
    setSavedMessage('Loaded report for editing.');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleDelete = (report: ClassReport) => {
    if (window.confirm(`Delete report "${report.title}"?`)) {
      deleteClassReport(report.id);
      if (report.batchId === form.batchId && report.date === form.date) {
        setForm((current) => ({ ...current, title: '', topicsCovered: '', skillsPracticed: '', homework: '', generalNotes: '', status: 'draft' }));
      }
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Class Reports"
        description="Record what was taught, homework given, and student progress after each class."
        action={<div className="flex flex-wrap gap-2"><RoadmapBadge status="Phase 4" /><button className="inline-flex items-center gap-2 rounded-2xl bg-directBlue px-4 py-3 text-sm font-black text-white" onClick={() => setForm(initialForm)}><Plus size={18} /> Create Report</button></div>}
      />

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {reportStats.map((stat) => (
          <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-card" key={stat.label}>
            <div className="text-sm font-black uppercase tracking-wide text-slate-400">{stat.label}</div>
            <div className="mt-3 text-3xl font-black text-navy">{stat.value}</div>
            <div className="mt-1 text-sm font-semibold text-slate-500">{stat.helper}</div>
          </div>
        ))}
      </div>

      <form className="rounded-3xl border border-slate-200 bg-white p-6 shadow-card" onSubmit={handleSubmit}>
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h2 className="text-xl font-black text-navy">{existingReport ? 'Edit Class Report' : 'Create Class Report'}</h2>
            <p className="mt-1 text-sm leading-6 text-slate-500">Reports are batch-based and connect to attendance when a matching record exists.</p>
          </div>
          {savedMessage ? <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-black text-emerald-700">{savedMessage}</span> : null}
        </div>

        <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <FormSelect
            label="Batch"
            value={form.batchId}
            onChange={(event) => updateField('batchId', event.target.value)}
            options={[{ label: 'Select batch', value: '' }, ...batches.map((batch) => ({ label: batch.name, value: batch.id }))]}
          />
          <FormInput label="Class date" type="date" value={form.date} onChange={(event) => updateField('date', event.target.value)} />
          <FormSelect
            label="Status"
            value={form.status}
            onChange={(event) => updateField('status', event.target.value)}
            options={Object.entries(classReportStatusLabels).map(([value, label]) => ({ value, label }))}
          />
          <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
            <div className="text-xs font-black uppercase tracking-wide text-slate-400">Coach</div>
            <div className="mt-1 text-sm font-black text-navy">{getCoachName(selectedBatch?.coachId)}</div>
          </div>
        </div>

        <div className="mt-4 rounded-2xl border border-blue-100 bg-blue-50 p-4">
          <div className="text-sm font-black text-navy">Attendance Summary</div>
          {attendanceSummary ? (
            <div className="mt-3 flex flex-wrap gap-2">
              <Badge className={attendanceStyles.present}>Present {attendanceSummary.present}</Badge>
              <Badge className={attendanceStyles.absent}>Absent {attendanceSummary.absent}</Badge>
              <Badge className={attendanceStyles.late}>Late {attendanceSummary.late}</Badge>
              <Badge className={attendanceStyles.excused}>Excused {attendanceSummary.excused}</Badge>
              <Badge className={statusStyles.completed}>{attendanceSummary.percentage ?? 0}% attendance</Badge>
            </div>
          ) : (
            <p className="mt-1 text-sm font-semibold text-slate-600">No attendance record found for this batch/date yet.</p>
          )}
        </div>

        <div className="mt-6 grid gap-4">
          <FormInput label="Title" value={form.title} onChange={(event) => updateField('title', event.target.value)} />
          <FormInput label="Topics covered" value={form.topicsCovered} placeholder="Opening principles, Fork tactic" onChange={(event) => updateField('topicsCovered', event.target.value)} />
          <FormInput label="Skills practiced" value={form.skillsPracticed} placeholder="Calculation, Board vision" onChange={(event) => updateField('skillsPracticed', event.target.value)} />
          <label className="grid gap-2 text-sm font-bold text-slate-700">
            Homework
            <textarea className="min-h-24 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-navy outline-none transition focus:border-directBlue focus:ring-4 focus:ring-blue-100" value={form.homework} onChange={(event) => updateField('homework', event.target.value)} />
          </label>
          <label className="grid gap-2 text-sm font-bold text-slate-700">
            General coach notes
            <textarea className="min-h-28 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-navy outline-none transition focus:border-directBlue focus:ring-4 focus:ring-blue-100" value={form.generalNotes} onChange={(event) => updateField('generalNotes', event.target.value)} />
          </label>
        </div>

        <div className="mt-6">
          <h3 className="text-lg font-black text-navy">Student Notes</h3>
          <div className="mt-3 grid gap-3">
            {!form.batchId ? (
              <EmptyState title="Select a batch" description="Choose a batch to add student-specific report notes." />
            ) : batchStudents.length === 0 ? (
              <EmptyState title="No students in this batch" description="Assign students to this batch before adding student-specific notes." />
            ) : batchStudents.map((student) => {
              const note = form.studentNotes.find((item) => item.studentId === student.id) ?? {
                studentId: student.id,
                note: '',
                performance: getDefaultPerformance(attendanceRecord, student.id),
              };
              const attendanceEntry = attendanceRecord?.entries.find((entry) => entry.studentId === student.id);
              return (
                <div className="grid gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-4 lg:grid-cols-[1.1fr_190px_1fr]" key={student.id}>
                  <div>
                    <div className="font-black text-navy">{student.name}</div>
                    <div className="mt-1 flex flex-wrap items-center gap-2">
                      <Badge className={levelStyles[student.level]}>{levelLabels[student.level]}</Badge>
                      {attendanceEntry ? <Badge className={attendanceStyles[attendanceEntry.status]}>{attendanceStatusLabels[attendanceEntry.status]}</Badge> : <span className="text-sm font-semibold text-slate-500">No attendance</span>}
                    </div>
                  </div>
                  <FormSelect
                    label="Performance"
                    value={note.performance}
                    onChange={(event) => updateStudentNote(student.id, 'performance', event.target.value)}
                    options={Object.entries(performanceLabels).map(([value, label]) => ({ value, label }))}
                  />
                  <FormInput label="Note" value={note.note} placeholder="Optional" onChange={(event) => updateStudentNote(student.id, 'note', event.target.value)} />
                </div>
              );
            })}
          </div>
        </div>

        <div className="mt-6 flex justify-end">
          <button className="inline-flex items-center gap-2 rounded-2xl bg-directBlue px-5 py-3 text-sm font-black text-white shadow-card" type="submit">
            <Save size={18} />
            {existingReport ? 'Update Report' : 'Save Report'}
          </button>
        </div>
      </form>

      <section>
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-xl font-black text-navy">Report History</h2>
          <div className="inline-flex items-center gap-2 text-sm font-bold text-slate-500"><FileText size={17} /> {history.length} reports</div>
        </div>
        <div className="mb-4 grid gap-3 rounded-3xl border border-slate-200 bg-white p-4 shadow-card lg:grid-cols-[1fr_auto_auto_auto]">
          <SearchInput value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search title, topic, homework, batch, or coach" />
          <FilterSelect
            value={batchFilter}
            onChange={(event) => setBatchFilter(event.target.value)}
            options={[{ label: 'All batches', value: 'all' }, ...batches.map((batch) => ({ label: batch.name, value: batch.id }))]}
          />
          <FilterSelect
            value={coachFilter}
            onChange={(event) => setCoachFilter(event.target.value)}
            options={[{ label: 'All coaches', value: 'all' }, ...Array.from(new Map(batches.map((batch) => [batch.coachId, getCoachName(batch.coachId)])).entries()).map(([value, label]) => ({ value, label }))]}
          />
          <FilterSelect
            value={statusFilter}
            onChange={(event) => setStatusFilter(event.target.value)}
            options={[{ label: 'All status', value: 'all' }, ...Object.entries(classReportStatusLabels).map(([value, label]) => ({ value, label }))]}
          />
        </div>
        {history.length === 0 ? (
          <EmptyState title="No class reports found" description="Create a report or adjust the report history filters." />
        ) : (
          <DataTable columns={['Date', 'Batch', 'Coach', 'Title', 'Topics', 'Homework', 'Attendance', 'Status', 'Actions']}>
            {history.map((report) => {
              const reportAttendance = getReportAttendanceSummary(report.id);
              return (
                <tr className="border-t border-slate-100" key={report.id}>
                  <td className="px-5 py-4 font-black text-navy">{report.date}</td>
                  <td className="px-5 py-4 text-slate-600">{getBatchName(report.batchId)}</td>
                  <td className="px-5 py-4 text-slate-600">{getCoachName(report.coachId)}</td>
                  <td className="px-5 py-4 font-bold text-navy">{report.title}</td>
                  <td className="px-5 py-4 text-slate-600">{report.topicsCovered.length}</td>
                  <td className="max-w-xs truncate px-5 py-4 text-slate-600">{report.homework || 'Optional'}</td>
                  <td className="px-5 py-4 text-slate-600">{reportAttendance?.percentage === null || !reportAttendance ? 'No data' : `${reportAttendance.percentage}%`}</td>
                  <td className="px-5 py-4"><Badge className={statusStyles[report.status]}>{classReportStatusLabels[report.status]}</Badge></td>
                  <td className="px-5 py-4">
                    <div className="flex gap-2">
                      <button className="rounded-xl border border-slate-200 p-2 text-slate-600 hover:bg-slate-50" onClick={() => setDetailReport(report)} type="button" aria-label="View report details">
                        <Eye size={16} />
                      </button>
                      <button className="rounded-xl border border-slate-200 p-2 text-slate-600 hover:bg-slate-50" onClick={() => loadReport(report)} type="button" aria-label="Edit report">
                        <FileText size={16} />
                      </button>
                      <button className="rounded-xl border border-rose-100 p-2 text-rose-600 hover:bg-rose-50" onClick={() => handleDelete(report)} type="button" aria-label="Delete report">
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </DataTable>
        )}
      </section>

      <Modal title={detailReport?.title ?? 'Report Details'} open={Boolean(detailReport)} onClose={() => setDetailReport(null)}>
        {detailReport ? (
          <div className="space-y-5">
            <div className="flex flex-wrap gap-2">
              <Badge className={statusStyles[detailReport.status]}>{classReportStatusLabels[detailReport.status]}</Badge>
              <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-600">{detailReport.date}</span>
              <span className="rounded-full bg-blue-50 px-3 py-1 text-xs font-bold text-directBlue">{getBatchName(detailReport.batchId)}</span>
              <span className="rounded-full bg-amber-50 px-3 py-1 text-xs font-bold text-directGold">{getCoachName(detailReport.coachId)}</span>
            </div>
            <div className="rounded-2xl bg-slate-50 p-4">
              <div className="text-sm font-black text-navy">Attendance</div>
              {getReportAttendanceSummary(detailReport.id) ? (
                <p className="mt-1 text-sm font-semibold text-slate-600">{getReportAttendanceSummary(detailReport.id)?.percentage}% attendance across {getReportAttendanceSummary(detailReport.id)?.total} students.</p>
              ) : (
                <p className="mt-1 text-sm font-semibold text-slate-600">No linked attendance record.</p>
              )}
            </div>
            <div>
              <h3 className="text-sm font-black uppercase tracking-wide text-slate-400">Topics Covered</h3>
              <div className="mt-2 flex flex-wrap gap-2">{detailReport.topicsCovered.map((topic) => <Badge className="bg-blue-50 text-blue-700 ring-blue-100" key={topic}>{topic}</Badge>)}</div>
            </div>
            <div>
              <h3 className="text-sm font-black uppercase tracking-wide text-slate-400">Skills Practiced</h3>
              <div className="mt-2 flex flex-wrap gap-2">{detailReport.skillsPracticed.map((skill) => <Badge className="bg-amber-50 text-amber-700 ring-amber-100" key={skill}>{skill}</Badge>)}</div>
            </div>
            <div>
              <h3 className="text-sm font-black uppercase tracking-wide text-slate-400">Homework</h3>
              <p className="mt-2 text-sm leading-6 text-slate-700">{detailReport.homework || 'No homework added.'}</p>
            </div>
            <div>
              <h3 className="text-sm font-black uppercase tracking-wide text-slate-400">General Notes</h3>
              <p className="mt-2 text-sm leading-6 text-slate-700">{detailReport.generalNotes || 'No general notes added.'}</p>
            </div>
            <div>
              <h3 className="text-sm font-black uppercase tracking-wide text-slate-400">Student Notes</h3>
              <div className="mt-3 grid gap-3">
                {detailReport.studentNotes.length === 0 ? (
                  <EmptyState title="No student notes" description="This report does not include student-specific notes." />
                ) : detailReport.studentNotes.map((note) => (
                  <div className="rounded-2xl bg-slate-50 p-4" key={note.studentId}>
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="font-black text-navy">{students.find((student) => student.id === note.studentId)?.name ?? 'Deleted student'}</div>
                      <Badge className={note.performance === 'absent' ? statusStyles.absent : statusStyles.completed}>{performanceLabels[note.performance]}</Badge>
                    </div>
                    <p className="mt-2 text-sm leading-6 text-slate-600">{note.note || 'No note added.'}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        ) : null}
      </Modal>
    </div>
  );
}
