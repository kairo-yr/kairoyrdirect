import { Badge } from '../components/ui/Badge';
import { DataTable } from '../components/ui/DataTable';
import { EmptyState } from '../components/ui/EmptyState';
import { PageHeader } from '../components/ui/PageHeader';
import { RoadmapBadge } from '../components/ui/RoadmapBadge';
import { attendanceRecords, getBatchById } from '../data/mockData';
import { statusStyles } from '../utils/badgeStyles';

export function AttendancePage() {
  return (
    <div className="space-y-6">
      <PageHeader title="Attendance" description="Attendance tracking placeholder. Real marking logic will connect in a future phase." action={<RoadmapBadge status="Phase 2" />} />
      <DataTable columns={['Batch', 'Date', 'Present', 'Absent', 'Status']}>
        {attendanceRecords.map((record) => (
          <tr className="border-t border-slate-100" key={record.id}>
            <td className="px-5 py-4 font-black text-navy">{getBatchById(record.batchId)?.name}</td>
            <td className="px-5 py-4 text-slate-600">{record.date}</td>
            <td className="px-5 py-4">{record.presentCount}</td>
            <td className="px-5 py-4">{record.absentCount}</td>
            <td className="px-5 py-4"><Badge className={statusStyles[record.status]}>{record.status}</Badge></td>
          </tr>
        ))}
      </DataTable>
      <EmptyState title="Attendance workflows coming later" description="Future attendance will connect to class reports and student profiles." />
    </div>
  );
}
