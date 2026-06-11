# Branding Supabase auth — emails + the Google sign-in screen

Two layers, both **dashboard config** (no code). Files referenced here are in
`docs/email-templates/`.

---

## Part 1 — Brand the auth emails (confirm / reset / magic link)

These are the emails Supabase sends (signup confirmation, password reset, magic
link) — separate from the app's Resend emails. Two things to do:

### 1a. Send them from your domain (custom SMTP) — do this first
By default Supabase sends auth emails from *its own* address (looks unbranded) and
rate-limits them. Point Supabase at your Resend account so they come from
`noreply@letsroam.life`:

1. **Resend → SMTP** (or API) — get the SMTP host/port/user/pass (host `smtp.resend.com`,
   port `465`, user `resend`, pass = your `re_…` API key).
2. **Supabase dashboard → Authentication → Emails → SMTP Settings → Enable custom SMTP**:
   - Sender email: `noreply@letsroam.life`
   - Sender name: `roam`
   - Host: `smtp.resend.com` · Port `465` · Username `resend` · Password: your Resend API key
3. Make sure `letsroam.life` is a **verified domain in Resend** (Resend → Domains).

### 1b. Paste the branded templates
**Supabase dashboard → Authentication → Email Templates.** For each template, switch
to the HTML/source view and paste the matching file, then **Save**:

| Supabase template | Paste this file |
|---|---|
| **Confirm signup** | `docs/email-templates/confirm-signup.html` |
| **Reset password** | `docs/email-templates/reset-password.html` |
| **Magic Link** | `docs/email-templates/magic-link.html` |

(You can reuse `confirm-signup.html` for *Invite user* / *Change email* too, tweaking
the copy.) Each uses the Supabase variable `{{ .ConfirmationURL }}` — keep that intact.

---

## Part 2 — Brand the Google "Sign in" screen (the `xxxx.supabase.co` problem)

When users tap **Sign in with Google**, Google shows *"Choose an account to continue
to **xxxx.supabase.co**"* with maybe no logo. That `xxxx.supabase.co` is your Supabase
project ref (the "number/letters system"). Two pieces fix it:

### 2a. Brand the Google consent screen (app name + logo) — free, do now
**Google Cloud Console → APIs & Services → OAuth consent screen:**
- **App name:** `roam`
- **App logo:** upload the roam logo (e.g. `client/public/icon-512x512.png` or the wide logo)
- **App home page:** `https://letsroam.life`
- **Authorized domains:** add `letsroam.life` (and your `supabase.co` project domain)
- **User support email / developer email:** your email
- Publish the app (move from "Testing" to "In production") so anyone can sign in.

This makes Google show **"roam"** + your logo on the consent screen.

### 2b. Replace `xxxx.supabase.co` with your domain (custom auth domain) — Supabase Pro
The *"continue to xxxx.supabase.co"* text is the OAuth **redirect host**. To make it say
`letsroam.life`, give Supabase a custom auth domain:

1. **Supabase dashboard → Project Settings → Custom Domains** (Pro feature) → add e.g.
   `auth.letsroam.life` and create the CNAME it asks for in your DNS.
2. Once active, Supabase's auth callback becomes
   `https://auth.letsroam.life/auth/v1/callback`.
3. **Google Cloud → Credentials → your OAuth 2.0 Client → Authorized redirect URIs:**
   add the new `https://auth.letsroam.life/auth/v1/callback` (keep the old one until
   you've switched).
4. **Supabase → Authentication → URL Configuration:** make sure Site URL =
   `https://letsroam.life` and redirect URLs include your domain.

Now the Google screen reads *"continue to **letsroam.life**"* with the **roam** name + logo.

> If you don't want the Pro custom-domain cost yet: doing **2a alone** already gets you
> the **roam name + logo** on the Google screen — only the small "continue to …supabase.co"
> host line remains. That's the 90% win for free.

---

## Order of operations
1. Custom SMTP (1a) → 2. Paste email templates (1b) → 3. Google consent screen (2a) →
4. (optional) Custom auth domain (2b).
Test by signing up a throwaway account and triggering each email + the Google flow.
