import { Badge } from '../components/ui/Badge';
import { DataTable } from '../components/ui/DataTable';
import { EmptyState } from '../components/ui/EmptyState';
import { PageHeader } from '../components/ui/PageHeader';
import { RoadmapBadge } from '../components/ui/RoadmapBadge';
import { feeRecords, feeStatusLabels, formatCurrency } from '../data/mockData';
import { useAppData } from '../hooks/useAppData';
import { feeStyles } from '../utils/badgeStyles';

export function FeesPage() {
  const { students } = useAppData();

  return (
    <div className="space-y-6">
      <PageHeader title="Fee Tracker" description="Fee tracker placeholder showing monthly fee status and due dates." action={<RoadmapBadge status="Coming Soon" />} />
      <DataTable columns={['Student', 'Monthly Fee', 'Paid/Pending', 'Due Date']}>
        {feeRecords.map((fee) => (
          <tr className="border-t border-slate-100" key={fee.id}>
            <td className="px-5 py-4 font-black text-navy">{students.find((student) => student.id === fee.studentId)?.name ?? 'Student'}</td>
            <td className="px-5 py-4 text-slate-600">{formatCurrency(fee.amount)}</td>
            <td className="px-5 py-4"><Badge className={feeStyles[fee.status]}>{feeStatusLabels[fee.status]}</Badge></td>
            <td className="px-5 py-4 text-slate-600">{fee.dueDate}</td>
          </tr>
        ))}
      </DataTable>
      <EmptyState title="Payment integration is not active" description="Future phases can connect fee records to student profiles and online payment workflows." />
    </div>
  );
}
