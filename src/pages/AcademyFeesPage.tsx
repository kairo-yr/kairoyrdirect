import { useEffect, useMemo, useState } from 'react';
import { collection, doc, getDocs, query, serverTimestamp, setDoc, updateDoc, where } from 'firebase/firestore';
import { CheckCircle2, Eye, IndianRupee, ReceiptText, RefreshCw } from 'lucide-react';
import { Badge } from '../components/ui/Badge';
import { DataTable } from '../components/ui/DataTable';
import { EmptyState } from '../components/ui/EmptyState';
import { FormInput } from '../components/ui/FormInput';
import { FormSelect } from '../components/ui/FormSelect';
import { Modal } from '../components/ui/Modal';
import { PageHeader } from '../components/ui/PageHeader';
import { StatCard } from '../components/ui/StatCard';
import { useAuth } from '../contexts/AuthContext';
import { db } from '../lib/firebase';
import type { AcademyStudentProfile } from '../types/auth';
import { createAuditLog } from '../utils/superAdminActions';

type FeeStatus = 'pending' | 'paid' | 'partial' | 'overdue' | 'waived';
type PaymentMode = 'cash' | 'upi' | 'bank' | 'other';

type BatchRecord = {
  id: string;
  name: string;
  studentIds?: string[];
  status?: string;
};

type FeeRecord = {
  id: string;
  academyId: string;
  studentId: string;
  studentName: string;
  batchId: string | null;
  batchName: string | null;
  month: string;
  amount: number;
  paidAmount: number;
  status: FeeStatus;
  dueDate: string;
  paidDate: string | null;
  paymentMode: PaymentMode | null;
  note: string;
  createdAt: unknown;
  updatedAt: unknown;
};

const paymentModeOptions: Array<{ label: string; value: PaymentMode }> = [
  { label: 'Cash', value: 'cash' },
  { label: 'UPI', value: 'upi' },
  { label: 'Bank', value: 'bank' },
  { label: 'Other', value: 'other' },
];

function getCurrentMonth() {
  const date = new Date();
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
}

function getTodayDate() {
  const date = new Date();
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

function defaultDueDate(month: string) {
  return `${month}-10`;
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat('en-IN', { currency: 'INR', maximumFractionDigits: 0, style: 'currency' }).format(value);
}

function statusClass(status: FeeStatus) {
  if (status === 'paid') return 'bg-emerald-50 text-emerald-700';
  if (status === 'partial') return 'bg-blue-50 text-directBlue';
  if (status === 'overdue') return 'bg-red-50 text-red-700';
  if (status === 'waived') return 'bg-slate-100 text-slate-700';
  return 'bg-amber-50 text-amber-700';
}

function displayStatus(record: FeeRecord): FeeStatus {
  if ((record.status === 'pending' || record.status === 'partial') && record.dueDate < getTodayDate()) return 'overdue';
  return record.status;
}

function getStudentBatch(studentId: string, batches: BatchRecord[]) {
  return batches.find((batch) => batch.studentIds?.includes(studentId)) ?? null;
}

export function AcademyFeesPage() {
  const { userProfile } = useAuth();
  const academyId = userProfile?.academyId;
  const [students, setStudents] = useState<AcademyStudentProfile[]>([]);
  const [batches, setBatches] = useState<BatchRecord[]>([]);
  const [fees, setFees] = useState<FeeRecord[]>([]);
  const [selectedMonth, setSelectedMonth] = useState(getCurrentMonth());
  const [statusFilter, setStatusFilter] = useState('');
  const [batchFilter, setBatchFilter] = useState('');
  const [search, setSearch] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [viewRecord, setViewRecord] = useState<FeeRecord | null>(null);
  const [paidRecord, setPaidRecord] = useState<FeeRecord | null>(null);
  const [partialRecord, setPartialRecord] = useState<FeeRecord | null>(null);
  const [waiveRecord, setWaiveRecord] = useState<FeeRecord | null>(null);
  const [editRecord, setEditRecord] = useState<FeeRecord | null>(null);
  const [paymentMode, setPaymentMode] = useState<PaymentMode>('upi');
  const [partialAmount, setPartialAmount] = useState('');
  const [actionNote, setActionNote] = useState('');

  const loadFees = async () => {
    if (!academyId || userProfile?.role !== 'academy_admin') {
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const [studentSnapshot, batchSnapshot, feeSnapshot] = await Promise.all([
        getDocs(collection(db, 'academies', academyId, 'students')),
        getDocs(collection(db, 'academies', academyId, 'batches')),
        getDocs(collection(db, 'academies', academyId, 'fees')),
      ]);
      setStudents(studentSnapshot.docs.map((docSnap) => ({ id: docSnap.id, ...docSnap.data() }) as AcademyStudentProfile));
      setBatches(batchSnapshot.docs.map((docSnap) => ({ id: docSnap.id, ...docSnap.data() }) as BatchRecord));
      setFees(feeSnapshot.docs.map((docSnap) => ({ id: docSnap.id, ...docSnap.data() }) as FeeRecord));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadFees();
  }, [academyId, userProfile?.role]);

  const selectedMonthFees = useMemo(() => fees.filter((fee) => fee.month === selectedMonth), [fees, selectedMonth]);

  const filteredFees = useMemo(() => {
    const normalizedSearch = search.trim().toLowerCase();
    return selectedMonthFees
      .filter((fee) => {
        const student = students.find((item) => item.id === fee.studentId);
        const matchesStatus = statusFilter ? displayStatus(fee) === statusFilter : true;
        const matchesBatch = batchFilter ? fee.batchId === batchFilter : true;
        const haystack = [fee.studentName, student?.phone, student?.email, fee.batchName, fee.note].join(' ').toLowerCase();
        const matchesSearch = normalizedSearch ? haystack.includes(normalizedSearch) : true;
        return matchesStatus && matchesBatch && matchesSearch;
      })
      .sort((a, b) => a.studentName.localeCompare(b.studentName));
  }, [batchFilter, search, selectedMonthFees, statusFilter, students]);

  const overview = useMemo(() => {
    const totalExpected = selectedMonthFees.reduce((total, fee) => total + fee.amount, 0);
    const totalCollected = selectedMonthFees.reduce((total, fee) => total + fee.paidAmount, 0);
    const totalPending = selectedMonthFees.reduce((total, fee) => total + Math.max(0, fee.amount - fee.paidAmount), 0);
    return {
      totalExpected,
      totalCollected,
      totalPending,
      paidStudents: selectedMonthFees.filter((fee) => displayStatus(fee) === 'paid').length,
      pendingStudents: selectedMonthFees.filter((fee) => displayStatus(fee) === 'pending').length,
      partialPayments: selectedMonthFees.filter((fee) => displayStatus(fee) === 'partial').length,
      overdueCount: selectedMonthFees.filter((fee) => displayStatus(fee) === 'overdue').length,
    };
  }, [selectedMonthFees]);

  const generateFees = async () => {
    if (!academyId || !userProfile) return;
    setSaving(true);
    setError('');
    try {
      const existingKeys = new Set(fees.map((fee) => `${fee.studentId}:${fee.month}`));
      const activeStudents = students.filter((student) => student.status === 'active');
      let created = 0;
      let skippedExisting = 0;
      let skippedNoFee = 0;
      for (const student of activeStudents) {
        const monthlyFee = Number(student.monthlyFee ?? 0);
        if (!monthlyFee) {
          skippedNoFee += 1;
          continue;
        }
        const key = `${student.id}:${selectedMonth}`;
        if (existingKeys.has(key)) {
          skippedExisting += 1;
          continue;
        }
        const batch = getStudentBatch(student.id, batches);
        const feeRef = doc(collection(db, 'academies', academyId, 'fees'));
        await setDoc(feeRef, {
          academyId,
          studentId: student.id,
          studentName: student.name,
          batchId: batch?.id ?? student.batchId ?? null,
          batchName: batch?.name ?? null,
          month: selectedMonth,
          amount: monthlyFee,
          paidAmount: 0,
          status: 'pending',
          dueDate: defaultDueDate(selectedMonth),
          paidDate: null,
          paymentMode: null,
          note: '',
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
        await createAuditLog({
          actor: userProfile,
          action: 'academy.fee.generated',
          targetType: 'fee',
          targetId: feeRef.id,
          academyId,
          message: `${student.name} fee generated for ${selectedMonth}.`,
          metadata: { academyId, studentId: student.id, feeId: feeRef.id, month: selectedMonth, amount: monthlyFee, paidAmount: 0 },
        });
        created += 1;
      }
      await loadFees();
      setMessage(`Created ${created} fee records. Skipped ${skippedExisting} existing records. Skipped ${skippedNoFee} students without monthly fee.`);
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : 'Unable to generate fees.');
    } finally {
      setSaving(false);
    }
  };

  const updateFee = async (record: FeeRecord, fields: Partial<FeeRecord>, action: string) => {
    if (!academyId || !userProfile) return;
    setSaving(true);
    setError('');
    try {
      await updateDoc(doc(db, 'academies', academyId, 'fees', record.id), {
        ...fields,
        updatedAt: serverTimestamp(),
      });
      await createAuditLog({
        actor: userProfile,
        action,
        targetType: 'fee',
        targetId: record.id,
        academyId,
        message: `${record.studentName} fee updated for ${record.month}.`,
        metadata: {
          academyId,
          studentId: record.studentId,
          feeId: record.id,
          month: record.month,
          amount: fields.amount ?? record.amount,
          paidAmount: fields.paidAmount ?? record.paidAmount,
        },
      });
      await loadFees();
      setMessage('Fee record updated.');
      setPaidRecord(null);
      setPartialRecord(null);
      setWaiveRecord(null);
      setEditRecord(null);
      setActionNote('');
      setPartialAmount('');
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : 'Unable to update fee.');
    } finally {
      setSaving(false);
    }
  };

  const openPaid = (record: FeeRecord) => {
    setPaidRecord(record);
    setPaymentMode(record.paymentMode ?? 'upi');
    setActionNote(record.note ?? '');
  };

  const openPartial = (record: FeeRecord) => {
    setPartialRecord(record);
    setPaymentMode(record.paymentMode ?? 'upi');
    setPartialAmount(String(record.paidAmount || ''));
    setActionNote(record.note ?? '');
  };

  const openWaive = (record: FeeRecord) => {
    setWaiveRecord(record);
    setActionNote(record.note ?? '');
  };

  const openEdit = (record: FeeRecord) => {
    setEditRecord({ ...record });
  };

  if (!academyId) {
    return <EmptyState title="Academy profile not linked" description="Your academy profile is not linked correctly. Contact Kairoyr support." />;
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-sm font-black uppercase tracking-wide text-directBlue">Fees</p>
          <h1 className="mt-2 text-3xl font-black text-navy">Academy Fee Tracker</h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">Generate monthly fees, track collections, and manage student payment status.</p>
        </div>
        <div className="flex flex-wrap gap-3">
          <FormInput label="Month" type="month" value={selectedMonth} onChange={(event) => setSelectedMonth(event.target.value)} />
          <button
            className="inline-flex items-center gap-2 self-end rounded-2xl bg-directBlue px-5 py-3 text-sm font-black text-white disabled:cursor-not-allowed disabled:opacity-60"
            disabled={saving}
            onClick={generateFees}
            type="button"
          >
            <RefreshCw size={16} /> Generate Fees
          </button>
        </div>
      </div>

      {message ? <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-bold text-emerald-700">{message}</div> : null}
      {error ? <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-bold text-red-700">{error}</div> : null}

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-7">
        <StatCard label="Total Expected" value={loading ? '...' : formatCurrency(overview.totalExpected)} helper={selectedMonth} icon={IndianRupee} />
        <StatCard label="Collected" value={loading ? '...' : formatCurrency(overview.totalCollected)} helper="Paid amount" icon={CheckCircle2} />
        <StatCard label="Pending" value={loading ? '...' : formatCurrency(overview.totalPending)} helper="Balance due" icon={ReceiptText} />
        <StatCard label="Paid Students" value={loading ? '...' : String(overview.paidStudents)} helper="Fully paid" icon={CheckCircle2} />
        <StatCard label="Pending Students" value={loading ? '...' : String(overview.pendingStudents)} helper="No payment yet" icon={ReceiptText} />
        <StatCard label="Partial" value={loading ? '...' : String(overview.partialPayments)} helper="Part paid" icon={IndianRupee} />
        <StatCard label="Overdue" value={loading ? '...' : String(overview.overdueCount)} helper="Past due date" icon={ReceiptText} />
      </div>

      <section className="rounded-3xl border border-slate-200 bg-white p-4 shadow-card">
        <div className="grid gap-3 md:grid-cols-4">
          <FormInput label="Search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Student, phone, email" />
          <FormSelect
            label="Status"
            value={statusFilter}
            onChange={(event) => setStatusFilter(event.target.value)}
            options={[
              { label: 'All statuses', value: '' },
              { label: 'Pending', value: 'pending' },
              { label: 'Paid', value: 'paid' },
              { label: 'Partial', value: 'partial' },
              { label: 'Overdue', value: 'overdue' },
              { label: 'Waived', value: 'waived' },
            ]}
          />
          <FormSelect label="Batch" value={batchFilter} onChange={(event) => setBatchFilter(event.target.value)} options={[{ label: 'All batches', value: '' }, ...batches.map((batch) => ({ label: batch.name, value: batch.id }))]} />
          <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-4 py-3 text-sm font-bold text-slate-600">
            Set monthly fee in student profile to generate fee records.
          </div>
        </div>
      </section>

      {loading ? (
        <EmptyState title="Loading fee records" description="Checking academy fee records." />
      ) : filteredFees.length === 0 ? (
        <EmptyState title="No fee records for this month" description="Generate monthly fees after setting monthly fee in student profiles." />
      ) : (
        <DataTable columns={['Student', 'Batch', 'Month', 'Amount', 'Paid', 'Balance', 'Status', 'Due', 'Paid Date', 'Mode', 'Actions']}>
          {filteredFees.map((fee) => {
            const shownStatus = displayStatus(fee);
            const balance = Math.max(0, fee.amount - fee.paidAmount);
            return (
              <tr className="border-t border-slate-100" key={fee.id}>
                <td className="px-5 py-4 font-black text-navy">{fee.studentName}</td>
                <td className="px-5 py-4 text-slate-600">{fee.batchName ?? 'Not assigned'}</td>
                <td className="px-5 py-4 text-slate-600">{fee.month}</td>
                <td className="px-5 py-4 text-slate-600">{formatCurrency(fee.amount)}</td>
                <td className="px-5 py-4 text-slate-600">{formatCurrency(fee.paidAmount)}</td>
                <td className="px-5 py-4 font-black text-navy">{formatCurrency(balance)}</td>
                <td className="px-5 py-4"><Badge className={statusClass(shownStatus)}>{shownStatus}</Badge></td>
                <td className="px-5 py-4 text-slate-600">{fee.dueDate}</td>
                <td className="px-5 py-4 text-slate-600">{fee.paidDate ?? 'Not paid'}</td>
                <td className="px-5 py-4 text-slate-600">{fee.paymentMode ?? 'Not set'}</td>
                <td className="px-5 py-4">
                  <div className="flex flex-wrap gap-2">
                    <button className="rounded-xl bg-blue-50 px-3 py-2 text-xs font-black text-directBlue" onClick={() => setViewRecord(fee)} type="button">View</button>
                    <button className="rounded-xl bg-slate-100 px-3 py-2 text-xs font-black text-navy" onClick={() => openEdit(fee)} type="button">Edit</button>
                    {shownStatus !== 'paid' && shownStatus !== 'waived' ? <button className="rounded-xl bg-emerald-50 px-3 py-2 text-xs font-black text-emerald-700" onClick={() => openPaid(fee)} type="button">Mark Paid</button> : null}
                    {shownStatus !== 'paid' && shownStatus !== 'waived' ? <button className="rounded-xl bg-blue-50 px-3 py-2 text-xs font-black text-directBlue" onClick={() => openPartial(fee)} type="button">Partial</button> : null}
                    {shownStatus !== 'waived' ? <button className="rounded-xl bg-slate-100 px-3 py-2 text-xs font-black text-slate-700" onClick={() => openWaive(fee)} type="button">Waive</button> : null}
                  </div>
                </td>
              </tr>
            );
          })}
        </DataTable>
      )}

      <Modal title="Fee Details" description={viewRecord ? `${viewRecord.studentName} · ${viewRecord.month}` : undefined} open={Boolean(viewRecord)} onClose={() => setViewRecord(null)}>
        {viewRecord ? (
          <div className="grid gap-3 text-sm">
            {[
              ['Student', viewRecord.studentName],
              ['Batch', viewRecord.batchName ?? 'Not assigned'],
              ['Amount', formatCurrency(viewRecord.amount)],
              ['Paid amount', formatCurrency(viewRecord.paidAmount)],
              ['Balance', formatCurrency(Math.max(0, viewRecord.amount - viewRecord.paidAmount))],
              ['Status', displayStatus(viewRecord)],
              ['Due date', viewRecord.dueDate],
              ['Paid date', viewRecord.paidDate ?? 'Not paid'],
              ['Payment mode', viewRecord.paymentMode ?? 'Not set'],
              ['Note', viewRecord.note || 'No note'],
            ].map(([label, value]) => (
              <div className="rounded-2xl bg-slate-50 p-4" key={label}>
                <div className="text-xs font-black uppercase tracking-wide text-slate-500">{label}</div>
                <div className="mt-1 font-black text-navy">{value}</div>
              </div>
            ))}
          </div>
        ) : null}
      </Modal>

      <Modal title="Mark Paid" description={paidRecord ? paidRecord.studentName : undefined} open={Boolean(paidRecord)} onClose={() => setPaidRecord(null)}>
        {paidRecord ? (
          <div className="grid gap-4">
            <FormSelect label="Payment mode" value={paymentMode} onChange={(event) => setPaymentMode(event.target.value as PaymentMode)} options={paymentModeOptions} />
            <FormInput label="Note" value={actionNote} onChange={(event) => setActionNote(event.target.value)} />
            <button className="rounded-2xl bg-directBlue px-5 py-3 text-sm font-black text-white" disabled={saving} onClick={() => updateFee(paidRecord, { paidAmount: paidRecord.amount, status: 'paid', paidDate: getTodayDate(), paymentMode, note: actionNote }, 'academy.fee.markedPaid')} type="button">Save Paid</button>
          </div>
        ) : null}
      </Modal>

      <Modal title="Mark Partial" description={partialRecord ? partialRecord.studentName : undefined} open={Boolean(partialRecord)} onClose={() => setPartialRecord(null)}>
        {partialRecord ? (
          <div className="grid gap-4">
            <FormInput label="Paid amount" min="0" type="number" value={partialAmount} onChange={(event) => setPartialAmount(event.target.value)} />
            <FormSelect label="Payment mode" value={paymentMode} onChange={(event) => setPaymentMode(event.target.value as PaymentMode)} options={paymentModeOptions} />
            <FormInput label="Note" value={actionNote} onChange={(event) => setActionNote(event.target.value)} />
            <button
              className="rounded-2xl bg-directBlue px-5 py-3 text-sm font-black text-white"
              disabled={saving}
              onClick={() => {
                const paidAmount = Number(partialAmount);
                if (!Number.isFinite(paidAmount) || paidAmount < 0) {
                  setError('Paid amount must be 0 or more.');
                  return;
                }
                void updateFee(partialRecord, {
                  paidAmount,
                  status: paidAmount >= partialRecord.amount ? 'paid' : paidAmount > 0 ? 'partial' : 'pending',
                  paidDate: paidAmount > 0 ? getTodayDate() : null,
                  paymentMode: paidAmount > 0 ? paymentMode : null,
                  note: actionNote,
                }, 'academy.fee.markedPartial');
              }}
              type="button"
            >
              Save Partial
            </button>
          </div>
        ) : null}
      </Modal>

      <Modal title="Waive Fee" description={waiveRecord ? waiveRecord.studentName : undefined} open={Boolean(waiveRecord)} onClose={() => setWaiveRecord(null)}>
        {waiveRecord ? (
          <div className="grid gap-4">
            <FormInput label="Note optional" value={actionNote} onChange={(event) => setActionNote(event.target.value)} />
            <button className="rounded-2xl bg-directBlue px-5 py-3 text-sm font-black text-white" disabled={saving} onClick={() => updateFee(waiveRecord, { status: 'waived', note: actionNote, paidDate: null, paymentMode: null }, 'academy.fee.waived')} type="button">Waive Fee</button>
          </div>
        ) : null}
      </Modal>

      <Modal title="Edit Fee" description={editRecord ? editRecord.studentName : undefined} open={Boolean(editRecord)} onClose={() => setEditRecord(null)}>
        {editRecord ? (
          <div className="grid gap-4">
            <FormInput label="Amount" min="0" type="number" value={String(editRecord.amount)} onChange={(event) => setEditRecord({ ...editRecord, amount: Number(event.target.value) })} />
            <FormInput label="Paid amount" min="0" type="number" value={String(editRecord.paidAmount)} onChange={(event) => setEditRecord({ ...editRecord, paidAmount: Number(event.target.value) })} />
            <FormInput label="Due date" type="date" value={editRecord.dueDate} onChange={(event) => setEditRecord({ ...editRecord, dueDate: event.target.value })} />
            <FormSelect
              label="Payment mode"
              value={editRecord.paymentMode ?? ''}
              onChange={(event) => setEditRecord({ ...editRecord, paymentMode: event.target.value ? event.target.value as PaymentMode : null })}
              options={[{ label: 'Not set', value: '' }, ...paymentModeOptions]}
            />
            <FormInput label="Note" value={editRecord.note} onChange={(event) => setEditRecord({ ...editRecord, note: event.target.value })} />
            <button
              className="rounded-2xl bg-directBlue px-5 py-3 text-sm font-black text-white"
              disabled={saving}
              onClick={() => {
                const status: FeeStatus = editRecord.status === 'waived' ? 'waived' : editRecord.paidAmount >= editRecord.amount ? 'paid' : editRecord.paidAmount > 0 ? 'partial' : 'pending';
                void updateFee(editRecord, {
                  amount: editRecord.amount,
                  paidAmount: editRecord.paidAmount,
                  dueDate: editRecord.dueDate,
                  paymentMode: editRecord.paymentMode,
                  note: editRecord.note,
                  status,
                  paidDate: status === 'paid' || status === 'partial' ? editRecord.paidDate ?? getTodayDate() : null,
                }, 'academy.fee.updated');
              }}
              type="button"
            >
              Save Fee
            </button>
          </div>
        ) : null}
      </Modal>
    </div>
  );
}

export function StudentFeesPage() {
  const { userProfile } = useAuth();
  const academyId = userProfile?.academyId;
  const linkedStudentId = userProfile?.linkedStudentId;
  const [fees, setFees] = useState<FeeRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [viewRecord, setViewRecord] = useState<FeeRecord | null>(null);

  useEffect(() => {
    const loadStudentFees = async () => {
      if (!academyId || !linkedStudentId) {
        setLoading(false);
        return;
      }
      setLoading(true);
      setError('');
      try {
        const feeSnapshot = await getDocs(query(collection(db, 'academies', academyId, 'fees'), where('studentId', '==', linkedStudentId)));
        setFees(
          feeSnapshot.docs
            .map((docSnap) => ({ id: docSnap.id, ...docSnap.data() }) as FeeRecord)
            .sort((a, b) => String(b.month ?? '').localeCompare(String(a.month ?? ''))),
        );
      } catch (caught) {
        setError(caught instanceof Error ? caught.message : 'Could not load fee records.');
      } finally {
        setLoading(false);
      }
    };

    void loadStudentFees();
  }, [academyId, linkedStudentId]);

  const overview = useMemo(() => {
    const activeFees = fees.filter((fee) => displayStatus(fee) !== 'waived');
    return {
      records: fees.length,
      paid: fees.filter((fee) => displayStatus(fee) === 'paid').length,
      pendingBalance: activeFees.reduce((total, fee) => total + Math.max(0, Number(fee.amount ?? 0) - Number(fee.paidAmount ?? 0)), 0),
      overdue: fees.filter((fee) => displayStatus(fee) === 'overdue').length,
    };
  }, [fees]);

  if (!linkedStudentId) {
    return <EmptyState title="Your student profile is not linked yet" description="Contact your academy." />;
  }

  return (
    <div className="space-y-6">
      <PageHeader title="Student Fees" description="View fee records linked to your student profile." />
      {error ? <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-bold text-red-700">{error}</div> : null}
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Fee Records" value={loading ? '...' : String(overview.records)} helper="Linked to this student" icon={ReceiptText} />
        <StatCard label="Paid Records" value={loading ? '...' : String(overview.paid)} helper="Fully paid" icon={CheckCircle2} />
        <StatCard label="Pending Balance" value={loading ? '...' : formatCurrency(overview.pendingBalance)} helper="Across active fees" icon={IndianRupee} />
        <StatCard label="Overdue" value={loading ? '...' : String(overview.overdue)} helper="Past due date" icon={ReceiptText} />
      </div>

      {loading ? (
        <EmptyState title="Loading fee records" description="Checking fee records for this student." />
      ) : fees.length === 0 ? (
        <EmptyState title="No fee records yet" description="Fee records will appear here once your academy generates them." />
      ) : (
        <DataTable columns={['Month', 'Amount', 'Paid', 'Balance', 'Status', 'Due', 'Paid Date', 'Mode', 'Action']}>
          {fees.map((fee) => {
            const shownStatus = displayStatus(fee);
            return (
              <tr className="border-t border-slate-100" key={fee.id}>
                <td className="px-5 py-4 font-black text-navy">{fee.month}</td>
                <td className="px-5 py-4 text-slate-600">{formatCurrency(fee.amount)}</td>
                <td className="px-5 py-4 text-slate-600">{formatCurrency(fee.paidAmount)}</td>
                <td className="px-5 py-4 font-black text-navy">{formatCurrency(Math.max(0, fee.amount - fee.paidAmount))}</td>
                <td className="px-5 py-4"><Badge className={statusClass(shownStatus)}>{shownStatus}</Badge></td>
                <td className="px-5 py-4 text-slate-600">{fee.dueDate || 'Not added'}</td>
                <td className="px-5 py-4 text-slate-600">{fee.paidDate ?? 'Not paid'}</td>
                <td className="px-5 py-4 text-slate-600">{fee.paymentMode ?? 'Not set'}</td>
                <td className="px-5 py-4">
                  <button className="rounded-xl bg-blue-50 px-3 py-2 text-xs font-black text-directBlue" onClick={() => setViewRecord(fee)} type="button" aria-label="View fee" title="View fee">View</button>
                </td>
              </tr>
            );
          })}
        </DataTable>
      )}

      <Modal title="Fee Details" description={viewRecord ? `${viewRecord.month} · ${displayStatus(viewRecord)}` : undefined} open={Boolean(viewRecord)} onClose={() => setViewRecord(null)}>
        {viewRecord ? (
          <div className="grid gap-3 text-sm">
            {[
              ['Student', viewRecord.studentName],
              ['Batch', viewRecord.batchName ?? 'Not assigned'],
              ['Amount', formatCurrency(viewRecord.amount)],
              ['Paid amount', formatCurrency(viewRecord.paidAmount)],
              ['Balance', formatCurrency(Math.max(0, viewRecord.amount - viewRecord.paidAmount))],
              ['Status', displayStatus(viewRecord)],
              ['Due date', viewRecord.dueDate || 'Not added'],
              ['Paid date', viewRecord.paidDate ?? 'Not paid'],
              ['Payment mode', viewRecord.paymentMode ?? 'Not set'],
              ['Note', viewRecord.note || 'No note'],
            ].map(([label, value]) => (
              <div className="rounded-2xl bg-slate-50 p-4" key={label}>
                <div className="text-xs font-black uppercase tracking-wide text-slate-500">{label}</div>
                <div className="mt-1 font-black text-navy">{value}</div>
              </div>
            ))}
          </div>
        ) : null}
      </Modal>
    </div>
  );
}
