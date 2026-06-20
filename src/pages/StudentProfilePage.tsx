import { useMemo, useState, type FormEvent } from 'react';
import { ArrowLeft, CalendarCheck, ClipboardList, CreditCard, Edit3, FileText, GraduationCap, ReceiptText, Save, UserRound } from 'lucide-react';
import { Link, useParams } from 'react-router-dom';
import { Badge } from '../components/ui/Badge';
import { DataTable } from '../components/ui/DataTable';
import { EmptyState } from '../components/ui/EmptyState';
import { FormInput } from '../components/ui/FormInput';
import { Modal } from '../components/ui/Modal';
import { PageHeader } from '../components/ui/PageHeader';
import { RoadmapBadge } from '../components/ui/RoadmapBadge';
import { attendanceStatusLabels, classReportStatusLabels, feeStatusLabels, formatCurrency, levelLabels, modeLabels, paymentMethodLabels, performanceLabels, statusLabels } from '../data/mockData';
import { useAppData } from '../hooks/useAppData';
import type { ClassReport, Student } from '../types';
import { attendanceStyles, feeStyles, levelStyles, modeStyles, statusStyles } from '../utils/badgeStyles';

const formatDate = (value?: string) => {
  if (!value) return 'Not recorded';
  return new Intl.DateTimeFormat('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }).format(new Date(value));
};

const monthName = (month: number) => new Intl.DateTimeFormat('en-IN', { month: 'long' }).format(new Date(2026, month - 1, 1));

const tabLabels = ['Overview', 'Attendance', 'Reports', 'Fees', 'Notes'] as const;
type Tab = typeof tabLabels[number];

function FieldCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-card">
      <h2 className="text-lg font-black text-navy">{title}</h2>
      <div className="mt-4 grid gap-3 text-sm font-bold text-slate-700">{children}</div>
    </section>
  );
}

function InfoRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="rounded-2xl bg-slate-50 p-4">
      <div className="text-xs font-black uppercase tracking-wide text-slate-400">{label}</div>
      <div className="mt-1 text-sm font-black text-navy">{value}</div>
    </div>
  );
}

function toStudentInput(student: Student) {
  const { id: _id, joinedAt: _joinedAt, ...input } = student;
  return input;
}

export function StudentProfilePage() {
  const { studentId } = useParams();
  const {
    updateStudent,
    getBatchName,
    getCoachName,
    getStudentAttendanceRecords,
    getStudentAttendanceStats,
    getStudentBatch,
    getStudentById,
    getStudentCoach,
    getStudentCurrentFeeStatus,
    getStudentFeeRecords,
    getStudentFeeSummary,
    getStudentLatestActivity,
    getStudentReports,
  } = useAppData();
  const student = getStudentById(studentId);
  const [activeTab, setActiveTab] = useState<Tab>('Overview');
  const [editingNotes, setEditingNotes] = useState(false);
  const [detailReport, setDetailReport] = useState<ClassReport | null>(null);
  const [noteForm, setNoteForm] = useState({
    internalNotes: student?.internalNotes ?? '',
    goals: student?.goals ?? '',
    strengths: student?.strengths ?? '',
    improvementAreas: student?.improvementAreas ?? '',
  });

  const batch = student ? getStudentBatch(student.id) : undefined;
  const coach = student ? getStudentCoach(student.id) : undefined;
  const attendanceRecords = student ? getStudentAttendanceRecords(student.id) : [];
  const attendanceStats = student ? getStudentAttendanceStats(student.id) : { total: 0, present: 0, absent: 0, late: 0, excused: 0, percentage: null };
  const reports = student ? getStudentReports(student.id) : [];
  const feeRecords = student ? getStudentFeeRecords(student.id) : [];
  const feeSummary = student ? getStudentFeeSummary(student.id) : { collected: 0, pending: 0, overdue: 0, waived: 0, totalRecords: 0 };
  const latestActivity = student ? getStudentLatestActivity(student.id) : {};
  const currentFeeStatus = student ? getStudentCurrentFeeStatus(student.id) ?? student.feeStatus : null;

  const studentNotes = useMemo(
    () =>
      student
        ? reports
          .flatMap((report) => report.studentNotes.filter((note) => note.studentId === student.id).map((note) => ({ report, note })))
          .sort((a, b) => b.report.date.localeCompare(a.report.date))
        : [],
    [reports, student],
  );

  const performanceTrend = studentNotes[0]?.note.performance ? performanceLabels[studentNotes[0].note.performance] : 'No report trend yet';
  const practiceAreas = reports.flatMap((report) => report.skillsPracticed).slice(0, 4).join(', ') || student?.improvementAreas || 'No areas recorded yet';
  const pendingAmount = feeRecords.filter((record) => record.status === 'pending' || record.status === 'overdue').reduce((total, record) => total + record.amount, 0);
  const latestPaid = feeRecords.find((record) => record.status === 'paid');

  const handleSaveNotes = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!student) return;
    updateStudent(student.id, {
      ...toStudentInput(student),
      internalNotes: noteForm.internalNotes.trim(),
      goals: noteForm.goals.trim(),
      strengths: noteForm.strengths.trim(),
      improvementAreas: noteForm.improvementAreas.trim(),
    });
    setEditingNotes(false);
  };

  if (!student) {
    return (
      <div className="space-y-6">
        <PageHeader title="Student Profile" description="The requested student profile could not be found." action={<RoadmapBadge status="Phase 6" />} />
        <EmptyState title="Student not found" description="This student may have been deleted or the profile link is invalid." />
        <Link className="inline-flex items-center gap-2 rounded-2xl bg-directBlue px-5 py-3 text-sm font-black text-white" to="/students">
          <ArrowLeft size={18} /> Back to Students
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Student Profile"
        description="A complete local view of student details, attendance, reports, fees, and notes."
        action={<RoadmapBadge status="Phase 6" />}
      />

      <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-card">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <Link className="mb-3 inline-flex items-center gap-2 text-sm font-black text-directBlue" to="/students">
              <ArrowLeft size={17} /> Back to Students
            </Link>
            <div className="flex flex-wrap items-center gap-3">
              <h1 className="text-3xl font-black text-navy">{student.name}</h1>
              <Badge className={levelStyles[student.level]}>{levelLabels[student.level]}</Badge>
              <Badge className={statusStyles[student.status]}>{statusLabels[student.status]}</Badge>
              {currentFeeStatus ? <Badge className={feeStyles[currentFeeStatus]}>{feeStatusLabels[currentFeeStatus]}</Badge> : null}
            </div>
            <p className="mt-2 text-sm font-semibold text-slate-500">
              {getBatchName(student.batchId)} · {coach?.name ?? 'Unassigned coach'} · {attendanceStats.percentage === null ? 'No attendance data' : `${attendanceStats.percentage}% attendance`}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 px-4 py-3 text-sm font-black text-slate-700" onClick={() => setEditingNotes(true)} type="button">
              <Edit3 size={18} /> Edit Notes
            </button>
            <Link className="inline-flex items-center gap-2 rounded-2xl bg-directBlue px-4 py-3 text-sm font-black text-white" to="/students">
              <Edit3 size={18} /> Edit Student
            </Link>
          </div>
        </div>

        <div className="mt-6 grid gap-3 md:grid-cols-5">
          {[
            { label: 'Progress', value: `${student.progress}%`, icon: GraduationCap },
            { label: 'Attendance', value: attendanceStats.percentage === null ? 'No data' : `${attendanceStats.percentage}%`, icon: CalendarCheck },
            { label: 'Reports', value: String(reports.length), icon: FileText },
            { label: 'Fee Records', value: String(feeRecords.length), icon: CreditCard },
            { label: 'Monthly Fee', value: formatCurrency(student.monthlyFee), icon: ReceiptText },
          ].map((item) => (
            <div className="rounded-2xl bg-slate-50 p-4" key={item.label}>
              <div className="flex items-center gap-2 text-xs font-black uppercase tracking-wide text-slate-400"><item.icon size={15} /> {item.label}</div>
              <div className="mt-2 text-xl font-black text-navy">{item.value}</div>
            </div>
          ))}
        </div>
      </section>

      <div className="overflow-x-auto">
        <div className="inline-flex min-w-max rounded-2xl border border-slate-200 bg-white p-1 shadow-sm">
          {tabLabels.map((tab) => (
            <button
              className={`rounded-xl px-4 py-2 text-sm font-black transition ${activeTab === tab ? 'bg-blue-50 text-directBlue' : 'text-slate-500 hover:bg-slate-50'}`}
              key={tab}
              onClick={() => setActiveTab(tab)}
              type="button"
            >
              {tab}
            </button>
          ))}
        </div>
      </div>

      {activeTab === 'Overview' ? (
        <div className="space-y-6">
          <div className="grid gap-5 xl:grid-cols-3">
            <FieldCard title="Student Info">
              <InfoRow label="Age" value={`${student.age} years`} />
              <InfoRow label="Level" value={levelLabels[student.level]} />
              <InfoRow label="Joined" value={formatDate(student.joinedAt)} />
              <InfoRow label="Progress" value={`${student.progress}%`} />
            </FieldCard>
            <FieldCard title="Parent Info">
              <InfoRow label="Parent" value={student.parentName || 'Not added'} />
              <InfoRow label="Email" value={student.parentEmail || 'Not added'} />
              <InfoRow label="Phone" value={student.parentPhone || 'Not added'} />
            </FieldCard>
            <FieldCard title="Batch Info">
              <InfoRow label="Batch" value={batch?.name ?? 'Unassigned batch'} />
              <InfoRow label="Coach" value={coach?.name ?? 'Unassigned coach'} />
              <InfoRow label="Schedule" value={batch ? `${batch.scheduleDays.join(', ')} · ${batch.startTime} - ${batch.endTime}` : 'Not scheduled'} />
              <InfoRow label="Mode" value={batch ? <Badge className={modeStyles[batch.mode]}>{modeLabels[batch.mode]}</Badge> : 'Not set'} />
            </FieldCard>
          </div>

          <div className="grid gap-5 xl:grid-cols-3">
            <FieldCard title="Fee Snapshot">
              <InfoRow label="Monthly Fee" value={formatCurrency(student.monthlyFee)} />
              <InfoRow label="Current Status" value={currentFeeStatus ? <Badge className={feeStyles[currentFeeStatus]}>{feeStatusLabels[currentFeeStatus]}</Badge> : 'No fee record'} />
              <InfoRow label="Latest Fee" value={feeSummary.latest ? `${monthName(feeSummary.latest.month)} ${feeSummary.latest.year}` : 'No fee record'} />
              <InfoRow label="Pending Amount" value={formatCurrency(pendingAmount)} />
              <InfoRow label="Last Paid" value={latestPaid?.paidDate ? formatDate(latestPaid.paidDate) : 'No payment recorded'} />
            </FieldCard>
            <FieldCard title="Attendance Snapshot">
              <InfoRow label="Attendance" value={attendanceStats.percentage === null ? 'No data' : `${attendanceStats.percentage}%`} />
              <InfoRow label="Classes Recorded" value={attendanceStats.total} />
              <InfoRow label="Present / Late" value={`${attendanceStats.present} present · ${attendanceStats.late} late`} />
              <InfoRow label="Absent / Excused" value={`${attendanceStats.absent} absent · ${attendanceStats.excused} excused`} />
            </FieldCard>
            <FieldCard title="Progress Snapshot">
              <InfoRow label="Current Progress" value={`${student.progress}%`} />
              <InfoRow label="Current Level" value={levelLabels[student.level]} />
              <InfoRow label="Recent Performance" value={performanceTrend} />
              <InfoRow label="Practice Areas" value={practiceAreas} />
            </FieldCard>
          </div>

          <section>
            <h2 className="mb-3 text-xl font-black text-navy">Latest Activity</h2>
            <div className="grid gap-4 md:grid-cols-3">
              <InfoRow label="Latest Attendance" value={latestActivity.attendance ? `${formatDate(latestActivity.attendance.record.date)} · ${attendanceStatusLabels[latestActivity.attendance.entry.status]}` : 'No attendance yet'} />
              <InfoRow label="Latest Report" value={latestActivity.report ? `${formatDate(latestActivity.report.date)} · ${latestActivity.report.title}` : 'No reports yet'} />
              <InfoRow label="Latest Fee" value={latestActivity.fee ? `${monthName(latestActivity.fee.month)} ${latestActivity.fee.year} · ${feeStatusLabels[latestActivity.fee.status]}` : 'No fees yet'} />
            </div>
          </section>

          <section>
            <h2 className="mb-3 text-xl font-black text-navy">Quick Actions</h2>
            <div className="flex flex-wrap gap-2">
              <Link className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 px-4 py-3 text-sm font-black text-slate-700" to="/batches"><ClipboardList size={18} /> View Batch</Link>
              <Link className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 px-4 py-3 text-sm font-black text-slate-700" to="/attendance"><CalendarCheck size={18} /> Mark Attendance</Link>
              <Link className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 px-4 py-3 text-sm font-black text-slate-700" to="/reports"><FileText size={18} /> Create Report</Link>
              <Link className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 px-4 py-3 text-sm font-black text-slate-700" to="/fees"><CreditCard size={18} /> View Fee Records</Link>
            </div>
          </section>
        </div>
      ) : null}

      {activeTab === 'Attendance' ? (
        <section>
          <h2 className="mb-3 text-xl font-black text-navy">Attendance History</h2>
          {attendanceRecords.length === 0 ? (
            <EmptyState title="No attendance yet" description="Attendance records for this student will appear here after classes are marked." />
          ) : (
            <DataTable columns={['Date', 'Batch', 'Status', 'Note']}>
              {attendanceRecords.map(({ record, entry }) => (
                <tr className="border-t border-slate-100" key={record.id}>
                  <td className="px-5 py-4 font-black text-navy">{formatDate(record.date)}</td>
                  <td className="px-5 py-4 text-slate-600">{getBatchName(record.batchId)}</td>
                  <td className="px-5 py-4"><Badge className={attendanceStyles[entry.status]}>{attendanceStatusLabels[entry.status]}</Badge></td>
                  <td className="px-5 py-4 text-slate-600">{entry.note ?? 'No note'}</td>
                </tr>
              ))}
            </DataTable>
          )}
        </section>
      ) : null}

      {activeTab === 'Reports' ? (
        <section>
          <h2 className="mb-3 text-xl font-black text-navy">Class Report History</h2>
          {reports.length === 0 ? (
            <EmptyState title="No reports yet" description="Reports connected to this student or their batch will appear here." />
          ) : (
            <DataTable columns={['Date', 'Batch', 'Coach', 'Title', 'Topics', 'Student Note', 'Status', 'Action']}>
              {reports.map((report) => {
                const note = report.studentNotes.find((item) => item.studentId === student.id);
                return (
                  <tr className="border-t border-slate-100" key={report.id}>
                    <td className="px-5 py-4 font-black text-navy">{formatDate(report.date)}</td>
                    <td className="px-5 py-4 text-slate-600">{getBatchName(report.batchId)}</td>
                    <td className="px-5 py-4 text-slate-600">{getCoachName(report.coachId)}</td>
                    <td className="px-5 py-4 font-bold text-navy">{report.title}</td>
                    <td className="px-5 py-4 text-slate-600">{report.topicsCovered.join(', ')}</td>
                    <td className="px-5 py-4 text-slate-600">{note ? `${performanceLabels[note.performance]} · ${note.note || 'No note'}` : 'No student-specific note'}</td>
                    <td className="px-5 py-4"><Badge className={statusStyles[report.status]}>{classReportStatusLabels[report.status]}</Badge></td>
                    <td className="px-5 py-4"><button className="rounded-xl border border-slate-200 px-3 py-2 text-xs font-black text-slate-600" onClick={() => setDetailReport(report)} type="button">View</button></td>
                  </tr>
                );
              })}
            </DataTable>
          )}
        </section>
      ) : null}

      {activeTab === 'Fees' ? (
        <section className="space-y-4">
          <div className="grid gap-4 md:grid-cols-4">
            <InfoRow label="Collected" value={formatCurrency(feeSummary.collected)} />
            <InfoRow label="Pending" value={formatCurrency(feeSummary.pending)} />
            <InfoRow label="Overdue" value={formatCurrency(feeSummary.overdue)} />
            <InfoRow label="Waived" value={formatCurrency(feeSummary.waived)} />
          </div>
          {feeRecords.length === 0 ? (
            <EmptyState title="No fee records yet" description="Fee records for this student will appear here once monthly dues are generated or added." />
          ) : (
            <DataTable columns={['Month', 'Amount', 'Due Date', 'Status', 'Payment', 'Paid Date', 'Notes']}>
              {feeRecords.map((record) => (
                <tr className="border-t border-slate-100" key={record.id}>
                  <td className="px-5 py-4 font-black text-navy">{monthName(record.month)} {record.year}</td>
                  <td className="px-5 py-4 text-slate-600">{formatCurrency(record.amount)}</td>
                  <td className="px-5 py-4 text-slate-600">{formatDate(record.dueDate)}</td>
                  <td className="px-5 py-4"><Badge className={feeStyles[record.status]}>{feeStatusLabels[record.status]}</Badge></td>
                  <td className="px-5 py-4 text-slate-600">{record.paymentMethod ? paymentMethodLabels[record.paymentMethod] : 'Not recorded'}</td>
                  <td className="px-5 py-4 text-slate-600">{formatDate(record.paidDate)}</td>
                  <td className="px-5 py-4 text-slate-600">{record.notes ?? 'No notes'}</td>
                </tr>
              ))}
            </DataTable>
          )}
        </section>
      ) : null}

      {activeTab === 'Notes' ? (
        <section className="space-y-6">
          <FieldCard title="Internal Student Notes">
            <InfoRow label="Goals" value={student.goals || 'No goals recorded yet'} />
            <InfoRow label="Strengths" value={student.strengths || 'No strengths recorded yet'} />
            <InfoRow label="Improvement Areas" value={student.improvementAreas || 'No improvement areas recorded yet'} />
            <InfoRow label="Internal Notes" value={student.internalNotes || 'No internal notes recorded yet'} />
          </FieldCard>

          <section>
            <h2 className="mb-3 text-xl font-black text-navy">Notes From Class Reports</h2>
            {studentNotes.length === 0 ? (
              <EmptyState title="No student-specific report notes" description="Coach notes from class reports will appear here." />
            ) : (
              <DataTable columns={['Date', 'Coach', 'Batch', 'Performance', 'Note']}>
                {studentNotes.map(({ report, note }) => (
                  <tr className="border-t border-slate-100" key={`${report.id}-${note.studentId}`}>
                    <td className="px-5 py-4 font-black text-navy">{formatDate(report.date)}</td>
                    <td className="px-5 py-4 text-slate-600">{getCoachName(report.coachId)}</td>
                    <td className="px-5 py-4 text-slate-600">{getBatchName(report.batchId)}</td>
                    <td className="px-5 py-4"><Badge className={note.performance === 'needs_practice' ? statusStyles.pending : statusStyles.completed}>{performanceLabels[note.performance]}</Badge></td>
                    <td className="px-5 py-4 text-slate-600">{note.note || 'No note'}</td>
                  </tr>
                ))}
              </DataTable>
            )}
          </section>
        </section>
      ) : null}

      <Modal title="Edit Student Notes" description="These notes are local internal profile fields for this student." open={editingNotes} onClose={() => setEditingNotes(false)}>
        <form className="grid gap-4" onSubmit={handleSaveNotes}>
          <FormInput label="Goals" value={noteForm.goals} onChange={(event) => setNoteForm((current) => ({ ...current, goals: event.target.value }))} />
          <FormInput label="Strengths" value={noteForm.strengths} onChange={(event) => setNoteForm((current) => ({ ...current, strengths: event.target.value }))} />
          <label className="grid gap-2 text-sm font-bold text-slate-700">
            Improvement areas
            <textarea className="min-h-24 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-navy outline-none transition focus:border-directBlue focus:ring-4 focus:ring-blue-100" value={noteForm.improvementAreas} onChange={(event) => setNoteForm((current) => ({ ...current, improvementAreas: event.target.value }))} />
          </label>
          <label className="grid gap-2 text-sm font-bold text-slate-700">
            Internal notes
            <textarea className="min-h-28 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-navy outline-none transition focus:border-directBlue focus:ring-4 focus:ring-blue-100" value={noteForm.internalNotes} onChange={(event) => setNoteForm((current) => ({ ...current, internalNotes: event.target.value }))} />
          </label>
          <div className="flex justify-end gap-3 pt-2">
            <button className="rounded-2xl border border-slate-200 px-5 py-3 text-sm font-black text-slate-600" type="button" onClick={() => setEditingNotes(false)}>Cancel</button>
            <button className="inline-flex items-center gap-2 rounded-2xl bg-directBlue px-5 py-3 text-sm font-black text-white" type="submit"><Save size={18} /> Save Notes</button>
          </div>
        </form>
      </Modal>

      <Modal title={detailReport?.title ?? 'Report Details'} open={Boolean(detailReport)} onClose={() => setDetailReport(null)}>
        {detailReport ? (
          <div className="space-y-4">
            <div className="flex flex-wrap gap-2">
              <Badge className={statusStyles[detailReport.status]}>{classReportStatusLabels[detailReport.status]}</Badge>
              <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-600">{formatDate(detailReport.date)}</span>
              <span className="rounded-full bg-blue-50 px-3 py-1 text-xs font-bold text-directBlue">{getBatchName(detailReport.batchId)}</span>
            </div>
            <InfoRow label="Topics" value={detailReport.topicsCovered.join(', ') || 'No topics'} />
            <InfoRow label="Skills" value={detailReport.skillsPracticed.join(', ') || 'No skills'} />
            <InfoRow label="Homework" value={detailReport.homework || 'No homework'} />
            <InfoRow label="General Notes" value={detailReport.generalNotes || 'No general notes'} />
          </div>
        ) : null}
      </Modal>
    </div>
  );
}
