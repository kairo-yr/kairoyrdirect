-- Make a class report belong to an actual class session, not merely a batch/date pair.
-- Existing report content and identifiers are retained; only unambiguous legacy rows are linked.

alter table public.class_reports
  add column if not exists class_session_id uuid references public.class_sessions(id) on delete set null;

create index if not exists class_reports_session_idx on public.class_reports(class_session_id);
create unique index if not exists class_reports_one_per_session_uidx
  on public.class_reports(class_session_id) where class_session_id is not null;

with candidate_sessions as (
  select cr.id as report_id, min(cs.id) as session_id
  from public.class_reports cr
  join public.class_sessions cs
    on cs.academy_id=cr.academy_id
   and cs.session_date=cr.report_date
  left join public.session_source_batches ssb
    on ssb.session_id=cs.id
   and ssb.batch_id=cr.batch_id
  where cr.class_session_id is null
    and (cs.primary_batch_id=cr.batch_id or ssb.batch_id=cr.batch_id)
  group by cr.id
  having count(distinct cs.id)=1
)
update public.class_reports cr
set class_session_id=candidate_sessions.session_id
from candidate_sessions
where cr.id=candidate_sessions.report_id
  and cr.class_session_id is null
  and not exists (
    select 1 from public.class_reports owned
    where owned.class_session_id=candidate_sessions.session_id
      and owned.id<>cr.id
  );

-- This legacy constraint prevents two real sessions of the same batch/date from
-- each owning a report. The partial session index above is now the invariant.
alter table public.class_reports
  drop constraint if exists class_reports_batch_id_report_date_key;
