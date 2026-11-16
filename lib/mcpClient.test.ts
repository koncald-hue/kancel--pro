import { describe, expect, it } from 'vitest';
import { authorizeUrl, parseRpc, toolPayload } from './mcpClient';

describe('MCP client helpers', () => {
    it('reads plain JSON and event-stream responses by id', () => {
        expect(parseRpc('{"jsonrpc":"2.0","id":2,"result":{"a":1}}', 2)?.result).toEqual({ a: 1 });
        expect(parseRpc('event: message\ndata: {"jsonrpc":"2.0","id":3,"result":{"b":2}}\n\n', 3)?.result).toEqual({ b: 2 });
        expect(parseRpc('data: {"id":9,"result":1}', 3)).toBeNull();
        expect(parseRpc('nonsense', 1)).toBeNull();
    });
    it('unwraps tool results that are JSON text, optionally wrapped in a result string', () => {
        expect(toolPayload({ content: [{ type: 'text', text: '{"success":true,"count":1}' }] })).toEqual({ success: true, count: 1 });
        expect(toolPayload({ content: [{ type: 'text', text: JSON.stringify({ result: JSON.stringify({ ok: 1 }) }) }] })).toEqual({ ok: 1 });
        expect(toolPayload({ content: [{ type: 'text', text: 'prostý text' }] })).toBe('prostý text');
        expect(toolPayload(undefined)).toBe('');
    });
    it('builds a PKCE authorize URL with the resource indicator', () => {
        const u = new URL(authorizeUrl({ clientId: 'abc', redirectUri: 'http://localhost:3001/cb', challenge: 'ch', state: 'st' }));
        expect(u.origin + u.pathname).toBe('https://login.directcase.ai/oauth2/authorize');
        expect(u.searchParams.get('code_challenge_method')).toBe('S256');
        expect(u.searchParams.get('resource')).toBe('https://mcp.directcase.ai/');
        expect(u.searchParams.get('redirect_uri')).toBe('http://localhost:3001/cb');
    });
});
