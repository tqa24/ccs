/**
 * Signal Forwarder
 *
 * Shared utility for forwarding process signals to child processes
 * and cleaning up handlers on exit.
 */
import { ChildProcess } from 'child_process';

/**
 * Forward SIGINT, SIGTERM, SIGHUP to a child process.
 * Returns a cleanup function to remove the handlers.
 */
export function forwardSignals(child: ChildProcess): () => void {
  const forwardSigInt = () => {
    if (!child.killed) child.kill('SIGINT');
  };
  const forwardSigTerm = () => {
    if (!child.killed) child.kill('SIGTERM');
  };
  const forwardSighup = () => {
    if (!child.killed) child.kill('SIGHUP');
  };

  process.on('SIGINT', forwardSigInt);
  process.on('SIGTERM', forwardSigTerm);
  process.on('SIGHUP', forwardSighup);

  return () => {
    process.removeListener('SIGINT', forwardSigInt);
    process.removeListener('SIGTERM', forwardSigTerm);
    process.removeListener('SIGHUP', forwardSighup);
  };
}

export type ChildProcessErrorHandler = (err: NodeJS.ErrnoException) => void | Promise<void>;
export type ChildProcessExitHandler = (code: number | null, signal: NodeJS.Signals | null) => void;

function defaultExitHandler(code: number | null, signal: NodeJS.Signals | null): void {
  if (signal) process.kill(process.pid, signal);
  else process.exit(code || 0);
}

/**
 * Attach shared signal-forwarding lifecycle handlers to a child process.
 * Ensures signal listeners are always cleaned up on child exit/error.
 */
export function wireChildProcessSignals(
  child: ChildProcess,
  onError: ChildProcessErrorHandler,
  onExit: ChildProcessExitHandler = defaultExitHandler
): void {
  const cleanupSignalHandlers = forwardSignals(child);
  let settled = false;

  const settle = (): boolean => {
    if (settled) return false;
    settled = true;
    cleanupSignalHandlers();
    return true;
  };

  child.on('exit', (code, signal) => {
    if (!settle()) return;
    onExit(code, signal);
  });

  child.on('error', async (err: NodeJS.ErrnoException) => {
    if (!settle()) return;
    try {
      await onError(err);
    } catch (handlerErr) {
      const message = handlerErr instanceof Error ? handlerErr.message : String(handlerErr);
      console.error(`[X] Failed to handle child process error: ${message}`);
      process.exit(1);
    }
  });
}
