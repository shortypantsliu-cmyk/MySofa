// netlify/functions/library.js
// Handles read/write of the MySofa library to Netlify Blobs.
// Deployed automatically — no configuration needed beyond placing this file.

import { getStore } from '@netlify/blobs';

export default async (req) => {
  const store = getStore('mysofa');

  // ── GET: return the stored library ──────────────────────────────────────────
  if (req.method === 'GET') {
    try {
      const data = await store.get('library', { type: 'json' });
      return Response.json(data ?? []);
    } catch {
      // Blob doesn't exist yet (first ever load) — return empty array
      return Response.json([]);
    }
  }

  // ── POST: overwrite the stored library ──────────────────────────────────────
  if (req.method === 'POST') {
    try {
      const items = await req.json();
      if (!Array.isArray(items)) {
        return Response.json({ ok: false, error: 'Expected an array' }, { status: 400 });
      }
      await store.setJSON('library', items);
      return Response.json({ ok: true, count: items.length });
    } catch (e) {
      return Response.json({ ok: false, error: e.message }, { status: 500 });
    }
  }

  return new Response('Method not allowed', { status: 405 });
};

// Serve at /api/library instead of /.netlify/functions/library
export const config = { path: '/api/library' };
