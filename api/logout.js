export default function handler(req, res) {
  // Clear the auth cookie by setting Max-Age to 0
  res.setHeader(
    'Set-Cookie',
    'dash_token=; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=0'
  );
  return res.redirect(302, '/login.html');
}
