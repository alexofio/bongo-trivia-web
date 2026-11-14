// bongo-trivia-web Worker.
// Static files in public/ are served by Workers Static Assets without touching this code.
// This Worker only runs for /api/* (see run_worker_first in wrangler.jsonc) and for www → apex redirects.
export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    // One canonical host so the session cookie and analytics stay on bongotrivia.co.tz
    if (url.hostname === 'www.bongotrivia.co.tz') {
      url.hostname = 'bongotrivia.co.tz';
      return Response.redirect(url.toString(), 301);
    }

    if (url.pathname.startsWith('/api/')) {
      // Same-origin API: forward to bt-api through a service binding once it exists.
      if (env.BT_API) return env.BT_API.fetch(request);
      return Response.json(
        { code: 'api_not_live', message: 'Bongo Trivia API is not connected yet. The site runs in demo mode.' },
        { status: 503, headers: { 'Cache-Control': 'no-store' } }
      );
    }

    return env.ASSETS.fetch(request);
  }
};
