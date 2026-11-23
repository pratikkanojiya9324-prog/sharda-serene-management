import { useState, type ReactNode } from 'react';
import { NavLink } from 'react-router-dom';
import { Icon, type IconName } from './Icon';

const NAV: { to: string; label: string; icon: IconName }[] = [
  { to: '/dashboard', label: 'Dashboard', icon: 'dashboard' },
  { to: '/flats', label: 'Flats & members', icon: 'building' },
  { to: '/staff', label: 'Staff', icon: 'shield' },
  { to: '/notices', label: 'Notices', icon: 'megaphone' },
  { to: '/polls', label: 'Polls', icon: 'clipboard' },
  { to: '/complaints', label: 'Complaints', icon: 'wrench' },
  { to: '/bills', label: 'Bills', icon: 'receipt' },
  { to: '/visits', label: 'Visitor log', icon: 'clipboard' },
  { to: '/daily-help', label: 'Daily help', icon: 'users' },
  { to: '/parcels', label: 'Parcels', icon: 'paperclip' },
  { to: '/amenities', label: 'Amenities', icon: 'door' },
  { to: '/events', label: 'Events', icon: 'clock' },
  { to: '/documents', label: 'Documents', icon: 'download' },
  { to: '/emergency-contacts', label: 'Emergency contacts', icon: 'users' },
  { to: '/sos', label: 'SOS', icon: 'alert' },
];

export default function Layout({
  societyName,
  userName,
  onSignOut,
  children,
}: {
  societyName: string;
  userName: string;
  onSignOut: () => void;
  children: ReactNode;
}) {
  const [menuOpen, setMenuOpen] = useState(false);

  const sidebar = (
    <nav className="flex h-full flex-col bg-brand-900 text-brand-100">
      <div className="flex items-center gap-3 px-5 py-5">
        <div className="rounded-xl bg-white/10 p-2 text-white">
          <Icon name="shield" className="h-5 w-5" />
        </div>
        <div>
          <p className="text-sm font-semibold text-white">Society Gate</p>
          <p className="text-xs text-brand-200/80">Admin console</p>
        </div>
      </div>
      <div className="flex-1 space-y-1 px-3 py-2">
        {NAV.map((n) => (
          <NavLink
            key={n.to}
            to={n.to}
            onClick={() => setMenuOpen(false)}
            className={({ isActive }) =>
              `flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors ${
                isActive ? 'bg-white/12 text-white shadow-inner' : 'text-brand-100/80 hover:bg-white/6 hover:text-white'
              }`
            }
          >
            {({ isActive }) => (
              <>
                <Icon name={n.icon} className={`h-5 w-5 ${isActive ? 'text-accent-500' : ''}`} />
                {n.label}
              </>
            )}
          </NavLink>
        ))}
      </div>
      <div className="border-t border-white/10 p-3">
        <button
          onClick={onSignOut}
          className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-brand-100/80 hover:bg-white/6 hover:text-white"
        >
          <Icon name="logout" className="h-5 w-5" />
          Sign out
        </button>
      </div>
    </nav>
  );

  return (
    <div className="flex h-full">
      <aside className="hidden w-64 shrink-0 lg:block">{sidebar}</aside>
      {menuOpen && (
        <div className="fixed inset-0 z-30 lg:hidden">
          <div className="absolute inset-0 bg-slate-900/40" onClick={() => setMenuOpen(false)} />
          <aside className="absolute inset-y-0 left-0 w-64">{sidebar}</aside>
        </div>
      )}
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-16 shrink-0 items-center gap-3 border-b border-slate-200 bg-white/80 px-4 backdrop-blur sm:px-8">
          <button className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 lg:hidden" onClick={() => setMenuOpen(true)} aria-label="Menu">
            <Icon name="menu" />
          </button>
          <div className="flex items-center gap-2">
            <span className="h-2 w-2 rounded-full bg-accent-500" />
            <span className="text-base font-semibold text-slate-900">{societyName}</span>
          </div>
          <span className="flex-1" />
          <div className="flex items-center gap-2 text-sm text-slate-600">
            <span className="flex h-8 w-8 items-center justify-center rounded-full bg-brand-100 text-sm font-semibold text-brand-800">
              {userName.slice(0, 1).toUpperCase()}
            </span>
            <span className="hidden sm:inline">{userName}</span>
          </div>
        </header>
        <main className="flex-1 overflow-y-auto px-4 py-8 sm:px-8">
          <div className="mx-auto max-w-6xl">{children}</div>
        </main>
      </div>
    </div>
  );
}
