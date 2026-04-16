-- RPC wrappers for pgmq read/archive so Supabase Edge Functions can access
-- the queue via supabase-js .rpc() without needing a direct pg connection.

create or replace function read_job_ingest(vt integer, qty integer)
returns table(
  msg_id     bigint,
  read_ct    integer,
  enqueued_at timestamptz,
  vt          timestamptz,
  message    jsonb
)
language sql
security definer
as $$
  select msg_id, read_ct, enqueued_at, vt, message
  from pgmq.read('job_ingest', vt, qty);
$$;

create or replace function archive_job_ingest(msg_id bigint)
returns boolean
language sql
security definer
as $$
  select pgmq.archive('job_ingest', msg_id);
$$;
