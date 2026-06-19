import { BarChart3, CalendarCheck, ClipboardList, CreditCard, FileText, GraduationCap } from 'lucide-react';
import { PageHeader } from '../components/ui/PageHeader';
import { StatCard } from '../components/ui/StatCard';
import { DataTable } from '../components/ui/DataTable';
import { Badge } from '../components/ui/Badge';
import { EmptyState } from '../components/ui/EmptyState';
import { RoadmapBadge } from '../components/ui/RoadmapBadge';
import {
  classReports,
  feeRecords,
  getBatchById,
  getBatchesForCoach,
  getCoachById,
  getStudentById,
  parentUpdates,
  playAccess,
  stats,
  students,
  todayClasses,
} from '../data/mockData';
import { statusStyles } from '../utils/badgeStyles';
import { PLAY_APP_NAME } from '../config/brand';

const icons = [GraduationCap, ClipboardList, GraduationCap, CreditCard, CalendarCheck, FileText];

export function DashboardPage() {
  return (
    <div className="space-y-6">
      <PageHeader title="Dashboard" description="A polished Phase 1 control room with mock academy operating data." />
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {stats.map((stat, index) => (
          <StatCard key={stat.label} {...stat} icon={icons[index]} />
        ))}
      </div>
      <div className="grid gap-6 xl:grid-cols-3">
        <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-card">
          <div className="mb-4 flex items-center justify-between gap-3">
            <h2 className="text-xl font-black text-navy">Today’s Classes</h2>
            <RoadmapBadge status="Mock Data" />
          </div>
          <div className="space-y-3">
            {todayClasses.map((item) => {
              const batch = getBatchById(item.batchId);
              const coach = getCoachById(item.coachId);
              return (
                <div className="rounded-2xl bg-slate-50 p-4" key={item.id}>
                  <div className="font-black text-navy">{batch?.name}</div>
                  <div className="mt-1 text-sm text-slate-600">{item.time} · {coach?.name} · {item.room}</div>
                </div>
              );
            })}
          </div>
        </section>
        <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-card">
          <div className="mb-4 flex items-center justify-between gap-3">
            <h2 className="text-xl font-black text-navy">Pending Parent Updates</h2>
            <RoadmapBadge status="Phase 2" />
          </div>
          <div className="space-y-3">
            {parentUpdates.map((update) => (
              <div className="rounded-2xl bg-slate-50 p-4" key={update.id}>
                <div className="font-black text-navy">{getStudentById(update.studentId)?.name}</div>
                <div className="mt-1 text-sm text-slate-600">{update.reason}</div>
              </div>
            ))}
          </div>
        </section>
        <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-card">
          <div className="mb-4 flex items-center justify-between gap-3">
            <h2 className="text-xl font-black text-navy">{PLAY_APP_NAME} Access</h2>
            <RoadmapBadge status="Future Integration" />
          </div>
          <div className="space-y-3">
            {playAccess.map((access) => (
              <div className="flex items-center justify-between gap-3 rounded-2xl bg-slate-50 p-4" key={access.id}>
                <div className="font-black text-navy">{getStudentById(access.studentId)?.name}</div>
                <Badge className={access.status === 'Ready' ? statusStyles.Active : access.status === 'Pending Setup' ? statusStyles.Pending : statusStyles.Draft}>{access.status}</Badge>
              </div>
            ))}
          </div>
        </section>
      </div>
      <div className="grid gap-6 xl:grid-cols-2">
        <div>
          <h2 className="mb-3 text-xl font-black text-navy">Fee Alerts</h2>
          <DataTable columns={['Student', 'Amount', 'Due Date', 'Status']}>
            {feeRecords.filter((fee) => fee.status !== 'Paid').map((fee) => (
              <tr className="border-t border-slate-100" key={fee.id}>
                <td className="px-5 py-4 font-bold text-navy">{getStudentById(fee.studentId)?.name}</td>
                <td className="px-5 py-4 text-slate-600">₹{fee.amount.toLocaleString('en-IN')}</td>
                <td className="px-5 py-4 text-slate-600">{fee.dueDate}</td>
                <td className="px-5 py-4"><Badge className={statusStyles[fee.status]}>{fee.status}</Badge></td>
              </tr>
            ))}
          </DataTable>
        </div>
        <div>
          <h2 className="mb-3 text-xl font-black text-navy">Recent reports</h2>
          <DataTable columns={['Student/Batch', 'Topic', 'Coach', 'Status']}>
            {classReports.map((report) => (
              <tr className="border-t border-slate-100" key={report.id}>
                <td className="px-5 py-4 font-bold text-navy">{getStudentById(report.studentId)?.name ?? getBatchById(report.batchId)?.name}</td>
                <td className="px-5 py-4 text-slate-600">{report.topic}</td>
                <td className="px-5 py-4 text-slate-600">{getCoachById(report.coachId)?.name}</td>
                <td className="px-5 py-4"><Badge className={statusStyles[report.status]}>{report.status}</Badge></td>
              </tr>
            ))}
          </DataTable>
        </div>
      </div>
      <div className="grid gap-6 xl:grid-cols-2">
        <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-card">
          <h2 className="text-xl font-black text-navy">Recently Added Students</h2>
          <div className="mt-4 space-y-3">
            {students.slice(-3).map((student) => (
              <div className="flex items-center justify-between gap-3 rounded-2xl bg-slate-50 p-4" key={student.id}>
                <div>
                  <div className="font-black text-navy">{student.name}</div>
                  <div className="text-sm text-slate-600">{getBatchById(student.batchId)?.name} · Joined {student.joinedAt}</div>
                </div>
                <Badge className={statusStyles.Active}>Active</Badge>
              </div>
            ))}
          </div>
        </section>
        <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-card">
          <h2 className="text-xl font-black text-navy">Coach Workload</h2>
          {classReports.length === 0 ? (
            <div className="mt-4"><EmptyState title="No coach workload yet" description="Coach workload will appear once batches and classes are scheduled." /></div>
          ) : (
            <div className="mt-4 space-y-3">
              {['coach-arjun', 'coach-priya', 'coach-vikram'].map((coachId) => {
                const coach = getCoachById(coachId);
                return (
                  <div className="rounded-2xl bg-slate-50 p-4" key={coachId}>
                    <div className="flex items-center justify-between">
                      <div className="font-black text-navy">{coach?.name}</div>
                      <div className="text-sm font-bold text-slate-600">{getBatchesForCoach(coachId).length} batches</div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
