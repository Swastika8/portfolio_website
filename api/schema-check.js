import { compareContracts } from '../schema-check.mjs';

const maxBytes = 160 * 1024;

function reply(status, data, headers = {}) {
  return Response.json(data, { status, headers: { 'Cache-Control': 'no-store', ...headers } });
}

export default {
  async fetch(request) {
    if (request.method !== 'POST') return reply(405, { error: 'Use POST to compare contracts.' }, { Allow: 'POST' });
    if (request.headers.get('content-type')?.split(';')[0].trim().toLowerCase() !== 'application/json') {
      return reply(415, { error: 'Send a JSON request.' });
    }
    if (Number(request.headers.get('content-length')) > maxBytes) return reply(413, { error: 'This request is too large.' });

    let payload;
    try {
      const chunks = [];
      let received = 0;
      for await (const chunk of request.body ?? []) {
        received += chunk.byteLength;
        if (received > maxBytes) return reply(413, { error: 'This request is too large.' });
        chunks.push(chunk);
      }
      payload = JSON.parse(Buffer.concat(chunks).toString('utf8'));
      if (!payload || typeof payload !== 'object' || Array.isArray(payload)) return reply(400, { error: 'Send a JSON object.' });
    } catch {
      return reply(400, { error: 'Check the JSON and try again.' });
    }

    try {
      return reply(200, compareContracts(payload.expected, payload.incoming));
    } catch (error) {
      if (error.status === 400) return reply(400, { error: error.message });
      throw error;
    }
  },
};
