// bongo-trivia-web Worker (bongotrivia.co.tz).
// Static files in public/ are served by Workers Static Assets without running this code. This Worker runs first only for:
//   /bongo-trivia/*  → the Bluetrain Portal through the PORTAL service binding (player + agent API, SMS opt-out links).
//                      Same origin for the browser: no CORS, and the portal host is never exposed.
//   /r/*             → agent links /r/CODE[/CAMPAIGN][?s=subid] become /?ref=CODE&c=CAMPAIGN&s=subid for the app.
// and for www → apex redirects.
export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (url.hostname === 'www.bongotrivia.co.tz') {
      url.hostname = 'bongotrivia.co.tz';
      return Response.redirect(url.toString(), request.method === 'GET' || request.method === 'HEAD' ? 301 : 308);
    }

    if (url.pathname.startsWith('/bongo-trivia/')) {
      if (!env.PORTAL) return Response.json({ error: 'Bongo Trivia API is not connected yet.' }, { status: 503, headers: { 'Cache-Control': 'no-store' } });
      // The portal routes by host: bongotrivia.co.tz requests reach only the Bongo Trivia site code (worker/lib/bongo/site.js).
      const fwd = new URL(url); fwd.hostname = 'bongotrivia.co.tz'; fwd.protocol = 'https:'; fwd.port = '';
      return env.PORTAL.fetch(new Request(fwd.toString(), request));
    }

    const m = url.pathname.match(/^\/r\/([A-Za-z0-9]{3,12})(?:\/([A-Za-z0-9]{3,12}))?\/?$/);
    if (m) {
      const to = new URL('/', url);
      to.searchParams.set('ref', m[1].toUpperCase());
      if (m[2]) to.searchParams.set('c', m[2]);
      for (const [k, v] of url.searchParams) to.searchParams.set(k, v);   // s=subid, utm_*, click ids
      return Response.redirect(to.toString(), 302);
    }

    return env.ASSETS.fetch(request);
  }
};
