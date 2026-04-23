import { describe, it, expect, vi } from "vitest";
import { enqueueForJob } from "./job-queue";

describe("enqueueForJob", () => {
  it("executes a single task", async () => {
    const task = vi.fn().mockResolvedValue(undefined);
    await enqueueForJob("jq-single", task);
    expect(task).toHaveBeenCalledOnce();
  });

  it("returns a promise", () => {
    const result = enqueueForJob("jq-returns-promise", () => Promise.resolve());
    expect(result).toBeInstanceOf(Promise);
  });

  it("runs tasks for the same jobId in order", async () => {
    const order: number[] = [];
    const delay = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

    // task1 takes longer but must finish before task2 starts
    enqueueForJob("jq-order", async () => { await delay(30); order.push(1); });
    await enqueueForJob("jq-order", async () => { order.push(2); });

    expect(order).toEqual([1, 2]);
  });

  it("runs tasks for different jobIds concurrently", async () => {
    const finished: string[] = [];
    const delay = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

    const pA = enqueueForJob("jq-concurrent-A", async () => { await delay(40); finished.push("A"); });
    const pB = enqueueForJob("jq-concurrent-B", async () => { await delay(10); finished.push("B"); });

    await Promise.all([pA, pB]);

    // B finishes first because it has a shorter delay and no dependency on A
    expect(finished[0]).toBe("B");
    expect(finished[1]).toBe("A");
  });

  it("continues executing subsequent tasks even when a prior task throws", async () => {
    const task1 = vi.fn().mockRejectedValue(new Error("fail"));
    const task2 = vi.fn().mockResolvedValue(undefined);

    enqueueForJob("jq-error-recovery", task1);
    await enqueueForJob("jq-error-recovery", task2);

    expect(task1).toHaveBeenCalledOnce();
    expect(task2).toHaveBeenCalledOnce();
  });

  it("resolves to undefined on successful completion", async () => {
    const result = await enqueueForJob("jq-resolves", async () => undefined);
    expect(result).toBeUndefined();
  });

  it("queues multiple tasks and all run in order", async () => {
    const results: number[] = [];

    enqueueForJob("jq-multi", async () => { results.push(1); });
    enqueueForJob("jq-multi", async () => { results.push(2); });
    await enqueueForJob("jq-multi", async () => { results.push(3); });

    expect(results).toEqual([1, 2, 3]);
  });
});
