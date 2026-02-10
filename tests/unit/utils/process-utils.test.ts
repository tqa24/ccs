/**
 * Unit tests for process-utils.ts
 */
import { describe, it, expect, beforeEach, afterEach, jest } from 'bun:test';
import { EventEmitter } from 'events';
import { killWithEscalation } from '../../../src/utils/process-utils';
import type { ChildProcess } from 'child_process';

// Mock ChildProcess using EventEmitter
function createMockProcess(exitCode: number | null = null): ChildProcess {
  const proc = new EventEmitter() as any;
  proc.killed = false;
  proc.exitCode = exitCode;
  proc.kill = jest.fn((signal?: string) => {
    if (signal === 'SIGTERM' || signal === 'SIGKILL') {
      proc.killed = true;
    }
    return true;
  });
  return proc as ChildProcess;
}

describe('killWithEscalation', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('should send SIGTERM immediately', () => {
    const proc = createMockProcess();
    killWithEscalation(proc);

    expect(proc.kill).toHaveBeenCalledWith('SIGTERM');
    expect(proc.kill).toHaveBeenCalledTimes(1);
  });

  it('should send SIGKILL after grace period if process still running', () => {
    const proc = createMockProcess(null); // exitCode null = still running
    killWithEscalation(proc, 3000);

    // SIGTERM sent immediately
    expect(proc.kill).toHaveBeenCalledWith('SIGTERM');
    expect(proc.kill).toHaveBeenCalledTimes(1);

    // Advance time by grace period
    jest.advanceTimersByTime(3000);

    // SIGKILL sent after grace period
    expect(proc.kill).toHaveBeenCalledWith('SIGKILL');
    expect(proc.kill).toHaveBeenCalledTimes(2);
  });

  it('should NOT send SIGKILL if process exits before grace period', () => {
    const proc = createMockProcess(null);
    killWithEscalation(proc, 3000);

    expect(proc.kill).toHaveBeenCalledWith('SIGTERM');
    expect(proc.kill).toHaveBeenCalledTimes(1);

    // Simulate process exit after 1 second
    jest.advanceTimersByTime(1000);
    proc.exitCode = 0; // Process exited
    proc.emit('exit', 0);

    // Advance remaining time
    jest.advanceTimersByTime(2000);

    // SIGKILL should NOT have been sent
    expect(proc.kill).toHaveBeenCalledTimes(1);
    expect(proc.kill).not.toHaveBeenCalledWith('SIGKILL');
  });

  it('should use default grace period of 3000ms', () => {
    const proc = createMockProcess(null);
    killWithEscalation(proc); // No grace period argument

    expect(proc.kill).toHaveBeenCalledWith('SIGTERM');

    // Advance by default 3000ms
    jest.advanceTimersByTime(3000);

    expect(proc.kill).toHaveBeenCalledWith('SIGKILL');
  });

  it('should respect custom grace period', () => {
    const proc = createMockProcess(null);
    killWithEscalation(proc, 5000); // Custom 5 second grace period

    expect(proc.kill).toHaveBeenCalledWith('SIGTERM');

    // Advance by less than grace period
    jest.advanceTimersByTime(4999);
    expect(proc.kill).toHaveBeenCalledTimes(1); // Still only SIGTERM

    // Advance to grace period
    jest.advanceTimersByTime(1);
    expect(proc.kill).toHaveBeenCalledWith('SIGKILL');
  });

  it('should clear timer when process exits', () => {
    const proc = createMockProcess(null);
    killWithEscalation(proc, 3000);

    // Simulate immediate exit
    proc.exitCode = 0;
    proc.emit('exit', 0);

    // Advance way past grace period
    jest.advanceTimersByTime(10000);

    // Should only have SIGTERM, timer was cleared
    expect(proc.kill).toHaveBeenCalledTimes(1);
    expect(proc.kill).toHaveBeenCalledWith('SIGTERM');
  });

  it('should handle process that already exited', () => {
    const proc = createMockProcess(0); // Already exited
    killWithEscalation(proc, 3000);

    expect(proc.kill).toHaveBeenCalledWith('SIGTERM');

    // Even though exitCode is not null, timer still fires
    // (because we check exitCode at timer callback time)
    jest.advanceTimersByTime(3000);

    // SIGKILL should NOT be sent because exitCode is not null
    expect(proc.kill).toHaveBeenCalledTimes(1);
  });
});
