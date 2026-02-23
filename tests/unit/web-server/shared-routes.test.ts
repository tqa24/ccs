import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { sharedRoutes } from '../../../src/web-server/shared-routes';

function getGetRouteHandler(routePath: string): (req: unknown, res: unknown) => void {
  const layer = (sharedRoutes as { stack?: unknown[] }).stack?.find((entry) => {
    const route = (entry as { route?: { path?: string; methods?: Record<string, boolean> } }).route;
    return route?.path === routePath && route.methods?.get;
  }) as
    | {
        route?: {
          stack?: Array<{ handle: (req: unknown, res: unknown) => void }>;
        };
      }
    | undefined;

  const handler = layer?.route?.stack?.[0]?.handle;
  if (!handler) {
    throw new Error(`GET handler not found for route: ${routePath}`);
  }

  return handler;
}

describe('web-server shared-routes', () => {
  let tempHome: string;
  let ccsDir: string;
  let originalCcsHome: string | undefined;

  beforeEach(() => {
    tempHome = fs.mkdtempSync(path.join(os.tmpdir(), 'ccs-shared-routes-test-'));
    originalCcsHome = process.env.CCS_HOME;
    process.env.CCS_HOME = tempHome;

    ccsDir = path.join(tempHome, '.ccs');
    fs.mkdirSync(path.join(ccsDir, 'shared', 'skills'), { recursive: true });
    fs.mkdirSync(path.join(ccsDir, 'shared', 'agents'), { recursive: true });
  });

  afterEach(() => {
    if (originalCcsHome !== undefined) {
      process.env.CCS_HOME = originalCcsHome;
    } else {
      delete process.env.CCS_HOME;
    }

    if (tempHome && fs.existsSync(tempHome)) {
      fs.rmSync(tempHome, { recursive: true, force: true });
    }
  });

  it('lists symlinked skill directories', () => {
    const sharedSkillsDir = path.join(ccsDir, 'shared', 'skills');
    const targetDir = path.join(tempHome, 'skill-targets', 'my-skill');
    fs.mkdirSync(targetDir, { recursive: true });
    fs.writeFileSync(path.join(targetDir, 'SKILL.md'), 'name: my-skill\n\nMy test skill');

    const linkPath = path.join(sharedSkillsDir, 'my-skill');
    const symlinkType = process.platform === 'win32' ? 'junction' : 'dir';
    fs.symlinkSync(targetDir, linkPath, symlinkType as fs.symlink.Type);

    const handler = getGetRouteHandler('/skills');
    let payload: { items: Array<{ name: string; type: string }> } | undefined;

    handler(
      {},
      {
        json: (data: { items: Array<{ name: string; type: string }> }) => {
          payload = data;
        },
      }
    );

    expect(payload).toBeDefined();
    expect(payload?.items).toHaveLength(1);
    expect(payload?.items[0]).toMatchObject({
      name: 'my-skill',
      type: 'skill',
    });
  });

  it('lists symlinked agent directories', () => {
    const sharedAgentsDir = path.join(ccsDir, 'shared', 'agents');
    const targetDir = path.join(tempHome, 'agent-targets', 'my-agent');
    fs.mkdirSync(targetDir, { recursive: true });
    fs.writeFileSync(path.join(targetDir, 'prompt.md'), 'My test agent prompt');

    const linkPath = path.join(sharedAgentsDir, 'my-agent');
    const symlinkType = process.platform === 'win32' ? 'junction' : 'dir';
    fs.symlinkSync(targetDir, linkPath, symlinkType as fs.symlink.Type);

    const handler = getGetRouteHandler('/agents');
    let payload: { items: Array<{ name: string; type: string }> } | undefined;

    handler(
      {},
      {
        json: (data: { items: Array<{ name: string; type: string }> }) => {
          payload = data;
        },
      }
    );

    expect(payload).toBeDefined();
    expect(payload?.items).toHaveLength(1);
    expect(payload?.items[0]).toMatchObject({
      name: 'my-agent',
      type: 'agent',
    });
  });

  it('ignores markdown files in shared skills root', () => {
    const sharedSkillsDir = path.join(ccsDir, 'shared', 'skills');
    fs.writeFileSync(path.join(sharedSkillsDir, 'CLAUDE.md'), 'not a skill directory');

    const handler = getGetRouteHandler('/skills');
    let payload: { items: Array<{ name: string }> } | undefined;

    handler(
      {},
      {
        json: (data: { items: Array<{ name: string }> }) => {
          payload = data;
        },
      }
    );

    expect(payload).toBeDefined();
    expect(payload?.items).toEqual([]);
  });
});
