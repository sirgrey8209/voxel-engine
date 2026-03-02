interface Task<T, R> {
  data: T;
  resolve: (result: R) => void;
  reject: (error: Error) => void;
}

export class WorkerPool<T = unknown, R = unknown> {
  private workers: Worker[] = [];
  private available: Worker[] = [];
  private queue: Task<T, R>[] = [];

  constructor(
    private createWorker: () => Worker,
    private poolSize: number = navigator.hardwareConcurrency || 4
  ) {
    for (let i = 0; i < this.poolSize; i++) {
      const worker = this.createWorker();
      this.workers.push(worker);
      this.available.push(worker);
    }
  }

  get size(): number {
    return this.workers.length;
  }

  execute(data: T): Promise<R> {
    return new Promise((resolve, reject) => {
      const task: Task<T, R> = { data, resolve, reject };

      if (this.available.length > 0) {
        this.runTask(this.available.pop()!, task);
      } else {
        this.queue.push(task);
      }
    });
  }

  private runTask(worker: Worker, task: Task<T, R>): void {
    worker.onmessage = (e: MessageEvent) => {
      task.resolve(e.data);
      this.onWorkerDone(worker);
    };

    worker.onerror = (e: ErrorEvent) => {
      task.reject(new Error(e.message));
      this.onWorkerDone(worker);
    };

    worker.postMessage(task.data);
  }

  private onWorkerDone(worker: Worker): void {
    if (this.queue.length > 0) {
      const nextTask = this.queue.shift()!;
      this.runTask(worker, nextTask);
    } else {
      this.available.push(worker);
    }
  }

  terminate(): void {
    for (const worker of this.workers) {
      worker.terminate();
    }
    this.workers = [];
    this.available = [];
    this.queue = [];
  }
}
