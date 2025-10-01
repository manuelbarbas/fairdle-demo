// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "skale-rng/RNG.sol";

contract FairdleManager is AccessControl, RNG {
    bytes32 public constant GUESSER_ROLE = keccak256("GUESSER_ROLE");
    bytes32 public constant ADMIN = keccak256("ADMIN");

    IERC20 public paymentToken;
    uint256 public constant ENTRY_FEE = 0.0001 * 1e6; // 0.0001 USDC (6 decimals)
    uint256 public immutable maxGuesses;

    // Word management
    mapping(uint256 => bytes32) private _wordList;
    uint256 public _wordCount;
    uint256 public wordUpdateInterval = 1 days;

    // Daily game state
    bytes32 private _dailyWord;
    uint256 private _dailyWordDay;
    uint256 private _dailyWordLength; // Length of the current daily word

    bool private isPaymentOn;

    // Player state (single state per player, reset daily)
    struct DailyGameState {
        uint256 lastGameDay;
        bytes32[] guesses;
        uint8[][] letterStatuses; // Letter statuses for each guess
        bool[] isCorrectLength; // Length correctness for each guess
        bool isGameActive; // Whether the game is active
    }

    mapping(address => DailyGameState) private playerGameState;

    event GameStarted(address indexed player, uint256 currentDay);
    event GameCompleted(address indexed player, bool won);

    error InsufficientPayment();
    error InvalidWordLength();
    error GameNotActive();
    error GameAlreadyActive();

    constructor(
        address tokenAddress,
        bytes32[] memory wordList,
        uint256 maxGuessesPerGame
    ) {
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(ADMIN, msg.sender);
        paymentToken = IERC20(tokenAddress);
        maxGuesses = maxGuessesPerGame;
        addWords(wordList);
    }

    function startGame() external {
        uint256 currentDay = block.timestamp / wordUpdateInterval;

        if (_dailyWordDay < currentDay) {
            _newWord();
        }

        DailyGameState storage state = playerGameState[msg.sender];

        // Reset state if the day has changed
        if (state.lastGameDay != currentDay) {
            state.guesses = new bytes32[](0);
            state.letterStatuses = new uint8[][](0);
            state.isCorrectLength = new bool[](0);
            state.isGameActive = true;
            state.lastGameDay = currentDay;
            _grantRole(GUESSER_ROLE, msg.sender);
        } else {
            require(state.guesses.length == 0, "GameAlreadyActive");
        }

        if (isPaymentOn) {
            if (paymentToken.allowance(msg.sender, address(this)) < ENTRY_FEE) {
                revert InsufficientPayment();
            }
            paymentToken.transferFrom(msg.sender, address(this), ENTRY_FEE);
        }

        emit GameStarted(msg.sender, currentDay);
    }

    function submitGuess(bytes32 guess) external returns (uint8[] memory letterStatuses, bool isCorrectLength) {
        DailyGameState storage gameState = playerGameState[msg.sender];
        require(hasRole(GUESSER_ROLE, msg.sender), "NotActivePlayer");
        require(gameState.isGameActive, "GameNotActive");
        require(gameState.guesses.length < maxGuesses, "GuessLimitReached");

        // Check duplicate guess
        for (uint256 i = 0; i < gameState.guesses.length; i++) {
            require(gameState.guesses[i] != guess, "DuplicateGuess");
        }

        // Evaluate guess
        (letterStatuses, isCorrectLength) = evaluateGuess(guess, _dailyWord);

        // Record guess and evaluation
        gameState.guesses.push(guess);
        gameState.letterStatuses.push(letterStatuses);
        gameState.isCorrectLength.push(isCorrectLength);

        // Check win condition
        bool won = guess == _dailyWord;
        if (won) {
            gameState.isGameActive = false;
            _revokeRole(GUESSER_ROLE, msg.sender);
            emit GameCompleted(msg.sender, true);
            return (letterStatuses, isCorrectLength);
        }

        // End game if guess limit reached
        if (gameState.guesses.length == maxGuesses) {
            gameState.isGameActive = false;
            _revokeRole(GUESSER_ROLE, msg.sender);
            emit GameCompleted(msg.sender, false);
            return (letterStatuses, isCorrectLength);
        }

        return (letterStatuses, isCorrectLength);
    }

    function evaluateGuess(bytes32 guess, bytes32 target) private view returns (uint8[] memory, bool) {
        bytes memory guessBytes = bytes32ToBytes(guess);
        bytes memory targetBytes = bytes32ToBytes(target);
        uint256 guessLength = getWordLength(guess);
        bool isCorrectLength = guessLength == _dailyWordLength;

        uint8[] memory statuses = new uint8[](guessLength);


        // First pass: Mark correct letters
        for (uint256 i = 0; i < guessLength; i++) {
            if (guessBytes[i] == targetBytes[i]) {
                statuses[i] = 2; // Correct
            }
        }

        // Second pass: Mark present and absent letters
        for (uint256 i = 0; i < guessLength; i++) {
            if (statuses[i] == 2) continue; 
            bool isPresent = false;
            for (uint256 j = 0; j < _dailyWordLength; j++) {
                if (guessBytes[i] == targetBytes[j] && statuses[j] != 2) {
                    isPresent = true;
                    break;
                }
            }
            statuses[i] = isPresent ? 1 : 0; // 1 for present, 0 for absent
        }

        return (statuses, isCorrectLength);
    }

    function getWordLength(bytes32 word) private pure returns (uint256) {
        bytes memory wordBytes = bytes32ToBytes(word);
        uint256 length = 0;
        for (uint256 i = 0; i < 32; i++) {
            if (wordBytes[i] == 0) {
                break;
            }
            length++;
        }
        return length;
    }

    function bytes32ToBytes(bytes32 _bytes32) private pure returns (bytes memory) {
        bytes memory bytesArray = new bytes(32);
        for (uint256 i = 0; i < 32; i++) {
            bytesArray[i] = _bytes32[i];
        }
        return bytesArray;
    }

    function _newWord() private {
        require(_wordCount != 0, "InvalidGameState");
        uint256 randomIndex = getRandomRange(_wordCount);
        _dailyWord = _wordList[randomIndex];
        _dailyWordLength = getWordLength(_dailyWord);
        _dailyWordDay = block.timestamp / wordUpdateInterval;
    }

    function addWords(bytes32[] memory newWords) public onlyRole(ADMIN) {
        uint256 wordCountAux = _wordCount;
        for (uint256 i = 0; i < newWords.length; i++) {
            _wordList[wordCountAux] = newWords[i];
            wordCountAux++;
        }
        _wordCount = wordCountAux;
    }

    function removeWord(uint256[] memory wordIndexes) external onlyRole(ADMIN) {
        for (uint256 i = 0; i < wordIndexes.length; i++) {
            if (wordIndexes[i] < _wordCount) {
                delete _wordList[wordIndexes[i]];
            }
        }
    }

    function setWordUpdateInterval(uint256 interval) external onlyRole(ADMIN) {
        wordUpdateInterval = interval;
    }

    function forceNewDailyWord() external onlyRole(ADMIN) {
        _newWord();
    }

    function withdrawFunds(address recipient) external onlyRole(ADMIN) {
        uint256 balance = paymentToken.balanceOf(address(this));
        paymentToken.transfer(recipient, balance);
    }

    function setPaymentMode(bool mode) external onlyRole(ADMIN) {
        isPaymentOn = mode;
    }

    function getUserGameState(address player) public view returns (
        uint256 lastGameDay,
        bytes32[] memory guesses,
        uint8[][] memory letterStatuses,
        bool[] memory isCorrectLength,
        bool isGameActive
    ) {
        require(player == msg.sender, "Only the player can view their game state");
        DailyGameState memory state = playerGameState[player];
        return (
            state.lastGameDay,
            state.guesses,
            state.letterStatuses,
            state.isCorrectLength,
            state.isGameActive
        );
    }

    function getDailyWord() public view onlyRole(ADMIN) returns (bytes32) {
        return _dailyWord;
    }

    function getDailyWordLength() public view onlyRole(ADMIN) returns (uint256) {
        return _dailyWordLength;
    }

    function setTokenPayment(address newToken) public onlyRole(ADMIN) {
        paymentToken = IERC20(newToken);
    }

    function playerStatus(address player) public view returns (bool isCurrentDay, uint256 guessCount, bool hasGuesserRole) {
        uint256 currentDay = block.timestamp / wordUpdateInterval;
        DailyGameState memory state = playerGameState[player];
        return (
            state.lastGameDay == currentDay,
            state.guesses.length,
            hasRole(GUESSER_ROLE, player)
        );
    }
}