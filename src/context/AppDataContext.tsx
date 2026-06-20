import { createContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { attendanceRecords as seedAttendanceRecords, classReports as seedClassReports, feeRecords as seedFeeRecords, seedAcademy, seedBatches, seedCoaches, seedStudents } from '../data/mockData';
import type { Academy, AttendanceEntry, AttendanceRecord, Batch, ClassReport, Coach, FeeRecord, FeeStatus, Student } from '../types';

const STORAGE_KEY = 'kairoyr-direct-phase2-data';

type AppDataState = {
  academy: Academy;
  students: Student[];
  coaches: Coach[];
  batches: Batch[];
  attendanceRecords: AttendanceRecord[];
  classReports: ClassReport[];
  feeRecords: FeeRecord[];
};

type StudentInput = Omit<Student, 'id' | 'joinedAt'>;
type CoachInput = Omit<Coach, 'id' | 'joinedAt'>;
type BatchInput = Omit<Batch, 'id'>;
type AttendanceInput = Omit<AttendanceRecord, 'id' | 'createdAt' | 'updatedAt'>;
type ClassReportInput = Omit<ClassReport, 'id' | 'createdAt' | 'updatedAt'>;
type FeeRecordInput = Omit<FeeRecord, 'id' | 'createdAt' | 'updatedAt'>;

type AppDataContextValue = AppDataState & {
  updateAcademy: (academy: Academy) => void;
  addStudent: (student: StudentInput) => void;
  updateStudent: (id: string, student: StudentInput) => void;
  deleteStudent: (id: string) => void;
  addCoach: (coach: CoachInput) => void;
  updateCoach: (id: string, coach: CoachInput) => void;
  deleteCoach: (id: string) => void;
  addBatch: (batch: BatchInput) => void;
  updateBatch: (id: string, batch: BatchInput) => void;
  deleteBatch: (id: string) => void;
  addAttendanceRecord: (record: AttendanceInput) => void;
  updateAttendanceRecord: (id: string, record: AttendanceInput) => void;
  deleteAttendanceRecord: (id: string) => void;
  addClassReport: (report: ClassReportInput) => void;
  updateClassReport: (id: string, report: ClassReportInput) => void;
  deleteClassReport: (id: string) => void;
  addFeeRecord: (record: FeeRecordInput) => void;
  updateFeeRecord: (id: string, record: FeeRecordInput) => void;
  deleteFeeRecord: (id: string) => void;
  getStudentsByBatch: (batchId: string) => Student[];
  getBatchesByCoach: (coachId: string) => Batch[];
  getStudentCountForBatch: (batchId: string) => number;
  getStudentCountForCoach: (coachId: string) => number;
  getCoachName: (coachId?: string) => string;
  getBatchName: (batchId?: string) => string;
  getAttendanceByBatch: (batchId: string) => AttendanceRecord[];
  getAttendanceByStudent: (studentId: string) => AttendanceRecord[];
  getAttendanceForDate: (date: string) => AttendanceRecord[];
  getAttendanceRecord: (batchId: string, date: string) => AttendanceRecord | undefined;
  getStudentAttendancePercentage: (studentId: string) => number | null;
  getBatchAttendancePercentage: (batchId: string) => number | null;
  getAttendanceSummaryForDate: (date: string) => {
    records: number;
    present: number;
    absent: number;
    late: number;
    excused: number;
    total: number;
    percentage: number | null;
  };
  getReportsByBatch: (batchId: string) => ClassReport[];
  getReportsByStudent: (studentId: string) => ClassReport[];
  getReportsForDate: (date: string) => ClassReport[];
  getClassReport: (batchId: string, date: string) => ClassReport | undefined;
  getReportsByCoach: (coachId: string) => ClassReport[];
  getReportAttendanceSummary: (reportId: string) => {
    present: number;
    absent: number;
    late: number;
    excused: number;
    total: number;
    percentage: number | null;
  } | null;
  getRecentReports: (limit: number) => ClassReport[];
  getReportCountForBatch: (batchId: string) => number;
  getReportCountForStudent: (studentId: string) => number;
  getFeeRecordsByStudent: (studentId: string) => FeeRecord[];
  getFeeRecordsByBatch: (batchId: string) => FeeRecord[];
  getFeeRecordForStudentMonth: (studentId: string, month: number, year: number) => FeeRecord | undefined;
  getLatestFeeRecordForStudent: (studentId: string) => FeeRecord | undefined;
  getStudentCurrentFeeStatus: (studentId: string) => FeeStatus | null;
  getTotalFeesCollected: (month?: number, year?: number) => number;
  getTotalPendingFees: (month?: number, year?: number) => number;
  getTotalOverdueFees: (month?: number, year?: number) => number;
  getFeeSummaryForMonth: (month: number, year: number) => {
    collected: number;
    pending: number;
    overdue: number;
    waived: number;
    expected: number;
    paidCount: number;
    pendingCount: number;
    overdueCount: number;
    waivedCount: number;
    totalCount: number;
  };
  generateMonthlyFeeRecords: (month: number, year: number, dueDate: string, defaultAmount?: number) => { created: number; skipped: number };
  getStudentById: (studentId?: string) => Student | undefined;
  getStudentAttendanceRecords: (studentId: string) => Array<{ record: AttendanceRecord; entry: AttendanceEntry }>;
  getStudentAttendanceStats: (studentId: string) => {
    total: number;
    present: number;
    absent: number;
    late: number;
    excused: number;
    percentage: number | null;
  };
  getStudentReports: (studentId: string) => ClassReport[];
  getStudentFeeRecords: (studentId: string) => FeeRecord[];
  getStudentFeeSummary: (studentId: string) => {
    collected: number;
    pending: number;
    overdue: number;
    waived: number;
    totalRecords: number;
    latest?: FeeRecord;
  };
  getStudentLatestActivity: (studentId: string) => {
    attendance?: { record: AttendanceRecord; entry: AttendanceEntry };
    report?: ClassReport;
    fee?: FeeRecord;
  };
  getStudentBatch: (studentId: string) => Batch | undefined;
  getStudentCoach: (studentId: string) => Coach | undefined;
};

export const AppDataContext = createContext<AppDataContextValue | undefined>(undefined);

const initialState: AppDataState = {
  academy: seedAcademy,
  students: seedStudents,
  coaches: seedCoaches,
  batches: seedBatches,
  attendanceRecords: seedAttendanceRecords,
  classReports: seedClassReports,
  feeRecords: seedFeeRecords,
};

const DEFAULT_MONTHLY_FEE = 2000;

function getLatestFeeRecordFrom(records: FeeRecord[], studentId: string) {
  return records
    .filter((record) => record.studentId === studentId)
    .sort((a, b) => {
      const monthDelta = b.year * 12 + b.month - (a.year * 12 + a.month);
      if (monthDelta !== 0) return monthDelta;
      return b.updatedAt.localeCompare(a.updatedAt);
    })[0];
}

function syncStudentFeeStatuses(students: Student[], records: FeeRecord[]) {
  return students.map((student) => {
    const latest = getLatestFeeRecordFrom(records, student.id);
    return latest ? { ...student, feeStatus: latest.status } : student;
  });
}

function normalizeStudents(students: Student[]) {
  return students.map((student) => ({
    ...student,
    monthlyFee: Number.isFinite(student.monthlyFee) ? student.monthlyFee : DEFAULT_MONTHLY_FEE,
    feeStatus: student.feeStatus ?? 'pending',
    internalNotes: student.internalNotes ?? '',
    goals: student.goals ?? '',
    strengths: student.strengths ?? '',
    improvementAreas: student.improvementAreas ?? '',
  }));
}

function normalizeFeeRecord(record: FeeRecord): FeeRecord {
  const now = new Date().toISOString();
  const monthFromDueDate = record.dueDate ? new Date(record.dueDate).getMonth() + 1 : new Date().getMonth() + 1;
  const yearFromDueDate = record.dueDate ? new Date(record.dueDate).getFullYear() : new Date().getFullYear();
  return {
    ...record,
    batchId: record.batchId ?? '',
    month: record.month ?? monthFromDueDate,
    year: record.year ?? yearFromDueDate,
    status: record.status ?? 'pending',
    createdAt: record.createdAt ?? now,
    updatedAt: record.updatedAt ?? now,
  };
}

function normalizeState(parsed: AppDataState): AppDataState {
  const students = normalizeStudents(Array.isArray(parsed.students) ? parsed.students : seedStudents);
  const feeRecords = Array.isArray(parsed.feeRecords) ? parsed.feeRecords.map(normalizeFeeRecord) : seedFeeRecords;
  return {
    ...parsed,
    academy: parsed.academy ?? seedAcademy,
    students: syncStudentFeeStatuses(students, feeRecords),
    coaches: Array.isArray(parsed.coaches) ? parsed.coaches : seedCoaches,
    batches: Array.isArray(parsed.batches) ? parsed.batches : seedBatches,
    attendanceRecords: Array.isArray(parsed.attendanceRecords) ? parsed.attendanceRecords : seedAttendanceRecords,
    classReports: Array.isArray(parsed.classReports) ? parsed.classReports : seedClassReports,
    feeRecords,
  };
}

function loadInitialState() {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) return initialState;
    const parsed = JSON.parse(stored) as AppDataState;
    if (!parsed.academy || !Array.isArray(parsed.students) || !Array.isArray(parsed.coaches) || !Array.isArray(parsed.batches)) {
      return initialState;
    }
    return normalizeState(parsed);
  } catch {
    return initialState;
  }
}

function createId(prefix: string) {
  return `${prefix}-${crypto.randomUUID?.() ?? Date.now().toString(36)}`;
}

export function AppDataProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AppDataState>(loadInitialState);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }, [state]);

  const value = useMemo<AppDataContextValue>(() => {
    const getStudentsByBatch = (batchId: string) => state.students.filter((student) => student.batchId === batchId);
    const getBatchesByCoach = (coachId: string) => state.batches.filter((batch) => batch.coachId === coachId);
    const getStudentCountForBatch = (batchId: string) => getStudentsByBatch(batchId).length;
    const getStudentCountForCoach = (coachId: string) =>
      getBatchesByCoach(coachId).reduce((total, batch) => total + getStudentCountForBatch(batch.id), 0);
    const getAttendanceByBatch = (batchId: string) => state.attendanceRecords.filter((record) => record.batchId === batchId);
    const getAttendanceByStudent = (studentId: string) =>
      state.attendanceRecords.filter((record) => record.entries.some((entry) => entry.studentId === studentId));
    const getAttendanceForDate = (date: string) => state.attendanceRecords.filter((record) => record.date === date);
    const getAttendanceRecord = (batchId: string, date: string) =>
      state.attendanceRecords.find((record) => record.batchId === batchId && record.date === date);
    const getPresentLikeCount = (records: AttendanceRecord[]) =>
      records.reduce(
        (total, record) => total + record.entries.filter((entry) => entry.status === 'present' || entry.status === 'late').length,
        0,
      );
    const getEntryCount = (records: AttendanceRecord[]) => records.reduce((total, record) => total + record.entries.length, 0);
    const getStudentAttendancePercentage = (studentId: string) => {
      const entries = state.attendanceRecords.flatMap((record) => record.entries.filter((entry) => entry.studentId === studentId));
      if (entries.length === 0) return null;
      const attended = entries.filter((entry) => entry.status === 'present' || entry.status === 'late').length;
      return Math.round((attended / entries.length) * 100);
    };
    const getBatchAttendancePercentage = (batchId: string) => {
      const records = getAttendanceByBatch(batchId);
      const total = getEntryCount(records);
      if (total === 0) return null;
      return Math.round((getPresentLikeCount(records) / total) * 100);
    };
    const getAttendanceSummaryForDate = (date: string) => {
      const records = getAttendanceForDate(date);
      const entries = records.flatMap((record) => record.entries);
      const present = entries.filter((entry) => entry.status === 'present').length;
      const absent = entries.filter((entry) => entry.status === 'absent').length;
      const late = entries.filter((entry) => entry.status === 'late').length;
      const excused = entries.filter((entry) => entry.status === 'excused').length;
      const total = entries.length;
      return {
        records: records.length,
        present,
        absent,
        late,
        excused,
        total,
        percentage: total === 0 ? null : Math.round(((present + late) / total) * 100),
      };
    };
    const getReportsByBatch = (batchId: string) => state.classReports.filter((report) => report.batchId === batchId);
    const getReportsForDate = (date: string) => state.classReports.filter((report) => report.date === date);
    const getClassReport = (batchId: string, date: string) =>
      state.classReports.find((report) => report.batchId === batchId && report.date === date);
    const getReportsByCoach = (coachId: string) => state.classReports.filter((report) => report.coachId === coachId);
    const getReportsByStudent = (studentId: string) =>
      state.classReports.filter((report) => {
        const inReportBatch = state.students.some((student) => student.id === studentId && student.batchId === report.batchId);
        const hasNote = report.studentNotes.some((note) => note.studentId === studentId);
        return inReportBatch || hasNote;
      });
    const getReportAttendanceSummary = (reportId: string) => {
      const report = state.classReports.find((item) => item.id === reportId);
      if (!report?.attendanceRecordId) return null;
      const attendance = state.attendanceRecords.find((record) => record.id === report.attendanceRecordId);
      if (!attendance) return null;
      const present = attendance.entries.filter((entry) => entry.status === 'present').length;
      const absent = attendance.entries.filter((entry) => entry.status === 'absent').length;
      const late = attendance.entries.filter((entry) => entry.status === 'late').length;
      const excused = attendance.entries.filter((entry) => entry.status === 'excused').length;
      const total = attendance.entries.length;
      return {
        present,
        absent,
        late,
        excused,
        total,
        percentage: total === 0 ? null : Math.round(((present + late) / total) * 100),
      };
    };
    const getRecentReports = (limit: number) =>
      [...state.classReports]
        .sort((a, b) => `${b.date}-${b.updatedAt}`.localeCompare(`${a.date}-${a.updatedAt}`))
        .slice(0, limit);
    const getReportCountForBatch = (batchId: string) => getReportsByBatch(batchId).length;
    const getReportCountForStudent = (studentId: string) => getReportsByStudent(studentId).length;
    const filterFeeRecordsForMonth = (month?: number, year?: number) =>
      state.feeRecords.filter((record) => (month ? record.month === month : true) && (year ? record.year === year : true));
    const getFeeRecordsByStudent = (studentId: string) => state.feeRecords.filter((record) => record.studentId === studentId);
    const getFeeRecordsByBatch = (batchId: string) => state.feeRecords.filter((record) => record.batchId === batchId);
    const getFeeRecordForStudentMonth = (studentId: string, month: number, year: number) =>
      state.feeRecords.find((record) => record.studentId === studentId && record.month === month && record.year === year);
    const getLatestFeeRecordForStudent = (studentId: string) => getLatestFeeRecordFrom(state.feeRecords, studentId);
    const getStudentCurrentFeeStatus = (studentId: string) => {
      const latest = getLatestFeeRecordForStudent(studentId);
      if (latest) return latest.status;
      return state.students.find((student) => student.id === studentId)?.feeStatus ?? null;
    };
    const getTotalFeesCollected = (month?: number, year?: number) =>
      filterFeeRecordsForMonth(month, year)
        .filter((record) => record.status === 'paid')
        .reduce((total, record) => total + record.amount, 0);
    const getTotalPendingFees = (month?: number, year?: number) =>
      filterFeeRecordsForMonth(month, year)
        .filter((record) => record.status === 'pending')
        .reduce((total, record) => total + record.amount, 0);
    const getTotalOverdueFees = (month?: number, year?: number) =>
      filterFeeRecordsForMonth(month, year)
        .filter((record) => record.status === 'overdue')
        .reduce((total, record) => total + record.amount, 0);
    const getFeeSummaryForMonth = (month: number, year: number) => {
      const records = filterFeeRecordsForMonth(month, year);
      const byStatus = (status: FeeStatus) => records.filter((record) => record.status === status);
      const sum = (items: FeeRecord[]) => items.reduce((total, record) => total + record.amount, 0);
      const paid = byStatus('paid');
      const pending = byStatus('pending');
      const overdue = byStatus('overdue');
      const waived = byStatus('waived');
      return {
        collected: sum(paid),
        pending: sum(pending),
        overdue: sum(overdue),
        waived: sum(waived),
        expected: sum(records.filter((record) => record.status !== 'waived')),
        paidCount: paid.length,
        pendingCount: pending.length,
        overdueCount: overdue.length,
        waivedCount: waived.length,
        totalCount: records.length,
      };
    };
    const getStudentById = (studentId?: string) => state.students.find((student) => student.id === studentId);
    const getStudentAttendanceRecords = (studentId: string) =>
      state.attendanceRecords
        .flatMap((record) => {
          const entry = record.entries.find((item) => item.studentId === studentId);
          return entry ? [{ record, entry }] : [];
        })
        .sort((a, b) => b.record.date.localeCompare(a.record.date));
    const getStudentAttendanceStats = (studentId: string) => {
      const entries = getStudentAttendanceRecords(studentId).map((item) => item.entry);
      const present = entries.filter((entry) => entry.status === 'present').length;
      const absent = entries.filter((entry) => entry.status === 'absent').length;
      const late = entries.filter((entry) => entry.status === 'late').length;
      const excused = entries.filter((entry) => entry.status === 'excused').length;
      const total = entries.length;
      return {
        total,
        present,
        absent,
        late,
        excused,
        percentage: total === 0 ? null : Math.round(((present + late) / total) * 100),
      };
    };
    const getStudentReports = (studentId: string) =>
      getReportsByStudent(studentId).sort((a, b) => `${b.date}-${b.updatedAt}`.localeCompare(`${a.date}-${a.updatedAt}`));
    const getStudentFeeRecords = (studentId: string) =>
      getFeeRecordsByStudent(studentId).sort((a, b) => {
        const monthDelta = b.year * 12 + b.month - (a.year * 12 + a.month);
        if (monthDelta !== 0) return monthDelta;
        return b.updatedAt.localeCompare(a.updatedAt);
      });
    const getStudentFeeSummary = (studentId: string) => {
      const records = getStudentFeeRecords(studentId);
      const sumByStatus = (status: FeeStatus) =>
        records.filter((record) => record.status === status).reduce((total, record) => total + record.amount, 0);
      return {
        collected: sumByStatus('paid'),
        pending: sumByStatus('pending'),
        overdue: sumByStatus('overdue'),
        waived: sumByStatus('waived'),
        totalRecords: records.length,
        latest: records[0],
      };
    };
    const getStudentLatestActivity = (studentId: string) => ({
      attendance: getStudentAttendanceRecords(studentId)[0],
      report: getStudentReports(studentId)[0],
      fee: getStudentFeeRecords(studentId)[0],
    });
    const getStudentBatch = (studentId: string) => {
      const student = getStudentById(studentId);
      return state.batches.find((batch) => batch.id === student?.batchId);
    };
    const getStudentCoach = (studentId: string) => {
      const batch = getStudentBatch(studentId);
      return state.coaches.find((coach) => coach.id === batch?.coachId);
    };

    return {
      ...state,
      updateAcademy: (academy) => setState((current) => ({ ...current, academy })),
      addStudent: (student) =>
        setState((current) => ({
          ...current,
          students: [...current.students, { ...student, id: createId('student'), joinedAt: new Date().toISOString().slice(0, 10) }],
        })),
      updateStudent: (id, student) =>
        setState((current) => ({
          ...current,
          students: current.students.map((item) => (item.id === id ? { ...item, ...student } : item)),
        })),
      deleteStudent: (id) =>
        setState((current) => ({
          ...current,
          students: current.students.filter((student) => student.id !== id),
        })),
      addCoach: (coach) =>
        setState((current) => ({
          ...current,
          coaches: [...current.coaches, { ...coach, id: createId('coach'), joinedAt: new Date().toISOString().slice(0, 10) }],
        })),
      updateCoach: (id, coach) =>
        setState((current) => ({
          ...current,
          coaches: current.coaches.map((item) => (item.id === id ? { ...item, ...coach } : item)),
        })),
      deleteCoach: (id) =>
        setState((current) => ({
          ...current,
          coaches: current.coaches.filter((coach) => coach.id !== id),
          batches: current.batches.map((batch) => (batch.coachId === id ? { ...batch, coachId: '' } : batch)),
        })),
      addBatch: (batch) =>
        setState((current) => ({
          ...current,
          batches: [...current.batches, { ...batch, id: createId('batch') }],
        })),
      updateBatch: (id, batch) =>
        setState((current) => ({
          ...current,
          batches: current.batches.map((item) => (item.id === id ? { ...item, ...batch } : item)),
        })),
      deleteBatch: (id) =>
        setState((current) => ({
          ...current,
          batches: current.batches.filter((batch) => batch.id !== id),
          students: current.students.map((student) => (student.batchId === id ? { ...student, batchId: '' } : student)),
        })),
      addAttendanceRecord: (record) =>
        setState((current) => {
          const now = new Date().toISOString();
          const existing = current.attendanceRecords.find((item) => item.batchId === record.batchId && item.date === record.date);
          if (existing) {
            return {
              ...current,
              attendanceRecords: current.attendanceRecords.map((item) =>
                item.id === existing.id ? { ...item, ...record, updatedAt: now } : item,
              ),
            };
          }
          return {
            ...current,
            attendanceRecords: [...current.attendanceRecords, { ...record, id: createId('attendance'), createdAt: now, updatedAt: now }],
          };
        }),
      updateAttendanceRecord: (id, record) =>
        setState((current) => ({
          ...current,
          attendanceRecords: current.attendanceRecords.map((item) =>
            item.id === id ? { ...item, ...record, updatedAt: new Date().toISOString() } : item,
          ),
        })),
      deleteAttendanceRecord: (id) =>
        setState((current) => ({
          ...current,
          attendanceRecords: current.attendanceRecords.filter((record) => record.id !== id),
          classReports: current.classReports.map((report) => (report.attendanceRecordId === id ? { ...report, attendanceRecordId: undefined } : report)),
        })),
      addClassReport: (report) =>
        setState((current) => {
          const now = new Date().toISOString();
          const existing = current.classReports.find((item) => item.batchId === report.batchId && item.date === report.date);
          if (existing) {
            return {
              ...current,
              classReports: current.classReports.map((item) =>
                item.id === existing.id ? { ...item, ...report, updatedAt: now } : item,
              ),
            };
          }
          return {
            ...current,
            classReports: [...current.classReports, { ...report, id: createId('report'), createdAt: now, updatedAt: now }],
          };
        }),
      updateClassReport: (id, report) =>
        setState((current) => ({
          ...current,
          classReports: current.classReports.map((item) =>
            item.id === id ? { ...item, ...report, updatedAt: new Date().toISOString() } : item,
          ),
        })),
      deleteClassReport: (id) =>
        setState((current) => ({
          ...current,
          classReports: current.classReports.filter((report) => report.id !== id),
        })),
      addFeeRecord: (record) =>
        setState((current) => {
          const now = new Date().toISOString();
          const existing = current.feeRecords.find(
            (item) => item.studentId === record.studentId && item.month === record.month && item.year === record.year,
          );
          const feeRecords = existing
            ? current.feeRecords.map((item) => (item.id === existing.id ? { ...item, ...record, updatedAt: now } : item))
            : [...current.feeRecords, { ...record, id: createId('fee'), createdAt: now, updatedAt: now }];
          return {
            ...current,
            feeRecords,
            students: syncStudentFeeStatuses(current.students, feeRecords),
          };
        }),
      updateFeeRecord: (id, record) =>
        setState((current) => {
          const now = new Date().toISOString();
          const duplicate = current.feeRecords.find(
            (item) => item.id !== id && item.studentId === record.studentId && item.month === record.month && item.year === record.year,
          );
          const feeRecords = duplicate
            ? current.feeRecords
              .filter((item) => item.id !== id)
              .map((item) => (item.id === duplicate.id ? { ...item, ...record, updatedAt: now } : item))
            : current.feeRecords.map((item) => (item.id === id ? { ...item, ...record, updatedAt: now } : item));
          return {
            ...current,
            feeRecords,
            students: syncStudentFeeStatuses(current.students, feeRecords),
          };
        }),
      deleteFeeRecord: (id) =>
        setState((current) => {
          const feeRecords = current.feeRecords.filter((record) => record.id !== id);
          return {
            ...current,
            feeRecords,
            students: syncStudentFeeStatuses(current.students, feeRecords),
          };
        }),
      getStudentsByBatch,
      getBatchesByCoach,
      getStudentCountForBatch,
      getStudentCountForCoach,
      getCoachName: (coachId) => state.coaches.find((coach) => coach.id === coachId)?.name ?? 'Unassigned',
      getBatchName: (batchId) => state.batches.find((batch) => batch.id === batchId)?.name ?? 'Unassigned',
      getAttendanceByBatch,
      getAttendanceByStudent,
      getAttendanceForDate,
      getAttendanceRecord,
      getStudentAttendancePercentage,
      getBatchAttendancePercentage,
      getAttendanceSummaryForDate,
      getReportsByBatch,
      getReportsByStudent,
      getReportsForDate,
      getClassReport,
      getReportsByCoach,
      getReportAttendanceSummary,
      getRecentReports,
      getReportCountForBatch,
      getReportCountForStudent,
      getFeeRecordsByStudent,
      getFeeRecordsByBatch,
      getFeeRecordForStudentMonth,
      getLatestFeeRecordForStudent,
      getStudentCurrentFeeStatus,
      getTotalFeesCollected,
      getTotalPendingFees,
      getTotalOverdueFees,
      getFeeSummaryForMonth,
      getStudentById,
      getStudentAttendanceRecords,
      getStudentAttendanceStats,
      getStudentReports,
      getStudentFeeRecords,
      getStudentFeeSummary,
      getStudentLatestActivity,
      getStudentBatch,
      getStudentCoach,
      generateMonthlyFeeRecords: (month, year, dueDate, defaultAmount = DEFAULT_MONTHLY_FEE) => {
        const now = new Date().toISOString();
        const activeStudents = state.students.filter((student) => student.status === 'active');
        const createdRecords: FeeRecord[] = [];
        let skipped = 0;
        activeStudents.forEach((student) => {
          const exists = state.feeRecords.some((record) => record.studentId === student.id && record.month === month && record.year === year);
          if (exists) {
            skipped += 1;
            return;
          }
          createdRecords.push({
            id: createId('fee'),
            studentId: student.id,
            batchId: student.batchId,
            month,
            year,
            amount: student.monthlyFee || defaultAmount,
            status: 'pending',
            dueDate,
            createdAt: now,
            updatedAt: now,
          });
        });
        setState((current) => {
          const existingKeys = new Set(current.feeRecords.map((record) => `${record.studentId}-${record.month}-${record.year}`));
          const safeRecords = createdRecords.filter((record) => !existingKeys.has(`${record.studentId}-${record.month}-${record.year}`));
          const feeRecords = [...current.feeRecords, ...safeRecords];
          return {
            ...current,
            feeRecords,
            students: syncStudentFeeStatuses(current.students, feeRecords),
          };
        });
        return { created: createdRecords.length, skipped };
      },
    };
  }, [state]);

  return <AppDataContext.Provider value={value}>{children}</AppDataContext.Provider>;
}
