/** Turns Supabase's sign-in email error into a plain reason for the server log. */
export function adminEmailReason(message: string): string {
  if (/rate limit|too many/i.test(message)) {
    return "Supabase's email limit was reached (its built-in email service sends only a few emails per hour). Wait an hour, or set up custom SMTP in Supabase.";
  }
  if (/not authorized|not allowed to send/i.test(message)) {
    return "Supabase's built-in email only sends to members of your Supabase organisation. Sign in to Supabase with the admin email, or set up custom SMTP in Supabase.";
  }
  if (/signups? not allowed|sign ?ups? (are )?disabled/i.test(message)) {
    return "New sign-ups are disabled in Supabase, so a first-time admin can't get a link. Allow sign-ups in Supabase → Authentication.";
  }
  if (/redirect/i.test(message)) {
    return "Supabase didn't accept the return address. Add https://<your site>/admin/auth/callback to Supabase → Authentication → URL Configuration → Redirect URLs.";
  }
  return "Supabase refused to send it; see the error above.";
}
