'use client';

import * as Popover from '@radix-ui/react-popover';
import { ChevronDown } from 'lucide-react';
import { useId, useMemo, useState } from 'react';
import styles from './SearchableSelect.module.scss';

export type SearchableSelectOption = { value: string; label: string };

export function SearchableSelect({
  id: idProp,
  name,
  label,
  options,
  value: valueControlled,
  defaultValue = '',
  onValueChange,
  placeholder = 'Type to filter…',
  emptyText = 'No matches',
}: {
  id?: string;
  name: string;
  label: string;
  options: SearchableSelectOption[];
  /** Controlled selection (required with `onValueChange` for dependent fields). */
  value?: string;
  defaultValue?: string;
  onValueChange?: (value: string) => void;
  placeholder?: string;
  emptyText?: string;
}) {
  const autoId = useId();
  const baseId = idProp ?? autoId;
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [internalValue, setInternalValue] = useState(defaultValue);

  const isControlled = valueControlled !== undefined;
  const value = isControlled ? valueControlled : internalValue;

  const setValue = (v: string) => {
    if (isControlled) {
      onValueChange?.(v);
    } else {
      setInternalValue(v);
    }
  };

  const selectedLabel = useMemo(() => {
    if (!value) return '';
    return options.find((o) => o.value === value)?.label ?? '';
  }, [options, value]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return options;
    return options.filter((o) => o.label.toLowerCase().includes(q));
  }, [options, query]);

  return (
    <div className={styles.field}>
      <label className={styles.label} htmlFor={`${baseId}-trigger`}>
        {label}
      </label>
      <input type="hidden" name={name} value={value} />
      <Popover.Root open={open} onOpenChange={setOpen}>
        <Popover.Trigger asChild>
          <button
            id={`${baseId}-trigger`}
            type="button"
            className={[styles.trigger, !selectedLabel ? styles.triggerMuted : ''].filter(Boolean).join(' ')}
            aria-expanded={open}
            aria-haspopup="dialog"
          >
            <span>{selectedLabel || '— Select —'}</span>
            <ChevronDown size={18} className={styles.chevron} aria-hidden />
          </button>
        </Popover.Trigger>
        <Popover.Portal>
          <Popover.Content
            className={styles.popoverContent}
            sideOffset={4}
            align="start"
            collisionPadding={8}
            onOpenAutoFocus={(e) => e.preventDefault()}
          >
            <input
              id={`${baseId}-search`}
              className={styles.search}
              type="search"
              placeholder={placeholder}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              autoComplete="off"
            />
            {filtered.length === 0 ? (
              <p className={styles.empty}>{emptyText}</p>
            ) : (
              <ul className={styles.list} role="listbox">
                {filtered.map((o) => (
                  <li key={o.value}>
                    <button
                      type="button"
                      className={[styles.option, o.value === value ? styles.optionActive : ''].filter(Boolean).join(' ')}
                      role="option"
                      aria-selected={o.value === value}
                      onClick={() => {
                        setValue(o.value);
                        setOpen(false);
                        setQuery('');
                      }}
                    >
                      {o.label}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </Popover.Content>
        </Popover.Portal>
      </Popover.Root>
    </div>
  );
}
