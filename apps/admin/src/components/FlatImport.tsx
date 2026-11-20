// Flats & members CSV import: parse -> normalise -> chunk by flat -> accounts bulk_import.
import { useState } from 'react';
import { Icon } from './Icon';
import { useToast } from './Toast';
import { Button, ConfirmDialog, Modal, Pill, Table, Textarea, td, th } from './ui';
import { callAccounts } from '../lib/accounts';
import { csvErrorMessage, downloadCsv, parseMembersCsv, toCsv } from '../lib/csv';
import { friendlyError } from '../lib/errors';
import { chunkByFlat, generatedPasswords, mergeResults, toRequestRows, type ChunkOutcome, type ImportResultRow } from '../lib/flatImport';
import { SOCIETY_ID } from '../lib/supabase';

const FORMAT = 'building,wing,flat,password,member_name,member_phone,relation';
const TEMPLATE = [
  FORMAT.split(','),
  ['Building 1', 'A', '101', 'Secret@101', 'Rahul Shah', '9876543210', 'Self'],
  ['Building 1', 'A', '101', '', 'Priya Shah', '9876500000', 'Spouse'],
  ['Building 1', 'A', '102', '', '', '', ''],
];

export default function FlatImport({ open, onClose, onImported }: { open: boolean; onClose: () => void; onImported: () => void }) {
  const toast = useToast();
  const [text, setText] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  const [results, setResults] = useState<ImportResultRow[] | null>(null);
  const [downloaded, setDownloaded] = useState(false);
  // What to do once the admin confirms leaving without downloading generated passwords.
  const [pendingLeave, setPendingLeave] = useState<'close' | 'reset' | null>(null);

  function reset() {
    setDownloaded(false);
    setPendingLeave(null);
    setText('');
    setError(null);
    setResults(null);
    setProgress(null);
  }

  function close() {
    if (progress) return; // never abandon an import half-way
    reset();
    onClose();
  }

  /** Leaving the results loses generated passwords: confirm unless they were downloaded. */
  function leave(action: 'close' | 'reset') {
    if (results && generatedPasswords(results).length > 1 && !downloaded) return setPendingLeave(action);
    if (action === 'close') close();
    else reset();
  }

  async function onFile(file: File | undefined) {
    if (file) setText(await file.text());
  }

  async function run() {
    setError(null);
    let chunks;
    try {
      const rows = parseMembersCsv(text);
      if (rows.length === 0) return setError('The CSV has no rows.');
      chunks = chunkByFlat(rows);
    } catch (e) {
      const m = /^flat_too_many_rows:(.*)$/.exec((e as Error).message);
      return setError(m ? `Flat ${m[1]} has more than 200 rows.` : csvErrorMessage(e, FORMAT));
    }
    const outcomes: ChunkOutcome[] = [];
    setProgress({ done: 0, total: chunks.length });
    for (const chunk of chunks) {
      try {
        outcomes.push(await callAccounts('bulk_import', { society_id: SOCIETY_ID, rows: toRequestRows(chunk) }));
      } catch (e) {
        outcomes.push({ error: friendlyError(e) });
      }
      setProgress({ done: outcomes.length, total: chunks.length });
    }
    setProgress(null);
    const merged = mergeResults(chunks, outcomes);
    setResults(merged);
    const failed = merged.filter((r) => !r.ok).length;
    toast(failed ? 'error' : 'success', failed ? `Imported with ${failed} row error${failed === 1 ? '' : 's'}` : `Imported ${merged.length} rows`);
    onImported();
  }

  const okCount = results?.filter((r) => r.ok).length ?? 0;
  const generated = results ? generatedPasswords(results) : [];

  return (
    <Modal
      open={open}
      title="Import flats & members"
      onClose={() => leave('close')}
      wide
      footer={
        results ? (
          <>
            <Button variant="secondary" onClick={() => leave('reset')}>
              Import another file
            </Button>
            <Button onClick={() => leave('close')}>Done</Button>
          </>
        ) : (
          <>
            <Button variant="secondary" onClick={close} disabled={!!progress}>
              Cancel
            </Button>
            <Button icon="upload" onClick={() => void run()} busy={!!progress} disabled={!text.trim()}>
              {progress ? `Importing ${progress.done}/${progress.total}…` : 'Import'}
            </Button>
          </>
        )
      }
    >
      {!results ? (
        <div className="space-y-4">
          <div className="rounded-xl bg-slate-50 p-4 text-sm text-slate-600 ring-1 ring-slate-200">
            <p className="font-medium text-slate-800">One row per family member</p>
            <p className="mt-1 font-mono text-xs text-slate-500">{FORMAT}</p>
            <ul className="mt-2 list-disc space-y-0.5 pl-5 text-xs">
              <li>Missing buildings, wings and flats are created. Building may be written “1”, “B1” or “Building 1”.</li>
              <li>A blank password keeps the flat's current one; a new flat without one gets a generated password.</li>
              <li>A flat's family list is replaced by the members in the file.</li>
            </ul>
            <button className="mt-3 inline-flex items-center gap-1 text-xs font-medium text-brand-700 hover:underline" onClick={() => downloadCsv('flats-template.csv', toCsv(TEMPLATE))}>
              <Icon name="download" className="h-3.5 w-3.5" /> Download template
            </button>
          </div>
          <label className="flex cursor-pointer items-center justify-center gap-2 rounded-xl border-2 border-dashed border-slate-200 px-4 py-6 text-sm text-slate-500 hover:border-brand-500 hover:text-brand-700">
            <Icon name="upload" />
            Choose a .csv file
            <input type="file" accept=".csv,text/csv" className="hidden" onChange={(e) => void onFile(e.target.files?.[0])} />
          </label>
          <Textarea rows={8} value={text} onChange={(e) => setText(e.target.value)} placeholder={`…or paste rows here\n${FORMAT}`} className="font-mono text-xs" />
          {error && <p className="text-sm text-red-600">{error}</p>}
        </div>
      ) : (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center gap-3">
            <Pill tone="green" icon="check">
              {okCount} ok
            </Pill>
            {results.length - okCount > 0 && (
              <Pill tone="red" icon="alert">
                {results.length - okCount} failed
              </Pill>
            )}
            <span className="flex-1" />
            {generated.length > 1 && (
              <Button variant="accent" icon="download" onClick={() => {
                  downloadCsv('generated-passwords.csv', toCsv(generated));
                  setDownloaded(true);
                }}>
                Download generated passwords ({generated.length - 1})
              </Button>
            )}
          </div>
          {generated.length > 1 && (
            <p className="text-xs text-amber-700">Download the generated passwords now: they are not shown again.</p>
          )}
          <div className="max-h-96 overflow-y-auto rounded-xl ring-1 ring-slate-200">
            <Table
              head={
                <tr>
                  <th className={th}>Line</th>
                  <th className={th}>Flat</th>
                  <th className={th}>Result</th>
                </tr>
              }
            >
              {results.map((r) => (
                <tr key={r.line}>
                  <td className={`${td} text-slate-500`}>{r.line}</td>
                  <td className={td}>
                    {r.building} · {r.wing} · {r.flat}
                  </td>
                  <td className={td}>
                    {r.ok ? (
                      <span className="inline-flex items-center gap-2">
                        <Pill tone="green" icon="check">
                          OK
                        </Pill>
                        {r.generatedPassword && <span className="text-xs text-slate-500">password generated</span>}
                      </span>
                    ) : (
                      <span className="text-red-600">{r.error}</span>
                    )}
                  </td>
                </tr>
              ))}
            </Table>
          </div>
        </div>
      )}
      <ConfirmDialog
        open={!!pendingLeave}
        title="Generated passwords not downloaded"
        message="The generated passwords are shown only once. If you leave now, those flats will need a password reset."
        confirmLabel="Leave without downloading"
        danger
        onConfirm={() => (pendingLeave === 'close' ? close() : reset())}
        onClose={() => setPendingLeave(null)}
      />
    </Modal>
  );
}
