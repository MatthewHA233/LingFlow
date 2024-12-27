'use client';

import { Providers } from '@/components/providers';
import { Navbar } from '@/components/layout/Navbar';

export default function Template({ children }: { children: React.ReactNode }) {
  return (
    <Providers>
      <Navbar />
      <main className="pt-16">{children}</main>
    </Providers>
  );
}