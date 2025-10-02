import { formatEther, parseEther } from 'viem';
import type { PublicClient } from 'viem';

const MIN_GAS_THRESHOLD = parseEther('0.5'); // 0.005 FAIR
const API_KEY = import.meta.env.VITE_API_KEY;
const GAS_FAUCET_URL = import.meta.env.VITE_GAS_FAUCET_URL || 'http://localhost:3000/api/fair/gas';

export interface GasCheckResult {
  needsGas: boolean;
  currentBalance: bigint;
  formattedBalance: string;
}

/**
 * Check if the wallet has sufficient gas balance
 */
export async function checkGasBalance(
  publicClient: PublicClient | undefined,
  address: `0x${string}` | undefined
): Promise<GasCheckResult | null> {
  if (!publicClient || !address) {
    console.error('Missing publicClient or address for gas check');
    return null;
  }

  try {
    const balance = await publicClient.getBalance({ address });
    const needsGas = balance < MIN_GAS_THRESHOLD;
    
    return {
      needsGas,
      currentBalance: balance,
      formattedBalance: formatEther(balance)
    };
  } catch (error) {
    console.error('Error checking gas balance:', error);
    return null;
  }
}

/**
 * Request gas from the faucet
 */
export async function requestGasFromFaucet(address: `0x${string}`): Promise<boolean> {
  if (!API_KEY) {
    console.error('API_KEY not configured in environment variables');
    return false;
  }

  try {
    const response = await fetch(GAS_FAUCET_URL, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ address }),
    });

    if (!response.ok) {
      const errorData = await response.text();
      console.error('Gas faucet request failed:', response.status, errorData);
      return false;
    }

    const data = await response.json();
    console.log('Gas distribution successful:', data);
    return true;
  } catch (error) {
    console.error('Error requesting gas from faucet:', error);
    return false;
  }
}

/**
 * Check gas balance and request from faucet if needed
 */
export async function ensureSufficientGas(
  publicClient: PublicClient | undefined,
  address: `0x${string}` | undefined
): Promise<{
  success: boolean;
  message: string;
  gasDistributed?: boolean;
}> {
  // Check current balance
  const gasCheck = await checkGasBalance(publicClient, address);
  
  if (!gasCheck) {
    return {
      success: false,
      message: 'Unable to check gas balance'
    };
  }

  if (!gasCheck.needsGas) {
    return {
      success: true,
      message: `Sufficient gas balance: ${gasCheck.formattedBalance} FAIR`,
      gasDistributed: false
    };
  }

  // Request gas from faucet
  console.log(`Low gas detected (${gasCheck.formattedBalance} FAIR). Requesting from faucet...`);
  
  if (!address) {
    return {
      success: false,
      message: 'No wallet address available'
    };
  }

  const faucetSuccess = await requestGasFromFaucet(address);
  
  if (faucetSuccess) {
    // Wait a moment for the transaction to process
    await new Promise(resolve => setTimeout(resolve, 3000));
    
    // Check balance again
    const newGasCheck = await checkGasBalance(publicClient, address);
    
    return {
      success: true,
      message: `Gas distributed successfully! New balance: ${newGasCheck?.formattedBalance || 'unknown'} FAIR`,
      gasDistributed: true
    };
  }

  return {
    success: false,
    message: 'Failed to request gas from faucet. Please try again later.',
    gasDistributed: false
  };
}