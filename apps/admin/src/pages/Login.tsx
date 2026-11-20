import { useState } from 'react';
import { isValidUsername, staffEmail } from '@society-gate/shared';
import { Icon } from '../components/Icon';
import { Button, Field, Input } from '../components/ui';
import { SOCIETY_ID, supabase } from '../lib/supabase';

function loginError(message: string): string {
  if (/invalid login credentials/i.test(message)) return 'Wrong username or password.';
  if (/banned/i.test(message)) return 'This account has been disabled. Ask another admin for help.';
  return message;
}

export default function Login({ notAdmin }: { notAdmin: boolean }) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const u = username.trim().toLowerCase();
    if (!isValidUsername(u)) return setError('Enter your username (3-30 lowercase letters, digits, dot, dash or underscore).');
    if (!password) return setError('Enter your password.');
    setBusy(true);
    const { error: err } = await supabase.auth.signInWithPassword({ email: staffEmail(u, SOCIETY_ID), password });
    setBusy(false);
    if (err) setError(loginError(err.message));
  }

  return (
    <div className="grid min-h-full lg:grid-cols-2">
      <div className="relative hidden overflow-hidden bg-gradient-to-br from-brand-700 via-brand-800 to-brand-900 p-12 text-white lg:flex lg:flex-col lg:justify-between">
        <div className="absolute -top-24 -right-24 h-80 w-80 rounded-full bg-white/5" />
        <div className="absolute -bottom-32 -left-16 h-96 w-96 rounded-full bg-accent-500/10" />
        <div className="relative flex items-center gap-3">
          <div className="rounded-xl bg-white/10 p-2">
            <Icon name="shield" className="h-6 w-6" />
          </div>
          <span className="text-lg font-semibold">Society Gate</span>
        </div>
        <div className="relative">
          <h2 className="text-4xl leading-tight font-semibold">
            Run your society
            <br />
            <span className="text-accent-500">calmly.</span>
          </h2>
          <p className="mt-4 max-w-md text-brand-100/80">
            Flats and families, staff logins, notices, complaints and maintenance bills — all in one place.
          </p>
        </div>
        <p className="relative text-sm text-brand-200/70">Admin console</p>
      </div>

      <div className="flex items-center justify-center p-6">
        <form onSubmit={submit} className="w-full max-w-sm space-y-5">
          <div>
            <div className="mb-6 inline-flex rounded-2xl bg-brand-50 p-3 text-brand-700 lg:hidden">
              <Icon name="shield" className="h-6 w-6" />
            </div>
            <h1 className="text-2xl font-semibold text-slate-900">Welcome back</h1>
            <p className="mt-1 text-sm text-slate-500">Sign in with your staff username and password.</p>
          </div>
          {notAdmin && (
            <div className="rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-800 ring-1 ring-amber-200">
              That account is not an admin of this society.
            </div>
          )}
          <Field label="Username">
            <Input
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              autoComplete="username"
              autoCapitalize="none"
              autoFocus
              placeholder="e.g. admin"
            />
          </Field>
          <Field label="Password">
            <Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" />
          </Field>
          {error && <p className="text-sm text-red-600">{error}</p>}
          <Button type="submit" busy={busy} className="w-full py-2.5">
            Sign in
          </Button>
        </form>
      </div>
    </div>
  );
}
