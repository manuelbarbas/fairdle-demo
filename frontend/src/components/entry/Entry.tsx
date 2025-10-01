import { useState, useEffect } from "react";
import { useWeb3Modal } from "@web3modal/wagmi/react";
import {
  useAccount,
  useDisconnect,
  useChainId,
  useSwitchChain,
  useWalletClient,
  usePublicClient,
  useWaitForTransactionReceipt,
} from "wagmi";
import { toast } from "react-toastify";
import WordleGame from "../gameplay/WordleGame";
//import { startGame, getPlayerSatus, type PlayerStatus } from "../../web3/contracts/wordle/WordleGameContract"
import { writeContract, readContract } from "../../web3/requests/contractCalls";
import { fairTestnet } from "../../config/config";
import "./Entry.css";

type GameMode = "menu" | "daily" | "competitive" | "starting";

export const Entry: React.FC = () => {
  const [gameMode, setGameMode] = useState<GameMode>("menu");
  const [txHash, setTxHash] = useState<`0x${string}` | undefined>(undefined);
  const [isStartingGame, setIsStartingGame] = useState(false);
  const [availableGuesses, setAvailableGuesses] = useState(7);
  const MAX_GUESSES = 7;
  const { open } = useWeb3Modal();
  const { address, isConnected } = useAccount();
  const { disconnect } = useDisconnect();
  const chainId = useChainId();
  const { switchChain } = useSwitchChain();
  const { data: walletClient } = useWalletClient();
  const publicClient = usePublicClient();

  // Wait for transaction receipt
  const {
    data: receipt,
    isLoading: isWaitingForReceipt,
    isSuccess: isReceiptSuccess,
  } = useWaitForTransactionReceipt({
    hash: txHash,
  });

  // Start game transaction function
  const startGameTransaction = async () => {
    if (!walletClient || !address) {
      console.error("Wallet client or address not available");
      toast.error("Wallet not available. Please reconnect your wallet.", {
        position: "top-center",
        autoClose: 4000,
      });
      return;
    }

    try {
      setIsStartingGame(true);
      console.log("Initiating startGame transaction...");

      // Get the encoded function data from the contract

      console.log("TRYING TO START THE GAME");

      const tx = await writeContract(walletClient, "startGame");

      console.log("START GAME", tx);

      setTxHash(tx);

      // Show success toast for transaction submission
      toast.success(
        "🚀 Game transaction submitted! Waiting for confirmation...",
        {
          position: "top-center",
          autoClose: 3000,
        }
      );
    } catch (error) {
      console.error("Error starting game:", error);
      setIsStartingGame(false);

      // Show error toast
      // const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      toast.error(`Transaction failed`, {
        position: "top-center",
        autoClose: 5000,
      });
    }
  };

  const handleDailyPlay = async () => {
    if (isConnected) {
      // Check if we're on the correct chain
      if (chainId !== fairTestnet.id) {
        switchChain({ chainId: fairTestnet.id });
      } else {
        try {
          if (!publicClient) {
            console.error("Public client is undefined");
            return;
          }
          if (!walletClient) {
            console.error("Wallet client is undefined");
            return;
          }
          const result = await readContract(walletClient,publicClient, "playerStatus", [
            address,
          ]) as [boolean, bigint,boolean];

          const [isCorrectDay, tries, hasGuesserRole] = result;

          if(isCorrectDay) {
            if(hasGuesserRole) {
              if(tries < BigInt(7)){
                setGameMode("daily");
              }
            }
            else {
              if(tries == BigInt(7)) {
                toast.warning(
                  "Daily limit reached! Come back tomorrow for a new challenge!",
                  {
                  position: "top-center",
                  autoClose: 5000,
                  hideProgressBar: false,
                  closeOnClick: true,
                  pauseOnHover: true,
                  draggable: true,
                  }
                );
              }
              else{
                  toast.warning(
                  "You already got it right! Come back tomorrow for more!",
                  {
                  position: "top-center",
                  autoClose: 5000,
                  hideProgressBar: false,
                  closeOnClick: true,
                  pauseOnHover: true,
                  draggable: true,
                  }
                );
              }
            }
          }else{
            await startGameTransaction();
          }

        } catch (error) {
          console.error("Error checking player status:", error);
          toast.error("Error checking game status. Please try again!", {
            position: "top-center",
            autoClose: 4000,
          });
        }
      }
    }
  };

  // Handle successful transaction receipt
  useEffect(() => {
    if (isReceiptSuccess && receipt) {
      console.log("Transaction successful:", receipt);
      setIsStartingGame(false);
      setGameMode("daily");
      // Reset transaction hash to allow new transactions
      setTxHash(undefined);

      // Show success toast for confirmed transaction
      toast.success("🎉 Game started successfully! Let's play!", {
        position: "top-center",
        autoClose: 3000,
      });
    }
  }, [isReceiptSuccess, receipt]);

  const handleBackToMenu = () => {
    setGameMode("menu");
    setTxHash(undefined);
    setIsStartingGame(false);
  };

  const formatAddress = (address: string) => {
    return `${address.slice(0, 6)}...${address.slice(-4)}`;
  };

  const isOnCorrectChain = chainId === fairTestnet.id;

  // Function to update available guesses
  const updateAvailableGuesses = async () => {
    if (isConnected && walletClient && publicClient && address) {
      try {
        const result = await readContract(walletClient, publicClient, "playerStatus", [
          address,
        ]) as [boolean, bigint, boolean];
        const [, tries] = result;
        setAvailableGuesses(MAX_GUESSES - Number(tries));
      } catch (error) {
        console.error("Error updating available guesses:", error);
      }
    }
  };

  // Update available guesses when entering daily mode
  useEffect(() => {
    if (gameMode === 'daily') {
      updateAvailableGuesses();
    }
  }, [gameMode, isConnected, walletClient, publicClient, address]);

  if (gameMode === "daily") {
    return (
      <div className="game-mode-container">
        <div className="game-header">
          <button className="back-button hover-lift" onClick={handleBackToMenu}>
            ← Back to Menu
          </button>
          <div className="guesses-stats">
            <span className="stats-label">Guesses:</span>
            <span className="stats-value">{availableGuesses} / {MAX_GUESSES}</span>
          </div>
          <div className="wallet-display">
            <div className="wallet-info">
              <span className="wallet-address">{formatAddress(address!)}</span>
              <div className="chain-info">
                {!isOnCorrectChain && (
                  <button
                    className="switch-chain-button"
                    onClick={() => switchChain({ chainId: fairTestnet.id })}
                  >
                    Switch to FAIR Testnet
                  </button>
                )}
              </div>
              <button
                className="disconnect-button"
                onClick={() => disconnect()}
              >
                Disconnect
              </button>
            </div>
          </div>
        </div>
        <WordleGame onGuessUpdate={updateAvailableGuesses} />
      </div>
    );
  }

  return (
    <div className="main-menu">
      <div className="menu-container glass-effect fade-in">
        <div className="menu-header">
          <h1 className="menu-title">
            <span style={{ color: "black" }}>F</span>
            <span style={{ color: "var(--fair-blue)" }}>AI</span>
            <span style={{ color: "black" }}>RDLE</span>
          </h1>
          <p className="menu-subtitle">
            Challenge yourself with blockchain-powered word games
          </p>
        </div>

        {/* Wallet Section */}
        <div className="wallet-section">
          {!isConnected ? (
            <button
              className="connect-wallet-button hover-lift"
              onClick={() => open()}
            >
              Connect Wallet
            </button>
          ) : (
            <div className="wallet-connected">
              <div className="wallet-info">
                <span className="wallet-status">✅ Connected</span>
                <span className="wallet-address">
                  {formatAddress(address!)}
                </span>
                <div className="chain-info">
                  {!isOnCorrectChain && (
                    <button
                      className="switch-chain-button"
                      onClick={() => switchChain({ chainId: fairTestnet.id })}
                    >
                      Switch to FAIR Testnet
                    </button>
                  )}
                </div>
              </div>
              <button
                className="disconnect-button"
                onClick={() => disconnect()}
              >
                Disconnect
              </button>
            </div>
          )}
        </div>

        {/* Game Mode Buttons */}
        <div className="game-modes">
          <button
            className={`game-mode-button daily-play ${
              !isConnected ||
              !isOnCorrectChain ||
              isStartingGame ||
              isWaitingForReceipt
                ? "disabled"
                : ""
            } hover-lift`}
            onClick={handleDailyPlay}
            disabled={
              !isConnected ||
              !isOnCorrectChain ||
              isStartingGame ||
              isWaitingForReceipt
            }
          >
            <div className="button-content">
              <span className="button-icon">
                {isStartingGame || isWaitingForReceipt ? "⏳" : "📅"}
              </span>
              <div className="button-text">
                <h3>Daily Play</h3>
                <p>
                  {isStartingGame
                    ? "Starting game..."
                    : isWaitingForReceipt
                    ? "Waiting for confirmation..."
                    : "Play today's word challenge"}
                </p>
                {isConnected && !isOnCorrectChain && (
                  <small className="chain-requirement">
                    Requires FAIR Testnet
                  </small>
                )}
              </div>
            </div>
          </button>

          {/*  <button 
            className={`game-mode-button competitive-play ${!isConnected ? 'disabled' : ''} hover-lift`}
            onClick={handleCompetitivePlay}
            disabled={!isConnected}
          >
            <div className="button-content">
              <span className="button-icon">🏆</span>
              <div className="button-text">
                <h3>Competitive Play</h3>
                <p>Challenge other players</p>
              </div>
            </div>
          </button>*/}
        </div>

        {/* Coming Soon Notification 
        {showComingSoon && (
          <div className="coming-soon-notification bounce-in">
            <div className="notification-content">
              <span className="notification-icon">🚀</span>
              <p>Coming Soon!</p>
            </div>
          </div>
        )}*/}

        {/* Transaction Status Message */}
        {txHash && isWaitingForReceipt && (
          <div className="transaction-status">
            <p>🔄 Transaction submitted! Waiting for confirmation...</p>
            <small>Transaction hash: {txHash}</small>
          </div>
        )}

        {/* Connection Required Message */}
        {!isConnected && (
          <div className="connection-required">
            <p>🔒 Connect your wallet to FAIR Testnet to start playing</p>
          </div>
        )}
        {isConnected && !isOnCorrectChain && (
          <div className="chain-required">
            <p>⚠️ Please switch to FAIR Testnet to play</p>
          </div>
        )}
      </div>
    </div>
  );
};
