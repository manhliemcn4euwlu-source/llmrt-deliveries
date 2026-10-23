#!/usr/bin/env node
// anthropic-shim.js: an Anthropic Messages API front end over the pursekeeper inference proxy.
//
// The proxy (inference-proxy.js) pays a Nano 402 door per call and speaks OpenAI
// /v1/chat/completions. Claude Code speaks Anthropic /v1/messages. This shim translates one to the
// other, so a runtime with no account and no API key can pay for its own model calls in Nano.
//
//   PROXY_KEY=<the proxy's key> SHIM_PORT=3403 node anthropic-shim.js
//   ANTHROPIC_BASE_URL=http://127.0.0.1:3403 ANTHROPIC_API_KEY=<any> ANTHROPIC_MODEL=gpt-5-nano claude ...
//
// Env: UPSTREAM_PROXY (default http://127.0.0.1:3402), PROXY_KEY (required), SHIM_PORT (3403),
//      SHIM_MODEL (default gpt-5-nano; what the door is asked for, whatever the runtime names).
'use strict';
const http = require('node:http');
const { randomUUID } = require('node:crypto');

const UP = (process.env.UPSTREAM_PROXY || 'http://127.0.0.1:3402').replace(/\/$/, '');
const KEY = process.env.PROXY_KEY || '';
const PORT = Number(process.env.SHIM_PORT || 3403);
const MODEL = process.env.SHIM_MODEL || 'gpt-5-nano';
if (!KEY) { console.error('set PROXY_KEY (the inference proxy key)'); process.exit(2); }

const log = m => console.error(new Date().toISOString() + ' ' + m);

// Anthropic content blocks -> OpenAI content + tool calls. Text blocks are joined; tool_use becomes
// tool_calls; a tool_result block becomes a tool message, which is how OpenAI expects a result back.
function toOpenAI(body) {
  const out = [];
  const push = (role, content) => { if (content !== undefined && content !== null && content !== '') out.push({ role, content }); };
  const sys = body.system;
  if (typeof sys === 'string') push('system', sys);
  else if (Array.isArray(sys)) push('system', sys.map(b => (typeof b === 'string' ? b : b.text || '')).join('\n'));
  for (const m of body.messages || []) {
    const parts = Array.isArray(m.content) ? m.content : [{ type: 'text', text: String(m.content == null ? '' : m.content) }];
    const texts = [], calls = [], results = [];
    for (const p of parts) {
      if (p.type === 'text') texts.push(p.text || '');
      else if (p.type === 'tool_use') calls.push({ id: p.id, type: 'function', function: { name: p.name, arguments: JSON.stringify(p.input || {}) } });
      else if (p.type === 'tool_result') {
        const c = Array.isArray(p.content) ? p.content.map(x => x.text || '').join('') : String(p.content == null ? '' : p.content);
        results.push({ role: 'tool', tool_call_id: p.tool_use_id, content: c });
      }
    }
    if (results.length) { out.push(...results); if (texts.length) push(m.role, texts.join('\n')); continue; }
    const msg = { role: m.role, content: texts.length ? texts.join('\n') : (calls.length ? null : '') };
    if (calls.length) msg.tool_calls = calls;
    if (msg.content !== '') out.push(msg);
  }
  const req = { model: MODEL, messages: out, max_tokens: body.max_tokens || 1024 };
  if (body.temperature !== undefined) req.temperature = body.temperature;
  if (body.stop_sequences) req.stop = body.stop_sequences;
  if (Array.isArray(body.tools) && body.tools.length) {
    req.tools = body.tools.map(t => ({ type: 'function', function: { name: t.name, description: t.description || '', parameters: t.input_schema || { type: 'object', properties: {} } } }));
    if (body.tool_choice && body.tool_choice.type === 'tool') req.tool_choice = { type: 'function', function: { name: body.tool_choice.name } };
  }
  return req;
}

// OpenAI completion -> Anthropic message. A tool call answer is a tool_use block, which is what makes
// an agent loop work at all; finish_reason maps to stop_reason so the runtime knows to run the tool.
function fromOpenAI(o, model) {
  const ch = (o.choices && o.choices[0]) || {};
  const m = ch.message || {};
  const blocks = [];
  if (m.content) blocks.push({ type: 'text', text: String(m.content) });
  for (const c of m.tool_calls || []) {
    let input = {};
    try { input = JSON.parse(c.function && c.function.arguments || '{}'); } catch { input = { _raw: c.function && c.function.arguments }; }
    blocks.push({ type: 'tool_use', id: c.id || ('toolu_' + randomUUID().replace(/-/g, '').slice(0, 24)), name: (c.function && c.function.name) || 'tool', input });
  }
  if (!blocks.length) blocks.push({ type: 'text', text: '' });
  const stop = ch.finish_reason === 'tool_calls' ? 'tool_use' : ch.finish_reason === 'length' ? 'max_tokens' : 'end_turn';
  const u = o.usage || {};
  return { id: 'msg_' + randomUUID().replace(/-/g, '').slice(0, 24), type: 'message', role: 'assistant', model: model || MODEL, content: blocks, stop_reason: stop, stop_sequence: null,
    usage: { input_tokens: u.prompt_tokens || 0, output_tokens: u.completion_tokens || 0 } };
}

function readAll(req) {
  return new Promise((resolve, reject) => {
    const chunks = []; let n = 0;
    req.on('data', c => { n += c.length; if (n > 8 << 20) reject(new Error('body too large')); else chunks.push(c); });
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });
}

function sse(res, event, data) { res.write('event: ' + event + '\ndata: ' + JSON.stringify(data) + '\n\n'); }

// Streaming: the shim asks the door for a plain completion and emits it as Anthropic events. The
// proxy's own SSE wrapping carries the whole message in one delta anyway, so a second streaming
// path here would add a failure mode without adding a byte of latency.
function streamMessage(res, msg) {
  res.writeHead(200, { 'content-type': 'text/event-stream', 'cache-control': 'no-cache', connection: 'keep-alive' });
  sse(res, 'message_start', { type: 'message_start', message: { ...msg, content: [], stop_reason: null } });
  for (let i = 0; i < msg.content.length; i++) {
    const b = msg.content[i];
    const start = b.type === 'tool_use' ? { type: 'tool_use', id: b.id, name: b.name, input: {} } : { type: 'text', text: '' };
    sse(res, 'content_block_start', { type: 'content_block_start', index: i, content_block: start });
    const delta = b.type === 'tool_use' ? { type: 'input_json_delta', partial_json: JSON.stringify(b.input) } : { type: 'text_delta', text: b.text };
    sse(res, 'content_block_delta', { type: 'content_block_delta', index: i, delta });
    sse(res, 'content_block_stop', { type: 'content_block_stop', index: i });
  }
  sse(res, 'message_delta', { type: 'message_delta', delta: { stop_reason: msg.stop_reason, stop_sequence: null }, usage: msg.usage });
  sse(res, 'message_stop', { type: 'message_stop' });
  res.end();
}

const server = http.createServer(async (req, res) => {
  const u = new URL(req.url, 'http://x');
  if (req.method === 'GET' && (u.pathname === '/' || u.pathname === '/health')) { res.writeHead(200, { 'content-type': 'application/json' }); return res.end(JSON.stringify({ ok: true, upstream: UP, model: MODEL })); }
  if (!u.pathname.endsWith('/v1/messages')) { res.writeHead(404, { 'content-type': 'application/json' }); return res.end(JSON.stringify({ type: 'error', error: { type: 'not_found_error', message: 'only /v1/messages is served' } })); }
  let body;
  try { body = JSON.parse((await readAll(req)).toString('utf8') || '{}'); } catch (e) { res.writeHead(400, { 'content-type': 'application/json' }); return res.end(JSON.stringify({ type: 'error', error: { type: 'invalid_request_error', message: e.message } })); }
  const wantStream = !!body.stream;
  const oreq = toOpenAI(body);
  if (wantStream) delete oreq.stream;   // the shim streams the finished message itself
  let r;
  try {
    r = await fetch(UP + '/v1/chat/completions', { method: 'POST', headers: { 'content-type': 'application/json', authorization: 'Bearer ' + KEY }, body: JSON.stringify(oreq) });
  } catch (e) { res.writeHead(502, { 'content-type': 'application/json' }); return res.end(JSON.stringify({ type: 'error', error: { type: 'api_error', message: 'proxy unreachable: ' + e.message } })); }
  const text = await r.text();
  if (r.status !== 200) {
    // The proxy's refusals are 402 with a code (cap_exceeded, over_per_call_limit, ...). Passing the
    // status and code through unchanged is what lets the operator see why the wallet stopped paying.
    let parsed = null; try { parsed = JSON.parse(text); } catch { /* not JSON */ }
    const code = (parsed && parsed.payer && parsed.payer.code) || null;
    res.writeHead(r.status, { 'content-type': 'application/json', ...(code ? { 'x-payer-refused': code } : {}) });
    return res.end(JSON.stringify({ type: 'error', error: { type: r.status === 402 ? 'invalid_request_error' : 'api_error', message: (parsed && (parsed.error && parsed.error.message || parsed.error)) || text.slice(0, 500), code } }));
  }
  let o; try { o = JSON.parse(text); } catch { res.writeHead(502, { 'content-type': 'application/json' }); return res.end(JSON.stringify({ type: 'error', error: { type: 'api_error', message: 'door answered no JSON' } })); }
  const msg = fromOpenAI(o, body.model);
  const paid = { 'x-payer-paid': r.headers.get('x-payer-paid'), 'x-payer-hash': r.headers.get('x-payer-hash') };
  for (const [k, v] of Object.entries(paid)) if (v) res.setHeader(k, v);
  if (wantStream) return streamMessage(res, msg);
  res.writeHead(200, { 'content-type': 'application/json' });
  res.end(JSON.stringify(msg));
});
server.listen(PORT, '127.0.0.1', () => log('anthropic shim on 127.0.0.1:' + PORT + ' -> ' + UP + ' model ' + MODEL));
