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
