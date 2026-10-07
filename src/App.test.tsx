import { useEffect, type ReactNode } from 'react';
import { afterEach, beforeEach, describe, it, expect, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import App from './App';

const lifecycle = vi.hoisted(() => ({
  connect: vi.fn(), disconnect: vi.fn(), newDispose: vi.fn(), classicDispose: vi.fn(),
}));

vi.mock('./context/FilterContext', () => ({
  FilterProvider: ({ children }: { children: ReactNode }) => children,
}));
vi.mock('./context/PLCContext', () => ({
  PLCProvider: function Provider({ children }: { children: ReactNode }) {
    useEffect(() => { lifecycle.connect(); return lifecycle.disconnect; }, []);
    return children;
  },
}));
vi.mock('./components/Dashboard', () => ({
  default: function NewDashboard({ headerSlot }: { headerSlot: ReactNode }) {
    useEffect(() => lifecycle.newDispose, []);
    return <main data-testid="new-dashboard">{headerSlot}New factory</main>;
  },
}));
vi.mock('./legacy/components/Dashboard', () => ({
  default: function ClassicDashboard({ headerSlot }: { headerSlot: ReactNode }) {
    useEffect(() => lifecycle.classicDispose, []);
    return <main data-testid="classic-dashboard">{headerSlot}Classic factory</main>;
  },
}));

beforeEach(() => {
  vi.clearAllMocks();
  const values = new Map<string, string>();
  vi.stubGlobal('localStorage', {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => values.set(key, value),
    removeItem: (key: string) => values.delete(key),
    clear: () => values.clear(),
  });
  history.replaceState(null, '', '/');
});
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

describe('Interface switching', () => {
  it('replaces the dashboard and its theme while keeping one telemetry provider mounted', async () => {
    render(<App />);
    await screen.findByTestId('new-dashboard');
    expect(lifecycle.connect).toHaveBeenCalledTimes(1);
    expect(document.head.querySelector('[data-ui-theme="new"]')).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: 'Classic UI' }));
    await screen.findByTestId('classic-dashboard');
    expect(screen.queryByTestId('new-dashboard')).toBeNull();
    expect(lifecycle.newDispose).toHaveBeenCalledTimes(1);
    expect(lifecycle.connect).toHaveBeenCalledTimes(1);
    expect(lifecycle.disconnect).not.toHaveBeenCalled();
    expect(document.head.querySelector('[data-ui-theme="new"]')).toBeNull();
    expect(document.head.querySelector('[data-ui-theme="classic"]')).toBeTruthy();
    expect(document.documentElement.dataset.uiVersion).toBe('classic');

    fireEvent.click(screen.getByRole('button', { name: 'New UI' }));
    await screen.findByTestId('new-dashboard');
    expect(screen.queryByTestId('classic-dashboard')).toBeNull();
    expect(lifecycle.classicDispose).toHaveBeenCalledTimes(1);
    expect(lifecycle.connect).toHaveBeenCalledTimes(1);
    expect(lifecycle.disconnect).not.toHaveBeenCalled();
  });

  it('cleans up telemetry and active presentation styles when the app closes', async () => {
    history.replaceState(null, '', '/?ui=classic');
    const app = render(<App />);
    await screen.findByTestId('classic-dashboard');
    app.unmount();
    expect(lifecycle.disconnect).toHaveBeenCalledTimes(1);
    expect(document.head.querySelector('[data-ui-theme]')).toBeNull();
    expect(document.documentElement.dataset.uiVersion).toBeUndefined();
  });
});
