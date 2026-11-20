import { createContext, useCallback, useContext, useState, type ReactNode } from 'react';
import { Icon } from './Icon';

type Kind = 'success' | 'error' | 'info';
interface ToastItem {
  id: number;
  kind: Kind;
  text: string;
}

const ToastContext = createContext<(kind: Kind, text: string) => void>(() => {});

let nextId = 1;

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);
  const dismiss = useCallback((id: number) => setItems((l) => l.filter((t) => t.id !== id)), []);
  const show = useCallback(
    (kind: Kind, text: string) => {
      const id = nextId++;
      setItems((l) => [...l, { id, kind, text }]);
      setTimeout(() => dismiss(id), kind === 'error' ? 6000 : 3500);
    },
    [dismiss],
  );
  const style = {
    success: { ring: 'ring-emerald-200', icon: 'check', color: 'text-emerald-600' },
    error: { ring: 'ring-red-200', icon: 'alert', color: 'text-red-600' },
    info: { ring: 'ring-slate-200', icon: 'info', color: 'text-brand-700' },
  } as const;
  return (
    <ToastContext.Provider value={show}>
      {children}
      <div className="pointer-events-none fixed right-4 bottom-4 z-50 flex w-full max-w-sm flex-col gap-2" aria-live="polite">
        {items.map((t) => (
          <div
            key={t.id}
            className={`animate-toast-in pointer-events-auto flex items-start gap-3 rounded-xl bg-white px-4 py-3 text-sm text-slate-700 shadow-lg ring-1 ${style[t.kind].ring}`}
          >
            <Icon name={style[t.kind].icon} className={`mt-0.5 h-4 w-4 shrink-0 ${style[t.kind].color}`} />
            <span className="flex-1">{t.text}</span>
            <button onClick={() => dismiss(t.id)} className="text-slate-400 hover:text-slate-600" aria-label="Dismiss">
              <Icon name="x" className="h-4 w-4" />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

/** toast('success' | 'error' | 'info', text) */
export const useToast = () => useContext(ToastContext);
