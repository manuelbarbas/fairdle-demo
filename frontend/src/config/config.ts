import { createWeb3Modal } from '@web3modal/wagmi/react'
import { defaultWagmiConfig } from '@web3modal/wagmi/react/config'
import { WagmiProvider } from 'wagmi'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { defineChain } from 'viem'

// 0. Setup queryClient
const queryClient = new QueryClient()

// 1. Get projectId from environment
const projectId = import.meta.env.VITE_WALLET_CONNECT_PROJECT_ID

if (!projectId) throw new Error('Project ID is not defined')

// 1.5. Define FAIR Testnet chain
const fairTestnet = defineChain({
  id: 935,
  name: 'FAIR Testnet',
  nativeCurrency: {
    name: 'FAIR',
    symbol: 'FAIR',
    decimals: 18,
  },
  rpcUrls: {
    default: {
      http: ['https://testnet-rpc.fair.cloud/'],
    },
  },
  blockExplorers: {
    default: {
      name: 'FAIR Testnet Explorer',
      url: 'https://testnet-explorer.fair.cloud/',
    },
  },
  testnet: true,
})

// 2. Create wagmiConfig
const metadata = {
  name: 'SKALE Wordle',
  description: 'A modern Wordle game on SKALE',
  url: 'https://web3modal.com', // origin must match your domain & subdomain
  icons: ['https://avatars.githubusercontent.com/u/37784886']
}

const chains = [fairTestnet] as const

export const config = defaultWagmiConfig({
  chains,
  projectId,
  metadata,
  connectors: [],
})

// 3. Create modal
createWeb3Modal({
  wagmiConfig: config,
  projectId,
  enableAnalytics: true,
  enableOnramp: false,
  // Disable social authentication methods

})

export { WagmiProvider, QueryClient, QueryClientProvider, queryClient, fairTestnet}
