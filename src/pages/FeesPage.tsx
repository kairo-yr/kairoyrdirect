import { Badge } from '../components/ui/Badge';
import { DataTable } from '../components/ui/DataTable';
import { EmptyState } from '../components/ui/EmptyState';
import { PageHeader } from '../components/ui/PageHeader';
import { RoadmapBadge } from '../components/ui/RoadmapBadge';
import { feeRecords, formatCurrency, getStudentById } from '../data/mockData';
import { statusStyles } from '../utils/badgeStyles';

export function FeesPage() {
  return (
    <div className="space-y-6">
      <PageHeader title="Fee Tracker" description="Fee tracker placeholder showing monthly fee status and due dates." action={<RoadmapBadge status="Coming Soon" />} />
      <DataTable columns={['Student', 'Monthly Fee', 'Paid/Pending', 'Due Date']}>
        {feeRecords.map((fee) => (
          <tr className="border-t border-slate-100" key={fee.id}>
            <td className="px-5 py-4 font-black text-navy">{getStudentById(fee.studentId)?.name}</td>
            <td className="px-5 py-4 text-slate-600">{formatCurrency(fee.amount)}</td>
            <td className="px-5 py-4"><Badge className={statusStyles[fee.status]}>{fee.status}</Badge></td>
            <td className="px-5 py-4 text-slate-600">{fee.dueDate}</td>
          </tr>
        ))}
      </DataTable>
      <EmptyState title="Payment integration is not active" description="Future phases can connect fee records to student profiles and online payment workflows." />
    </div>
  );
}
