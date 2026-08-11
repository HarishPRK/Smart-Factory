import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { VideoAnalyticsPage } from './VideoAnalytics';

const { push } = vi.hoisted(() => ({ push: vi.fn() }));

vi.mock('../ui/Toast', () => ({
  useToast: () => ({ push }),
}));

const fetchMock = vi.fn();

function tileNamed(name: string): HTMLElement {
  const tile = screen.getByText(name).closest('.va-tile');
  if (!(tile instanceof HTMLElement)) throw new Error(`Could not find tile: ${name}`);
  return tile;
}

function openTile(name: string): HTMLElement {
  const tile = tileNamed(name);
  fireEvent.click(within(tile).getByRole('button', { name: 'Open feed' }));
  return tile;
}

beforeEach(() => {
  push.mockReset();
  fetchMock.mockReset();
  vi.stubGlobal('fetch', fetchMock);
  vi.stubGlobal('requestAnimationFrame', vi.fn((callback: FrameRequestCallback) => {
    callback(0);
    return 1;
  }));
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe('VideoAnalyticsPage stream controls', () => {
  it('shows Stop on every feed as soon as its request starts', () => {
    render(<VideoAnalyticsPage />);

    const openButtons = screen.getAllByRole('button', { name: 'Open feed' });
    expect(openButtons).toHaveLength(13);
    openButtons.forEach((button) => fireEvent.click(button));

    expect(screen.getAllByRole('button', { name: /^Stop .+ feed$/ })).toHaveLength(13);
    expect(screen.getAllByText('Video loading…')).toHaveLength(13);
  });

  it('disconnects a loading feed before its upstream stop request finishes', async () => {
    let resolveStop: ((value: Response) => void) | undefined;
    fetchMock.mockReturnValue(new Promise<Response>((resolve) => {
      resolveStop = resolve;
    }));

    render(<VideoAnalyticsPage />);
    const tile = openTile('Inventory Management');
    expect(within(tile).getByAltText('Inventory Management')).toBeTruthy();

    fireEvent.click(within(tile).getByRole('button', { name: 'Stop Inventory Management feed' }));

    expect(within(tile).queryByAltText('Inventory Management')).toBeNull();
    expect(fetchMock).toHaveBeenCalledWith('/api/video/nv-nanoowl/stop', { method: 'POST' });
    const stopping = within(tile).getByRole('button', { name: 'Stopping Inventory Management feed' });
    expect(stopping.hasAttribute('disabled')).toBe(true);
    expect(stopping.getAttribute('aria-busy')).toBe('true');

    await act(async () => {
      resolveStop?.({ ok: true, status: 200, text: vi.fn() } as unknown as Response);
      await Promise.resolve();
    });

    expect(within(tile).getByRole('button', { name: 'Open feed' })).toBeTruthy();
  });

  it('stops an unmapped feed locally without inventing an upstream request', () => {
    render(<VideoAnalyticsPage />);
    const tile = openTile('Table monitor');

    fireEvent.click(within(tile).getByRole('button', { name: 'Stop Table monitor feed' }));

    expect(within(tile).queryByAltText('Table monitor')).toBeNull();
    expect(within(tile).getByRole('button', { name: 'Open feed' })).toBeTruthy();
    expect(fetchMock).not.toHaveBeenCalled();
    expect(push).toHaveBeenCalledWith(expect.objectContaining({
      kind: 'info',
      title: 'Table monitor stopped',
    }));
  });

  it('keeps Stop available when a stream errors before its first frame', () => {
    render(<VideoAnalyticsPage />);
    const tile = openTile('Table monitor');

    fireEvent.error(within(tile).getByAltText('Table monitor'));

    expect(within(tile).getByText('Stream unavailable')).toBeTruthy();
    expect(within(tile).getByRole('button', { name: 'Stop Table monitor feed' })).toBeTruthy();
  });
});
