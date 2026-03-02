import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { WorkerPool } from '../../src/workers/WorkerPool';

describe('WorkerPool', () => {
  it('should create pool with specified size', () => {
    const pool = new WorkerPool(() => ({
      postMessage: vi.fn(),
      terminate: vi.fn(),
      onmessage: null,
      onerror: null,
    } as unknown as Worker), 4);

    expect(pool.size).toBe(4);
    pool.terminate();
  });

  it('should execute task and return result', async () => {
    const mockWorker = {
      postMessage: vi.fn(),
      terminate: vi.fn(),
      onmessage: null as ((e: MessageEvent) => void) | null,
      onerror: null as ((e: ErrorEvent) => void) | null,
    };

    const pool = new WorkerPool(() => {
      return mockWorker as unknown as Worker;
    }, 1);

    const taskPromise = pool.execute({ test: true });

    // Simulate worker responding
    mockWorker.onmessage!({ data: { result: 'done' } } as MessageEvent);

    const result = await taskPromise;
    expect(result).toEqual({ result: 'done' });
    pool.terminate();
  });

  it('should queue tasks when all workers are busy', async () => {
    const workers: Array<{
      postMessage: ReturnType<typeof vi.fn>;
      terminate: ReturnType<typeof vi.fn>;
      onmessage: ((e: MessageEvent) => void) | null;
      onerror: ((e: ErrorEvent) => void) | null;
    }> = [];

    const pool = new WorkerPool(() => {
      const worker = {
        postMessage: vi.fn(),
        terminate: vi.fn(),
        onmessage: null as ((e: MessageEvent) => void) | null,
        onerror: null as ((e: ErrorEvent) => void) | null,
      };
      workers.push(worker);
      return worker as unknown as Worker;
    }, 2);

    // Start 3 tasks with only 2 workers
    // Pool uses pop() (LIFO), so workers[1] is used first, then workers[0]
    const task1 = pool.execute({ id: 1 });
    const task2 = pool.execute({ id: 2 });
    const task3 = pool.execute({ id: 3 });

    // Workers are used in LIFO order (pop from available stack)
    expect(workers[1].postMessage).toHaveBeenCalledWith({ id: 1 });
    expect(workers[0].postMessage).toHaveBeenCalledWith({ id: 2 });

    // Complete first task (worker[1] was processing task1)
    workers[1].onmessage!({ data: { result: 1 } } as MessageEvent);
    const result1 = await task1;
    expect(result1).toEqual({ result: 1 });

    // Worker[1] should now process task 3
    expect(workers[1].postMessage).toHaveBeenCalledWith({ id: 3 });

    // Complete remaining tasks
    workers[0].onmessage!({ data: { result: 2 } } as MessageEvent);
    workers[1].onmessage!({ data: { result: 3 } } as MessageEvent);

    const result2 = await task2;
    const result3 = await task3;

    expect(result2).toEqual({ result: 2 });
    expect(result3).toEqual({ result: 3 });

    pool.terminate();
  });

  it('should handle worker errors', async () => {
    const mockWorker = {
      postMessage: vi.fn(),
      terminate: vi.fn(),
      onmessage: null as ((e: MessageEvent) => void) | null,
      onerror: null as ((e: ErrorEvent) => void) | null,
    };

    const pool = new WorkerPool(() => {
      return mockWorker as unknown as Worker;
    }, 1);

    const taskPromise = pool.execute({ test: true });

    // Simulate error
    mockWorker.onerror!({ message: 'Worker error' } as ErrorEvent);

    await expect(taskPromise).rejects.toThrow('Worker error');

    pool.terminate();
  });

  it('should terminate all workers', () => {
    const terminateFns: Array<ReturnType<typeof vi.fn>> = [];

    const pool = new WorkerPool(() => {
      const terminateFn = vi.fn();
      terminateFns.push(terminateFn);
      return {
        postMessage: vi.fn(),
        terminate: terminateFn,
        onmessage: null,
        onerror: null,
      } as unknown as Worker;
    }, 3);

    pool.terminate();

    expect(terminateFns).toHaveLength(3);
    for (const fn of terminateFns) {
      expect(fn).toHaveBeenCalled();
    }
    expect(pool.size).toBe(0);
  });

  it('should use navigator.hardwareConcurrency as default pool size', () => {
    // Mock navigator.hardwareConcurrency
    const originalNavigator = globalThis.navigator;
    Object.defineProperty(globalThis, 'navigator', {
      value: { hardwareConcurrency: 8 },
      writable: true,
      configurable: true,
    });

    const pool = new WorkerPool(() => ({
      postMessage: vi.fn(),
      terminate: vi.fn(),
      onmessage: null,
      onerror: null,
    } as unknown as Worker));

    expect(pool.size).toBe(8);
    pool.terminate();

    // Restore
    Object.defineProperty(globalThis, 'navigator', {
      value: originalNavigator,
      writable: true,
      configurable: true,
    });
  });

  it('should return worker to available pool after task completion', async () => {
    const mockWorker = {
      postMessage: vi.fn(),
      terminate: vi.fn(),
      onmessage: null as ((e: MessageEvent) => void) | null,
      onerror: null as ((e: ErrorEvent) => void) | null,
    };

    const pool = new WorkerPool(() => {
      return mockWorker as unknown as Worker;
    }, 1);

    // First task
    const task1 = pool.execute({ id: 1 });
    mockWorker.onmessage!({ data: { result: 1 } } as MessageEvent);
    await task1;

    // Second task should be able to use the same worker
    const task2 = pool.execute({ id: 2 });
    expect(mockWorker.postMessage).toHaveBeenCalledTimes(2);
    expect(mockWorker.postMessage).toHaveBeenLastCalledWith({ id: 2 });

    mockWorker.onmessage!({ data: { result: 2 } } as MessageEvent);
    const result2 = await task2;
    expect(result2).toEqual({ result: 2 });

    pool.terminate();
  });
});
