import { Plus } from 'lucide-react';
import { Badge } from '../components/ui/Badge';
import { DataTable } from '../components/ui/DataTable';
import { PageHeader } from '../components/ui/PageHeader';
import { RoadmapBadge } from '../components/ui/RoadmapBadge';
import { getBatchById, students } from '../data/mockData';
import { levelStyles, statusStyles } from '../utils/badgeStyles';

export function StudentsPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Students"
        description="Student management placeholder with levels, batches, fees, and progress visibility."
        action={<div className="flex flex-wrap gap-2"><RoadmapBadge status="Mock Data" /><button className="inline-flex items-center gap-2 rounded-2xl bg-directBlue px-4 py-3 text-sm font-black text-white"><Plus size={18} /> Add Student</button></div>}
      />
      <DataTable columns={['Name', 'Level', 'Batch', 'Fee Status', 'Progress']}>
        {students.map((student) => (
          <tr className="border-t border-slate-100" key={student.id}>
            <td className="px-5 py-4 font-black text-navy">{student.name}</td>
            <td className="px-5 py-4"><Badge className={levelStyles[student.level]}>{student.level}</Badge></td>
            <td className="px-5 py-4 text-slate-600">{getBatchById(student.batchId)?.name}</td>
            <td className="px-5 py-4"><Badge className={statusStyles[student.feeStatus]}>{student.feeStatus}</Badge></td>
            <td className="px-5 py-4">
              <div className="h-2 w-28 overflow-hidden rounded-full bg-slate-100">
                <div className="h-full rounded-full bg-directBlue" style={{ width: `${student.progress}%` }} />
              </div>
              <span className="mt-1 block text-xs font-bold text-slate-500">{student.progress}%</span>
            </td>
          </tr>
        ))}
      </DataTable>
    </div>
  );
}
