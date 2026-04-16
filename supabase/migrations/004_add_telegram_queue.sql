-- Enable pgmq extension (Supabase Queues)
create extension if not exists pgmq;

-- Create the job ingest queue
select pgmq.create('job_ingest');

-- Public wrapper callable from supabase-js .rpc() to enqueue a message
create or replace function send_job_ingest(msg jsonb)
returns bigint
language sql
security definer
as $$
  select pgmq.send('job_ingest', msg);
$$;
