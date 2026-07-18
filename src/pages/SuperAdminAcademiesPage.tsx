import { useEffect, useMemo, useState } from 'react';
import { Ban, CheckCircle2, Eye, RotateCcw, Search, XCircle } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Badge } from '../components/ui/Badge';
import { DataTable } from '../components/ui/DataTable';
import { EmptyState } from '../components/ui/EmptyState';
import { FormInput } from '../components/ui/FormInput';
import { FormSelect } from '../components/ui/FormSelect';
import { PageHeader } from '../components/ui/PageHeader';
import {
  approveAcademy,
  disableAcademy,
  getAcademies,
  reactivateAcademy,
  rejectAcademy,
  type Academy,
  type AcademyStatus,
} from '../lib/academyApi';
import { getAcademyStatusClass } from '../utils/academyStatus';
import { formatDateTime } from '../utils/dateFormat';
import { useRefreshOnFocus } from '../hooks/useRefreshOnFocus';

type AcademyFilter = 'all' | AcademyStatus;

export function SuperAdminAcademiesPage() {
  const [academies, setAcademies] = useState<Academy[]>([]);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<AcademyFilter>('all');
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const refresh = async () => {
    setLoading(true);
    setError('');
    try {
      setAcademies(await getAcademies());
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Could not load academies.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void refresh();
  }, []);

  useRefreshOnFocus(refresh);

  const filteredAcademies = useMemo(() => {
    const term = search.trim().toLowerCase();
    return academies.filter((academy) => {
      const statusMatches = statusFilter === 'all' || academy.status === statusFilter;
      const searchMatches = !term || [academy.name, academy.owner_email, academy.city, academy.primary_phone, academy.status]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(term));
      return statusMatches && searchMatches;
    });
  }, [academies, search, statusFilter]);

  const runAction = async (action: () => Promise<void>, success: string) => {
    setError('');
    setMessage('');
    try {
      await action();
      setMessage(success);
      await refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Action failed.');
    }
  };

  const handleReject = async (academy: Academy) => {
    const reason = window.prompt(`Reason for rejecting ${academy.name}?`);
    if (!reason?.trim()) return;
    await runAction(() => rejectAcademy(academy.id, reason.trim()).then(() => undefined), `${academy.name} rejected.`);
  };

  return (
    <div className="space-y-6">
      <PageHeader title="Academies" description="Search, filter, and manage all academies registered on Kairoyr Direct." />

      <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-card">
        <div className="flex items-center gap-2 text-navy">
          <Search size={20} />
          <h2 className="text-xl font-black">Search and Filter</h2>
        </div>
        <div className="mt-4 grid gap-4 md:grid-cols-[1fr_220px]">
          <FormInput label="Search by academy name, owner email, city, phone, or status" value={search} onChange={(event) => setSearch(event.target.value)} />
          <FormSelect
            label="Status"
            value={statusFilter}
            onChange={(event) => setStatusFilter(event.target.value as AcademyFilter)}
            options={[
              { label: 'All', value: 'all' },
              { label: 'Pending', value: 'pending' },
              { label: 'Active', value: 'active' },
              { label: 'Rejected', value: 'rejected' },
              { label: 'Disabled', value: 'disabled' },
              { label: 'Archived', value: 'archived' },
            ]}
          />
        </div>
      </section>

      {message ? <div className="rounded-2xl bg-emerald-50 px-4 py-3 text-sm font-black text-emerald-700">{message}</div> : null}
      {error ? <div className="rounded-2xl bg-rose-50 px-4 py-3 text-sm font-black text-rose-700">{error}</div> : null}

      {loading ? (
        <EmptyState title="Loading academies" description="Checking the platform academy registry." />
      ) : academies.length === 0 ? (
        <EmptyState title="No academies registered yet" description="Academy registration requests will appear here." />
      ) : filteredAcademies.length === 0 ? (
        <EmptyState title="No academies found" description="Try a different search or status filter." />
      ) : (
        <DataTable columns={['Academy', 'Owner', 'City', 'Phone', 'Status', 'Created', 'Approved', 'Action']}>
          {filteredAcademies.map((academy) => (
            <tr className="border-t border-slate-100" key={academy.id}>
              <td className="px-5 py-4 font-black text-navy">{academy.name}</td>
              <td className="px-5 py-4 text-slate-600">{academy.owner_email || 'Not available'}</td>
              <td className="px-5 py-4 text-slate-600">{academy.city || 'Not available'}</td>
              <td className="px-5 py-4 text-slate-600">{academy.primary_phone || 'Not available'}</td>
              <td className="px-5 py-4"><Badge className={getAcademyStatusClass(academy.status)}>{academy.status}</Badge></td>
              <td className="px-5 py-4 text-slate-600">{formatDateTime(academy.created_at)}</td>
              <td className="px-5 py-4 text-slate-600">{formatDateTime(academy.approved_at)}</td>
              <td className="px-5 py-4">
                <div className="flex flex-wrap gap-2">
                  <Link className="inline-flex items-center gap-1 rounded-xl border border-slate-200 px-3 py-2 text-xs font-black text-slate-700" to={`/super-admin/academies/${academy.id}`}>
                    <Eye size={14} /> View Details
                  </Link>
                  {academy.status === 'pending' ? (
                    <>
                      <button className="inline-flex items-center gap-1 rounded-xl bg-emerald-600 px-3 py-2 text-xs font-black text-white" onClick={() => runAction(() => approveAcademy(academy.id).then(() => undefined), `${academy.name} approved.`)} type="button">
                        <CheckCircle2 size={14} /> Approve
                      </button>
                      <button className="inline-flex items-center gap-1 rounded-xl border border-rose-100 px-3 py-2 text-xs font-black text-rose-600" onClick={() => handleReject(academy)} type="button">
                        <XCircle size={14} /> Reject
                      </button>
                    </>
                  ) : null}
                  {academy.status === 'active' ? (
                    <button className="inline-flex items-center gap-1 rounded-xl border border-rose-100 px-3 py-2 text-xs font-black text-rose-600" onClick={() => runAction(() => disableAcademy(academy.id).then(() => undefined), `${academy.name} disabled.`)} type="button">
                      <Ban size={14} /> Disable
                    </button>
                  ) : null}
                  {academy.status === 'disabled' ? (
                    <button className="inline-flex items-center gap-1 rounded-xl bg-emerald-600 px-3 py-2 text-xs font-black text-white" onClick={() => runAction(() => reactivateAcademy(academy.id).then(() => undefined), `${academy.name} reactivated.`)} type="button">
                      <RotateCcw size={14} /> Reactivate
                    </button>
                  ) : null}
                </div>
              </td>
            </tr>
          ))}
        </DataTable>
      )}
    </div>
  );
}
