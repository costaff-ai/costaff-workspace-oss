import { describe, expect, it } from 'vitest';
import { KEY_PLACEHOLDER, mcpSetup } from './cli-mcp.ts';

describe('mcp setup', () => {
  it('points at the devices page and leaves the key for the person to fill in', () => {
    const out = mcpSetup('https://workspace.costaffs.app/', '/v1/mcp');
    expect(out.url).toBe('https://workspace.costaffs.app/v1/mcp');
    expect(out.keysUrl).toBe('https://workspace.costaffs.app/devices');
    expect(out.claude).toContain(`Authorization: Bearer ${KEY_PLACEHOLDER}`);
    expect(out.claude).toContain('costaff-workspace https://workspace.costaffs.app/v1/mcp');
  });
});
