import '../src/tracing'
import '../src/console-capture'

import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { WagmiProvider } from 'wagmi'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ConnectKitProvider } from 'connectkit'
import { Toaster } from 'sonner'
import { config } from '../src/config'
import '../src/index.css'
import { AdminApp } from './AdminApp'

const queryClient = new QueryClient()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <WagmiProvider config={config}>
      <QueryClientProvider client={queryClient}>
        <ConnectKitProvider>
          <AdminApp />
          <Toaster position="top-center" />
        </ConnectKitProvider>
      </QueryClientProvider>
    </WagmiProvider>
  </StrictMode>,
)
