import { create } from 'zustand';

interface LoginDialogState {
  isOpen: boolean;
  openLoginDialog: () => void;
  closeLoginDialog: () => void;
}

export const useLoginDialog = create<LoginDialogState>((set) => ({
  isOpen: false,
  openLoginDialog: () => set({ isOpen: true }),
  closeLoginDialog: () => set({ isOpen: false }),
})); 