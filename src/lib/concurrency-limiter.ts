class Semaphore {
  private permits: number;
  private waitQueue: (() => void)[] = [];

  constructor(permits: number) {
    this.permits = permits;
  }

  async acquire(): Promise<void> {
    if (this.permits > 0) {
      this.permits--;
      return;
    }

    return new Promise((resolve) => {
      this.waitQueue.push(resolve);
    });
  }

  release(): void {
    const resolve = this.waitQueue.shift();
    if (resolve) {
      resolve();
    } else {
      this.permits++;
    }
  }
}

export function createLimiter(concurrency: number) {
  const semaphore = new Semaphore(concurrency);

  return async function limit<T>(fn: () => Promise<T>): Promise<T> {
    await semaphore.acquire();
    try {
      return await fn();
    } finally {
      semaphore.release();
    }
  };
}
