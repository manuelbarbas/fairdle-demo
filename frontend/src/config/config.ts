import { WagmiProvider, createConfig, http } from 'wagmi'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { defineChain } from 'viem'
import { EthereumWalletConnectors } from '@dynamic-labs/ethereum'
import type { DynamicContextProps } from '@dynamic-labs/sdk-react-core'

// 0. Setup queryClient
const queryClient = new QueryClient()

// 1. Get Dynamic environment ID from environment
const dynamicEnvironmentId = import.meta.env.VITE_DYNAMIC_ENVIRONMENT_ID

if (!dynamicEnvironmentId) throw new Error('Dynamic Environment ID is not defined')

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

// 2. Create wagmi config for Dynamic
const chains = [fairTestnet] as const

export const config = createConfig({
  chains,
  multiInjectedProviderDiscovery: false,
  transports: {
    [fairTestnet.id]: http(),
  },
})

// 3. Create Dynamic settings configuration
export const dynamicConfig: DynamicContextProps['settings'] = {
  environmentId: dynamicEnvironmentId,
  walletConnectors: [EthereumWalletConnectors],
  overrides: {
    evmNetworks: [
      {
        chainId: fairTestnet.id,
        chainName: fairTestnet.name,
        iconUrls: [],
        name: fairTestnet.name,
        nativeCurrency: fairTestnet.nativeCurrency,
        networkId: fairTestnet.id,
        rpcUrls: [fairTestnet.rpcUrls.default.http[0]],
        blockExplorerUrls: [fairTestnet.blockExplorers?.default.url || ''],
        vanityName: 'FAIR Testnet',
      }
    ]
  }
}

export { WagmiProvider, QueryClient, QueryClientProvider, queryClient, fairTestnet }
