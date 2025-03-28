'use client';

import { ThemeProvider } from './theme-provider';
import { useEffect, useState } from 'react';

export function Providers({ children }: { children: React.ReactNode }) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return null;
  }

  return (
    <div className="providers-wrapper">
      <ThemeProvider
        attribute="class"
        defaultTheme="dark"
        enableSystem={false}
        storageKey="hongliu-theme"
        disableTransitionOnChange
      >
        {children}
      </ThemeProvider>
    </div>
  );
}