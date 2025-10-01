import { useState, useEffect } from "react";
import "./styles.css";
import {
  useAccount,
  useWalletClient,
  usePublicClient,
  useWaitForTransactionReceipt,
} from "wagmi";
import {
  writeContract,
  readContract,
  stringToBytes32,
  bytes32ToString,
} from "../../web3/requests/contractCalls";
import { toast } from "react-toastify";

interface GameState {
  guesses: string[];
  letterStatuses: string[][]; // Array of letter statuses ("correct", "present", "absent")
  isCorrectLength: boolean[]; // Array of word length correctness
  currentGuess: string;
  gameStatus: "playing" | "won" | "lost";
  currentRow: number;
  isSubmittingGuess: boolean;
  currentTries: number;
  targetWord: string | null; // Winning guess or null for loss
  lastGameDay: number; // Last day the player played
}

interface WordleGameProps {
  onGuessUpdate?: () => void;
}

const WordleGame: React.FC<WordleGameProps> = ({ onGuessUpdate }) => {
  const [gameState, setGameState] = useState<GameState>({
    guesses: [],
    letterStatuses: [],
    isCorrectLength: [],
    currentGuess: "",
    gameStatus: "playing",
    currentRow: 0,
    isSubmittingGuess: false,
    currentTries: 0,
    targetWord: null,
    lastGameDay: 0,
  });
  const [showVictoryOverlay, setShowVictoryOverlay] = useState(false);

  const [txHash, setTxHash] = useState<`0x${string}` | undefined>(undefined);
  const { address } = useAccount();
  const { data: walletClient } = useWalletClient();
  const publicClient = usePublicClient();

  const { data: receipt, isSuccess: isReceiptSuccess } =
    useWaitForTransactionReceipt({
      hash: txHash,
    });

  // Load player game state on mount
  useEffect(() => {
    const loadPlayerGameState = async () => {
      if (address && walletClient && publicClient) {
        try {
          const [
            lastGameDay,
            guesses,
            letterStatuses,
            isCorrectLength,
            isGameActive,
          ] = (await readContract(
            walletClient,
            publicClient,
            "getUserGameState",
            [address]
          )) as [number, `0x${string}`[], number[][], boolean[], boolean];

          console.log("lastGameDay ", lastGameDay);
          console.log("guesses ", guesses);
          console.log("letterStatuses ", letterStatuses);
          console.log("isCorrectLength ", isCorrectLength);
          console.log("isGameActive ", isGameActive);

          const playerGuesses = guesses.map(bytes32ToString);
          const formattedStatuses = letterStatuses.map((statusArray) =>
            statusArray.map((status) => {
              if (status === 2) return "correct";
              if (status === 1) return "present";
              return "absent";
            })
          );

          let gameStatus: "playing" | "won" | "lost" = isGameActive
            ? "playing"
            : "lost";
          let targetWord: string | null = null;

          if (!isGameActive && playerGuesses.length > 0) {
            const lastGuessIndex = playerGuesses.length - 1;
            const lastStatuses = letterStatuses[lastGuessIndex] || [];
            const isWin =
              lastStatuses.length > 0 &&
              lastStatuses.every((status) => status === 2);
            gameStatus = isWin ? "won" : "lost";
            targetWord = isWin ? playerGuesses[lastGuessIndex] : null;
          }

          setGameState((prev) => ({
            ...prev,
            lastGameDay,
            guesses: playerGuesses,
            letterStatuses: formattedStatuses,
            isCorrectLength,
            currentTries: playerGuesses.length,
            currentRow: playerGuesses.length,
            gameStatus,
            targetWord,
          }));
        } catch (error) {
          console.error("Error loading player game state:", error);
          toast.error("Failed to load game state.", {
            position: "top-center",
            autoClose: 5000,
          });
        }
      }
    };

    loadPlayerGameState();
  }, [address, walletClient, publicClient]);

  // Submit guess transaction
  const submitGuessTransaction = async () => {
    if (!walletClient || !address || gameState.isSubmittingGuess) {
      toast.error("Wallet not connected or guess in progress.", {
        position: "top-center",
        autoClose: 3000,
      });
      return;
    }

    if (gameState.currentGuess.length === 0) {
      toast.error("Guess cannot be empty.", {
        position: "top-center",
        autoClose: 3000,
      });
      return;
    }

    try {
      setGameState((prev) => ({ ...prev, isSubmittingGuess: true }));
      const tx = await writeContract(walletClient, "submitGuess", [
        stringToBytes32(gameState.currentGuess),
      ]);
      setTxHash(tx);
      toast.success("🚀 Guess submitted! Waiting for confirmation...", {
        position: "top-center",
        autoClose: 3000,
      });
    } catch (error: any) {
      setGameState((prev) => ({ ...prev, isSubmittingGuess: false }));
      const errorMessage = error.message.includes("NotActivePlayer")
        ? "Game not active. Start a new game."
        : error.message.includes("GuessLimitReached")
        ? "Guess limit reached for today."
        : error.message.includes("DuplicateGuess")
        ? "This guess was already submitted."
        : "Failed to submit guess. Please try again.";
      toast.error(errorMessage, {
        position: "top-center",
        autoClose: 5000,
      });
    }
  };

  const handleKeyPress = (key: string) => {
    if (gameState.gameStatus !== "playing" || gameState.isSubmittingGuess)
      return;

    if (key === "ENTER") {
      if (gameState.currentGuess.length > 0) {
        submitGuessTransaction();
      }
    } else if (key === "BACKSPACE") {
      setGameState((prev) => ({
        ...prev,
        currentGuess: prev.currentGuess.slice(0, -1),
      }));
    } else if (key.length === 1 && /[A-Z]/.test(key)) {
      setGameState((prev) => ({
        ...prev,
        currentGuess: prev.currentGuess + key,
      }));
    }
  };

  const renderCurrentGuess = () => {
    const guessLength = gameState.currentGuess.length || 1;
    const letters = Array(guessLength).fill("_");
    for (let i = 0; i < gameState.currentGuess.length; i++) {
      letters[i] = gameState.currentGuess[i];
    }
    return (
      <div className="current-guess-container">
        <div className="underscores">
          {letters.map((letter, index) => (
            <span
              key={index}
              className={`underscore ${
                !gameState.currentGuess[index] ? "blinking" : ""
              }`}
            >
              {letter}
            </span>
          ))}
        </div>
      </div>
    );
  };

  const renderGuessHistory = () => {
    return gameState.guesses.map((guess, index) => (
      <div key={index} className="guess-row">
        <div className="guess-letters">
          {guess.split("").map((letter, letterIndex) => (
            <span
              key={letterIndex}
              className={`letter ${
                gameState.letterStatuses[index][letterIndex] || "absent"
              }`}
            >
              {letter}
            </span>
          ))}
        </div>
        <div className="word-length-feedback">
          <span className="length-text">Word Length: {guess.length}</span>
          <span className="length-indicator">
            {gameState.isCorrectLength[index] ? " ✅" : " ❌"}
          </span>
        </div>
      </div>
    ));
  };

  const renderKeyboard = () => {
    const rows = [
      ["Q", "W", "E", "R", "T", "Y", "U", "I", "O", "P"],
      ["A", "S", "D", "F", "G", "H", "J", "K", "L"],
      ["ENTER", "Z", "X", "C", "V", "B", "N", "M", "BACKSPACE"],
    ];

    return rows.map((row, i) => (
      <div key={i} className="keyboard-row">
        {row.map((key) => {
          let keyStatus = "";
          for (let i = 0; i < gameState.guesses.length; i++) {
            const guess = gameState.guesses[i];
            const statuses = gameState.letterStatuses[i] || [];
            if (guess.includes(key)) {
              const positions = guess
                .split("")
                .map((letter, pos) => (letter === key ? pos : -1))
                .filter((pos) => pos !== -1);
              for (const pos of positions) {
                const status = statuses[pos] || "absent";
                if (status === "correct") {
                  keyStatus = "correct";
                  break;
                } else if (status === "present" && keyStatus !== "correct") {
                  keyStatus = "present";
                } else if (status === "absent" && !keyStatus) {
                  keyStatus = "absent";
                }
              }
            }
          }
          return (
            <button
              key={key}
              className={`key ${keyStatus} ${
                key === "ENTER" || key === "BACKSPACE" ? "wide" : ""
              }`}
              onClick={() => handleKeyPress(key)}
            >
              {key === "BACKSPACE" ? "⌫" : key}
            </button>
          );
        })}
      </div>
    ));
  };

  // Handle transaction receipt and game updates
  useEffect(() => {
    if (isReceiptSuccess && receipt) {
      const updateGameState = async () => {
        if (!walletClient || !publicClient || !address) {
          setGameState((prev) => ({ ...prev, isSubmittingGuess: false }));
          toast.error("Wallet or client not available.", {
            position: "top-center",
            autoClose: 5000,
          });
          return;
        }

        try {
          // Fetch updated game state from contract
          const [
            lastGameDay,
            guesses,
            letterStatuses,
            isCorrectLength,
            isGameActive,
          ] = (await readContract(
            walletClient,
            publicClient,
            "getUserGameState",
            [address]
          )) as [number, `0x${string}`[], number[][], boolean[], boolean];


          console.log("lastGameDay ", lastGameDay);
          console.log("guesses ", guesses);
          console.log("letterStatuses ", letterStatuses);
          console.log("isCorrectLength ", isCorrectLength);
          console.log("isGameActive ", isGameActive);

          const playerGuesses = guesses.map(bytes32ToString);
          const formattedStatuses = letterStatuses.map((statusArray) =>
            statusArray.map((status) => {
              if (status === 2) return "correct";
              if (status === 1) return "present";
              return "absent";
            })
          );

          let gameStatus: "playing" | "won" | "lost" = isGameActive
            ? "playing"
            : "lost";
          let targetWord: string | null = null;

          if (!isGameActive && playerGuesses.length > 0) {
            const lastGuessIndex = playerGuesses.length - 1;
            const lastStatuses = letterStatuses[lastGuessIndex] || [];
            const isWin =
              lastStatuses.length > 0 &&
              lastStatuses.every((status) => status === 2);
            gameStatus = isWin ? "won" : "lost";
            targetWord = isWin ? playerGuesses[lastGuessIndex] : null;
          }

          setGameState((prev) => ({
            ...prev,
            lastGameDay,
            guesses: playerGuesses,
            letterStatuses: formattedStatuses,
            isCorrectLength,
            currentTries: playerGuesses.length,
            currentRow: playerGuesses.length,
            isSubmittingGuess: false,
            gameStatus,
            targetWord,
            currentGuess: "", // Reset current guess after submission
          }));

          // Show victory overlay if won
          if (gameStatus === "won") {
            setShowVictoryOverlay(true);
          }

          toast.success("✅ Guess confirmed!", {
            position: "top-center",
            autoClose: 3000,
          });

          // Notify parent component about guess update
          if (onGuessUpdate) {
            onGuessUpdate();
          }
        } catch (error) {
          console.error("Error fetching updated game state:", error);
          setGameState((prev) => ({ ...prev, isSubmittingGuess: false }));
          toast.error("Failed to process guess. Please try again.", {
            position: "top-center",
            autoClose: 5000,
          });
        }
      };

      updateGameState();
      setTxHash(undefined);
    }
  }, [isReceiptSuccess, receipt, walletClient, publicClient, address]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Enter") handleKeyPress("ENTER");
      else if (e.key === "Backspace") handleKeyPress("BACKSPACE");
      else if (/^[a-zA-Z]$/.test(e.key)) handleKeyPress(e.key.toUpperCase());
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [gameState]);

  return (
    <main className="w-full max-w-md flex flex-col items-center">
      {gameState.gameStatus === "playing" && (
        <div className="mb-8">{renderCurrentGuess()}</div>
      )}
      <div className="guess-history mb-8 w-full">{renderGuessHistory()}</div>

      {showVictoryOverlay && gameState.targetWord && (
        <div className="overlay" onClick={() => setShowVictoryOverlay(false)}>
          <div className="info-box" onClick={(e) => e.stopPropagation()}>
            <button
              className="close-button"
              onClick={() => setShowVictoryOverlay(false)}
              aria-label="Close"
            >
              ×
            </button>
            <h2 className="text-center mb-2">Congratulations! </h2>
            <h3 className="text-center mb-4">
              You guessed the word: <strong>{"FAIR"}</strong>
            </h3>
            <p className="text-left">
              <strong>Introducing FAIR: The First MEV Resistant L1</strong>
              <br />
              <br />
              FAIR is a next-gen Layer 1 blockchain featuring native MEV
              resistance, an optimized EVM, and on-chain AI capabilities. It
              ensures fairness via encrypted execution using Blockchain
              Integrated Threshold Encryption (BITE) at the consensus level,
              preventing front-running, sandwich attacks, and censorship.
              <br />
              <br />
              With FAIR and BITE protocol dApps like FAIRDLE work perfectly
              since the daily random selected word as well as the players
              guesses get encrypted and it's not possible to cheat by listening
              to the mempool.
              <br />
              <br />
              Don't miss this game changing technology and learn about{" "}
              <a
                href="https://www.fairchain.ai/"
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-600 underline"
              >
                FAIR
              </a>.
            </p>
          </div>
        </div>
      )}

      {gameState.gameStatus === "lost" && (
        <div className="text-center mb-8 p-6 glass-effect rounded-lg border border-glass-border">
          <h2 className="text-2xl font-bold text-red-600 mb-2">
            Better luck next time! 😞
          </h2>
          <p className="text-text-secondary">
            You've reached the guess limit. Come back tomorrow!
          </p>
        </div>
      )}

      {gameState.isSubmittingGuess && (
        <div className="transaction-status mb-4 p-3 glass-effect rounded-lg">
          <p className="text-center text-text-secondary">
            ⏳ Submitting guess...
          </p>
        </div>
      )}

      <div className="keyboard">{renderKeyboard()}</div>
    </main>
  );
};

export default WordleGame;
