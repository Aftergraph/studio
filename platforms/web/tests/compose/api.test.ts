import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { compileIntent, parseCompileResponse, ComposeProtocolError, ComposeHttpError } from '../../src/compose/api';

const validResponse = {
  ir: {
    schema: 'aftergraph/intent-ir/v0.1',
    source: { text: 'test', surface: 'compose-web' },
    goal: { statement: 'goal', successCriteria: [] },
    ambiguities: [],
  },
  target: { target: 'auto', confidence: 0.9, reasonCodes: [], alternatives: [] },
  artifact: { target: 'auto', mediaType: 'text/markdown', content: 'content', semanticMap: {} },
  findings: [],
};

describe('parseCompileResponse', () => {
  it('accepts a well-formed response', () => {
    const result = parseCompileResponse(validResponse);
    expect(result.ir.schema).toBe('aftergraph/intent-ir/v0.1');
    expect(result.target.confidence).toBe(0.9);
  });

  it('rejects null', () => {
    expect(() => parseCompileResponse(null)).toThrow(ComposeProtocolError);
  });

  it('rejects non-objects', () => {
    expect(() => parseCompileResponse('string')).toThrow(ComposeProtocolError);
    expect(() => parseCompileResponse(42)).toThrow(ComposeProtocolError);
  });

  it('rejects missing ir', () => {
    expect(() => parseCompileResponse({ ...validResponse, ir: undefined })).toThrow(ComposeProtocolError);
  });

  it('rejects missing target', () => {
    expect(() => parseCompileResponse({ ...validResponse, target: undefined })).toThrow(ComposeProtocolError);
  });

  it('rejects missing artifact', () => {
    expect(() => parseCompileResponse({ ...validResponse, artifact: undefined })).toThrow(ComposeProtocolError);
  });

  it('rejects missing findings array', () => {
    expect(() => parseCompileResponse({ ...validResponse, findings: undefined })).toThrow(ComposeProtocolError);
  });

  it('rejects invalid schema type', () => {
    expect(() =>
      parseCompileResponse({ ...validResponse, ir: { ...validResponse.ir, schema: 123 } }),
    ).toThrow(ComposeProtocolError);
  });

  it('rejects invalid confidence type', () => {
    expect(() =>
      parseCompileResponse({ ...validResponse, target: { ...validResponse.target, confidence: 'high' } }),
    ).toThrow(ComposeProtocolError);
  });
});

describe('ComposeHttpError', () => {
  it('carries the status code', () => {
    const err = new ComposeHttpError(429);
    expect(err.status).toBe(429);
    expect(err.message).toContain('429');
    expect(err.name).toBe('ComposeHttpError');
  });
});

describe('ComposeProtocolError', () => {
  it('has the right name and default message', () => {
    const err = new ComposeProtocolError();
    expect(err.name).toBe('ComposeProtocolError');
    expect(err.message).toBe('Invalid Compose response');
  });
});

describe('compileIntent', () => {
  const okResponse = () =>
    Promise.resolve(
      new Response(JSON.stringify(validResponse), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      }),
    );

  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn(() => okResponse()));
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('completes a successful compile', async () => {
    const result = await compileIntent('hello');
    expect(result.ir.schema).toBe('aftergraph/intent-ir/v0.1');
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it('aborts the request when the caller aborts the signal', async () => {
    const fetchMock = vi.fn((_url: string, init: RequestInit) => {
      return new Promise<Response>((_resolve, reject) => {
        const sig = init.signal;
        if (!sig) return;
        sig.addEventListener('abort', () => reject(sig.reason));
      });
    });
    vi.stubGlobal('fetch', fetchMock);

    const controller = new AbortController();
    const promise = compileIntent('hello', 'auto', undefined, controller.signal, 5000);
    controller.abort(new DOMException('Aborted', 'AbortError'));
    await expect(promise).rejects.toThrow('Aborted');
  });

  it('throws ComposeHttpError on a non-ok response', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(() => Promise.resolve(new Response('nope', { status: 500 }))),
    );
    await expect(compileIntent('hello')).rejects.toMatchObject({ name: 'ComposeHttpError', status: 500 });
  });
});
