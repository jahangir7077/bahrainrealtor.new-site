import type { APIRoute } from 'astro';

export const prerender = false;

export const GET: APIRoute = () => {
  const generatedAt = new Date().toISOString();

  return new Response(JSON.stringify({ generatedAt }), {
    headers: {
      'Cache-Control': 'no-store, max-age=0',
      'Content-Type': 'application/json; charset=utf-8',
    },
  });
};
