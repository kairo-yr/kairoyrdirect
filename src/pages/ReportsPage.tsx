import { Badge } from '../components/ui/Badge';
import { DataTable } from '../components/ui/DataTable';
import { PageHeader } from '../components/ui/PageHeader';
import { RoadmapBadge } from '../components/ui/RoadmapBadge';
import { classReports, getBatchById, getCoachById, getStudentById } from '../data/mockData';
import { statusStyles } from '../utils/badgeStyles';

export function ReportsPage() {
  return (
    <div className="space-y-6">
      <PageHeader title="Class Reports" description="Mock class report history for parent communication and student progress visibility." action={<RoadmapBadge status="Phase 2" />} />
      <DataTable columns={['Student/Batch', 'Topic Covered', 'Coach', 'Date', 'Status']}>
        {classReports.map((report) => (
          <tr className="border-t border-slate-100" key={report.id}>
            <td className="px-5 py-4 font-black text-navy">{getStudentById(report.studentId)?.name ?? getBatchById(report.batchId)?.name}</td>
            <td className="px-5 py-4 text-slate-600">{report.topic}</td>
            <td className="px-5 py-4 text-slate-600">{getCoachById(report.coachId)?.name}</td>
            <td className="px-5 py-4 text-slate-600">{report.date}</td>
            <td className="px-5 py-4"><Badge className={statusStyles[report.status]}>{report.status}</Badge></td>
          </tr>
        ))}
      </DataTable>
    </div>
  );
}
