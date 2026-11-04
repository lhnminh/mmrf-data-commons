import React from 'react';
import { render, screen } from '@testing-library/react';
import ChatHeader from './ChatHeader';

const setWide = (matches: boolean) => {
  window.matchMedia = jest.fn().mockReturnValue({ matches }) as unknown as typeof window.matchMedia;
};

describe('ChatHeader', () => {
  afterEach(() => {
    document.documentElement.style.overflow = '';
    document.body.style.overflow = '';
    document.body.style.height = '';
  });

  it('closes to the Analysis Center', () => {
    setWide(true);
    render(<ChatHeader />);
    expect(screen.getByRole('link', { name: 'Close Chat' }).getAttribute('href')).toBe('/?app=');
  });

  // The thread scrolls itself. If the page scrolled too, the cohort strip would leave the screen.
  // `clip`, because code can still scroll an element that is `overflow: hidden`.
  it('fits the page to the window on a wide screen and restores it on leaving', () => {
    setWide(true);
    const { unmount } = render(<ChatHeader />);
    // The root needs its own value, or the body's is applied to the window as `hidden`.
    expect(document.documentElement.style.overflow).toBe('hidden');
    expect(document.body.style.overflow).toBe('clip');
    expect(document.body.style.height).toBe('100vh');
    unmount();
    expect(document.documentElement.style.overflow).toBe('');
    expect(document.body.style.overflow).toBe('');
    expect(document.body.style.height).toBe('');
  });

  it('leaves page scrolling alone on a narrow screen, where the strip can wrap', () => {
    setWide(false);
    render(<ChatHeader />);
    expect(document.body.style.overflow).toBe('');
  });
});
