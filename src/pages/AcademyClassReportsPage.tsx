import { useEffect, useMemo, useState } from 'react';
import { collection, doc, getDoc, getDocs, query, serverTimestamp, setDoc, updateDoc, where } from 'firebase/firestore';
import { Edit, Eye, FileText, Save } from 'lucide-react';
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

type ReportMode = 'academy' | 'coach';
type ReportStatus = 'draft' | 'submitted';
type PerformanceTag = 'excellent' | 'good' | 'needs_attention' | 'not_reviewed';

type BatchRecord = {
  id: string;
  name: string;
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

type AttendanceRecord = {
  id: string;
  batchId: string;
  date: string;
  students?: Array<{ studentId: string; studentName: string; status: 'present' | 'absent'; note?: string }>;
};

type StudentReportNote = {
  studentId: string;
  studentName: string;
  note: string;
  performanceTag: PerformanceTag;
};

type ClassReportRecord = {
  id: string;
  academyId: string;
  batchId: string;
  batchName: string;
  coachId: string | null;
  coachName: string | null;
  date: string;
  attendanceId: string | null;
  title: string;
  topicCovered: string;
  classSummary: string;
  homeworkGiven: string;
  nextClassPlan: string;
  studentPerformanceNotes: string;
  studentsPresentIds: string[];
  studentsAbsentIds: string[];
  studentNotes: StudentReportNote[];
  status: ReportStatus;
  createdByUid: string;
  createdByName: string;
  createdByRole: 'academy_admin' | 'coach';
  updatedByUid: string | null;
  updatedByName: string | null;
  createdAt: unknown;
  updatedAt: unknown;
};

type ReportForm = {
  title: string;
  topicCovered: string;
  classSummary: string;
  homeworkGiven: string;
  nextClassPlan: string;
  studentPerformanceNotes: string;
  studentNotes: StudentReportNote[];
};

const emptyForm: ReportForm = {
  title: '',
  topicCovered: '',
  classSummary: '',
  homeworkGiven: '',
  nextClassPlan: '',
  studentPerformanceNotes: '',
  studentNotes: [],
};

function getTodayDate() {
  const date = new Date();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${date.getFullYear()}-${month}-${day}`;
}

function buildStudentNotes(batch: BatchRecord | undefined, studentsById: Map<string, StudentRecord>): StudentReportNote[] {
  if (!batch) return [];
  return batch.studentIds
    .map((studentId) => studentsById.get(studentId))
    .filter((student): student is StudentRecord => Boolean(student))
    .map((student) => ({
      studentId: student.id,
      studentName: student.name || 'Unnamed student',
      note: '',
      performanceTag: 'not_reviewed',
    }));
}

function notesFromReport(report: ClassReportRecord): ReportForm {
  return {
    title: report.title,
    topicCovered: report.topicCovered,
    classSummary: report.classSummary,
    homeworkGiven: report.homeworkGiven,
    nextClassPlan: report.nextClassPlan,
    studentPerformanceNotes: report.studentPerformanceNotes,
    studentNotes: report.studentNotes ?? [],
  };
}

function ClassReportsSystemPage({ mode }: { mode: ReportMode }) {
  const { userProfile } = useAuth();
  const academyId = userProfile?.academyId;
  const linkedCoachId = userProfile?.linkedCoachId;
  const isCoachMode = mode === 'coach';
  const [batches, setBatches] = useState<BatchRecord[]>([]);
  const [studentsById, setStudentsById] = useState<Map<string, StudentRecord>>(new Map());
  const [attendanceRecords, setAttendanceRecords] = useState<AttendanceRecord[]>([]);
  const [reports, setReports] = useState<ClassReportRecord[]>([]);
  const [selectedDate, setSelectedDate] = useState(getTodayDate());
  const [selectedBatchId, setSelectedBatchId] = useState('');
  const [form, setForm] = useState<ReportForm>(emptyForm);
  const [filterStartDate, setFilterStartDate] = useState('');
  const [filterEndDate, setFilterEndDate] = useState('');
  const [filterBatchId, setFilterBatchId] = useState('');
  const [filterCoachId, setFilterCoachId] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [search, setSearch] = useState('');
  const [viewReport, setViewReport] = useState<ClassReportRecord | null>(null);
  const [editReport, setEditReport] = useState<ClassReportRecord | null>(null);
  const [editForm, setEditForm] = useState<ReportForm>(emptyForm);
  const [editStatus, setEditStatus] = useState<ReportStatus>('draft');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const selectedBatch = batches.find((batch) => batch.id === selectedBatchId);
  const matchingAttendance = attendanceRecords.find((record) => record.batchId === selectedBatchId && record.date === selectedDate);
  const existingReport = reports.find((report) => report.batchId === selectedBatchId && report.date === selectedDate);
  const studentsPresentIds = matchingAttendance?.students?.filter((student) => student.status === 'present').map((student) => student.studentId) ?? [];
  const studentsAbsentIds = matchingAttendance?.students?.filter((student) => student.status === 'absent').map((student) => student.studentId) ?? [];

  const loadReports = async (currentBatches: BatchRecord[]) => {
    if (!academyId) return;
    const reportSnapshot = isCoachMode && linkedCoachId
      ? await getDocs(query(collection(db, 'academies', academyId, 'classReports'), where('coachId', '==', linkedCoachId)))
      : await getDocs(collection(db, 'academies', academyId, 'classReports'));
    const assignedBatchIds = new Set(currentBatches.map((batch) => batch.id));
    const loadedReports = reportSnapshot.docs
      .map((docSnap) => ({ id: docSnap.id, ...docSnap.data() }) as ClassReportRecord)
      .filter((report) => !isCoachMode || report.coachId === linkedCoachId || assignedBatchIds.has(report.batchId))
      .sort((a, b) => b.date.localeCompare(a.date));
    setReports(loadedReports);
  };

  useEffect(() => {
    const loadPage = async () => {
      if (!academyId || (isCoachMode && !linkedCoachId)) {
        setLoading(false);
        return;
      }
      setLoading(true);
      try {
        const [batchSnapshot, attendanceSnapshot] = await Promise.all([
          isCoachMode && linkedCoachId
            ? getDocs(query(collection(db, 'academies', academyId, 'batches'), where('coachId', '==', linkedCoachId)))
            : getDocs(collection(db, 'academies', academyId, 'batches')),
          isCoachMode && linkedCoachId
            ? getDocs(query(collection(db, 'academies', academyId, 'attendance'), where('coachId', '==', linkedCoachId)))
            : getDocs(collection(db, 'academies', academyId, 'attendance')),
        ]);
        const loadedBatches = batchSnapshot.docs
          .map((docSnap) => ({ id: docSnap.id, ...docSnap.data() }) as BatchRecord)
          .filter((batch) => batch.status === 'active')
          .filter((batch) => !isCoachMode || batch.coachId === linkedCoachId);
        const assignedStudentIds = new Set(loadedBatches.flatMap((batch) => batch.studentIds));
        const studentDocs = isCoachMode
          ? await Promise.all(Array.from(assignedStudentIds).map((studentId) => getDoc(doc(db, 'academies', academyId, 'students', studentId))))
          : (await getDocs(collection(db, 'academies', academyId, 'students'))).docs;
        const loadedStudents = new Map(
          studentDocs
            .filter((docSnap) => docSnap.exists())
            .map((docSnap) => ({ id: docSnap.id, ...docSnap.data() }) as StudentRecord)
            .filter((student) => student.status !== 'disabled')
            .filter((student) => !isCoachMode || assignedStudentIds.has(student.id))
            .map((student) => [student.id, student] as const),
        );
        setBatches(loadedBatches);
        setStudentsById(loadedStudents);
        setAttendanceRecords(
          attendanceSnapshot.docs
            .map((docSnap) => ({ id: docSnap.id, ...docSnap.data() }) as AttendanceRecord)
            .filter((record) => !isCoachMode || loadedBatches.some((batch) => batch.id === record.batchId)),
        );
        setSelectedBatchId((current) => current || loadedBatches[0]?.id || '');
        await loadReports(loadedBatches);
      } finally {
        setLoading(false);
      }
    };

    void loadPage();
  }, [academyId, isCoachMode, linkedCoachId]);

  useEffect(() => {
    if (!selectedBatchId) {
      setForm(emptyForm);
      return;
    }
    if (existingReport) {
      setForm(notesFromReport(existingReport));
      setMessage('Class report for this batch and date already exists. Editing existing report.');
      return;
    }
    setForm((current) => ({
      ...emptyForm,
      title: current.title && !current.title.startsWith('Class Report -') ? current.title : `Class Report - ${selectedBatch?.name ?? 'Batch'} - ${selectedDate}`,
      studentNotes: buildStudentNotes(selectedBatch, studentsById),
    }));
    setMessage(matchingAttendance ? '' : 'Attendance not marked for this batch/date yet.');
  }, [existingReport, matchingAttendance, selectedBatch, selectedBatchId, selectedDate, studentsById]);

  const coachOptions = useMemo(() => {
    const coaches = new Map<string, string>();
    batches.forEach((batch) => {
      if (batch.coachId) coaches.set(batch.coachId, batch.coachName || 'Assigned coach');
    });
    return Array.from(coaches, ([value, label]) => ({ value, label }));
  }, [batches]);

  const filteredReports = useMemo(() => {
    const normalizedSearch = search.trim().toLowerCase();
    return reports.filter((report) => {
      const matchesStart = filterStartDate ? report.date >= filterStartDate : true;
      const matchesEnd = filterEndDate ? report.date <= filterEndDate : true;
      const matchesBatch = filterBatchId ? report.batchId === filterBatchId : true;
      const matchesCoach = filterCoachId ? report.coachId === filterCoachId : true;
      const matchesStatus = filterStatus ? report.status === filterStatus : true;
      const haystack = [
        report.title,
        report.topicCovered,
        report.batchName,
        report.coachName,
        report.studentNotes.map((note) => `${note.studentName} ${note.note}`).join(' '),
      ].join(' ').toLowerCase();
      const matchesSearch = normalizedSearch ? haystack.includes(normalizedSearch) : true;
      return matchesStart && matchesEnd && matchesBatch && matchesCoach && matchesStatus && matchesSearch;
    });
  }, [filterBatchId, filterCoachId, filterEndDate, filterStartDate, filterStatus, reports, search]);

  const updateFormField = (field: keyof ReportForm, value: string) => {
    setMessage('');
    setForm((current) => ({ ...current, [field]: value }));
  };

  const updateStudentNote = (studentId: string, field: 'note' | 'performanceTag', value: string) => {
    setForm((current) => ({
      ...current,
      studentNotes: current.studentNotes.map((note) =>
        note.studentId === studentId ? { ...note, [field]: field === 'performanceTag' ? value as PerformanceTag : value } : note,
      ),
    }));
  };

  const updateEditField = (field: keyof ReportForm, value: string) => {
    setEditForm((current) => ({ ...current, [field]: value }));
  };

  const updateEditStudentNote = (studentId: string, field: 'note' | 'performanceTag', value: string) => {
    setEditForm((current) => ({
      ...current,
      studentNotes: current.studentNotes.map((note) =>
        note.studentId === studentId ? { ...note, [field]: field === 'performanceTag' ? value as PerformanceTag : value } : note,
      ),
    }));
  };

  const saveReport = async (nextStatus: ReportStatus) => {
    if (!academyId || !userProfile || !selectedBatch) return;
    if (!form.title.trim() || !form.topicCovered.trim()) {
      setError('Title and topic covered are required.');
      return;
    }
    setSaving(true);
    setError('');
    try {
      const reportId = existingReport?.id;
      const reportRef = reportId
        ? doc(db, 'academies', academyId, 'classReports', reportId)
        : doc(collection(db, 'academies', academyId, 'classReports'));
      const payload = {
        academyId,
        batchId: selectedBatch.id,
        batchName: selectedBatch.name,
        coachId: selectedBatch.coachId ?? null,
        coachName: selectedBatch.coachName ?? null,
        date: selectedDate,
        attendanceId: matchingAttendance?.id ?? null,
        title: form.title.trim(),
        topicCovered: form.topicCovered.trim(),
        classSummary: form.classSummary.trim(),
        homeworkGiven: form.homeworkGiven.trim(),
        nextClassPlan: form.nextClassPlan.trim(),
        studentPerformanceNotes: form.studentPerformanceNotes.trim(),
        studentsPresentIds,
        studentsAbsentIds,
        studentNotes: form.studentNotes.map((note) => ({ ...note, note: note.note.trim() })),
        status: nextStatus,
        updatedByUid: reportId ? userProfile.uid : null,
        updatedByName: reportId ? userProfile.name : null,
        updatedAt: serverTimestamp(),
      };
      if (reportId) {
        await updateDoc(reportRef, payload);
      } else {
        await setDoc(reportRef, {
          ...payload,
          createdByUid: userProfile.uid,
          createdByName: userProfile.name,
          createdByRole: isCoachMode ? 'coach' : 'academy_admin',
          createdAt: serverTimestamp(),
        });
      }
      const action = nextStatus === 'submitted' ? 'academy.classReport.submitted' : reportId ? 'academy.classReport.updated' : 'academy.classReport.created';
      await createAuditLog({
        actor: userProfile,
        action,
        targetType: 'classReport',
        targetId: reportRef.id,
        academyId,
        message: `${selectedBatch.name} class report ${reportId ? 'updated' : 'created'} for ${selectedDate}.`,
        metadata: {
          reportId: reportRef.id,
          batchId: selectedBatch.id,
          date: selectedDate,
          createdByUid: reportId ? existingReport?.createdByUid : userProfile.uid,
          createdByRole: reportId ? existingReport?.createdByRole : isCoachMode ? 'coach' : 'academy_admin',
        },
      });
      await loadReports(batches);
      setMessage(reportId ? 'Class report updated.' : 'Class report saved.');
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : 'Unable to save class report.');
    } finally {
      setSaving(false);
    }
  };

  const openEdit = (report: ClassReportRecord) => {
    setEditReport(report);
    setEditForm(notesFromReport(report));
    setEditStatus(report.status);
  };

  const saveEdit = async () => {
    if (!academyId || !userProfile || !editReport) return;
    setSaving(true);
    setError('');
    try {
      await updateDoc(doc(db, 'academies', academyId, 'classReports', editReport.id), {
        title: editForm.title.trim(),
        topicCovered: editForm.topicCovered.trim(),
        classSummary: editForm.classSummary.trim(),
        homeworkGiven: editForm.homeworkGiven.trim(),
        nextClassPlan: editForm.nextClassPlan.trim(),
        studentPerformanceNotes: editForm.studentPerformanceNotes.trim(),
        studentNotes: editForm.studentNotes.map((note) => ({ ...note, note: note.note.trim() })),
        status: editStatus,
        updatedByUid: userProfile.uid,
        updatedByName: userProfile.name,
        updatedAt: serverTimestamp(),
      });
      await createAuditLog({
        actor: userProfile,
        action: editStatus === 'submitted' ? 'academy.classReport.submitted' : 'academy.classReport.updated',
        targetType: 'classReport',
        targetId: editReport.id,
        academyId,
        message: `${editReport.batchName} class report updated for ${editReport.date}.`,
        metadata: {
          reportId: editReport.id,
          batchId: editReport.batchId,
          date: editReport.date,
          createdByUid: editReport.createdByUid,
          createdByRole: editReport.createdByRole,
        },
      });
      setEditReport(null);
      await loadReports(batches);
      setMessage('Class report updated.');
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : 'Unable to update class report.');
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
          <p className="text-sm font-black uppercase tracking-wide text-directBlue">Class Reports</p>
          <h1 className="mt-2 text-3xl font-black text-navy">{isCoachMode ? 'Coach Class Reports' : 'Academy Class Reports'}</h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">
            Create lesson summaries, homework notes, and student performance records connected to batch attendance.
          </p>
        </div>
        <Badge className="bg-blue-50 text-directBlue">{isCoachMode ? 'Coach scoped' : 'Academy scoped'}</Badge>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <StatCard label="Total Reports" value={loading ? '...' : String(reports.length)} helper="Class reports in scope" icon={FileText} />
        <StatCard label="Submitted" value={loading ? '...' : String(reports.filter((report) => report.status === 'submitted').length)} helper="Ready for review" icon={Eye} />
        <StatCard label="Drafts" value={loading ? '...' : String(reports.filter((report) => report.status === 'draft').length)} helper="Needs completion" icon={Edit} />
      </div>

      {error ? <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-bold text-red-700">{error}</div> : null}
      {message ? <div className="rounded-2xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm font-bold text-directBlue">{message}</div> : null}

      <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-card">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h2 className="text-xl font-black text-navy">{existingReport ? 'Edit Class Report' : 'Create Class Report'}</h2>
            <p className="mt-1 text-sm leading-6 text-slate-500">One submitted report is kept per batch and date for now.</p>
          </div>
          {existingReport ? <Badge className="bg-amber-50 text-amber-700">Existing report</Badge> : null}
        </div>

        <div className="mt-5 grid gap-4 md:grid-cols-3">
          <FormInput label="Date" type="date" value={selectedDate} onChange={(event) => setSelectedDate(event.target.value)} />
          <FormSelect
            label="Batch"
            value={selectedBatchId}
            onChange={(event) => setSelectedBatchId(event.target.value)}
            options={[{ label: batches.length ? 'Select batch' : 'No active batches', value: '' }, ...batches.map((batch) => ({ label: batch.name, value: batch.id }))]}
          />
          <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
            <div className="text-xs font-black uppercase tracking-wide text-slate-400">Coach</div>
            <div className="mt-1 text-sm font-black text-navy">{selectedBatch?.coachName ?? 'Not assigned'}</div>
          </div>
        </div>

        <div className="mt-4 rounded-2xl border border-blue-100 bg-blue-50 p-4">
          <div className="text-sm font-black text-navy">Attendance Link</div>
          {matchingAttendance ? (
            <p className="mt-1 text-sm font-semibold text-slate-600">Present {studentsPresentIds.length} · Absent {studentsAbsentIds.length}</p>
          ) : (
            <p className="mt-1 text-sm font-semibold text-slate-600">Attendance not marked for this batch/date yet.</p>
          )}
        </div>

        <div className="mt-5 grid gap-4">
          <FormInput label="Title" value={form.title} onChange={(event) => updateFormField('title', event.target.value)} />
          <FormInput label="Topic covered" value={form.topicCovered} onChange={(event) => updateFormField('topicCovered', event.target.value)} />
          {[
            ['classSummary', 'Class summary'],
            ['homeworkGiven', 'Homework given'],
            ['nextClassPlan', 'Next class plan'],
            ['studentPerformanceNotes', 'Student performance notes'],
          ].map(([field, label]) => (
            <label className="grid gap-2 text-sm font-bold text-slate-700" key={field}>
              {label}
              <textarea
                className="min-h-24 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-navy outline-none transition focus:border-directBlue focus:ring-4 focus:ring-blue-100"
                onChange={(event) => updateFormField(field as keyof ReportForm, event.target.value)}
                value={String(form[field as keyof ReportForm])}
              />
            </label>
          ))}
        </div>

        <div className="mt-6">
          <h3 className="text-lg font-black text-navy">Student Notes</h3>
          <div className="mt-3 grid gap-3">
            {!selectedBatchId ? (
              <EmptyState title="Select a batch" description="Choose a batch to add student-specific notes." />
            ) : form.studentNotes.length === 0 ? (
              <EmptyState title="No students in this batch" description="Assign students to this batch before adding student notes." />
            ) : (
              form.studentNotes.map((note) => (
                <div className="grid gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-4 lg:grid-cols-[1fr_210px_1.2fr]" key={note.studentId}>
                  <div className="font-black text-navy">{note.studentName}</div>
                  <FormSelect
                    label="Performance"
                    onChange={(event) => updateStudentNote(note.studentId, 'performanceTag', event.target.value)}
                    options={[
                      { label: 'Not reviewed', value: 'not_reviewed' },
                      { label: 'Excellent', value: 'excellent' },
                      { label: 'Good', value: 'good' },
                      { label: 'Needs attention', value: 'needs_attention' },
                    ]}
                    value={note.performanceTag}
                  />
                  <FormInput label="Note" onChange={(event) => updateStudentNote(note.studentId, 'note', event.target.value)} placeholder="Optional" value={note.note} />
                </div>
              ))
            )}
          </div>
        </div>

        <div className="mt-5 flex flex-wrap justify-end gap-3">
          <button
            aria-label="Create report draft"
            className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-5 py-3 text-sm font-black text-navy disabled:cursor-not-allowed disabled:opacity-60"
            disabled={saving || !selectedBatchId}
            onClick={() => void saveReport('draft')}
            type="button"
          >
            <Save size={16} /> Save Draft
          </button>
          <button
            aria-label="Submit report"
            className="inline-flex items-center gap-2 rounded-2xl bg-directBlue px-5 py-3 text-sm font-black text-white disabled:cursor-not-allowed disabled:opacity-60"
            disabled={saving || !selectedBatchId}
            onClick={() => void saveReport('submitted')}
            type="button"
          >
            <Save size={16} /> Submit Report
          </button>
        </div>
      </section>

      <section>
        <div className="mb-3 flex flex-wrap items-end justify-between gap-3">
          <h2 className="text-xl font-black text-navy">{isCoachMode ? 'My Class Reports' : 'Reports History'}</h2>
          <div className="grid w-full gap-3 md:grid-cols-3 xl:grid-cols-6">
            <FormInput label="Start" type="date" value={filterStartDate} onChange={(event) => setFilterStartDate(event.target.value)} />
            <FormInput label="End" type="date" value={filterEndDate} onChange={(event) => setFilterEndDate(event.target.value)} />
            <FormSelect label="Batch" value={filterBatchId} onChange={(event) => setFilterBatchId(event.target.value)} options={[{ label: 'All batches', value: '' }, ...batches.map((batch) => ({ label: batch.name, value: batch.id }))]} />
            <FormSelect label="Coach" value={filterCoachId} onChange={(event) => setFilterCoachId(event.target.value)} options={[{ label: 'All coaches', value: '' }, ...coachOptions]} disabled={isCoachMode} />
            <FormSelect
              label="Status"
              value={filterStatus}
              onChange={(event) => setFilterStatus(event.target.value)}
              options={[
                { label: 'All statuses', value: '' },
                { label: 'Draft', value: 'draft' },
                { label: 'Submitted', value: 'submitted' },
              ]}
            />
            <FormInput label="Search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Topic, title, student" />
          </div>
        </div>
        {filteredReports.length === 0 ? (
          <EmptyState title={isCoachMode ? 'No class reports created yet' : 'No class reports found'} description="Class reports will appear here after they are saved." />
        ) : (
          <DataTable columns={['Date', 'Batch', 'Coach', 'Title / Topic', 'Status', 'Present / Absent', 'Created By', 'Created', 'Actions']}>
            {filteredReports.map((report) => (
              <tr className="border-t border-slate-100" key={report.id}>
                <td className="px-5 py-4 font-black text-navy">{report.date}</td>
                <td className="px-5 py-4 text-slate-600">{report.batchName}</td>
                <td className="px-5 py-4 text-slate-600">{report.coachName ?? 'Not assigned'}</td>
                <td className="px-5 py-4 text-slate-600"><span className="font-black text-navy">{report.title}</span><br />{report.topicCovered}</td>
                <td className="px-5 py-4"><Badge className={report.status === 'submitted' ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'}>{report.status}</Badge></td>
                <td className="px-5 py-4 text-slate-600">{report.studentsPresentIds.length} / {report.studentsAbsentIds.length}</td>
                <td className="px-5 py-4 text-slate-600">{report.createdByName}</td>
                <td className="px-5 py-4 text-slate-600">{formatFirestoreDate(report.createdAt)}</td>
                <td className="px-5 py-4">
                  <div className="flex gap-2">
                    <button aria-label="View report" className="rounded-xl bg-blue-50 px-3 py-2 text-xs font-black text-directBlue" onClick={() => setViewReport(report)} type="button">View</button>
                    <button aria-label="Edit report" className="rounded-xl bg-slate-100 px-3 py-2 text-xs font-black text-navy" onClick={() => openEdit(report)} type="button">Edit</button>
                  </div>
                </td>
              </tr>
            ))}
          </DataTable>
        )}
      </section>

      <Modal title="View Report" description={viewReport ? `${viewReport.batchName} · ${viewReport.date}` : undefined} open={Boolean(viewReport)} onClose={() => setViewReport(null)}>
        {viewReport ? (
          <div className="space-y-4 text-sm leading-6 text-slate-600">
            <div className="grid gap-3 md:grid-cols-2">
              <div><span className="font-black text-navy">Coach:</span> {viewReport.coachName ?? 'Not assigned'}</div>
              <div><span className="font-black text-navy">Status:</span> {viewReport.status}</div>
              <div><span className="font-black text-navy">Created by:</span> {viewReport.createdByName}</div>
              <div><span className="font-black text-navy">Created:</span> {formatFirestoreDate(viewReport.createdAt)}</div>
              <div><span className="font-black text-navy">Updated:</span> {formatFirestoreDate(viewReport.updatedAt)}</div>
            </div>
            {[
              ['Title', viewReport.title],
              ['Topic covered', viewReport.topicCovered],
              ['Class summary', viewReport.classSummary],
              ['Homework given', viewReport.homeworkGiven],
              ['Next class plan', viewReport.nextClassPlan],
              ['Student performance notes', viewReport.studentPerformanceNotes],
            ].map(([label, value]) => (
              <div key={label}>
                <div className="font-black text-navy">{label}</div>
                <p>{value || 'Not added'}</p>
              </div>
            ))}
            <div>
              <div className="font-black text-navy">Present students</div>
              <p>{viewReport.studentsPresentIds.map((id) => studentsById.get(id)?.name ?? id).join(', ') || 'None'}</p>
            </div>
            <div>
              <div className="font-black text-navy">Absent students</div>
              <p>{viewReport.studentsAbsentIds.map((id) => studentsById.get(id)?.name ?? id).join(', ') || 'None'}</p>
            </div>
            <div>
              <div className="font-black text-navy">Student-specific notes</div>
              <div className="mt-2 space-y-2">
                {viewReport.studentNotes.map((note) => (
                  <div className="rounded-2xl border border-slate-200 p-3" key={note.studentId}>
                    <div className="font-black text-navy">{note.studentName} · {note.performanceTag}</div>
                    <p>{note.note || 'No note added.'}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        ) : null}
      </Modal>

      <Modal title="Edit Report" description={editReport ? `${editReport.batchName} · ${editReport.date}` : undefined} open={Boolean(editReport)} onClose={() => setEditReport(null)}>
        <div className="space-y-4">
          <FormSelect
            label="Status"
            value={editStatus}
            onChange={(event) => setEditStatus(event.target.value as ReportStatus)}
            options={[
              { label: 'Draft', value: 'draft' },
              { label: 'Submitted', value: 'submitted' },
            ]}
          />
          <FormInput label="Title" value={editForm.title} onChange={(event) => updateEditField('title', event.target.value)} />
          <FormInput label="Topic covered" value={editForm.topicCovered} onChange={(event) => updateEditField('topicCovered', event.target.value)} />
          {[
            ['classSummary', 'Class summary'],
            ['homeworkGiven', 'Homework given'],
            ['nextClassPlan', 'Next class plan'],
            ['studentPerformanceNotes', 'Student performance notes'],
          ].map(([field, label]) => (
            <label className="grid gap-2 text-sm font-bold text-slate-700" key={field}>
              {label}
              <textarea
                className="min-h-24 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-navy outline-none transition focus:border-directBlue focus:ring-4 focus:ring-blue-100"
                onChange={(event) => updateEditField(field as keyof ReportForm, event.target.value)}
                value={String(editForm[field as keyof ReportForm])}
              />
            </label>
          ))}
          {editForm.studentNotes.map((note) => (
            <div className="grid gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-4 lg:grid-cols-[1fr_210px_1.2fr]" key={note.studentId}>
              <div className="font-black text-navy">{note.studentName}</div>
              <FormSelect
                label="Performance"
                onChange={(event) => updateEditStudentNote(note.studentId, 'performanceTag', event.target.value)}
                options={[
                  { label: 'Not reviewed', value: 'not_reviewed' },
                  { label: 'Excellent', value: 'excellent' },
                  { label: 'Good', value: 'good' },
                  { label: 'Needs attention', value: 'needs_attention' },
                ]}
                value={note.performanceTag}
              />
              <FormInput label="Note" onChange={(event) => updateEditStudentNote(note.studentId, 'note', event.target.value)} placeholder="Optional" value={note.note} />
            </div>
          ))}
          <div className="flex justify-end">
            <button className="rounded-2xl bg-directBlue px-5 py-3 text-sm font-black text-white disabled:cursor-not-allowed disabled:opacity-60" disabled={saving} onClick={saveEdit} type="button">
              {saving ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}

export function AcademyClassReportsPage() {
  return <ClassReportsSystemPage mode="academy" />;
}

export function CoachClassReportsPage() {
  return <ClassReportsSystemPage mode="coach" />;
}
