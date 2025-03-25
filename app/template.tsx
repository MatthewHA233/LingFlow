'use client';

import { Providers } from '@/components/providers';
import { Navbar } from '@/components/layout/Navbar';

export default function Template({ children }: { children: React.ReactNode }) {
  return (
    <Providers>
      <div className="flex flex-col h-screen overflow-hidden">
        <Navbar />
        <div className="flex-1 overflow-auto pt-12 sm:pt-14">
          {children}
        </div>
      </div>
    </Providers>
  );
}