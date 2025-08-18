import {toHex, encodeFunctionData, type WalletClient, type PublicClient } from 'viem'
import {WordleGame_Contract_Address, WordleGame_Contract_ABI} from '../contracts'
import {BITE} from "@skalenetwork/bite";

// Contract configuration
const CONTRACT_ADDRESS = WordleGame_Contract_Address as `0x${string}`
const CONTRACT_ABI = WordleGame_Contract_ABI
const chain_rpc = "https://testnet-v1.skalenodes.com/v1/idealistic-dual-miram";

// Utility function to convert string to bytes32
function stringToBytes32(str: string): `0x${string}` {
  // Ensure string is uppercase and pad to 32 bytes
  const paddedStr = str.toUpperCase().padEnd(32, '\0')
  return toHex(paddedStr, { size: 32 })
}

// Utility function to convert bytes32 to string
function bytes32ToString(bytes32: `0x${string}`): string {
  // Convert hex to string and remove null bytes
  const hex = bytes32.slice(2);
  let str = '';
  for (let i = 0; i < hex.length; i += 2) {
    const byte = parseInt(hex.substr(i, 2), 16);
    if (byte !== 0) {
      str += String.fromCharCode(byte);
    }
  }
  return str.toUpperCase();
}


export async function readContract(walletClient: WalletClient,publicClient: PublicClient, funcName: string, args: unknown[] = []) {
  

  const result = await publicClient.readContract({
    account: walletClient.account,
    abi: CONTRACT_ABI,
    address: CONTRACT_ADDRESS,
    functionName: funcName,
    args: args
  });

  return result;
}

export async function writeContract(walletClient: WalletClient, funcName: string, args: unknown[] = []) {
  if (!walletClient.account) {
    throw new Error("Wallet client account is undefined");
  }

  const data = encodeFunctionData({
    abi: CONTRACT_ABI,
    functionName: funcName,
    args: args
  });

  const bite = new BITE(chain_rpc);

  const transaction = {
    to: CONTRACT_ADDRESS,
    data: data
  };

  const encryptedTransaction = await bite.encryptTransaction(transaction);

  const tx = await walletClient.sendTransaction({
    account: walletClient.account,
    to: encryptedTransaction.to as `0x${string}`,
    data: encryptedTransaction.data as `0x${string}`,
    gas: encryptedTransaction.gasLimit
    ? BigInt(encryptedTransaction.gasLimit)
    : undefined,
    value: 0n,
    chain: walletClient.chain
  });

  return tx;
}


export { bytes32ToString, stringToBytes32 }
