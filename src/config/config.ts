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
  id: 1328435889,
  name: 'FAIR Testnet',
  nativeCurrency: {
    name: 'FAIR',
    symbol: 'FAIR',
    decimals: 18,
  },
  rpcUrls: {
    default: {
      http: ['https://testnet-v1.skalenodes.com/v1/idealistic-dual-miram'],
    },
  },
  blockExplorers: {
    default: {
      name: 'FAIR Testnet Explorer',
      url: 'https://idealistic-dual-miram.explorer.testnet-v1.skalenodes.com',
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
  // Optional - Override createConnector
  // createConnector,
})

// 3. Create modal
createWeb3Modal({
  wagmiConfig: config,
  projectId,
  enableAnalytics: true, // Optional - defaults to your Cloud configuration
  enableOnramp: true // Optional - false as default
})

export { WagmiProvider, QueryClient, QueryClientProvider, queryClient, fairTestnet }
