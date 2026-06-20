import { useMemo, useState, type FormEvent } from 'react';
import { CheckCircle2, Eye, IndianRupee, Plus, ReceiptText, RefreshCw, Save, Trash2 } from 'lucide-react';
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
import { feeStatusLabels, formatCurrency, paymentMethodLabels } from '../data/mockData';
import { useAppData } from '../hooks/useAppData';
import type { FeeRecord, FeeStatus, PaymentMethod } from '../types';
import { feeStyles, statusStyles } from '../utils/badgeStyles';

const now = new Date();
const currentMonth = now.getMonth() + 1;
const currentYear = now.getFullYear();
const today = now.toISOString().slice(0, 10);

const monthOptions = Array.from({ length: 12 }, (_, index) => ({
  value: String(index + 1),
  label: new Intl.DateTimeFormat('en-IN', { month: 'long' }).format(new Date(2026, index, 1)),
}));

const yearOptions = Array.from({ length: 5 }, (_, index) => {
  const year = currentYear - 2 + index;
  return { value: String(year), label: String(year) };
});

type FeeForm = {
  studentId: string;
  month: string;
  year: string;
  amount: string;
  dueDate: string;
  status: FeeStatus;
  paymentMethod: PaymentMethod;
  paidDate: string;
  notes: string;
};

const initialForm: FeeForm = {
  studentId: '',
  month: String(currentMonth),
  year: String(currentYear),
  amount: '2000',
  dueDate: `${currentYear}-${String(currentMonth).padStart(2, '0')}-05`,
  status: 'pending',
  paymentMethod: 'upi',
  paidDate: '',
  notes: '',
};

function toForm(record: FeeRecord): FeeForm {
  return {
    studentId: record.studentId,
    month: String(record.month),
    year: String(record.year),
    amount: String(record.amount),
    dueDate: record.dueDate,
    status: record.status,
    paymentMethod: record.paymentMethod ?? 'upi',
    paidDate: record.paidDate ?? '',
    notes: record.notes ?? '',
  };
}

function formatMonthYear(month: number, year: number) {
  const monthLabel = monthOptions.find((option) => option.value === String(month))?.label ?? `Month ${month}`;
  return `${monthLabel} ${year}`;
}

export function FeesPage() {
  const {
    students,
    batches,
    feeRecords,
    addFeeRecord,
    updateFeeRecord,
    deleteFeeRecord,
    generateMonthlyFeeRecords,
    getBatchName,
    getFeeRecordForStudentMonth,
    getFeeSummaryForMonth,
  } = useAppData();
  const [query, setQuery] = useState('');
  const [batchFilter, setBatchFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [monthFilter, setMonthFilter] = useState(String(currentMonth));
  const [yearFilter, setYearFilter] = useState(String(currentYear));
  const [modalOpen, setModalOpen] = useState(false);
  const [generateOpen, setGenerateOpen] = useState(false);
  const [detailRecord, setDetailRecord] = useState<FeeRecord | null>(null);
  const [markPaidRecord, setMarkPaidRecord] = useState<FeeRecord | null>(null);
  const [editing, setEditing] = useState<FeeRecord | null>(null);
  const [form, setForm] = useState<FeeForm>(initialForm);
  const [generateForm, setGenerateForm] = useState({
    month: String(currentMonth),
    year: String(currentYear),
    dueDate: `${currentYear}-${String(currentMonth).padStart(2, '0')}-05`,
    defaultAmount: '2000',
  });
  const [markPaidForm, setMarkPaidForm] = useState({ paymentMethod: 'upi' as PaymentMethod, paidDate: today, notes: '' });
  const [savedMessage, setSavedMessage] = useState('');

  const thisMonthSummary = getFeeSummaryForMonth(currentMonth, currentYear);

  const filteredRecords = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    return [...feeRecords]
      .filter((record) => {
        const student = students.find((item) => item.id === record.studentId);
        const batchName = getBatchName(record.batchId);
        const haystack = [student?.name ?? 'Deleted student', student?.parentName ?? '', batchName, record.notes ?? '']
          .join(' ')
          .toLowerCase();
        const matchesSearch = !normalizedQuery || haystack.includes(normalizedQuery);
        const matchesBatch = batchFilter === 'all' || record.batchId === batchFilter;
        const matchesStatus = statusFilter === 'all' || record.status === statusFilter;
        const matchesMonth = monthFilter === 'all' || record.month === Number(monthFilter);
        const matchesYear = yearFilter === 'all' || record.year === Number(yearFilter);
        return matchesSearch && matchesBatch && matchesStatus && matchesMonth && matchesYear;
      })
      .sort((a, b) => {
        const monthDelta = b.year * 12 + b.month - (a.year * 12 + a.month);
        if (monthDelta !== 0) return monthDelta;
        return b.updatedAt.localeCompare(a.updatedAt);
      });
  }, [batchFilter, feeRecords, getBatchName, monthFilter, query, statusFilter, students, yearFilter]);

  const summaryCards = [
    { label: 'Collected This Month', value: formatCurrency(thisMonthSummary.collected), helper: `${thisMonthSummary.paidCount} paid records` },
    { label: 'Pending This Month', value: formatCurrency(thisMonthSummary.pending), helper: `${thisMonthSummary.pendingCount} pending records` },
    { label: 'Overdue This Month', value: formatCurrency(thisMonthSummary.overdue), helper: `${thisMonthSummary.overdueCount} overdue records` },
    { label: 'Waived This Month', value: formatCurrency(thisMonthSummary.waived), helper: `${thisMonthSummary.waivedCount} waived records` },
    { label: 'Expected This Month', value: formatCurrency(thisMonthSummary.expected), helper: `${thisMonthSummary.totalCount} total records` },
  ];

  const openAddModal = () => {
    setEditing(null);
    setForm(initialForm);
    setSavedMessage('');
    setModalOpen(true);
  };

  const openEditModal = (record: FeeRecord) => {
    setEditing(record);
    setForm(toForm(record));
    setSavedMessage('');
    setModalOpen(true);
  };

  const updateField = (field: keyof FeeForm, value: string) => {
    setSavedMessage('');
    setForm((current) => {
      if (field === 'studentId') {
        const student = students.find((item) => item.id === value);
        return { ...current, studentId: value, amount: student ? String(student.monthlyFee || 2000) : current.amount };
      }
      if (field === 'status' && value === 'paid') {
        return { ...current, status: 'paid', paidDate: current.paidDate || today };
      }
      return { ...current, [field]: value };
    });
  };

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const month = Number(form.month);
    const year = Number(form.year);
    const amount = Number(form.amount);
    const selectedStudent = students.find((student) => student.id === form.studentId);
    if (!form.studentId || !selectedStudent) {
      alert('Student is required.');
      return;
    }
    if (!Number.isInteger(month) || month < 1 || month > 12 || !Number.isInteger(year)) {
      alert('Month and year are required.');
      return;
    }
    if (!Number.isFinite(amount) || amount < 0) {
      alert('Amount must be 0 or more.');
      return;
    }
    if (!form.dueDate) {
      alert('Due date is required.');
      return;
    }
    if (form.status === 'paid' && !form.paidDate) {
      alert('Paid date is required when status is paid.');
      return;
    }

    const existing = getFeeRecordForStudentMonth(form.studentId, month, year);
    const payload = {
      studentId: form.studentId,
      batchId: selectedStudent.batchId,
      month,
      year,
      amount,
      dueDate: form.dueDate,
      status: form.status,
      paymentMethod: form.status === 'paid' ? form.paymentMethod : undefined,
      paidDate: form.status === 'paid' ? form.paidDate || today : undefined,
      notes: form.notes.trim() || undefined,
    };

    if (editing) {
      updateFeeRecord(editing.id, payload);
      setSavedMessage('Fee record updated locally.');
    } else if (existing) {
      updateFeeRecord(existing.id, payload);
      setSavedMessage('Existing monthly fee record updated locally.');
    } else {
      addFeeRecord(payload);
      setSavedMessage('Fee record saved locally.');
    }
    setModalOpen(false);
  };

  const handleDelete = (record: FeeRecord) => {
    const student = students.find((item) => item.id === record.studentId);
    if (window.confirm(`Delete fee record for ${student?.name ?? 'Deleted student'} - ${formatMonthYear(record.month, record.year)}?`)) {
      deleteFeeRecord(record.id);
    }
  };

  const openMarkPaid = (record: FeeRecord) => {
    setMarkPaidRecord(record);
    setMarkPaidForm({
      paymentMethod: record.paymentMethod ?? 'upi',
      paidDate: record.paidDate ?? today,
      notes: record.notes ?? '',
    });
  };

  const handleMarkPaid = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!markPaidRecord) return;
    updateFeeRecord(markPaidRecord.id, {
      studentId: markPaidRecord.studentId,
      batchId: markPaidRecord.batchId,
      month: markPaidRecord.month,
      year: markPaidRecord.year,
      amount: markPaidRecord.amount,
      dueDate: markPaidRecord.dueDate,
      status: 'paid',
      paymentMethod: markPaidForm.paymentMethod,
      paidDate: markPaidForm.paidDate || today,
      notes: markPaidForm.notes.trim() || markPaidRecord.notes,
    });
    setMarkPaidRecord(null);
  };

  const handleGenerate = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const month = Number(generateForm.month);
    const year = Number(generateForm.year);
    const defaultAmount = Number(generateForm.defaultAmount);
    if (!generateForm.dueDate || !Number.isInteger(month) || !Number.isInteger(year) || !Number.isFinite(defaultAmount) || defaultAmount < 0) {
      alert('Month, year, due date, and default amount are required.');
      return;
    }
    const result = generateMonthlyFeeRecords(month, year, generateForm.dueDate, defaultAmount);
    setGenerateOpen(false);
    setSavedMessage(`Generated ${result.created} fee records. Skipped ${result.skipped} existing records.`);
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Fee Tracker"
        description="Track monthly fees, pending payments, and payment history."
        action={(
          <div className="flex flex-wrap gap-2">
            <RoadmapBadge status="Phase 5" />
            <button className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-black text-slate-700" onClick={() => setGenerateOpen(true)} type="button">
              <RefreshCw size={18} /> Generate Monthly Fees
            </button>
            <button className="inline-flex items-center gap-2 rounded-2xl bg-directBlue px-4 py-3 text-sm font-black text-white" onClick={openAddModal} type="button">
              <Plus size={18} /> Add Fee Record
            </button>
          </div>
        )}
      />

      {savedMessage ? <div className="rounded-2xl bg-emerald-50 px-4 py-3 text-sm font-black text-emerald-700">{savedMessage}</div> : null}

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
        {summaryCards.map((card) => (
          <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-card" key={card.label}>
            <div className="text-sm font-black uppercase tracking-wide text-slate-400">{card.label}</div>
            <div className="mt-3 text-2xl font-black text-navy">{card.value}</div>
            <div className="mt-1 text-sm font-semibold text-slate-500">{card.helper}</div>
          </div>
        ))}
      </div>

      <div className="grid gap-3 rounded-3xl border border-slate-200 bg-white p-4 shadow-card xl:grid-cols-[1fr_auto_auto_auto_auto]">
        <SearchInput value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search student, parent, batch, or note" />
        <FilterSelect value={batchFilter} onChange={(event) => setBatchFilter(event.target.value)} options={[{ label: 'All batches', value: 'all' }, ...batches.map((batch) => ({ label: batch.name, value: batch.id }))]} />
        <FilterSelect value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)} options={[{ label: 'All status', value: 'all' }, ...Object.entries(feeStatusLabels).map(([value, label]) => ({ value, label }))]} />
        <FilterSelect value={monthFilter} onChange={(event) => setMonthFilter(event.target.value)} options={[{ label: 'All months', value: 'all' }, ...monthOptions]} />
        <FilterSelect value={yearFilter} onChange={(event) => setYearFilter(event.target.value)} options={[{ label: 'All years', value: 'all' }, ...yearOptions]} />
      </div>

      {filteredRecords.length === 0 ? (
        <EmptyState title="No fee records found" description="Generate monthly fees or add a fee record for a student." />
      ) : (
        <DataTable columns={['Student', 'Batch', 'Month', 'Amount', 'Due Date', 'Status', 'Payment', 'Paid Date', 'Actions']}>
          {filteredRecords.map((record) => {
            const student = students.find((item) => item.id === record.studentId);
            return (
              <tr className="border-t border-slate-100" key={record.id}>
                <td className="px-5 py-4">
                  <div className="font-black text-navy">{student?.name ?? 'Deleted student'}</div>
                  <div className="text-xs font-bold text-slate-500">{student?.parentName ?? 'Parent unavailable'}</div>
                </td>
                <td className="px-5 py-4 text-slate-600">{getBatchName(record.batchId)}</td>
                <td className="px-5 py-4 text-slate-600">{formatMonthYear(record.month, record.year)}</td>
                <td className="px-5 py-4 font-black text-navy">{formatCurrency(record.amount)}</td>
                <td className="px-5 py-4 text-slate-600">{record.dueDate}</td>
                <td className="px-5 py-4"><Badge className={feeStyles[record.status]}>{feeStatusLabels[record.status]}</Badge></td>
                <td className="px-5 py-4 text-slate-600">{record.paymentMethod ? paymentMethodLabels[record.paymentMethod] : 'Not recorded'}</td>
                <td className="px-5 py-4 text-slate-600">{record.paidDate ?? 'Not paid'}</td>
                <td className="px-5 py-4">
                  <div className="flex gap-2">
                    <button className="rounded-xl border border-slate-200 p-2 text-slate-600 hover:bg-slate-50" onClick={() => setDetailRecord(record)} type="button" aria-label="View fee record">
                      <Eye size={16} />
                    </button>
                    <button className="rounded-xl border border-slate-200 p-2 text-slate-600 hover:bg-slate-50" onClick={() => openEditModal(record)} type="button" aria-label="Edit fee record">
                      <ReceiptText size={16} />
                    </button>
                    {record.status !== 'paid' ? (
                      <button className="rounded-xl border border-emerald-100 p-2 text-emerald-700 hover:bg-emerald-50" onClick={() => openMarkPaid(record)} type="button" aria-label="Mark paid">
                        <CheckCircle2 size={16} />
                      </button>
                    ) : null}
                    <button className="rounded-xl border border-rose-100 p-2 text-rose-600 hover:bg-rose-50" onClick={() => handleDelete(record)} type="button" aria-label="Delete fee record">
                      <Trash2 size={16} />
                    </button>
                  </div>
                </td>
              </tr>
            );
          })}
        </DataTable>
      )}

      <Modal title={editing ? 'Edit Fee Record' : 'Add Fee Record'} description="Fee records are monthly and connected to student profiles." open={modalOpen} onClose={() => setModalOpen(false)}>
        <form className="grid gap-4" onSubmit={handleSubmit}>
          <div className="grid gap-4 md:grid-cols-2">
            <FormSelect label="Student" value={form.studentId} onChange={(event) => updateField('studentId', event.target.value)} options={[{ label: 'Select student', value: '' }, ...students.map((student) => ({ label: `${student.name} - ${student.parentName}`, value: student.id }))]} />
            <FormInput label="Amount" type="number" min="0" value={form.amount} onChange={(event) => updateField('amount', event.target.value)} />
            <FormSelect label="Month" value={form.month} onChange={(event) => updateField('month', event.target.value)} options={monthOptions} />
            <FormSelect label="Year" value={form.year} onChange={(event) => updateField('year', event.target.value)} options={yearOptions} />
            <FormInput label="Due date" type="date" value={form.dueDate} onChange={(event) => updateField('dueDate', event.target.value)} />
            <FormSelect label="Status" value={form.status} onChange={(event) => updateField('status', event.target.value)} options={Object.entries(feeStatusLabels).map(([value, label]) => ({ value, label }))} />
            {form.status === 'paid' ? (
              <>
                <FormSelect label="Payment method" value={form.paymentMethod} onChange={(event) => updateField('paymentMethod', event.target.value)} options={Object.entries(paymentMethodLabels).map(([value, label]) => ({ value, label }))} />
                <FormInput label="Paid date" type="date" value={form.paidDate} onChange={(event) => updateField('paidDate', event.target.value)} />
              </>
            ) : null}
          </div>
          <label className="grid gap-2 text-sm font-bold text-slate-700">
            Payment notes
            <textarea className="min-h-24 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-navy outline-none transition focus:border-directBlue focus:ring-4 focus:ring-blue-100" value={form.notes} onChange={(event) => updateField('notes', event.target.value)} />
          </label>
          <div className="flex justify-end gap-3 pt-2">
            <button className="rounded-2xl border border-slate-200 px-5 py-3 text-sm font-black text-slate-600" type="button" onClick={() => setModalOpen(false)}>Cancel</button>
            <button className="inline-flex items-center gap-2 rounded-2xl bg-directBlue px-5 py-3 text-sm font-black text-white" type="submit"><Save size={18} /> Save Fee</button>
          </div>
        </form>
      </Modal>

      <Modal title="Generate Monthly Fees" description="Create one pending monthly fee record for each active student without duplicating existing records." open={generateOpen} onClose={() => setGenerateOpen(false)}>
        <form className="grid gap-4" onSubmit={handleGenerate}>
          <div className="grid gap-4 md:grid-cols-2">
            <FormSelect label="Month" value={generateForm.month} onChange={(event) => setGenerateForm((current) => ({ ...current, month: event.target.value }))} options={monthOptions} />
            <FormSelect label="Year" value={generateForm.year} onChange={(event) => setGenerateForm((current) => ({ ...current, year: event.target.value }))} options={yearOptions} />
            <FormInput label="Due date" type="date" value={generateForm.dueDate} onChange={(event) => setGenerateForm((current) => ({ ...current, dueDate: event.target.value }))} />
            <FormInput label="Default amount" type="number" min="0" value={generateForm.defaultAmount} onChange={(event) => setGenerateForm((current) => ({ ...current, defaultAmount: event.target.value }))} />
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <button className="rounded-2xl border border-slate-200 px-5 py-3 text-sm font-black text-slate-600" type="button" onClick={() => setGenerateOpen(false)}>Cancel</button>
            <button className="inline-flex items-center gap-2 rounded-2xl bg-directBlue px-5 py-3 text-sm font-black text-white" type="submit"><RefreshCw size={18} /> Generate Fees</button>
          </div>
        </form>
      </Modal>

      <Modal title="Mark Fee Paid" description={markPaidRecord ? `${formatMonthYear(markPaidRecord.month, markPaidRecord.year)} - ${formatCurrency(markPaidRecord.amount)}` : undefined} open={Boolean(markPaidRecord)} onClose={() => setMarkPaidRecord(null)}>
        <form className="grid gap-4" onSubmit={handleMarkPaid}>
          <div className="grid gap-4 md:grid-cols-2">
            <FormSelect label="Payment method" value={markPaidForm.paymentMethod} onChange={(event) => setMarkPaidForm((current) => ({ ...current, paymentMethod: event.target.value as PaymentMethod }))} options={Object.entries(paymentMethodLabels).map(([value, label]) => ({ value, label }))} />
            <FormInput label="Paid date" type="date" value={markPaidForm.paidDate} onChange={(event) => setMarkPaidForm((current) => ({ ...current, paidDate: event.target.value }))} />
          </div>
          <label className="grid gap-2 text-sm font-bold text-slate-700">
            Payment notes
            <textarea className="min-h-24 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-navy outline-none transition focus:border-directBlue focus:ring-4 focus:ring-blue-100" value={markPaidForm.notes} onChange={(event) => setMarkPaidForm((current) => ({ ...current, notes: event.target.value }))} />
          </label>
          <div className="flex justify-end gap-3 pt-2">
            <button className="rounded-2xl border border-slate-200 px-5 py-3 text-sm font-black text-slate-600" type="button" onClick={() => setMarkPaidRecord(null)}>Cancel</button>
            <button className="inline-flex items-center gap-2 rounded-2xl bg-emerald-600 px-5 py-3 text-sm font-black text-white" type="submit"><CheckCircle2 size={18} /> Mark Paid</button>
          </div>
        </form>
      </Modal>

      <Modal title="Fee Record Details" open={Boolean(detailRecord)} onClose={() => setDetailRecord(null)}>
        {detailRecord ? (
          <div className="space-y-4">
            <div className="flex flex-wrap gap-2">
              <Badge className={feeStyles[detailRecord.status]}>{feeStatusLabels[detailRecord.status]}</Badge>
              <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-600">{formatMonthYear(detailRecord.month, detailRecord.year)}</span>
              <span className="rounded-full bg-blue-50 px-3 py-1 text-xs font-bold text-directBlue">{getBatchName(detailRecord.batchId)}</span>
            </div>
            <div className="grid gap-3 text-sm font-bold text-slate-700 md:grid-cols-2">
              <div className="rounded-2xl bg-slate-50 p-4">Amount: <span className="text-navy">{formatCurrency(detailRecord.amount)}</span></div>
              <div className="rounded-2xl bg-slate-50 p-4">Due date: <span className="text-navy">{detailRecord.dueDate}</span></div>
              <div className="rounded-2xl bg-slate-50 p-4">Payment: <span className="text-navy">{detailRecord.paymentMethod ? paymentMethodLabels[detailRecord.paymentMethod] : 'Not recorded'}</span></div>
              <div className="rounded-2xl bg-slate-50 p-4">Paid date: <span className="text-navy">{detailRecord.paidDate ?? 'Not paid'}</span></div>
            </div>
            <div className="rounded-2xl bg-slate-50 p-4">
              <div className="flex items-center gap-2 text-sm font-black text-navy"><IndianRupee size={16} /> Notes</div>
              <p className="mt-2 text-sm leading-6 text-slate-600">{detailRecord.notes || 'No notes added.'}</p>
            </div>
          </div>
        ) : null}
      </Modal>
    </div>
  );
}
