export default function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();

  const { username, password } = req.body || {};

  const validUser = process.env.DASHBOARD_USER;
  const validPass = process.env.DASHBOARD_PASS;
  const secret    = process.env.AUTH_SECRET;

  if (!validUser || !validPass || !secret) {
    return res.status(500).json({ error: 'Auth not configured on server' });
  }

  if (username === validUser && password === validPass) {
    // Set secure httpOnly cookie — valid for 7 days
    const maxAge = 60 * 60 * 24 * 7;
    res.setHeader(
      'Set-Cookie',
      `dash_token=${secret}; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=${maxAge}`
    );
    return res.status(200).json({ ok: true });
  }

  return res.status(401).json({ error: 'Invalid username or password' });
}
