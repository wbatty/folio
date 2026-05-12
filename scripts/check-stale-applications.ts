/**
 * Checks applied jobs that are >= 90 days old and marks them DENIED if the
 * job posting returns a 404. Safe to run repeatedly — already-denied jobs are
 * excluded by the query.
 *
 * Intended for cron:
 *   0 9 * * * cd /path/to/duckreports && npm run check-stale-applications >> /var/log/check-stale.log 2>&1
 */

import { supabase } from "../src/lib/supabase";
import { checkJobStillLive } from "../src/lib/job-check";

const STALE_DAYS = 60;
const staleDate = new Date(Date.now() - STALE_DAYS * 24 * 60 * 60 * 1000).toISOString();

async function main() {
  console.log(`[check-stale] Checking APPLIED jobs with date_applied <= ${staleDate}`);

  const { data: jobs, error } = await supabase
    .from("jobs")
    .select("id, url, date_applied")
    .eq("status", "APPLIED")
    .lte("date_applied", staleDate)
    .is("deleted_at", null);

  if (error) {
    console.error("[check-stale] Failed to fetch jobs:", error.message);
    process.exit(1);
  }

  if (!jobs || jobs.length === 0) {
    console.log("[check-stale] No stale applications found.");
    return;
  }

  console.log(`[check-stale] Found ${jobs.length} stale application(s).`);

  let denied = 0;
  let alive = 0;
  let blocked = 0;

  for (const job of jobs) {
    const result = await checkJobStillLive(job.url);
    console.log(`[check-stale] ${job.id} (applied ${job.date_applied}) → ${result}`);

    if (result === "closed") {
      await supabase.from("jobs").update({ status: "DENIED" }).eq("id", job.id);
      await supabase.from("status_logs").insert({
        job_id: job.id,
        status: "DENIED",
        note: "Job posting no longer available — marked as denied by automated stale check (≥90 days)",
      });
      denied++;
    } else if (result === "live") {
      alive++;
    } else {
      blocked++;
    }
  }

  console.log(
    `[check-stale] Done. denied=${denied} alive=${alive} blocked=${blocked} (unknown = Workday or WAF — not actioned)`
  );
}

main().catch((err) => {
  console.error("[check-stale] Fatal:", err);
  process.exit(1);
});
