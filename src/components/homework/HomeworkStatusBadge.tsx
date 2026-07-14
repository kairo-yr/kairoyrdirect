import { Badge } from '../ui/Badge';

export function HomeworkStatusBadge({ status }: { status: string }) {
  const label = status.replaceAll('_', ' ').replace(/\b\w/g, (letter) => letter.toUpperCase());
  const tone = ['completed','completed_late','published'].includes(status) ? 'bg-emerald-50 text-emerald-700' : ['overdue','needs_correction','cancelled'].includes(status) ? 'bg-rose-50 text-rose-700' : ['needs_review','submitted'].includes(status) ? 'bg-amber-50 text-amber-700' : 'bg-blue-50 text-directBlue';
  return <Badge className={tone}>{label}</Badge>;
}
