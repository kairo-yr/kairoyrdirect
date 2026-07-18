import { useEffect, useMemo, useState } from 'react';
import { CalendarClock, Link2, Plus } from 'lucide-react';
import { EmptyState } from '../components/ui/EmptyState';
import { FormInput } from '../components/ui/FormInput';
import { FormSelect } from '../components/ui/FormSelect';
import { Modal } from '../components/ui/Modal';
import { PageHeader } from '../components/ui/PageHeader';
import { useAuth } from '../contexts/AuthContext';
import { getBatchesByAcademy, type Batch } from '../lib/batchApi';
import { createClassSlot, linkBatchToClassSlot, listBatchSlotLinks, listClassSlots, type ClassSlot } from '../lib/classSessionApi';
import { getCoachesByAcademy, type Coach } from '../lib/coachApi';

const weekdays = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
const timeLabel = (value: string) => new Date(`2000-01-01T${value}`).toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit' });

export function AcademyClassSlotsPage() {
  const { userProfile } = useAuth();
  const academyId = userProfile?.academyId;
  const [slots, setSlots] = useState<ClassSlot[]>([]);
  const [batches, setBatches] = useState<Batch[]>([]);
  const [coaches, setCoaches] = useState<Coach[]>([]);
  const [links, setLinks] = useState<Array<Record<string, unknown>>>([]);
  const [createOpen, setCreateOpen] = useState(false);
  const [linkOpen, setLinkOpen] = useState(false);
  const [form, setForm] = useState({ coachId: '', weekday: '5', startTime: '17:00', endTime: '18:00', location: '', roomName: '', name: '' });
  const [linkForm, setLinkForm] = useState({ batchId: '', slotId: '', effectiveStartDate: new Date().toISOString().slice(0, 10) });
  const [loading, setLoading] = useState(true); const [saving, setSaving] = useState(false); const [error, setError] = useState(''); const [message, setMessage] = useState('');

  const load = async () => {
    if (!academyId) return;
    setLoading(true); setError('');
    try {
      const [loadedSlots, loadedBatches, loadedCoaches, loadedLinks] = await Promise.all([listClassSlots(academyId), getBatchesByAcademy(academyId), getCoachesByAcademy(academyId), listBatchSlotLinks(academyId)]);
      setSlots(loadedSlots); setBatches(loadedBatches.filter((batch) => batch.status === 'active')); setCoaches(loadedCoaches.filter((coach) => coach.status === 'active')); setLinks(loadedLinks as Array<Record<string, unknown>>);
      setForm((current) => ({ ...current, coachId: current.coachId || loadedCoaches.find((coach) => coach.status === 'active')?.id || '' }));
      setLinkForm((current) => ({ ...current, batchId: current.batchId || loadedBatches.find((batch) => batch.status === 'active')?.id || '', slotId: current.slotId || loadedSlots[0]?.id || '' }));
    } catch (caught) { setError(caught instanceof Error ? caught.message : 'Could not load class schedules.'); }
    finally { setLoading(false); }
  };
  useEffect(() => { void load(); }, [academyId]);

  const linkedBatchNames = useMemo(() => {
    const map = new Map<string, string[]>();
    links.forEach((row) => { const slot = row.class_slot as { id?: string } | undefined; const batch = row.batch as { name?: string } | undefined; if (slot?.id && batch?.name) map.set(slot.id, [...(map.get(slot.id) ?? []), batch.name]); });
    return map;
  }, [links]);

  const saveSlot = async () => {
    if (!academyId || !form.coachId) return setError('Choose an active coach.');
    if (form.endTime <= form.startTime) return setError('End time must be after start time.');
    setSaving(true); setError('');
    try { await createClassSlot({ academy_id: academyId, coach_id: form.coachId, weekday: Number(form.weekday), start_time: form.startTime, end_time: form.endTime, location: form.location.trim() || null, room_name: form.roomName.trim() || null, name: form.name.trim() || null }); setCreateOpen(false); setMessage('Recurring class slot created.'); await load(); }
    catch (caught) { setError(caught instanceof Error ? caught.message : 'Could not create the slot.'); }
    finally { setSaving(false); }
  };
  const saveLink = async () => {
    if (!academyId || !linkForm.batchId || !linkForm.slotId) return setError('Choose a batch and class slot.');
    setSaving(true); setError('');
    try { await linkBatchToClassSlot({ academyId, batchId: linkForm.batchId, classSlotId: linkForm.slotId, effectiveStartDate: linkForm.effectiveStartDate }); setLinkOpen(false); setMessage('Batch linked to the recurring slot.'); await load(); }
    catch (caught) { setError(caught instanceof Error ? caught.message : 'Could not link the batch.'); }
    finally { setSaving(false); }
  };

  if (loading) return <EmptyState title="Loading class schedules" description="Checking recurring slots and linked batches." />;
  return <div className="space-y-6"><PageHeader title="Batch & Class Schedules" description="Create real teaching times, then link one or more administrative batches to each slot." action={<div className="flex flex-wrap gap-2"><button className="inline-flex items-center gap-2 rounded-xl border px-4 py-2.5 text-sm font-black" onClick={() => setLinkOpen(true)}><Link2 size={17}/>Link batch</button><button className="inline-flex items-center gap-2 rounded-xl bg-directBlue px-4 py-2.5 text-sm font-black text-white" onClick={() => setCreateOpen(true)}><Plus size={17}/>Create slot</button></div>}/>
    {message ? <p className="rounded-2xl bg-emerald-50 p-4 text-sm font-bold text-emerald-700">{message}</p> : null}{error ? <p className="rounded-2xl bg-rose-50 p-4 text-sm font-bold text-rose-700">{error}</p> : null}
    {slots.length ? <div className="grid gap-4 lg:grid-cols-2">{slots.map((slot) => <article className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm" key={slot.id}><div className="flex items-start gap-3"><span className="rounded-2xl bg-blue-50 p-3 text-directBlue"><CalendarClock size={22}/></span><div className="min-w-0"><h2 className="font-black text-navy">{slot.name || weekdays[slot.weekday - 1]}</h2><p className="mt-1 text-sm font-semibold text-slate-600">{weekdays[slot.weekday - 1]} · {timeLabel(slot.start_time)}–{timeLabel(slot.end_time)}</p><p className="mt-1 text-sm text-slate-500">{slot.coach?.full_name} · {slot.location || 'Location not set'}{slot.room_name ? ` · ${slot.room_name}` : ''}</p></div></div><div className="mt-4 rounded-2xl bg-slate-50 p-3"><p className="text-xs font-black uppercase text-slate-500">Linked batches</p><p className="mt-1 text-sm font-bold text-navy">{linkedBatchNames.get(slot.id)?.join(', ') || 'No batches linked yet'}</p></div></article>)}</div> : <EmptyState title="No recurring class slots yet" description="Create the academy’s first weekly teaching time, then link batches to it." />}
    <Modal open={createOpen} title="Create recurring class slot" description="Matching times remain separate when coach or location differs." onClose={() => setCreateOpen(false)}><div className="grid gap-4 sm:grid-cols-2"><FormInput label="Name optional" className="sm:col-span-2" value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })}/><FormSelect label="Coach" value={form.coachId} onChange={(event) => setForm({ ...form, coachId: event.target.value })} options={[{ value: '', label: 'Choose coach' }, ...coaches.map((coach) => ({ value: coach.id, label: coach.full_name }))]}/><FormSelect label="Weekday" value={form.weekday} onChange={(event) => setForm({ ...form, weekday: event.target.value })} options={weekdays.map((day, index) => ({ value: String(index + 1), label: day }))}/><FormInput label="Start time" type="time" value={form.startTime} onChange={(event) => setForm({ ...form, startTime: event.target.value })}/><FormInput label="End time" type="time" value={form.endTime} onChange={(event) => setForm({ ...form, endTime: event.target.value })}/><FormInput label="Location optional" value={form.location} onChange={(event) => setForm({ ...form, location: event.target.value })}/><FormInput label="Room optional" value={form.roomName} onChange={(event) => setForm({ ...form, roomName: event.target.value })}/><button disabled={saving} className="rounded-xl bg-directBlue px-4 py-3 text-sm font-black text-white sm:col-span-2" onClick={() => void saveSlot()}>Create recurring slot</button></div></Modal>
    <Modal open={linkOpen} title="Link batch to class slot" description="Multiple batches can share one slot and produce one class session." onClose={() => setLinkOpen(false)}><div className="grid gap-4"><FormSelect label="Batch" value={linkForm.batchId} onChange={(event) => setLinkForm({ ...linkForm, batchId: event.target.value })} options={[{ value: '', label: 'Choose batch' }, ...batches.map((batch) => ({ value: batch.id, label: batch.name }))]}/><FormSelect label="Recurring class slot" value={linkForm.slotId} onChange={(event) => setLinkForm({ ...linkForm, slotId: event.target.value })} options={[{ value: '', label: 'Choose slot' }, ...slots.map((slot) => ({ value: slot.id, label: `${weekdays[slot.weekday - 1]} · ${timeLabel(slot.start_time)} · ${slot.coach?.full_name}` }))]}/><FormInput label="Effective from" type="date" value={linkForm.effectiveStartDate} onChange={(event) => setLinkForm({ ...linkForm, effectiveStartDate: event.target.value })}/><button disabled={saving} className="rounded-xl bg-directBlue px-4 py-3 text-sm font-black text-white" onClick={() => void saveLink()}>Link batch</button></div></Modal>
  </div>;
}
