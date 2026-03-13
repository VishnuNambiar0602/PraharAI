import { useEffect, useRef, useState } from 'react';
import { ChevronDown, X } from 'lucide-react';

interface SearchableSelectProps {
  /** Full list of option strings to display */
  options: string[];
  /** Current selected value (empty string = nothing selected) */
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
  /**
   * When true, the user can type any value — if it doesn't match a list option,
   * the typed text is still accepted as the value on blur or Enter.
   */
  allowFreeText?: boolean;
  /** Additional className applied to the outer wrapper div */
  className?: string;
  /** Pass a CSS class for the input (e.g. "input-base h-11") */
  inputClassName?: string;
}

/**
 * Searchable/filterable dropdown that replaces a plain <select>.
 * - Filters the option list as the user types
 * - Pressing Enter or clicking an option selects it
 * - Pressing Escape or clicking outside closes the dropdown
 * - Selecting a value shows it in the input and closes the list
 * - Clicking the ✕ button clears the selection
 */
export default function SearchableSelect({
  options,
  value,
  onChange,
  placeholder = 'Select…',
  disabled = false,
  allowFreeText = false,
  className = '',
  inputClassName = 'input-base h-11',
}: SearchableSelectProps) {
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const [highlighted, setHighlighted] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const filtered = query.trim()
    ? options.filter((o) => o.toLowerCase().includes(query.toLowerCase()))
    : options;

  // Sync display text: when value changes externally, clear the local query
  useEffect(() => {
    if (!open) setQuery('');
  }, [value, open]);

  // Close on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
        setQuery('');
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const select = (option: string) => {
    onChange(option);
    setOpen(false);
    setQuery('');
  };

  const clear = (e: React.MouseEvent) => {
    e.stopPropagation();
    onChange('');
    setQuery('');
    setOpen(false);
  };

  const commitFreeText = () => {
    if (allowFreeText && query.trim()) {
      onChange(query.trim());
      setOpen(false);
      setQuery('');
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!open) {
      if (e.key === 'ArrowDown' || e.key === 'Enter') {
        setOpen(true);
        setHighlighted(0);
      }
      return;
    }
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setHighlighted((h) => Math.min(h + 1, filtered.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setHighlighted((h) => Math.max(h - 1, 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (filtered[highlighted]) {
        select(filtered[highlighted]);
      } else {
        commitFreeText();
      }
    } else if (e.key === 'Escape') {
      setOpen(false);
      if (allowFreeText && query.trim()) {
        onChange(query.trim());
      }
      setQuery('');
    }
  };

  const displayValue = open ? query : value || '';

  return (
    <div
      ref={containerRef}
      className={`relative ${className}`}
      role="combobox"
      aria-expanded={open}
    >
      <div className="relative">
        <input
          ref={inputRef}
          type="text"
          className={inputClassName}
          value={displayValue}
          placeholder={value ? '' : placeholder}
          disabled={disabled}
          onChange={(e) => {
            setQuery(e.target.value);
            setHighlighted(0);
            if (!open) setOpen(true);
          }}
          onFocus={() => {
            setOpen(true);
            setHighlighted(0);
          }}
          onKeyDown={handleKeyDown}
          onBlur={() => commitFreeText()}
          autoComplete="off"
          aria-autocomplete="list"
          aria-label={placeholder}
          style={{ paddingRight: '2.5rem' }}
        />
        {/* Show selected value as overlay text when not typing */}
        {!open && value && (
          <span
            className="absolute inset-0 flex items-center pointer-events-none"
            style={{
              paddingLeft: '0.75rem',
              paddingRight: '2.5rem',
              fontSize: '0.875rem',
              color: 'var(--color-ink)',
              overflow: 'hidden',
              whiteSpace: 'nowrap',
              textOverflow: 'ellipsis',
            }}
          >
            {value}
          </span>
        )}
        <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-0.5">
          {value && !disabled && (
            <button
              type="button"
              onClick={clear}
              tabIndex={-1}
              className="rounded p-0.5 transition-colors"
              style={{ color: 'var(--color-muted)' }}
              aria-label="Clear selection"
            >
              <X className="size-3.5" />
            </button>
          )}
          <ChevronDown
            className="size-4 transition-transform pointer-events-none"
            style={{
              color: 'var(--color-muted)',
              transform: open ? 'rotate(180deg)' : 'rotate(0deg)',
            }}
          />
        </div>
      </div>

      {open && (
        <ul
          role="listbox"
          className="absolute z-50 w-full mt-1 rounded-xl border overflow-y-auto"
          style={{
            maxHeight: '220px',
            background: 'var(--color-surface, #fff)',
            borderColor: 'var(--color-border)',
            boxShadow: '0 8px 24px rgba(0,0,0,0.12)',
          }}
        >
          {filtered.length === 0 ? (
            <li className="px-3 py-2.5 text-sm" style={{ color: 'var(--color-muted)' }}>
              {allowFreeText && query.trim() ? `Add "${query.trim()}"` : 'No results found'}
            </li>
          ) : (
            filtered.map((opt, i) => (
              <li
                key={opt}
                role="option"
                aria-selected={opt === value}
                onMouseDown={(e) => {
                  e.preventDefault(); // prevent blur before click
                  select(opt);
                }}
                onMouseEnter={() => setHighlighted(i)}
                className="px-3 py-2 text-sm cursor-pointer"
                style={{
                  background:
                    opt === value
                      ? 'var(--color-accent)'
                      : i === highlighted
                        ? 'var(--color-primary-50, rgba(200,112,13,0.08))'
                        : 'transparent',
                  color: opt === value ? '#fff' : 'var(--color-ink)',
                  fontWeight: opt === value ? 600 : 400,
                }}
              >
                {opt}
              </li>
            ))
          )}
        </ul>
      )}
    </div>
  );
}
