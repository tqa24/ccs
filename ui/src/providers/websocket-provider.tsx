/**
 * WebSocket Provider (Phase 04)
 *
 * React context provider for WebSocket connection.
 */

import { createContext, useContext, type ReactNode } from 'react';
import { useWebSocket } from '@/hooks/use-websocket';

type ConnectionStatus = 'connecting' | 'connected' | 'disconnected';

interface WSContextValue {
  status: ConnectionStatus;
  connect: () => void;
  disconnect: () => void;
}

const WSContext = createContext<WSContextValue | null>(null);

export function WebSocketProvider({ children }: { children: ReactNode }) {
  const ws = useWebSocket();

  return <WSContext.Provider value={ws}>{children}</WSContext.Provider>;
}

export function useWSContext() {
  const context = useContext(WSContext);
  if (!context) {
    throw new Error('useWSContext must be used within WebSocketProvider');
  }
  return context;
}
