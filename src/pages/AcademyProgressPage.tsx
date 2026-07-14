import { useEffect, useMemo, useState } from 'react';
import { collection, doc, getDoc, getDocs, query, serverTimestamp, setDoc, updateDoc, where } from 'firebase/firestore';
import { BarChart3, Edit, Eye, Save, Target } from 'lucide-react';
import { Badge } from '../components/ui/Badge';
import { DataTable } from '../components/ui/DataTable';
import { EmptyState } from '../components/ui/EmptyState';
import { FormInput } from '../components/ui/FormInput';
import { FormSelect } from '../components/ui/FormSelect';
import { Modal } from '../components/ui/Modal';
import { StatCard } from '../components/ui/StatCard';
import { useAuth } from '../contexts/AuthContext';
import { useCurrentCoach } from '../hooks/useCurrentCoach';
import { db } from '../lib/firebase';
import { getCoachWorkspace } from '../lib/coachWorkspaceApi';
import { formatFirestoreDate } from '../utils/firestoreFormat';
import { createAuditLog } from '../utils/superAdminActions';

type ProgressMode = 'academy' | 'coach' | 'student';

type Ratings = {
  opening: number;
  tactics: number;
  calculation: number;
  endgame: number;
  boardVision: number;
  gameDiscipline: number;
  homework: number;
  tournamentReadiness: number;
  overall: number;
};

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
  batchId?: string | null;
  status?: string;
};

type ProgressReport = {
  id: string;
  academyId: string;
  studentId: string;
  studentName: string;
  batchId: string | null;
  batchName: string | null;
  coachId: string | null;
  coachName: string | null;
  date: string;
  ratings: Ratings;
  strengths: string;
  weaknesses: string;
  nextFocus: string;
  coachNotes: string;
  createdByUid: string;
  createdByName: string;
  createdByRole: 'academy_admin' | 'coach';
  updatedByUid: string | null;
  updatedByName: string | null;
  createdAt: unknown;
  updatedAt: unknown;
};

type AttendanceRecord = {
  id: string;
  batchId?: string;
  students?: Array<{ studentId?: string; status?: string }>;
  entries?: Array<{ studentId?: string; status?: string }>;
};

type ClassReportRecord = {
  id: string;
  date?: string;
  batchName?: string;
  topicCovered?: string;
  homeworkGiven?: string;
  studentNotes?: Array<{ studentId?: string; note?: string }>;
};

const ratingFields: Array<{ key: keyof Ratings; label: string }> = [
  { key: 'opening', label: 'Opening Understanding' },
  { key: 'tactics', label: 'Tactics' },
  { key: 'calculation', label: 'Calculation' },
  { key: 'endgame', label: 'Endgame' },
  { key: 'boardVision', label: 'Board Vision' },
  { key: 'gameDiscipline', label: 'Game Discipline' },
  { key: 'homework', label: 'Homework Completion' },
  { key: 'tournamentReadiness', label: 'Tournament Readiness' },
  { key: 'overall', label: 'Overall Progress' },
];

const emptyRatings: Ratings = {
  opening: 0,
  tactics: 0,
  calculation: 0,
  endgame: 0,
  boardVision: 0,
  gameDiscipline: 0,
  homework: 0,
  tournamentReadiness: 0,
  overall: 0,
};

function getTodayDate() {
  const date = new Date();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${date.getFullYear()}-${month}-${day}`;
}

function needsAttention(report?: ProgressReport) {
  if (!report) return false;
  return report.ratings.overall <= 2 || report.ratings.calculation <= 2 || report.ratings.homework <= 2;
}

function getStudentBatch(studentId: string, batches: BatchRecord[]) {
  return batches.find((batch) => batch.studentIds.includes(studentId)) ?? null;
}

function getAttendancePercentage(studentId: string, records: AttendanceRecord[]) {
  const entries = records.flatMap((record) =>
    [...(record.students ?? []), ...(record.entries ?? [])].filter((entry) => entry.studentId === studentId),
  );
  if (!entries.length) return null;
  const present = entries.filter((entry) => entry.status === 'present' || entry.status === 'late').length;
  return Math.round((present / entries.length) * 100);
}

function ProgressSystemPage({ mode }: { mode: ProgressMode }) {
  const { userProfile } = useAuth();
  const isCoachMode = mode === 'coach';
  const { coach: currentCoach, error: coachResolutionError, loading: coachResolutionLoading } = useCurrentCoach(isCoachMode);
  const academyId = isCoachMode ? currentCoach?.academy_id ?? userProfile?.academyId : userProfile?.academyId;
  const coachId = currentCoach?.id ?? null;
  const linkedStudentId = userProfile?.linkedStudentId;
  const isAcademyMode = mode === 'academy';
  const isStudentMode = mode === 'student';
  const [students, setStudents] = useState<StudentRecord[]>([]);
  const [batches, setBatches] = useState<BatchRecord[]>([]);
  const [progressReports, setProgressReports] = useState<ProgressReport[]>([]);
  const [attendanceRecords, setAttendanceRecords] = useState<AttendanceRecord[]>([]);
  const [classReports, setClassReports] = useState<ClassReportRecord[]>([]);
  const [selectedStudentId, setSelectedStudentId] = useState('');
  const [selectedDate, setSelectedDate] = useState(getTodayDate());
  const [ratings, setRatings] = useState<Ratings>(emptyRatings);
  const [strengths, setStrengths] = useState('');
  const [weaknesses, setWeaknesses] = useState('');
  const [nextFocus, setNextFocus] = useState('');
  const [coachNotes, setCoachNotes] = useState('');
  const [studentFilter, setStudentFilter] = useState('');
  const [batchFilter, setBatchFilter] = useState('');
  const [coachFilter, setCoachFilter] = useState('');
  const [ratingFilter, setRatingFilter] = useState('');
  const [startDateFilter, setStartDateFilter] = useState('');
  const [endDateFilter, setEndDateFilter] = useState('');
  const [needsAttentionOnly, setNeedsAttentionOnly] = useState(false);
  const [viewReport, setViewReport] = useState<ProgressReport | null>(null);
  const [editReport, setEditReport] = useState<ProgressReport | null>(null);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const selectedStudent = students.find((student) => student.id === selectedStudentId);
  const selectedBatch = selectedStudent ? getStudentBatch(selectedStudent.id, batches) : null;
  const latestByStudent = useMemo(() => {
    const map = new Map<string, ProgressReport>();
    progressReports.forEach((report) => {
      const current = map.get(report.studentId);
      if (!current || report.date.localeCompare(current.date) > 0) map.set(report.studentId, report);
    });
    return map;
  }, [progressReports]);

  const loadProgress = async (visibleStudents: StudentRecord[]) => {
    if (!academyId) return;
    if (isStudentMode && linkedStudentId) {
      const progressSnapshot = await getDocs(query(collection(db, 'academies', academyId, 'progressReports'), where('studentId', '==', linkedStudentId)));
      setProgressReports(progressSnapshot.docs.map((docSnap) => ({ id: docSnap.id, ...docSnap.data() }) as ProgressReport).sort((a, b) => b.date.localeCompare(a.date)));
      return;
    }
    if (isCoachMode) {
      const reports = new Map<string, ProgressReport>();
      for (const student of visibleStudents) {
        const progressSnapshot = await getDocs(query(collection(db, 'academies', academyId, 'progressReports'), where('studentId', '==', student.id)));
        progressSnapshot.docs.forEach((docSnap) => reports.set(docSnap.id, { id: docSnap.id, ...docSnap.data() } as ProgressReport));
      }
      setProgressReports(Array.from(reports.values()).sort((a, b) => b.date.localeCompare(a.date)));
      return;
    }
    const progressSnapshot = await getDocs(collection(db, 'academies', academyId, 'progressReports'));
    const visibleStudentIds = new Set(visibleStudents.map((student) => student.id));
    setProgressReports(
      progressSnapshot.docs
        .map((docSnap) => ({ id: docSnap.id, ...docSnap.data() }) as ProgressReport)
        .filter((report) => visibleStudentIds.has(report.studentId))
        .sort((a, b) => b.date.localeCompare(a.date)),
    );
  };

  useEffect(() => {
    const loadPage = async () => {
      if (!academyId || (isCoachMode && !coachId) || (isStudentMode && !linkedStudentId)) {
        setLoading(false);
        return;
      }
      setLoading(true);
      try {
        if (isStudentMode && linkedStudentId) {
          const studentSnapshot = await getDoc(doc(db, 'academies', academyId, 'students', linkedStudentId));
          const loadedStudent = studentSnapshot.exists() ? ({ id: studentSnapshot.id, ...studentSnapshot.data() } as StudentRecord) : null;
          const [batchSnapshot, attendanceSnapshot, presentSnapshot, absentSnapshot] = await Promise.all([
            getDocs(query(collection(db, 'academies', academyId, 'batches'), where('studentIds', 'array-contains', linkedStudentId))),
            getDocs(query(collection(db, 'academies', academyId, 'attendance'), where('studentIds', 'array-contains', linkedStudentId))),
            getDocs(query(collection(db, 'academies', academyId, 'classReports'), where('studentsPresentIds', 'array-contains', linkedStudentId))),
            getDocs(query(collection(db, 'academies', academyId, 'classReports'), where('studentsAbsentIds', 'array-contains', linkedStudentId))),
          ]);
          const loadedBatches = batchSnapshot.docs.map((docSnap) => ({ id: docSnap.id, ...docSnap.data() }) as BatchRecord);
          const reports = new Map<string, ClassReportRecord>();
          [...presentSnapshot.docs, ...absentSnapshot.docs].forEach((docSnap) => {
            reports.set(docSnap.id, { id: docSnap.id, ...docSnap.data() } as ClassReportRecord);
          });

          setBatches(loadedBatches);
          setStudents(loadedStudent && loadedStudent.status !== 'disabled' ? [loadedStudent] : []);
          setAttendanceRecords(attendanceSnapshot.docs.map((docSnap) => ({ id: docSnap.id, ...docSnap.data() }) as AttendanceRecord));
          setSelectedStudentId(loadedStudent?.id ?? '');
          setClassReports(Array.from(reports.values()).sort((a, b) => String(b.date ?? '').localeCompare(String(a.date ?? ''))));
          await loadProgress(loadedStudent ? [loadedStudent] : []);
          return;
        }

        const attendanceSnapshot = isCoachMode && coachId
          ? await getDocs(query(collection(db, 'academies', academyId, 'attendance'), where('coachId', '==', coachId)))
          : await getDocs(collection(db, 'academies', academyId, 'attendance'));
        let activeBatches: BatchRecord[];
        let loadedStudents: StudentRecord[];
        if (isCoachMode && coachId) {
          const workspace = await getCoachWorkspace(coachId, academyId);
          activeBatches = workspace.batches;
          loadedStudents = workspace.students;
        } else {
          const batchSnapshot = await getDocs(collection(db, 'academies', academyId, 'batches'));
          activeBatches = batchSnapshot.docs
            .map((docSnap) => ({ id: docSnap.id, ...docSnap.data() }) as BatchRecord)
            .filter((batch) => batch.status === 'active');
          const studentDocs = await getDocs(collection(db, 'academies', academyId, 'students'));
          loadedStudents = studentDocs.docs
            .map((docSnap) => ({ id: docSnap.id, ...docSnap.data() }) as StudentRecord)
            .filter((student) => student.status !== 'disabled')
            .filter((student) => !isStudentMode || student.id === linkedStudentId);
        }
        setBatches(activeBatches);
        setStudents(loadedStudents);
        const activeBatchIds = new Set(activeBatches.map((batch) => batch.id));
        const visibleStudentIdsForAttendance = new Set(activeBatches.flatMap((batch) => batch.studentIds));
        setAttendanceRecords(
          attendanceSnapshot.docs
            .map((docSnap) => ({ id: docSnap.id, ...docSnap.data() }) as AttendanceRecord)
            .filter((record) =>
              !isCoachMode
              || Boolean(record.batchId && activeBatchIds.has(record.batchId))
              || [...(record.students ?? []), ...(record.entries ?? [])].some((entry) => entry.studentId && visibleStudentIdsForAttendance.has(entry.studentId)),
            ),
        );
        setSelectedStudentId((current) => current || loadedStudents[0]?.id || '');
        await loadProgress(loadedStudents);
      } finally {
        setLoading(false);
      }
    };

    void loadPage();
  }, [academyId, coachId, isCoachMode, isStudentMode, linkedStudentId]);

  const coachOptions = useMemo(() => {
    const map = new Map<string, string>();
    batches.forEach((batch) => {
      if (batch.coachId) map.set(batch.coachId, batch.coachName || 'Assigned coach');
    });
    return Array.from(map, ([value, label]) => ({ value, label }));
  }, [batches]);

  const filteredStudents = useMemo(
    () =>
      students.filter((student) => {
        const latest = latestByStudent.get(student.id);
        const batch = getStudentBatch(student.id, batches);
        const matchesStudent = studentFilter ? student.id === studentFilter : true;
        const matchesBatch = batchFilter ? batch?.id === batchFilter : true;
        const matchesCoach = coachFilter ? batch?.coachId === coachFilter : true;
        const matchesRating = ratingFilter ? latest?.ratings.overall === Number(ratingFilter) : true;
        const matchesStart = startDateFilter && latest ? latest.date >= startDateFilter : true;
        const matchesEnd = endDateFilter && latest ? latest.date <= endDateFilter : true;
        const matchesAttention = needsAttentionOnly ? needsAttention(latest) : true;
        return matchesStudent && matchesBatch && matchesCoach && matchesRating && matchesStart && matchesEnd && matchesAttention;
      }),
    [batchFilter, batches, coachFilter, endDateFilter, latestByStudent, needsAttentionOnly, ratingFilter, startDateFilter, studentFilter, students],
  );

  const studentProgressHistory = isStudentMode && linkedStudentId ? progressReports.filter((report) => report.studentId === linkedStudentId) : progressReports;
  const latestStudentReport = isStudentMode ? studentProgressHistory[0] : null;
  const averageOverall = progressReports.length
    ? Math.round((progressReports.reduce((total, report) => total + report.ratings.overall, 0) / progressReports.length) * 10) / 10
    : null;

  const updateRating = (key: keyof Ratings, value: string, edit = false) => {
    const next = Number(value);
    if (edit && editReport) {
      setEditReport({ ...editReport, ratings: { ...editReport.ratings, [key]: next } });
      return;
    }
    setRatings((current) => ({ ...current, [key]: next }));
  };

  const resetForm = () => {
    setRatings(emptyRatings);
    setStrengths('');
    setWeaknesses('');
    setNextFocus('');
    setCoachNotes('');
    setSelectedDate(getTodayDate());
  };

  const saveProgress = async () => {
    if (!academyId || !userProfile || !selectedStudent) return;
    if (!selectedDate || ratings.overall === 0) {
      setError('Student, date, and overall rating are required.');
      return;
    }
    const hasNotes = Boolean(strengths.trim() || weaknesses.trim() || nextFocus.trim() || coachNotes.trim());
    const hasRatings = Object.values(ratings).some((rating) => rating > 0);
    if (!hasNotes && !hasRatings) {
      setError('Add at least one rating or note before saving.');
      return;
    }
    setSaving(true);
    setError('');
    try {
      const progressRef = doc(collection(db, 'academies', academyId, 'progressReports'));
      await setDoc(progressRef, {
        academyId,
        studentId: selectedStudent.id,
        studentName: selectedStudent.name,
        batchId: selectedBatch?.id ?? null,
        batchName: selectedBatch?.name ?? null,
        coachId: selectedBatch?.coachId ?? (isCoachMode ? coachId : null),
        coachName: selectedBatch?.coachName ?? null,
        date: selectedDate,
        ratings,
        strengths: strengths.trim(),
        weaknesses: weaknesses.trim(),
        nextFocus: nextFocus.trim(),
        coachNotes: coachNotes.trim(),
        createdByUid: userProfile.uid,
        createdByName: userProfile.name,
        createdByRole: isCoachMode ? 'coach' : 'academy_admin',
        updatedByUid: null,
        updatedByName: null,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      await createAuditLog({
        actor: userProfile,
        action: 'academy.progress.created',
        targetType: 'progressReport',
        targetId: progressRef.id,
        academyId,
        message: `${selectedStudent.name} progress updated.`,
        metadata: {
          progressId: progressRef.id,
          studentId: selectedStudent.id,
          batchId: selectedBatch?.id ?? null,
          coachId: selectedBatch?.coachId ?? null,
          createdByUid: userProfile.uid,
        },
      });
      await loadProgress(students);
      resetForm();
      setMessage('Progress update saved.');
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : 'Unable to save progress.');
    } finally {
      setSaving(false);
    }
  };

  const openEdit = (report: ProgressReport) => {
    setEditReport(report);
    setError('');
  };

  const saveEdit = async () => {
    if (!academyId || !userProfile || !editReport) return;
    if (!editReport.date || editReport.ratings.overall === 0) {
      setError('Date and overall rating are required.');
      return;
    }
    setSaving(true);
    setError('');
    try {
      await updateDoc(doc(db, 'academies', academyId, 'progressReports', editReport.id), {
        date: editReport.date,
        ratings: editReport.ratings,
        strengths: editReport.strengths.trim(),
        weaknesses: editReport.weaknesses.trim(),
        nextFocus: editReport.nextFocus.trim(),
        coachNotes: editReport.coachNotes.trim(),
        updatedByUid: userProfile.uid,
        updatedByName: userProfile.name,
        updatedAt: serverTimestamp(),
      });
      await createAuditLog({
        actor: userProfile,
        action: 'academy.progress.updated',
        targetType: 'progressReport',
        targetId: editReport.id,
        academyId,
        message: `${editReport.studentName} progress report updated.`,
        metadata: {
          progressId: editReport.id,
          studentId: editReport.studentId,
          batchId: editReport.batchId,
          coachId: editReport.coachId,
          createdByUid: editReport.createdByUid,
        },
      });
      setEditReport(null);
      await loadProgress(students);
      setMessage('Progress report updated.');
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : 'Unable to update progress.');
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

  if (isStudentMode && !linkedStudentId) {
    return <EmptyState title="Your student profile is not linked yet" description="Contact your academy." />;
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-sm font-black uppercase tracking-wide text-directBlue">Progress</p>
          <h1 className="mt-2 text-3xl font-black text-navy">
            {isStudentMode ? 'My Progress' : isCoachMode ? 'My Students Progress' : 'Academy Progress'}
          </h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">
            Track chess growth across core learning categories with coach-driven progress updates.
          </p>
        </div>
        <Badge className="bg-blue-50 text-directBlue">{isStudentMode ? 'Student view' : isCoachMode ? 'Coach scoped' : 'Academy scoped'}</Badge>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
        <StatCard label="Total Students" value={loading ? '...' : String(students.length)} helper="Students in scope" icon={Target} />
        <StatCard label="With Progress" value={loading ? '...' : String(latestByStudent.size)} helper="Have at least one update" icon={BarChart3} />
        <StatCard label="No Progress" value={loading ? '...' : String(Math.max(0, students.length - latestByStudent.size))} helper="Need first update" icon={Target} />
        <StatCard label="Need Attention" value={loading ? '...' : String(Array.from(latestByStudent.values()).filter(needsAttention).length)} helper="Low overall/calculation/homework" icon={Eye} />
        <StatCard label="Average Overall" value={averageOverall === null ? 'No data' : String(averageOverall)} helper="Across progress reports" icon={BarChart3} />
      </div>

      {error ? <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-bold text-red-700">{error}</div> : null}
      {message ? <div className="rounded-2xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm font-bold text-directBlue">{message}</div> : null}

      {isStudentMode ? (
        <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-card">
          <h2 className="text-xl font-black text-navy">Latest Progress</h2>
          {!latestStudentReport ? (
            <EmptyState title="No progress updates yet" description="Your progress updates will appear here after your coach or academy adds them." />
          ) : (
            <div className="mt-4 grid gap-5 xl:grid-cols-[1fr_1.2fr]">
              <div className="rounded-2xl bg-blue-50 p-5">
                <div className="text-sm font-black uppercase tracking-wide text-directBlue">Overall Progress</div>
                <div className="mt-2 text-5xl font-black text-navy">{latestStudentReport.ratings.overall}/5</div>
                <p className="mt-3 text-sm font-semibold text-slate-600">{latestStudentReport.nextFocus || 'No next focus added.'}</p>
              </div>
              <div className="grid gap-3 md:grid-cols-3">
                {ratingFields.map((field) => (
                  <div className="rounded-2xl border border-slate-200 p-4" key={field.key}>
                    <div className="text-xs font-black uppercase tracking-wide text-slate-400">{field.label}</div>
                    <div className="mt-1 text-xl font-black text-navy">{latestStudentReport.ratings[field.key] || 'No data'}</div>
                  </div>
                ))}
              </div>
              <div className="xl:col-span-2 grid gap-4 md:grid-cols-2">
                <DetailCard label="Strengths" value={latestStudentReport.strengths} />
                <DetailCard label="Weaknesses" value={latestStudentReport.weaknesses} />
                <DetailCard label="Coach Notes" value={latestStudentReport.coachNotes} />
                <DetailCard label="Attendance" value={`${getAttendancePercentage(latestStudentReport.studentId, attendanceRecords) ?? 'No data'}${getAttendancePercentage(latestStudentReport.studentId, attendanceRecords) === null ? '' : '%'}`} />
              </div>
            </div>
          )}
        </section>
      ) : (
        <>
          <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-card">
            <h2 className="text-xl font-black text-navy">Add Progress Update</h2>
            <div className="mt-5 grid gap-4 md:grid-cols-3">
              <FormSelect
                label="Student"
                value={selectedStudentId}
                onChange={(event) => setSelectedStudentId(event.target.value)}
                options={[{ label: students.length ? 'Select student' : 'No students available', value: '' }, ...students.map((student) => ({ label: student.name, value: student.id }))]}
              />
              <FormInput label="Date" type="date" value={selectedDate} onChange={(event) => setSelectedDate(event.target.value)} />
              <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                <div className="text-xs font-black uppercase tracking-wide text-slate-400">Batch</div>
                <div className="mt-1 text-sm font-black text-navy">{selectedBatch?.name ?? 'Not assigned'}</div>
              </div>
            </div>
            <RatingGrid ratings={ratings} onChange={(key, value) => updateRating(key, value)} />
            <NotesGrid
              coachNotes={coachNotes}
              nextFocus={nextFocus}
              setCoachNotes={setCoachNotes}
              setNextFocus={setNextFocus}
              setStrengths={setStrengths}
              setWeaknesses={setWeaknesses}
              strengths={strengths}
              weaknesses={weaknesses}
            />
            <div className="mt-5 flex justify-end gap-3">
              <button className="rounded-2xl border border-slate-200 bg-white px-5 py-3 text-sm font-black text-navy" onClick={resetForm} type="button">Cancel</button>
              <button
                aria-label="Add progress"
                className="inline-flex items-center gap-2 rounded-2xl bg-directBlue px-5 py-3 text-sm font-black text-white disabled:cursor-not-allowed disabled:opacity-60"
                disabled={saving || !selectedStudentId}
                onClick={saveProgress}
                title="Add progress"
                type="button"
              >
                <Save size={16} /> Save Progress
              </button>
            </div>
          </section>

          {isCoachMode && students.length === 0 ? <EmptyState title="No batches assigned yet" description="Assigned students will appear here after active batches are assigned to this coach." /> : null}

          <section>
            <div className="mb-3 flex flex-wrap items-end justify-between gap-3">
              <h2 className="text-xl font-black text-navy">Student Progress List</h2>
              <div className="grid w-full gap-3 md:grid-cols-3 xl:grid-cols-6">
                <FormSelect label="Student" value={studentFilter} onChange={(event) => setStudentFilter(event.target.value)} options={[{ label: 'All students', value: '' }, ...students.map((student) => ({ label: student.name, value: student.id }))]} />
                <FormSelect label="Batch" value={batchFilter} onChange={(event) => setBatchFilter(event.target.value)} options={[{ label: 'All batches', value: '' }, ...batches.map((batch) => ({ label: batch.name, value: batch.id }))]} />
                <FormSelect label="Coach" value={coachFilter} onChange={(event) => setCoachFilter(event.target.value)} options={[{ label: 'All coaches', value: '' }, ...coachOptions]} disabled={isCoachMode} />
                <FormSelect label="Rating" value={ratingFilter} onChange={(event) => setRatingFilter(event.target.value)} options={[{ label: 'All ratings', value: '' }, ...[1, 2, 3, 4, 5].map((rating) => ({ label: `${rating}`, value: `${rating}` }))]} />
                <FormInput label="From" type="date" value={startDateFilter} onChange={(event) => setStartDateFilter(event.target.value)} />
                <FormInput label="To" type="date" value={endDateFilter} onChange={(event) => setEndDateFilter(event.target.value)} />
              </div>
              <label className="flex items-center gap-2 text-sm font-black text-slate-600">
                <input checked={needsAttentionOnly} onChange={(event) => setNeedsAttentionOnly(event.target.checked)} type="checkbox" />
                Needs attention
              </label>
            </div>
            {filteredStudents.length === 0 ? (
              <EmptyState title="No progress records found" description="Students will appear here when they match the selected filters." />
            ) : (
              <DataTable columns={['Student', 'Batch', 'Latest Rating', 'Latest Date', 'Next Focus', 'Attendance', 'Actions']}>
                {filteredStudents.map((student) => {
                  const latest = latestByStudent.get(student.id);
                  const batch = getStudentBatch(student.id, batches);
                  return (
                    <tr className="border-t border-slate-100" key={student.id}>
                      <td className="px-5 py-4 font-black text-navy">{student.name}</td>
                      <td className="px-5 py-4 text-slate-600">{batch?.name ?? 'Not assigned'}</td>
                      <td className="px-5 py-4 text-slate-600">{latest ? `${latest.ratings.overall}/5` : 'No progress'}</td>
                      <td className="px-5 py-4 text-slate-600">{latest?.date ?? 'No date'}</td>
                      <td className="px-5 py-4 text-slate-600">{latest?.nextFocus || 'Not added'}</td>
                      <td className="px-5 py-4 text-slate-600">{getAttendancePercentage(student.id, attendanceRecords) ?? 'No data'}{getAttendancePercentage(student.id, attendanceRecords) === null ? '' : '%'}</td>
                      <td className="px-5 py-4">
                        <div className="flex gap-2">
                          {latest ? <button aria-label="View progress" className="rounded-xl bg-blue-50 px-3 py-2 text-xs font-black text-directBlue" onClick={() => setViewReport(latest)} title="View progress" type="button">View</button> : null}
                          <button aria-label="Add progress" className="rounded-xl bg-slate-100 px-3 py-2 text-xs font-black text-navy" onClick={() => setSelectedStudentId(student.id)} title="Add progress" type="button">Add</button>
                          {latest ? <button aria-label="Edit progress" className="rounded-xl bg-slate-100 px-3 py-2 text-xs font-black text-navy" onClick={() => openEdit(latest)} title="Edit progress" type="button">Edit</button> : null}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </DataTable>
            )}
          </section>
        </>
      )}

      <section>
        <h2 className="mb-3 text-xl font-black text-navy">Progress History</h2>
        {studentProgressHistory.length === 0 ? (
          <EmptyState title="No progress updates yet" description="Progress updates will appear here after they are saved." />
        ) : (
          <DataTable columns={['Date', 'Student', 'Overall', 'Strengths', 'Weaknesses', 'Next Focus', 'Created By', 'Action']}>
            {studentProgressHistory.map((report) => (
              <tr className="border-t border-slate-100" key={report.id}>
                <td className="px-5 py-4 font-black text-navy">{report.date}</td>
                <td className="px-5 py-4 text-slate-600">{report.studentName}</td>
                <td className="px-5 py-4 text-slate-600">{report.ratings.overall}/5</td>
                <td className="px-5 py-4 text-slate-600">{report.strengths || 'Not added'}</td>
                <td className="px-5 py-4 text-slate-600">{report.weaknesses || 'Not added'}</td>
                <td className="px-5 py-4 text-slate-600">{report.nextFocus || 'Not added'}</td>
                <td className="px-5 py-4 text-slate-600">{report.createdByName}</td>
                <td className="px-5 py-4">
                  <button aria-label="View progress" className="rounded-xl bg-blue-50 px-3 py-2 text-xs font-black text-directBlue" onClick={() => setViewReport(report)} title="View progress" type="button">View</button>
                </td>
              </tr>
            ))}
          </DataTable>
        )}
      </section>

      {isStudentMode && classReports.length ? (
        <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-card">
          <h2 className="text-xl font-black text-navy">Recent Class Reports</h2>
          <div className="mt-3 grid gap-3">
            {classReports.slice(0, 3).map((report) => (
              <div className="rounded-2xl border border-slate-200 p-4" key={report.id}>
                <div className="font-black text-navy">{report.date ?? 'No date'} · {report.batchName ?? 'Batch'}</div>
                <p className="mt-1 text-sm text-slate-600">{report.topicCovered ?? 'Class report'}</p>
                <p className="mt-2 text-sm text-slate-600">{report.homeworkGiven ?? 'No homework added.'}</p>
              </div>
            ))}
          </div>
        </section>
      ) : null}

      <ProgressDetailModal report={viewReport} onClose={() => setViewReport(null)} />
      <Modal title="Edit Progress" description={editReport ? `${editReport.studentName} · ${editReport.date}` : undefined} open={Boolean(editReport)} onClose={() => setEditReport(null)}>
        {editReport ? (
          <div className="space-y-4">
            <FormInput label="Date" type="date" value={editReport.date} onChange={(event) => setEditReport({ ...editReport, date: event.target.value })} />
            <RatingGrid ratings={editReport.ratings} onChange={(key, value) => updateRating(key, value, true)} />
            <NotesGrid
              coachNotes={editReport.coachNotes}
              nextFocus={editReport.nextFocus}
              setCoachNotes={(value) => setEditReport({ ...editReport, coachNotes: value })}
              setNextFocus={(value) => setEditReport({ ...editReport, nextFocus: value })}
              setStrengths={(value) => setEditReport({ ...editReport, strengths: value })}
              setWeaknesses={(value) => setEditReport({ ...editReport, weaknesses: value })}
              strengths={editReport.strengths}
              weaknesses={editReport.weaknesses}
            />
            <div className="flex justify-end">
              <button className="rounded-2xl bg-directBlue px-5 py-3 text-sm font-black text-white disabled:cursor-not-allowed disabled:opacity-60" disabled={saving} onClick={saveEdit} type="button">
                {saving ? 'Saving...' : 'Save Changes'}
              </button>
            </div>
          </div>
        ) : null}
      </Modal>
    </div>
  );
}

function DetailCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-slate-200 p-4">
      <div className="text-xs font-black uppercase tracking-wide text-slate-400">{label}</div>
      <div className="mt-1 text-sm font-semibold text-slate-600">{value || 'Not added'}</div>
    </div>
  );
}

function RatingGrid({ ratings, onChange }: { ratings: Ratings; onChange: (key: keyof Ratings, value: string) => void }) {
  return (
    <div className="mt-5 grid gap-3 md:grid-cols-3">
      {ratingFields.map((field) => (
        <FormSelect
          key={field.key}
          label={field.label}
          onChange={(event) => onChange(field.key, event.target.value)}
          options={[
            { label: 'Not rated', value: '0' },
            { label: '1', value: '1' },
            { label: '2', value: '2' },
            { label: '3', value: '3' },
            { label: '4', value: '4' },
            { label: '5', value: '5' },
          ]}
          value={String(ratings[field.key])}
        />
      ))}
    </div>
  );
}

function NotesGrid({
  coachNotes,
  nextFocus,
  setCoachNotes,
  setNextFocus,
  setStrengths,
  setWeaknesses,
  strengths,
  weaknesses,
}: {
  coachNotes: string;
  nextFocus: string;
  setCoachNotes: (value: string) => void;
  setNextFocus: (value: string) => void;
  setStrengths: (value: string) => void;
  setWeaknesses: (value: string) => void;
  strengths: string;
  weaknesses: string;
}) {
  return (
    <div className="mt-5 grid gap-4 md:grid-cols-2">
      {[
        ['Strengths', strengths, setStrengths],
        ['Weaknesses', weaknesses, setWeaknesses],
        ['Next focus', nextFocus, setNextFocus],
        ['Coach notes', coachNotes, setCoachNotes],
      ].map(([label, value, setter]) => (
        <label className="grid gap-2 text-sm font-bold text-slate-700" key={String(label)}>
          {label as string}
          <textarea
            className="min-h-24 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-navy outline-none transition focus:border-directBlue focus:ring-4 focus:ring-blue-100"
            onChange={(event) => (setter as (value: string) => void)(event.target.value)}
            value={value as string}
          />
        </label>
      ))}
    </div>
  );
}

function ProgressDetailModal({ report, onClose }: { report: ProgressReport | null; onClose: () => void }) {
  return (
    <Modal title="View Progress" description={report ? `${report.studentName} · ${report.date}` : undefined} open={Boolean(report)} onClose={onClose}>
      {report ? (
        <div className="space-y-4">
          <div className="grid gap-3 md:grid-cols-3">
            {ratingFields.map((field) => (
              <div className="rounded-2xl border border-slate-200 p-4" key={field.key}>
                <div className="text-xs font-black uppercase tracking-wide text-slate-400">{field.label}</div>
                <div className="mt-1 text-xl font-black text-navy">{report.ratings[field.key] || 'Not rated'}</div>
              </div>
            ))}
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            <DetailCard label="Batch" value={report.batchName ?? 'Not assigned'} />
            <DetailCard label="Coach" value={report.coachName ?? 'Not assigned'} />
            <DetailCard label="Strengths" value={report.strengths} />
            <DetailCard label="Weaknesses" value={report.weaknesses} />
            <DetailCard label="Next Focus" value={report.nextFocus} />
            <DetailCard label="Coach Notes" value={report.coachNotes} />
            <DetailCard label="Created By" value={report.createdByName} />
            <DetailCard label="Updated" value={formatFirestoreDate(report.updatedAt)} />
          </div>
        </div>
      ) : null}
    </Modal>
  );
}

export function AcademyProgressPage() {
  return <ProgressSystemPage mode="academy" />;
}

export function CoachProgressPage() {
  return <ProgressSystemPage mode="coach" />;
}

export function StudentProgressPage() {
  return <ProgressSystemPage mode="student" />;
}
