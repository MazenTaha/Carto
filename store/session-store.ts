// Zustand store for session state management

import { create } from 'zustand';
import { CartSession, Receipt, SessionState } from '@/types';

interface SessionStore extends SessionState {
  setSession: (session: CartSession | null) => void;
  setReceipt: (receipt: Receipt | null) => void;
  updateProgress: (total: number, collected: number) => void;
  setConnected: (isConnected: boolean) => void;
  reset: () => void;
}

const initialState: SessionState = {
  session: null,
  receipt: null,
  progress: {
    total: 0,
    collected: 0,
    remaining: 0,
  },
  isConnected: false,
};

export const useSessionStore = create<SessionStore>((set) => ({
  ...initialState,
  setSession: (session) => set({ session }),
  setReceipt: (receipt) => set({ receipt }),
  updateProgress: (total, collected) =>
    set({
      progress: {
        total,
        collected,
        remaining: total - collected,
      },
    }),
  setConnected: (isConnected) => set({ isConnected }),
  reset: () => set(initialState),
}));

