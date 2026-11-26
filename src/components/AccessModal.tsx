import { X } from 'lucide-react';
import { FormEvent, useEffect, useState } from 'react';

interface AccessModalProps {
  open: boolean;
  initialTier: string;
  onClose: () => void;
}

export function AccessModal({ open, initialTier, onClose }: AccessModalProps) {
  const [email, setEmail] = useState('');
  const [tier, setTier] = useState(initialTier || 'Production');
  const [notes, setNotes] = useState('');
  const [error, setError] = useState('');
  const [confirmed, setConfirmed] = useState(false);

  useEffect(() => {
    setTier(initialTier || 'Production');
    setConfirmed(false);
    setError('');
  }, [initialTier, open]);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [open, onClose]);

  if (!open) return null;

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      setError('Enter a valid email address to continue.');
      return;
    }
    setError('');
    setConfirmed(true);
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="access-modal-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 px-4"
    >
      <div className="w-full max-w-md rounded-2xl border border-sky-400/25 bg-[#081022] p-6 sm:p-7 shadow-2xl">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2
              id="access-modal-title"
              className="font-display text-xl font-semibold text-white"
            >
              Deploy Consy on Conscious
            </h2>
            <p className="mt-1 text-xs text-slate-400">
              Configure your deployment tier and receive sandbox credentials.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close dialog"
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-800 hover:text-white cursor-pointer"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {confirmed ? (
          <div className="mt-6 space-y-4">
            <div className="rounded-xl border border-sky-400/30 bg-[#0B1730] p-4 text-sm text-sky-100">
              Your <span className="font-semibold text-white">{tier}</span>{' '}
              workspace request for{' '}
              <span className="font-semibold text-white">{email}</span> has been
              registered.
            </div>
            <button
              type="button"
              onClick={onClose}
              className="w-full rounded-lg bg-[#2563EB] px-4 py-2.5 text-sm font-medium text-white hover:bg-[#1D4ED8] cursor-pointer"
            >
              Done
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} noValidate className="mt-6 space-y-4">
            <div>
              <label
                htmlFor="modal-email"
                className="block text-xs font-medium text-slate-300"
              >
                Work Email
              </label>
              <input
                id="modal-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="name@company.com"
                required
                className="mt-1.5 w-full rounded-lg border border-sky-400/20 bg-[#04070E] px-3.5 py-2.5 text-sm text-white placeholder:text-slate-500 focus:border-sky-400 focus:outline-none"
              />
              {error && <p className="mt-1.5 text-xs text-rose-400">{error}</p>}
            </div>

            <div>
              <label
                htmlFor="modal-tier"
                className="block text-xs font-medium text-slate-300"
              >
                Deployment Tier
              </label>
              <select
                id="modal-tier"
                value={tier}
                onChange={(e) => setTier(e.target.value)}
                className="mt-1.5 w-full rounded-lg border border-sky-400/20 bg-[#04070E] px-3.5 py-2.5 text-sm text-white focus:border-sky-400 focus:outline-none"
              >
                <option value="Developer">Developer ($0 / month)</option>
                <option value="Production">Production ($149 / month)</option>
                <option value="Enterprise">Enterprise (Custom VPC)</option>
              </select>
            </div>

            <div>
              <label
                htmlFor="modal-notes"
                className="block text-xs font-medium text-slate-300"
              >
                Primary Workflow (optional)
              </label>
              <textarea
                id="modal-notes"
                rows={3}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Tool execution, customer triage, internal ops..."
                className="mt-1.5 w-full rounded-lg border border-sky-400/20 bg-[#04070E] px-3.5 py-2 text-sm text-white placeholder:text-slate-500 focus:border-sky-400 focus:outline-none resize-none"
              />
            </div>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={onClose}
                className="rounded-lg px-4 py-2 text-sm font-medium text-slate-300 hover:text-white cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="rounded-lg bg-[#2563EB] px-5 py-2 text-sm font-medium text-white hover:bg-[#1D4ED8] cursor-pointer"
              >
                Submit Request
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
