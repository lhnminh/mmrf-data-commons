import React, { useEffect } from 'react';
import Image from 'next/image';
import Link from 'next/link';

const WIDE_SCREEN = '(min-width: 768px)';

const ChatHeader: React.FC = () => {
  // The thread scrolls itself. If the page scrolled too, the cohort strip would leave the screen.
  // `clip`, because code can still scroll an element that is `overflow: hidden`. The root needs a
  // value of its own, or the body's is applied to the window as `hidden`.
  useEffect(() => {
    if (!window.matchMedia(WIDE_SCREEN).matches) return undefined;
    const root = document.documentElement.style;
    const body = document.body.style;
    const previous = { root: root.overflow, body: body.overflow, height: body.height };
    root.overflow = 'hidden';
    body.overflow = 'clip';
    body.height = '100vh';
    return () => {
      root.overflow = previous.root;
      body.overflow = previous.body;
      body.height = previous.height;
    };
  }, []);

  return (
    <header className="flex items-center gap-4 border-b border-base-lighter bg-base-max px-5 py-2">
      <Image
        src="/images/logos/VirtualLab-R.svg"
        alt="MMRF Virtual Lab"
        width={152}
        height={28}
        className="h-7 w-auto"
        priority
      />
      <span className="font-heading text-sm font-semibold text-primary">
        Chat
      </span>
      <Link
        href="/?app="
        className="ml-auto font-heading text-[13px] font-medium text-gunmetal hover:text-primary focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
      >
        Close Chat
      </Link>
    </header>
  );
};

export default ChatHeader;
