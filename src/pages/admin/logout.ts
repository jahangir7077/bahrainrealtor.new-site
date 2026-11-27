import type { APIRoute } from 'astro';
import { createAuthClient, settings } from '../../server/auth/session';
import { protectResponse, validMutation } from '../../server/auth/security';

export const POST: APIRoute = async ({ request, cookies, redirect }) => {
  const config = settings();
  if (!config || !validMutation(request, config.origin)) {
    const response = new Response('Request could not be completed.', { status: 403 });
    protectResponse(response);
    return response;
  }
  try {
    const client = createAuthClient(request, cookies, config);
    const { error } = await client.auth.signOut({ scope: 'local' });
    if (error) throw error;
    const response = redirect('/admin/login', 303);
    protectResponse(response);
    return response;
  } catch {
    const response = new Response('Sign-out could not be completed.', { status: 503 });
    protectResponse(response);
    return response;
  }
};
