/**
 * Panel container. On phones it is a bottom sheet (tap the grab handle to expand);
 * on desktop it is a floating side panel. CSS handles the layout in index.css.
 */
import { useState, type ReactNode } from 'react';
import { Minimize2, X } from 'lucide-react';

interface SheetProps {
  title: string;
  subtitle?: string;
  onClose: () => void;
  /** When provided, the corner button minimises instead of closing. */
  onMinimize?: () => void;
  minimizeLabel?: string;
  children: ReactNode;
}

export function Sheet({ title, subtitle, onClose, onMinimize, minimizeLabel = 'Minimize panel', children }: SheetProps) {
  const [expanded, setExpanded] = useState(false);

  return (
    <section
      aria-label={title}
      className={`sheet ui-surface sheet-enter ${expanded ? 'is-expanded' : ''}`}
    >
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        aria-label={expanded ? 'Shrink panel' : 'Expand panel'}
        className="sheet-grab"
      />
      <header className="flex items-start gap-3 px-4 pb-3 pt-1 md:pt-4">
        <div className="min-w-0 flex-1">
          <h2 className="text-[13px] font-bold uppercase tracking-[0.16em]">{title}</h2>
          {subtitle && <p className="mt-0.5 truncate text-sm ui-muted">{subtitle}</p>}
        </div>
        {onMinimize ? (
          <button
            type="button"
            onClick={onMinimize}
            aria-label={minimizeLabel}
            title={minimizeLabel}
            className="ui-btn grid h-10 w-10 shrink-0 place-items-center rounded-2xl"
          >
            <Minimize2 className="h-5 w-5" />
          </button>
        ) : (
          <button
            type="button"
            onClick={onClose}
            aria-label="Close panel"
            className="ui-btn grid h-10 w-10 shrink-0 place-items-center rounded-2xl"
          >
            <X className="h-5 w-5" />
          </button>
        )}
      </header>
      <div className="sheet-body">{children}</div>
    </section>
  );
}
