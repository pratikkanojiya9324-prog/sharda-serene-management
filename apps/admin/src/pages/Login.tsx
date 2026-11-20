import { useState } from 'react';
import { normalizePhone } from '@society-gate/shared';
import { supabase } from '../lib/supabase';

export default function Login({
  notAdmin,
  setClaiming,
}: {
  notAdmin: boolean;
  setClaiming: (v: boolean) => void;
}) {
  const [phoneInput, setPhoneInput] = useState('');
  const [phone, setPhone] = useState<string | null>(null);
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function sendCode(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    let normalized: string;
    try {
      normalized = normalizePhone(phoneInput);
    } catch {
      setError('Enter a valid 10-digit mobile number');
      return;
    }
    setBusy(true);
    const { error: err } = await supabase.auth.signInWithOtp({ phone: normalized });
    setBusy(false);
    if (err) setError(err.message);
    else setPhone(normalized);
  }

  async function verify(e: React.FormEvent) {
    e.preventDefault();
    if (!phone) return;
    setError(null);
    setBusy(true);
    setClaiming(true);
    const { error: err } = await supabase.auth.verifyOtp({ phone, token: code.trim(), type: 'sms' });
    if (err) {
      setClaiming(false);
      setBusy(false);
      setError(err.message);
      return;
    }
    // Turn any pending invites for this phone into memberships before App reads them.
    const { error: claimErr } = await supabase.rpc('claim_invites');
    setBusy(false);
    if (claimErr) setError(claimErr.message);
    setClaiming(false); // App now reads the user's admin memberships
  }

  return (
    <div className="card login">
      <h2>Society Gate admin</h2>
      {notAdmin && <p className="error">Not an admin</p>}
      {phone === null ? (
        <form onSubmit={sendCode}>
          <div className="row">
            <input
              type="tel"
              placeholder="Mobile number"
              value={phoneInput}
              onChange={(e) => setPhoneInput(e.target.value)}
              autoFocus
            />
            <button disabled={busy}>Send code</button>
          </div>
        </form>
      ) : (
        <form onSubmit={verify}>
          <p className="muted">Code sent to {phone}</p>
          <div className="row">
            <input
              inputMode="numeric"
              maxLength={6}
              placeholder="6-digit code"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              autoFocus
            />
            <button disabled={busy || code.trim().length !== 6}>Verify</button>
          </div>
          <button type="button" onClick={() => setPhone(null)}>
            Change number
          </button>
        </form>
      )}
      {error && <p className="error">{error}</p>}
    </div>
  );
}
