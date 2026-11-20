import { useCallback, useEffect, useRef, useState } from 'react';
import { Icon } from '../components/Icon';
import { useToast } from '../components/Toast';
import { Button, Card, EmptyState, ErrorBanner, Modal, PageHeader, Pill, SearchInput, Select, Table, Textarea, td, th } from '../components/ui';
import { friendlyError } from '../lib/errors';
import { useFlats, type FlatInfo } from '../lib/flats';
import { dateTime, titleCase } from '../lib/format';
import { ADMIN_COMPLAINT_COMMENTS_SELECT, ADMIN_COMPLAINTS_SELECT } from '../lib/selects';
import { COMPLAINT_CATEGORIES, COMPLAINT_STATUSES, COMPLAINT_STATUS_STYLE, type ComplaintCategory, type ComplaintStatus } from '../lib/status';
import { SOCIETY_ID, supabase } from '../lib/supabase';

/** Newest complaints loaded per filter; older ones need a narrower filter. */
const LIMIT = 500;

interface Complaint {
  id: string;
  flat_id: string;
  category: string;
  description: string;
  photo_path: string | null;
  status: ComplaintStatus;
  created_by_name: string | null;
  created_at: string;
  updated_at: string;
}

interface Comment {
  id: string;
  body: string;
  author_id: string | null;
  author_name: string | null;
  created_at: string;
}

export default function Complaints({ userId, userName }: { userId: string; userName: string }) {
  const { byId } = useFlats();
  const [rows, setRows] = useState<Complaint[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<'' | ComplaintStatus>('');
  const [category, setCategory] = useState<'' | ComplaintCategory>('');
  const [search, setSearch] = useState('');
  const [openId, setOpenId] = useState<string | null>(null);

  const loadSeq = useRef(0);
  const load = useCallback(async () => {
    const seq = ++loadSeq.current;
    let q = supabase.from('complaints').select(ADMIN_COMPLAINTS_SELECT).eq('society_id', SOCIETY_ID).order('created_at', { ascending: false }).limit(LIMIT);
    if (status) q = q.eq('status', status);
    if (category) q = q.eq('category', category);
    const { data, error: err } = await q;
    if (seq !== loadSeq.current) return; // filters changed meanwhile
    if (err) return setError(err.message);
    setError(null);
    setRows(data ?? []);
  }, [status, category]);

  useEffect(() => {
    void load();
  }, [load]);

  const s = search.trim().toLowerCase();
  const shown = (rows ?? []).filter(
    (c) => !s || (byId.get(c.flat_id)?.label ?? '').toLowerCase().includes(s) || c.description.toLowerCase().includes(s),
  );
  const open = rows?.find((c) => c.id === openId) ?? null;

  return (
    <>
      <PageHeader title="Complaints" subtitle="Track issues raised by flats and keep residents updated." />
      {error && <ErrorBanner message={error} onRetry={() => void load()} />}
      <Card>
        <div className="flex flex-wrap items-center gap-3 border-b border-slate-100 px-5 py-4">
          <SearchInput value={search} onChange={setSearch} placeholder="Search flat or text" />
          <Select value={status} onChange={(e) => setStatus(e.target.value as '' | ComplaintStatus)} className="w-40" aria-label="Status">
            <option value="">All statuses</option>
            {COMPLAINT_STATUSES.map((st) => (
              <option key={st} value={st}>
                {COMPLAINT_STATUS_STYLE[st].label}
              </option>
            ))}
          </Select>
          <Select value={category} onChange={(e) => setCategory(e.target.value as '' | ComplaintCategory)} className="w-40" aria-label="Category">
            <option value="">All categories</option>
            {COMPLAINT_CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {titleCase(c)}
              </option>
            ))}
          </Select>
          <span className="ml-auto text-sm text-slate-500">{shown.length} shown</span>
        </div>
        {rows && shown.length === 0 ? (
          <EmptyState icon="wrench" title="No complaints">Nothing matches these filters.</EmptyState>
        ) : (
          <Table
            head={
              <tr>
                <th className={th}>Flat</th>
                <th className={th}>Category</th>
                <th className={th}>Description</th>
                <th className={th}>Raised</th>
                <th className={th}>Status</th>
              </tr>
            }
          >
            {shown.map((c) => {
              const st = COMPLAINT_STATUS_STYLE[c.status];
              return (
                <tr key={c.id} onClick={() => setOpenId(c.id)} className="cursor-pointer hover:bg-slate-50/60">
                  <td className={`${td} font-semibold text-slate-900`}>{byId.get(c.flat_id)?.label ?? '—'}</td>
                  <td className={td}>{titleCase(c.category)}</td>
                  <td className={`${td} max-w-md`}>
                    <p className="truncate text-slate-600">{c.description}</p>
                  </td>
                  <td className={`${td} whitespace-nowrap text-slate-500`}>
                    {dateTime(c.created_at)}
                    {c.created_by_name && <span className="block text-xs text-slate-400">by {c.created_by_name}</span>}
                  </td>
                  <td className={td}>
                    <Pill tone={st.tone} icon={st.icon}>
                      {st.label}
                    </Pill>
                  </td>
                </tr>
              );
            })}
          </Table>
        )}
        {rows?.length === LIMIT && (
          <p className="px-5 py-3 text-xs text-slate-500">Showing the latest {LIMIT}. Filter by status or category to see older complaints.</p>
        )}
      </Card>
      <ComplaintDetail
        complaint={open}
        flat={open ? byId.get(open.flat_id) : undefined}
        userId={userId}
        userName={userName}
        onClose={() => setOpenId(null)}
        onChanged={() => void load()}
      />
    </>
  );
}

function ComplaintDetail({
  complaint,
  flat,
  userId,
  userName,
  onClose,
  onChanged,
}: {
  complaint: Complaint | null;
  flat: FlatInfo | undefined;
  userId: string;
  userName: string;
  onClose: () => void;
  onChanged: () => void;
}) {
  const toast = useToast();
  const [comments, setComments] = useState<Comment[]>([]);
  const [photo, setPhoto] = useState<string | null>(null);
  const [text, setText] = useState('');
  const [busy, setBusy] = useState<string | null>(null);
  const id = complaint?.id;
  const photoPath = complaint?.photo_path;

  const loadComments = useCallback(async () => {
    if (!id) return;
    const { data, error } = await supabase.from('complaint_comments').select(ADMIN_COMPLAINT_COMMENTS_SELECT).eq('complaint_id', id).order('created_at');
    if (error) toast('error', error.message);
    else setComments(data ?? []);
  }, [id, toast]);

  useEffect(() => {
    setComments([]);
    setText('');
    setPhoto(null);
    void loadComments();
  }, [loadComments]);

  useEffect(() => {
    if (!photoPath) return;
    void supabase.storage
      .from('complaint-photos')
      .createSignedUrl(photoPath, 3600)
      .then(({ data }) => setPhoto(data?.signedUrl ?? null));
  }, [photoPath]);

  async function changeStatus(next: ComplaintStatus) {
    if (!complaint) return;
    setBusy(next);
    const { error } = await supabase.rpc('set_complaint_status', { p_complaint_id: complaint.id, p_status: next });
    setBusy(null);
    if (error) return toast('error', friendlyError(error));
    toast('success', `Marked ${COMPLAINT_STATUS_STYLE[next].label.toLowerCase()}`);
    onChanged();
  }

  async function addComment(e: React.FormEvent) {
    e.preventDefault();
    if (!complaint || !text.trim()) return;
    setBusy('comment');
    const { error } = await supabase.rpc('add_complaint_comment', {
      p_complaint_id: complaint.id,
      p_body: text.trim(),
      p_actor_name: userName.slice(0, 60),
    });
    setBusy(null);
    if (error) return toast('error', friendlyError(error));
    setText('');
    void loadComments();
  }

  const st = complaint ? COMPLAINT_STATUS_STYLE[complaint.status] : null;

  return (
    <Modal open={!!complaint} title={complaint ? `${flat?.label ?? 'Flat'} · ${titleCase(complaint.category)}` : ''} onClose={onClose} wide>
      {complaint && st && (
        <div className="grid gap-6 md:grid-cols-5">
          <div className="space-y-4 md:col-span-3">
            <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
              <Pill tone={st.tone} icon={st.icon}>
                {st.label}
              </Pill>
              <span>Raised {dateTime(complaint.created_at)}</span>
              {complaint.created_by_name && <span>by {complaint.created_by_name}</span>}
            </div>
            <p className="text-sm whitespace-pre-line text-slate-700">{complaint.description}</p>
            {photo && (
              <a href={photo} target="_blank" rel="noreferrer">
                <img src={photo} alt="Complaint" className="max-h-64 rounded-xl object-cover ring-1 ring-slate-200" />
              </a>
            )}
            <div>
              <p className="mb-2 text-sm font-medium text-slate-700">Update status</p>
              <div className="flex flex-wrap gap-2">
                {COMPLAINT_STATUSES.map((next) => (
                  <Button
                    key={next}
                    size="sm"
                    variant={complaint.status === next ? 'primary' : 'secondary'}
                    icon={COMPLAINT_STATUS_STYLE[next].icon}
                    disabled={complaint.status === next || !!busy}
                    busy={busy === next}
                    onClick={() => void changeStatus(next)}
                  >
                    {COMPLAINT_STATUS_STYLE[next].label}
                  </Button>
                ))}
              </div>
            </div>
          </div>

          <div className="flex flex-col rounded-xl bg-slate-50 p-4 ring-1 ring-slate-200 md:col-span-2">
            <p className="mb-3 flex items-center gap-2 text-sm font-medium text-slate-700">
              <Icon name="chat" className="h-4 w-4" /> Comments
            </p>
            <div className="max-h-72 flex-1 space-y-3 overflow-y-auto">
              {comments.length === 0 && <p className="text-xs text-slate-400">No comments yet.</p>}
              {comments.map((c) => {
                const mine = c.author_id === userId;
                return (
                  <div key={c.id} className={`flex flex-col ${mine ? 'items-end' : 'items-start'}`}>
                    <div className={`max-w-[90%] rounded-2xl px-3 py-2 text-sm ${mine ? 'bg-brand-700 text-white' : 'bg-white text-slate-700 ring-1 ring-slate-200'}`}>
                      {c.body}
                    </div>
                    <span className="mt-0.5 text-[11px] text-slate-400">
                      {mine ? 'You' : (c.author_name ?? flat?.label ?? 'Resident')} · {dateTime(c.created_at)}
                    </span>
                  </div>
                );
              })}
            </div>
            <form onSubmit={addComment} className="mt-3 space-y-2">
              <Textarea rows={2} value={text} onChange={(e) => setText(e.target.value)} placeholder="Write a reply…" />
              <Button type="submit" size="sm" icon="chat" busy={busy === 'comment'} disabled={!text.trim()} className="w-full">
                Send
              </Button>
            </form>
          </div>
        </div>
      )}
    </Modal>
  );
}
