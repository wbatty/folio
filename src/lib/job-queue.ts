const jobQueues = new Map<string, Promise<void>>();

export function enqueueForJob(jobId: string, fn: () => Promise<void>): Promise<void> {
  const current = jobQueues.get(jobId) ?? Promise.resolve();
  const next = current.then(fn, fn); // continue even if previous failed
  jobQueues.set(jobId, next);
  return next;
}
