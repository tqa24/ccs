import * as readline from 'readline';

/**
 * Interactive Prompt Utilities (NO external dependencies)
 *
 * Features:
 * - TTY detection (auto-confirm in non-TTY)
 * - --yes flag support for automation
 * - --no-input flag support for CI
 * - Safe defaults (N for destructive actions)
 * - Input validation with retry
 */

interface ConfirmOptions {
  default?: boolean;
}

interface InputOptions {
  default?: string;
  validate?: (value: string) => string | null;
}

interface PasswordOptions {
  mask?: string; // Character to show (default: '*')
}

export class InteractivePrompt {
  /**
   * Ask for confirmation
   */
  static async confirm(message: string, options: ConfirmOptions = {}): Promise<boolean> {
    const { default: defaultValue = false } = options;

    // Check for --yes flag (automation) - always returns true
    if (
      process.env.CCS_YES === '1' ||
      process.argv.includes('--yes') ||
      process.argv.includes('-y')
    ) {
      return true;
    }

    // Check for --no-input flag (CI)
    if (process.env.CCS_NO_INPUT === '1' || process.argv.includes('--no-input')) {
      throw new Error('Interactive input required but --no-input specified');
    }

    // Non-TTY: use default
    if (!process.stdin.isTTY) {
      return defaultValue;
    }

    // Interactive prompt
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stderr,
      terminal: true,
    });

    const promptText = defaultValue ? `${message} [Y/n]: ` : `${message} [y/N]: `;

    return new Promise((resolve) => {
      rl.question(promptText, (answer: string) => {
        rl.close();

        const normalized = answer.trim().toLowerCase();

        // Empty answer: use default
        if (normalized === '') {
          resolve(defaultValue);
          return;
        }

        // Valid answers
        if (normalized === 'y' || normalized === 'yes') {
          resolve(true);
          return;
        }

        if (normalized === 'n' || normalized === 'no') {
          resolve(false);
          return;
        }

        // Invalid input: retry
        console.error('[!] Please answer y or n');
        resolve(InteractivePrompt.confirm(message, options));
      });
    });
  }

  /**
   * Get text input from user
   */
  static async input(message: string, options: InputOptions = {}): Promise<string> {
    const { default: defaultValue = '', validate = null } = options;

    // Non-TTY: use default or error
    if (!process.stdin.isTTY) {
      if (defaultValue) {
        return defaultValue;
      }
      throw new Error('Interactive input required but stdin is not a TTY');
    }

    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stderr,
      terminal: true,
    });

    const promptText = defaultValue ? `${message} [${defaultValue}]: ` : `${message}: `;

    return new Promise((resolve) => {
      rl.question(promptText, (answer: string) => {
        rl.close();

        const value = answer.trim() || defaultValue;

        // Validate input if validator provided
        if (validate) {
          const error = validate(value);
          if (error) {
            console.error(`[!] ${error}`);
            resolve(InteractivePrompt.input(message, options));
            return;
          }
        }

        resolve(value);
      });
    });
  }

  /**
   * Get password/secret input (masked)
   */
  static async password(message: string, options: PasswordOptions = {}): Promise<string> {
    const { mask = '*' } = options;

    // Non-TTY: error (passwords require interactive input)
    if (!process.stdin.isTTY) {
      throw new Error('Password input requires interactive TTY');
    }

    // Set raw mode BEFORE writing prompt to prevent any echo
    if (process.stdin.setRawMode) {
      process.stdin.setRawMode(true);
    }

    const promptText = `${message}: `;
    process.stderr.write(promptText);

    return new Promise((resolve) => {
      let input = '';

      const cleanup = (): void => {
        if (process.stdin.setRawMode) {
          process.stdin.setRawMode(false);
        }
        process.stdin.removeListener('data', onData);
      };

      const onData = (data: Buffer): void => {
        // Convert buffer to string and process each character
        const str = data.toString('utf8');

        for (const char of str) {
          const charCode = char.charCodeAt(0);

          // Enter key (CR or LF)
          if (charCode === 13 || charCode === 10) {
            cleanup();
            process.stderr.write('\n');
            resolve(input);
            return;
          }

          // Ctrl+C
          if (charCode === 3) {
            cleanup();
            process.stderr.write('\n');
            process.exit(130);
          }

          // Backspace (127 or 8)
          if (charCode === 127 || charCode === 8) {
            if (input.length > 0) {
              input = input.slice(0, -1);
              // Move cursor back, overwrite with space, move back again
              process.stderr.write('\b \b');
            }
            continue;
          }

          // Regular printable character (ignore control chars and newlines in paste)
          if (charCode >= 32) {
            input += char;
            process.stderr.write(mask);
          }
        }
      };

      process.stdin.on('data', onData);
      process.stdin.resume();
    });
  }
}
