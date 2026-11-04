import React from 'react';
import Image from 'next/image';
import Link from 'next/link';

const ChatHeader: React.FC = () => (
  <header className="flex items-center gap-4 border-b border-base-lighter bg-base-max px-5 py-2">
    <Image
      src="/images/logos/VirtualLab-R.svg"
      alt="MMRF Virtual Lab"
      width={152}
      height={28}
      className="h-7 w-auto"
      priority
    />
    <span className="font-heading text-sm font-semibold text-primary">Chat</span>
    <Link
      href="/?app="
      className="ml-auto font-heading text-[13px] font-medium text-gunmetal hover:text-primary focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
    >
      Close Chat
    </Link>
  </header>
);

export default ChatHeader;
