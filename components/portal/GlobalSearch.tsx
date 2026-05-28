'use client';

import Link from 'next/link';
import { Search } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import type { GlobalSearchResults } from '@/lib/tenant/globalSearch';
import styles from './GlobalSearch.module.scss';

const EMPTY: GlobalSearchResults = {
  customers: [],
  invoices: [],
  quotes: [],
  visits: [],
};

export function GlobalSearch() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<GlobalSearchResults>(EMPTY);
  const [loading, setLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const debounceRef = useRef<number | null>(null);

  const runSearch = useCallback(async (q: string) => {
    const trimmed = q.trim();
    if (trimmed.length < 2) {
      setResults(EMPTY);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const res = await fetch(`/api/tenant/search?q=${encodeURIComponent(trimmed)}`);
      if (!res.ok) {
        setResults(EMPTY);
        return;
      }
      const data = (await res.json()) as GlobalSearchResults;
      setResults(data);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (debounceRef.current) window.clearTimeout(debounceRef.current);
    debounceRef.current = window.setTimeout(() => {
      void runSearch(query);
    }, 200);
    return () => {
      if (debounceRef.current) window.clearTimeout(debounceRef.current);
    };
  }, [query, runSearch]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        setOpen(true);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  useEffect(() => {
    if (open) {
      window.setTimeout(() => inputRef.current?.focus(), 0);
    } else {
      setQuery('');
      setResults(EMPTY);
    }
  }, [open]);

  const hasResults =
    results.customers.length > 0 ||
    results.invoices.length > 0 ||
    results.quotes.length > 0 ||
    results.visits.length > 0;

  return (
    <>
      <button
        type="button"
        className={styles.triggerMobile}
        onClick={() => setOpen(true)}
        aria-label="Search workspace"
      >
        <Search size={18} aria-hidden />
      </button>

      <button
        type="button"
        className={styles.trigger}
        onClick={() => setOpen(true)}
        aria-label="Search workspace"
      >
        <Search size={16} aria-hidden />
        <span className={styles.triggerLabel}>Search</span>
        <kbd className={styles.kbd}>⌘K</kbd>
      </button>

      <Dialog.Root open={open} onOpenChange={setOpen}>
        <Dialog.Portal>
          <Dialog.Overlay className={styles.overlay} />
          <Dialog.Content className={styles.panel} aria-describedby={undefined}>
            <Dialog.Title className={styles.srOnly}>Search workspace</Dialog.Title>
            <div className={styles.inputWrap}>
              <Search size={18} className={styles.inputIcon} aria-hidden />
              <input
                ref={inputRef}
                type="search"
                className={styles.input}
                placeholder="Customers, invoices, quotes, visits…"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
              />
            </div>

            <div className={styles.results}>
              {query.trim().length < 2 ? (
                <p className={styles.hint}>Type at least 2 characters to search.</p>
              ) : loading ? (
                <p className={styles.hint}>Searching…</p>
              ) : !hasResults ? (
                <p className={styles.hint}>No matches for &ldquo;{query.trim()}&rdquo;.</p>
              ) : (
                <>
                  <SearchGroup
                    title="Customers"
                    items={results.customers}
                    onNavigate={() => setOpen(false)}
                  />
                  <SearchGroup
                    title="Invoices"
                    items={results.invoices}
                    onNavigate={() => setOpen(false)}
                  />
                  <SearchGroup
                    title="Quotes"
                    items={results.quotes}
                    onNavigate={() => setOpen(false)}
                  />
                  <SearchGroup
                    title="Visits"
                    items={results.visits}
                    onNavigate={() => setOpen(false)}
                  />
                </>
              )}
            </div>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
    </>
  );
}

function SearchGroup({
  title,
  items,
  onNavigate,
}: {
  title: string;
  items: GlobalSearchResults['customers'];
  onNavigate: () => void;
}) {
  if (items.length === 0) return null;
  return (
    <section className={styles.group}>
      <h3 className={styles.groupTitle}>{title}</h3>
      <ul className={styles.groupList}>
        {items.map((item) => (
          <li key={item.id}>
            <Link href={item.href} className={styles.resultRow} onClick={onNavigate}>
              <span className={styles.resultLabel}>{item.label}</span>
              <span className={styles.resultDetail}>{item.detail}</span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
