/**
 * @vitest-environment happy-dom
 */
import { createElement } from 'react';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { RouteStartsEditor, type RouteStartPlace } from './RouteStartsEditor';

const rejected = "Couldn't find that address. The place was not changed.";
const saved = 'Start location updated.';

vi.mock('./actions', () => ({
  saveRouteLocationAction: vi.fn(async () => ({})),
  saveCleanerBaseAction: vi.fn(async () => ({})),
  deleteRouteLocationAction: vi.fn(async () => ({})),
  updateRouteLocationAction: vi.fn(async (_prev: unknown, formData: FormData) => {
    const id = String(formData.get('location_id') ?? '');
    if (id === 'place-a')
      return { error: "Couldn't find that address. The place was not changed." };
    return { success: 'Start location updated.' };
  }),
}));

function place(id: string, label: string): RouteStartPlace {
  return {
    id,
    label,
    located: true,
    addressLine: `1 ${label} Street, Asheville, NC, 28801`,
    addressLine1: `1 ${label} Street`,
    city: 'Asheville',
    state: 'NC',
    postalCode: '28801',
  };
}

function buttonNamed(name: string): HTMLButtonElement {
  const match = [...document.querySelectorAll('button')].find(
    (node) => node.textContent?.replace(/\s+/g, ' ').trim() === name,
  );
  if (!(match instanceof HTMLButtonElement)) throw new Error(`Missing button ${name}`);
  return match;
}

async function click(name: string) {
  await act(async () => {
    buttonNamed(name).click();
  });
}

function streetInput(label: string): HTMLInputElement {
  const input = document.querySelector(`[aria-label="${label}"]`);
  if (!(input instanceof HTMLInputElement)) throw new Error(`Missing ${label}`);
  return input;
}

describe('RouteStartsEditor edit messages', () => {
  let root: Root | null = null;
  let container: HTMLDivElement | null = null;

  afterEach(() => {
    if (root) {
      act(() => {
        root?.unmount();
      });
    }
    container?.remove();
    root = null;
    container = null;
  });

  async function renderPlaces() {
    container = document.createElement('div');
    document.body.append(container);
    root = createRoot(container);
    const view = createElement(RouteStartsEditor, {
      tenantSlug: 'qa-pro',
      places: [place('place-a', 'South shed'), place('place-b', 'North shed')],
      cleaners: [],
    });
    await act(async () => {
      root?.render(view);
    });
  }

  it('shows a rejected address only on the place that was submitted', async () => {
    await renderPlaces();
    await click('Edit South shed');
    const street = streetInput('Street for South shed');
    street.value = '99 nomatch Road';
    const form = street.closest('form');
    if (!form) throw new Error('Missing South shed form');
    await act(async () => {
      form.requestSubmit();
    });

    expect(document.body.textContent).toContain(rejected);
    expect(document.body.textContent).toContain('1 South shed Street, Asheville, NC, 28801');

    await click('Edit North shed');
    expect(document.body.textContent).not.toContain(rejected);
    expect(streetInput('Street for North shed').value).toBe('1 North shed Street');
    expect(document.querySelector('[aria-label="Street for South shed"]')).toBeNull();

    await click('Close North shed');
    await click('Edit South shed');
    expect(document.body.textContent).not.toContain(rejected);
    expect(streetInput('Street for South shed').value).toBe('1 South shed Street');
  });

  it('shows a successful save only on the place that was submitted', async () => {
    await renderPlaces();
    await click('Edit North shed');
    const form = streetInput('Street for North shed').closest('form');
    if (!form) throw new Error('Missing North shed form');
    await act(async () => {
      form.requestSubmit();
    });

    expect(document.body.textContent).toContain(saved);

    await click('Edit South shed');
    expect(document.body.textContent).not.toContain(saved);
    expect(document.querySelector('[aria-label="Street for North shed"]')).toBeNull();
  });
});
