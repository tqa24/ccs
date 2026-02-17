import { describe, it, expect, jest } from 'bun:test';
import { EventEmitter } from 'events';
import type { ChildProcess } from 'child_process';
import { forwardSignals, wireChildProcessSignals } from '../../../src/utils/signal-forwarder';

type MockChildProcess = EventEmitter & {
  killed: boolean;
  kill: ChildProcess['kill'];
};

function createMockChildProcess(): ChildProcess {
  const child = new EventEmitter() as MockChildProcess;
  child.killed = false;
  child.kill = jest.fn(() => true) as ChildProcess['kill'];
  return child as ChildProcess;
}

function getSignalListenerCounts(): Record<'SIGINT' | 'SIGTERM' | 'SIGHUP', number> {
  return {
    SIGINT: process.listenerCount('SIGINT'),
    SIGTERM: process.listenerCount('SIGTERM'),
    SIGHUP: process.listenerCount('SIGHUP'),
  };
}

describe('signal-forwarder', () => {
  it('forwardSignals should register and cleanup listeners', () => {
    const child = createMockChildProcess();
    const before = getSignalListenerCounts();

    const cleanup = forwardSignals(child);

    expect(process.listenerCount('SIGINT')).toBe(before.SIGINT + 1);
    expect(process.listenerCount('SIGTERM')).toBe(before.SIGTERM + 1);
    expect(process.listenerCount('SIGHUP')).toBe(before.SIGHUP + 1);

    cleanup();

    expect(process.listenerCount('SIGINT')).toBe(before.SIGINT);
    expect(process.listenerCount('SIGTERM')).toBe(before.SIGTERM);
    expect(process.listenerCount('SIGHUP')).toBe(before.SIGHUP);
  });

  it('wireChildProcessSignals should use default exit behavior for exit code', () => {
    const child = createMockChildProcess();
    const before = getSignalListenerCounts();

    const exitSpy = jest
      .spyOn(process, 'exit')
      .mockImplementation((() => undefined as never) as typeof process.exit);
    const killSpy = jest
      .spyOn(process, 'kill')
      .mockImplementation((() => true) as typeof process.kill);

    try {
      wireChildProcessSignals(child, () => {});
      child.emit('exit', 7, null);

      expect(exitSpy).toHaveBeenCalledWith(7);
      expect(killSpy).not.toHaveBeenCalled();
      expect(process.listenerCount('SIGINT')).toBe(before.SIGINT);
      expect(process.listenerCount('SIGTERM')).toBe(before.SIGTERM);
      expect(process.listenerCount('SIGHUP')).toBe(before.SIGHUP);
    } finally {
      exitSpy.mockRestore();
      killSpy.mockRestore();
    }
  });

  it('wireChildProcessSignals should use default exit behavior for signal', () => {
    const child = createMockChildProcess();
    const before = getSignalListenerCounts();

    const exitSpy = jest
      .spyOn(process, 'exit')
      .mockImplementation((() => undefined as never) as typeof process.exit);
    const killSpy = jest
      .spyOn(process, 'kill')
      .mockImplementation((() => true) as typeof process.kill);

    try {
      wireChildProcessSignals(child, () => {});
      child.emit('exit', null, 'SIGTERM');

      expect(killSpy).toHaveBeenCalledWith(process.pid, 'SIGTERM');
      expect(exitSpy).not.toHaveBeenCalled();
      expect(process.listenerCount('SIGINT')).toBe(before.SIGINT);
      expect(process.listenerCount('SIGTERM')).toBe(before.SIGTERM);
      expect(process.listenerCount('SIGHUP')).toBe(before.SIGHUP);
    } finally {
      exitSpy.mockRestore();
      killSpy.mockRestore();
    }
  });

  it('wireChildProcessSignals should invoke onError and cleanup listeners', async () => {
    const child = createMockChildProcess();
    const before = getSignalListenerCounts();
    const onError = jest.fn(async () => {});
    const err = Object.assign(new Error('spawn failed'), {
      code: 'ENOENT',
    }) as NodeJS.ErrnoException;

    wireChildProcessSignals(child, onError);
    child.emit('error', err);
    await Promise.resolve();

    expect(onError).toHaveBeenCalledWith(err);
    expect(process.listenerCount('SIGINT')).toBe(before.SIGINT);
    expect(process.listenerCount('SIGTERM')).toBe(before.SIGTERM);
    expect(process.listenerCount('SIGHUP')).toBe(before.SIGHUP);
  });

  it('wireChildProcessSignals should run only one terminal callback when error is followed by exit', async () => {
    const child = createMockChildProcess();
    const onError = jest.fn(async () => {});
    const onExit = jest.fn();
    const err = Object.assign(new Error('spawn failed'), {
      code: 'ENOENT',
    }) as NodeJS.ErrnoException;

    wireChildProcessSignals(child, onError, onExit);
    child.emit('error', err);
    child.emit('exit', 1, null);
    await Promise.resolve();

    expect(onError).toHaveBeenCalledTimes(1);
    expect(onExit).not.toHaveBeenCalled();
  });

  it('wireChildProcessSignals should exit with code 1 when onError throws', async () => {
    const child = createMockChildProcess();
    const onError = jest.fn(async () => {
      throw new Error('handler exploded');
    });
    const exitSpy = jest
      .spyOn(process, 'exit')
      .mockImplementation((() => undefined as never) as typeof process.exit);

    try {
      const err = Object.assign(new Error('spawn failed'), {
        code: 'ENOENT',
      }) as NodeJS.ErrnoException;
      wireChildProcessSignals(child, onError);
      child.emit('error', err);
      await Promise.resolve();

      expect(onError).toHaveBeenCalledTimes(1);
      expect(exitSpy).toHaveBeenCalledWith(1);
    } finally {
      exitSpy.mockRestore();
    }
  });
});
