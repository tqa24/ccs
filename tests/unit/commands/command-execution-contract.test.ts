import { describe, it, expect } from 'bun:test';
import { runCommandWithContract } from '../../../src/commands/command-execution-contract';

describe('runCommandWithContract', () => {
  it('runs parse -> validate -> execute -> render in order', async () => {
    const lifecycle: string[] = [];

    const result = await runCommandWithContract(['--flag'], {
      parse: (rawArgs) => {
        lifecycle.push('parse');
        expect(rawArgs).toEqual(['--flag']);
        return { parsed: true, value: rawArgs[0] };
      },
      validate: (parsedArgs) => {
        lifecycle.push('validate');
        expect(parsedArgs).toEqual({ parsed: true, value: '--flag' });
      },
      execute: async (parsedArgs) => {
        lifecycle.push('execute');
        return { output: parsedArgs.value.toUpperCase() };
      },
      render: (executionResult, context) => {
        lifecycle.push('render');
        expect(executionResult).toEqual({ output: '--FLAG' });
        expect(context.rawArgs).toEqual(['--flag']);
        expect(context.parsedArgs).toEqual({ parsed: true, value: '--flag' });
      },
    });

    expect(lifecycle).toEqual(['parse', 'validate', 'execute', 'render']);
    expect(result.parsedArgs).toEqual({ parsed: true, value: '--flag' });
    expect(result.result).toEqual({ output: '--FLAG' });
  });

  it('short-circuits after validate failure', async () => {
    const lifecycle: string[] = [];

    const promise = runCommandWithContract([], {
      parse: () => {
        lifecycle.push('parse');
        return { valid: false };
      },
      validate: () => {
        lifecycle.push('validate');
        throw new Error('validation failed');
      },
      execute: () => {
        lifecycle.push('execute');
        return { ok: true };
      },
      render: () => {
        lifecycle.push('render');
      },
    });

    await expect(promise).rejects.toThrow('validation failed');
    expect(lifecycle).toEqual(['parse', 'validate']);
  });
});
