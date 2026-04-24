export const CacheTag = {
  jobsList: "jobs-list",
  jobDetail: (id: string) => `job-detail:${id}`,
  companies: "companies-list",
  metrics: "metrics",
} as const;
