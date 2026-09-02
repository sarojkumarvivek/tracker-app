// Runs at Vercel Edge before any request reaches the page/function.
// Protects /dashboard.html and /api/getVisits — redirects to login if no valid cookie.

function getCookie(req, name) {
  const header = req.headers.get('cookie') || '';
  for (const part of header.split(';')) {
    const [k, ...rest] = part.trim().split('=');
    if (k.trim() === name) return rest.join('=');
  }
  return null;
}

export default function middleware(req) {
  const token  = getCookie(req, 'dash_token');
  const secret = process.env.AUTH_SECRET;

  // No secret configured OR cookie doesn't match → send to login
  if (!secret || token !== secret) {
    return Response.redirect(new URL('/login.html', req.url), 302);
  }

  // Cookie valid → pass request through (undefined = next)
}

export const config = {
  matcher: ['/dashboard.html', '/api/getVisits'],
};
