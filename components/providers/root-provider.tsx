'use client';

import { ThemeProvider } from './theme-provider';
import { ToastProvider } from './toast-provider';

export function RootProvider({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider
      attribute="class"
      defaultTheme="dark"
      enableSystem={false}
      storageKey="hongliu-theme"
      disableTransitionOnChange
    >
      <div className="min-h-screen bg-background antialiased">
        {children}
        <ToastProvider />
      </div>
    </ThemeProvider>
  );
}