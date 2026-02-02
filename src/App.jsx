import React, { useEffect, useMemo, useRef, useState } from 'react';
import QRCode from 'qrcode';
import { io } from 'socket.io-client';
import {
  verifyHostPassword as verifyHostPasswordApi,
  startQuiz,
  resetGame,
  endGame,
  fetchGameState
} from './api.js';

const ANSWER_COLORS = ['answer-option-1', 'answer-option-2', 'answer-option-3', 'answer-option-4'];
const ANSWER_EMOJIS = ['🔴', '🔵', '🟢', '🟡'];
const SOCKET_URL =
  import.meta.env.VITE_SOCKET_URL || import.meta.env.VITE_API_BASE_URL || 'https://wedding-quiz-backend-production.up.railway.app';

function App() {
  const [screen, setScreen] = useState('home');
  const [serverGameState, setServerGameState] = useState(null);
  const [isHost, setIsHost] = useState(false);

  const [hostPassword, setHostPassword] = useState('');
  const [hostAuthError, setHostAuthError] = useState('');
  const [hostAuthLoading, setHostAuthLoading] = useState(false);

  const [playerNameInput, setPlayerNameInput] = useState('');
  const [joinError, setJoinError] = useState('');
  const [playerName, setPlayerName] = useState('');
  const [sessionToken, setSessionToken] = useState('');
  const [playerCount, setPlayerCount] = useState(0);
  const [socketConnected, setSocketConnected] = useState(false);

  const [phase, setPhase] = useState('lobby');
  const [timeLeft, setTimeLeft] = useState(0);
  const [phaseDuration, setPhaseDuration] = useState(0);
  const [currentQuestion, setCurrentQuestion] = useState(null);
  const [rankings, setRankings] = useState([]);
  const [selectedAnswer, setSelectedAnswer] = useState(null);
  const [answerFeedback, setAnswerFeedback] = useState(null);
  const [hasSubmittedAnswer, setHasSubmittedAnswer] = useState(false);

  const timerRef = useRef(null);
  const socketRef = useRef(null);
  const qrCanvasRef = useRef(null);
  const endGameRequestedRef = useRef(false);

  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const tokenFromUrl = urlParams.get('sessionToken');
    if (tokenFromUrl) {
      setSessionToken(tokenFromUrl);
      setScreen('join');
    }
  }, []);

  useEffect(() => {
    if (screen !== 'host') return;
    if (!qrCanvasRef.current) return;

    const baseUrl = window.location.href.split('?')[0];
    const joinToken = sessionToken || serverGameState?.sessionToken;
    const joinUrl = joinToken
      ? `${baseUrl}?sessionToken=${encodeURIComponent(joinToken)}`
      : `${baseUrl}?join=1`;

    QRCode.toCanvas(qrCanvasRef.current, joinUrl, { width: 220, margin: 1 }, error => {
      if (error) {
        console.error('QR code generation failed:', error);
      }
    });
  }, [screen]);

  useEffect(() => {
    if (socketRef.current) {
      socketRef.current.disconnect();
      socketRef.current = null;
    }

    const socket = io(SOCKET_URL, {
      autoConnect: false,
      auth: sessionToken ? { sessionToken } : {},
      query: sessionToken ? { sessionToken } : undefined
    });
    socketRef.current = socket;

    const handleConnect = () => setSocketConnected(true);
    const handleDisconnect = () => setSocketConnected(false);

    const handleGameState = data => {
      setServerGameState(data);
      if (typeof data.playerCount === 'number') {
        setPlayerCount(data.playerCount);
      } else if (data.players) {
        setPlayerCount(Object.keys(data.players).length);
      }
    };

    const handlePlayerListUpdate = data => {
      if (typeof data.playerCount === 'number') {
        setPlayerCount(data.playerCount);
      }
    };

    const handleQuestion = data => {
      setCurrentQuestion(data.question || null);
      setRankings([]);
      setAnswerFeedback(null);
      setSelectedAnswer(null);
      setHasSubmittedAnswer(false);
      setPhase('question');
      startTimer(data.timeLimit);
    };

    const handleResults = data => {
      setRankings(data.rankings || []);
      setPhase('results');
      startTimer(data.timeLimit);
    };

    const handleGameFinished = data => {
      setRankings(data.rankings || []);
      setPhase('finished');
      stopTimer();
    };

    const handleGameReset = () => {
      setPhase('lobby');
      setCurrentQuestion(null);
      setRankings([]);
      stopTimer();
    };

    const handleGameEnded = () => {
      setPhase('lobby');
      setCurrentQuestion(null);
      setRankings([]);
      stopTimer();
    };

    const handleRegistrationResult = data => {
      if (data.success) {
        setPlayerName(data.playerName || playerNameInput.trim());
        setJoinError('');
        setScreen('playerGame');
      } else {
        setJoinError(data.error || 'Unable to join the game.');
      }
    };

    const handleAnswerResult = data => {
      if (data.success) {
        setAnswerFeedback({
          isCorrect: data.isCorrect,
          pointsEarned: data.pointsEarned,
          timeTaken: data.timeTaken
        });
      } else {
        setAnswerFeedback({ error: data.error || 'Unable to submit answer.' });
      }
    };

    socket.on('connect', handleConnect);
    socket.on('disconnect', handleDisconnect);
    socket.on('game-state', handleGameState);
    socket.on('player-list-update', handlePlayerListUpdate);
    socket.on('question', handleQuestion);
    socket.on('results', handleResults);
    socket.on('game-finished', handleGameFinished);
    socket.on('game-reset', handleGameReset);
    socket.on('game-ended', handleGameEnded);
    socket.on('registration-result', handleRegistrationResult);
    socket.on('answer-result', handleAnswerResult);

    return () => {
      socket.off('connect', handleConnect);
      socket.off('disconnect', handleDisconnect);
      socket.off('game-state', handleGameState);
      socket.off('player-list-update', handlePlayerListUpdate);
      socket.off('question', handleQuestion);
      socket.off('results', handleResults);
      socket.off('game-finished', handleGameFinished);
      socket.off('game-reset', handleGameReset);
      socket.off('game-ended', handleGameEnded);
      socket.off('registration-result', handleRegistrationResult);
      socket.off('answer-result', handleAnswerResult);
    };
  }, [playerNameInput, sessionToken]);

  useEffect(() => {
    if (!socketRef.current) return;
    if (screen === 'host' || screen === 'hostGame') {
      connectSocket();
    }
  }, [screen, sessionToken]);

  function connectSocket() {
    if (!socketRef.current) return;
    if (!socketRef.current.connected) {
      socketRef.current.connect();
    }
  }

  function startTimer(duration) {
    const seconds = normalizeSeconds(duration);
    setTimeLeft(seconds);
    setPhaseDuration(seconds);
    clearInterval(timerRef.current);
    timerRef.current = setInterval(() => {
      setTimeLeft(prev => Math.max(prev - 1, 0));
    }, 1000);
  }

  function stopTimer() {
    clearInterval(timerRef.current);
    setTimeLeft(0);
    setPhaseDuration(0);
  }

  function normalizeSeconds(duration) {
    if (!duration) return 0;
    if (duration > 1000) {
      return Math.ceil(duration / 1000);
    }
    return Math.ceil(duration);
  }

  function showHostAuthScreen() {
    setHostPassword('');
    setHostAuthError('');
    setScreen('hostAuth');
  }

  async function verifyHostPassword() {
    const password = hostPassword.trim();
    if (!password) {
      setHostAuthError('Please enter the password.');
      return;
    }

    setHostAuthError('');
    setHostAuthLoading(true);

    try {
      const result = await verifyHostPasswordApi(password);
      if (!result.ok) {
        setHostAuthError('Incorrect password');
        return;
      }

      if (result.sessionToken) {
        setSessionToken(result.sessionToken);
      }

      setIsHost(true);
      setScreen('host');
      await fetchGameState().catch(() => {});
    } catch (error) {
      setHostAuthError(error.message || 'Unable to verify password. Try again.');
    } finally {
      setHostAuthLoading(false);
    }
  }

  async function handleStartGame() {
    setHostAuthError('');
    try {
      await startQuiz(hostPassword.trim());
      setScreen('hostGame');
      setPhase('question');
    } catch (error) {
      setHostAuthError(error.message || 'Unable to start the game.');
    }
  }

  async function handleResetGame() {
    setHostAuthError('');
    try {
      await resetGame(hostPassword.trim());
    } catch (error) {
      setHostAuthError(error.message || 'Unable to reset the game.');
    }
  }

  async function handleEndGame() {
    setHostAuthError('');
    try {
      await endGame(hostPassword.trim());
    } catch (error) {
      setHostAuthError(error.message || 'Unable to end the game.');
    }
  }

  useEffect(() => {
    if (!isHost) return;
    if (screen !== 'hostGame') return;
    if (phase !== 'finished') return;
    if (!currentQuestion?.isLast) return;
    if (endGameRequestedRef.current) return;

    endGameRequestedRef.current = true;
    handleEndGame();
  }, [isHost, screen, phase, currentQuestion]);

  function joinGame() {
    const name = playerNameInput.trim();
    if (!name) {
      setJoinError('Please enter your name');
      return;
    }
    if (!sessionToken) {
      setJoinError('Invalid QR code or missing session token.');
      return;
    }

    setJoinError('');
    connectSocket();
    const emitRegistration = () =>
      socketRef.current.emit('register-player', { playerName: name, sessionToken });
    if (socketRef.current.connected) {
      emitRegistration();
    } else {
      socketRef.current.once('connect', emitRegistration);
    }
  }

  function selectAnswer(selectedIndex) {
    if (!currentQuestion) return;
    if (hasSubmittedAnswer) return;
    const answerLetter = ['A', 'B', 'C', 'D'][selectedIndex];
    setSelectedAnswer(selectedIndex);
    setHasSubmittedAnswer(true);
    socketRef.current.emit('submit-answer', { answer: answerLetter });
  }

  const questionText = currentQuestion?.question || currentQuestion?.text || '';
  const questionAnswers = useMemo(() => {
    if (!currentQuestion) return [];
    if (Array.isArray(currentQuestion.answers)) {
      return currentQuestion.answers;
    }
    if (currentQuestion.options && typeof currentQuestion.options === 'object') {
      return ['A', 'B', 'C', 'D'].map(key => currentQuestion.options[key] || '');
    }
    return [];
  }, [currentQuestion]);
  const timerBase = phaseDuration || 30;
  const playerTimerWidth = `${(timeLeft / timerBase) * 100}%`;
  const circumference = 2 * Math.PI * 45;
  const progress = timerBase > 0 ? (timerBase - timeLeft) / timerBase : 0;
  const strokeDashoffset = circumference * (1 - Math.max(0, progress));
  const playerNames = useMemo(() => {
    const players = serverGameState?.players;
    if (Array.isArray(players)) {
      return players.map(player => player.name || player.playerName).filter(Boolean);
    }
    if (players && typeof players === 'object') {
      return Object.values(players)
        .map(player => player.name || player.playerName)
        .filter(Boolean);
    }
    return [];
  }, [serverGameState]);

  return (
    <>
      <div id="home-screen" className={`screen ${screen === 'home' ? 'active' : ''}`}>
        <div className="container">
          <h1 className="logo">🎮 Quiz Game</h1>
          <div className="button-group">
            <button className="btn btn-primary btn-large" onClick={showHostAuthScreen}>
              🎯 Host Game
            </button>
          </div>
        </div>
      </div>

      <div id="host-auth-screen" className={`screen ${screen === 'hostAuth' ? 'active' : ''}`}>
        <div className="container">
          <h2>Host Access</h2>
          <div className="input-group">
            <input
              type="password"
              value={hostPassword}
              onChange={event => setHostPassword(event.target.value)}
              placeholder="Enter Host Password"
              maxLength={6}
              pattern="[0-9]*"
              inputMode="numeric"
            />
            <button
              className="btn btn-primary btn-large"
              onClick={verifyHostPassword}
              disabled={hostAuthLoading}
            >
              {hostAuthLoading ? 'Checking...' : 'Continue'}
            </button>
          </div>
          <div className="error-message">{hostAuthError}</div>
        </div>
      </div>

      <div id="host-screen" className={`screen ${screen === 'host' ? 'active' : ''}`}>
        <div className="container">
          <h2>Host Game</h2>
          <div className="game-pin-display">
            <div className="pin-label">Scan to Join</div>
            <canvas ref={qrCanvasRef} className="qr-canvas" width="220" height="220"></canvas>
          </div>

          <div className="quiz-setup">
            <h3>Players Waiting</h3>
            <div className="leaderboard-display">
              <div className="leaderboard-item">
                <div className="leaderboard-name">Connected Players</div>
                <div className="leaderboard-score">{playerCount}</div>
              </div>
              {playerNames.length > 0 && (
                <div id="leaderboard-list">
                  {playerNames.map((name, index) => (
                    <div className="leaderboard-item" key={`${name}-${index}`}>
                      <div className="leaderboard-rank">#{index + 1}</div>
                      <div className="leaderboard-name">{name}</div>
                      <div className="leaderboard-score">Ready</div>
                    </div>
                  ))}
                </div>
              )}
            </div>
            <button className="btn btn-success btn-large" onClick={handleStartGame}>
              Start Game
            </button>
            <button className="btn btn-secondary btn-small" onClick={handleResetGame}>
              Reset Game
            </button>
            <div className="error-message">{hostAuthError}</div>
          </div>
        </div>
      </div>

      <div id="host-game-screen" className={`screen ${screen === 'hostGame' ? 'active' : ''}`}>
        <div className="container">
          <div className="game-header">
            <div className="game-info">
              <div>
                Players: <span id="player-count">{playerCount}</span>
              </div>
              <div>{socketConnected ? 'Live' : 'Connecting...'}</div>
            </div>
          </div>

          {phase === 'question' && currentQuestion && (
            <div id="question-display" className="question-display">
              <div className="question-number">Question in progress</div>
              <div className="timer-circle">
                <svg className="timer-svg" viewBox="0 0 100 100">
                  <circle className="timer-bg" cx="50" cy="50" r="45"></circle>
                  <circle
                    className="timer-progress"
                    cx="50"
                    cy="50"
                    r="45"
                    style={{
                      strokeDasharray: circumference,
                      strokeDashoffset: strokeDashoffset
                    }}
                  ></circle>
                </svg>
                <div className="timer-text" id="timer-text">
                  {timeLeft}
                </div>
              </div>
              <h2 id="question-text" className="question-text">
                {questionText}
              </h2>
              <div id="answer-options" className="answer-options">
                {questionAnswers.map((answer, index) => {
                  const optionClass = `answer-option ${ANSWER_COLORS[index]}`;
                  return (
                    <div className={optionClass} key={index}>
                      {ANSWER_EMOJIS[index]} {answer}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {phase !== 'question' && (
            <div id="leaderboard-display" className="leaderboard-display">
              <h3>{phase === 'results' ? 'Results' : 'Leaderboard'}</h3>
              <div id="leaderboard-list">
                {rankings.length === 0 && <div className="leaderboard-item">Waiting...</div>}
                {rankings.map((player, index) => (
                  <div className="leaderboard-item" key={`${player.name}-${index}`}>
                    <div className="leaderboard-rank">#{index + 1}</div>
                    <div className="leaderboard-name">{player.name}</div>
                    <div className="leaderboard-score">{player.score}</div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      <div id="join-screen" className={`screen ${screen === 'join' ? 'active' : ''}`}>
        <div className="container">
          <h2>Join Game</h2>
          <div className="input-group">
            <input
              type="text"
              value={playerNameInput}
              onChange={event => setPlayerNameInput(event.target.value)}
              placeholder="Enter Your Name"
              maxLength={20}
            />
            <button className="btn btn-primary btn-large" onClick={joinGame}>
              Join
            </button>
          </div>
          <div className="error-message">{joinError}</div>
        </div>
      </div>

      <div id="player-game-screen" className={`screen ${screen === 'playerGame' ? 'active' : ''}`}>
        <div className="container">
          <div className="player-header">
            <div className="player-name-display" id="player-name-display">
              {playerName || 'Player'}
            </div>
            <div className="player-score">{socketConnected ? 'Live' : 'Connecting...'}</div>
          </div>

          {phase === 'lobby' && (
            <div id="waiting-screen" className="waiting-screen">
              <div className="waiting-icon">⏳</div>
              <h3>Waiting for game to start...</h3>
              <div className="players-connected">
                Players connected: <span id="connected-players">{playerCount}</span>
              </div>
            </div>
          )}

          {phase === 'question' && currentQuestion && (
            <div id="question-screen" className="question-screen">
              <div className="question-number-small">
                Time left: <span id="player-q-num">{timeLeft}</span>s
              </div>
              <div className="timer-bar">
                <div className="timer-fill" id="timer-fill" style={{ width: playerTimerWidth }}></div>
              </div>
              <h2 id="player-question-text" className="question-text">
                {questionText}
              </h2>
              <div id="player-answer-options" className="answer-options-player">
                {questionAnswers.map((answer, index) => {
                  let optionClass = `answer-option-player ${ANSWER_COLORS[index]}`;
                  if (selectedAnswer === index) {
                    optionClass += ' selected';
                  }
                  return (
                    <div
                      className={optionClass}
                      key={index}
                      onClick={() => selectAnswer(index)}
                    >
                      {ANSWER_EMOJIS[index]} {answer}
                    </div>
                  );
                })}
              </div>
              {hasSubmittedAnswer && (
                <div className="players-connected">Answer submitted. Waiting for results...</div>
              )}
              {answerFeedback?.error && <div className="error-message">{answerFeedback.error}</div>}
            </div>
          )}

          {(phase === 'results' || phase === 'finished') && (
            <div id="answer-result" className="answer-result">
              <div className="result-icon" id="result-icon">
                {answerFeedback?.isCorrect ? '✅' : '🏆'}
              </div>
              <div
                className="result-text"
                id="result-text"
                style={{ color: answerFeedback?.isCorrect ? '#38ef7d' : '#667eea' }}
              >
                {answerFeedback?.isCorrect ? 'Correct!' : 'Leaderboard'}
              </div>
              <div className="result-points" id="result-points">
                {answerFeedback?.isCorrect
                  ? `+${answerFeedback.pointsEarned} points`
                  : 'Waiting for next question'}
              </div>
              <div id="leaderboard-list">
                {rankings.map((player, index) => (
                  <div className="leaderboard-item" key={`${player.name}-${index}`}>
                    <div className="leaderboard-rank">#{index + 1}</div>
                    <div className="leaderboard-name">{player.name}</div>
                    <div className="leaderboard-score">{player.score}</div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  );
}

export default App;
