/**
 * @vitest-environment happy-dom
 */
import { act, createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, describe, expect, it } from 'vitest';
import { NoAddOnComparison } from './NoAddOnComparison';

let root: Root | null = null;

afterEach(() => {
  root?.unmount();
  root = null;
  document.body.innerHTML = '';
});

describe('NoAddOnComparison', () => {
  it('renders confirmed prices, the as-of note, and source links', async () => {
    const host = document.createElement('div');
    document.body.appendChild(host);
    root = createRoot(host);

    await act(async () => {
      root?.render(createElement(NoAddOnComparison));
    });

    const text = host.textContent ?? '';
    expect(text).toContain('Core $49/mo');
    expect(text).toContain('Basic $79/mo');
    expect(text).toContain('As of Nov 2026');
    expect(text).toContain('Varies, see their site');
    expect(text).toContain('No per-user fee');

    const links = [...host.querySelectorAll('a')].map((anchor) => anchor.getAttribute('href'));
    expect(links).toContain('https://www.getjobber.com/pricing/');
    expect(links).toContain('https://www.housecallpro.com/pricing/');
  });
});
