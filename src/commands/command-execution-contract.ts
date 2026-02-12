/**
 * Command Execution Contract
 *
 * Standardized lifecycle: parse -> validate -> execute -> render
 * for CLI command handlers.
 */

export interface CommandExecutionContract<TParsedArgs, TExecutionResult> {
  parse(rawArgs: string[]): TParsedArgs;
  validate(parsedArgs: TParsedArgs): void;
  execute(parsedArgs: TParsedArgs): Promise<TExecutionResult> | TExecutionResult;
  render(
    result: TExecutionResult,
    context: { rawArgs: string[]; parsedArgs: TParsedArgs }
  ): Promise<void> | void;
}

/**
 * Run a command through the standard lifecycle.
 */
export async function runCommandWithContract<TParsedArgs, TExecutionResult>(
  rawArgs: string[],
  contract: CommandExecutionContract<TParsedArgs, TExecutionResult>
): Promise<{ parsedArgs: TParsedArgs; result: TExecutionResult }> {
  const parsedArgs = contract.parse(rawArgs);
  contract.validate(parsedArgs);
  const result = await contract.execute(parsedArgs);
  await contract.render(result, { rawArgs, parsedArgs });
  return { parsedArgs, result };
}
