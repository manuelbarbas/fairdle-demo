import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App.tsx'
import './main.css'

import { WagmiProvider, QueryClientProvider, queryClient, config } from './config/config.ts'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <WagmiProvider config={config}>
      <QueryClientProvider client={queryClient}>
        <App />
      </QueryClientProvider>
    </WagmiProvider>
  </StrictMode>,
)
