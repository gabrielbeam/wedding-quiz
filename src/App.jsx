import React, { useEffect, useMemo, useRef, useState } from 'react';
import QRCode from 'qrcode';

const HOST_PASSWORD = '280226';
const ANSWER_COLORS = ['answer-option-1', 'answer-option-2', 'answer-option-3', 'answer-option-4'];
const ANSWER_EMOJIS = ['🔴', '🔵', '🟢', '🟡'];

const initialGameState = {
  pin: null,
  questions: [],
  currentQuestion: 0,
  players: {},
  isHost: false,
  playerName: null,
  playerId: null,
  playerScore: 0
};

function App() {
  const [screen, setScreen] = useState('home');
  const [gameState, setGameState] = useState(initialGameState);

  const [hostPassword, setHostPassword] = useState('');
  const [hostAuthError, setHostAuthError] = useState('');

  const [pinInput, setPinInput] = useState('');
  const [playerNameInput, setPlayerNameInput] = useState('');
  const [joinError, setJoinError] = useState('');

  const [timeLeft, setTimeLeft] = useState(30);
  const [questionEnded, setQuestionEnded] = useState(false);
  const [showNext, setShowNext] = useState(false);
  const [showEnd, setShowEnd] = useState(false);
  const [leaderboardVisible, setLeaderboardVisible] = useState(false);

  const [playerView, setPlayerView] = useState('waiting');
  const [playerQuestion, setPlayerQuestion] = useState(null);
  const [playerQuestionNum, setPlayerQuestionNum] = useState(1);
  const [playerTotalQuestions, setPlayerTotalQuestions] = useState(0);
  const [playerTimeLeft, setPlayerTimeLeft] = useState(30);
  const [playerResult, setPlayerResult] = useState({ isCorrect: false, points: 0 });
  const [selectedAnswer, setSelectedAnswer] = useState(null);
  const [connectedPlayers, setConnectedPlayers] = useState(0);

  const hostTimerRef = useRef(null);
  const hostNextTimeoutRef = useRef(null);
  const playerTimerRef = useRef(null);
  const playerViewTimeoutRef = useRef(null);
  const gameStateRef = useRef(gameState);
  const qrCanvasRef = useRef(null);
  const lastQuestionIdRef = useRef(null);

  useEffect(() => {
    gameStateRef.current = gameState;
  }, [gameState]);

  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const pinFromUrl = urlParams.get('pin');
    if (pinFromUrl) {
      setScreen('join');
      setPinInput(pinFromUrl);
    }

    const savedState = localStorage.getItem('hostGameState');
    if (savedState) {
      const state = JSON.parse(savedState);
      if (state.pin) {
        setGameState(prev => ({ ...prev, pin: state.pin }));
      }
    }
  }, []);

  useEffect(() => {
    if (screen !== 'host') return;
    if (!gameState.pin) {
      generateGamePin();
    }
  }, [screen, gameState.pin]);

  useEffect(() => {
    if (screen !== 'host' || !gameState.pin) return;
    if (!qrCanvasRef.current) return;

    const baseUrl = window.location.href.split('?')[0];
    const joinUrl = `${baseUrl}?pin=${encodeURIComponent(gameState.pin)}`;

    QRCode.toCanvas(qrCanvasRef.current, joinUrl, { width: 220, margin: 1 }, error => {
      if (error) {
        console.error('QR code generation failed:', error);
      }
    });
  }, [screen, gameState.pin]);

  useEffect(() => {
    if (screen !== 'hostGame') return;

    const question = gameState.questions[gameState.currentQuestion];
    if (!question) {
      setLeaderboardVisible(true);
      clearInterval(hostTimerRef.current);
      return;
    }

    setLeaderboardVisible(false);
    setQuestionEnded(false);
    setShowNext(false);
    setShowEnd(false);
    setTimeLeft(30);

    clearInterval(hostTimerRef.current);
    hostTimerRef.current = setInterval(() => {
      setTimeLeft(prev => prev - 1);
    }, 1000);

    return () => clearInterval(hostTimerRef.current);
  }, [screen, gameState.currentQuestion, gameState.questions]);

  useEffect(() => {
    if (screen !== 'hostGame' || leaderboardVisible) return;
    if (timeLeft > 0 || questionEnded) return;
    endQuestion();
  }, [timeLeft, screen, leaderboardVisible, questionEnded]);

  useEffect(() => {
    if (screen !== 'playerGame') return;

    const pollInterval = setInterval(() => {
      const savedState = localStorage.getItem('hostGameState');
      if (!savedState) return;
      const state = JSON.parse(savedState);
      if (state.pin !== gameStateRef.current.pin) return;

      setConnectedPlayers(Object.keys(state.players || {}).length);

      const question = state.questions && state.questions[state.currentQuestion];
      if (question && question.id !== lastQuestionIdRef.current) {
        lastQuestionIdRef.current = question.id;
        setPlayerQuestion(question);
        setPlayerQuestionNum(state.currentQuestion + 1);
        setPlayerTotalQuestions(state.questions.length);
        setPlayerView('question');
        setSelectedAnswer(null);
      }
    }, 500);

    return () => clearInterval(pollInterval);
  }, [screen]);

  useEffect(() => {
    if (screen !== 'playerGame' || playerView !== 'question') return;

    clearInterval(playerTimerRef.current);
    setPlayerTimeLeft(30);

    playerTimerRef.current = setInterval(() => {
      setPlayerTimeLeft(prev => prev - 1);
    }, 1000);

    return () => clearInterval(playerTimerRef.current);
  }, [screen, playerView, playerQuestion]);

  useEffect(() => {
    if (screen !== 'playerGame' || playerView !== 'question') return;
    if (playerTimeLeft > 0) return;

    clearInterval(playerTimerRef.current);
    showAnswerResult(false, 0);
  }, [playerTimeLeft, screen, playerView]);

  function saveHostGameState(state) {
    if (!state.isHost) return;
    localStorage.setItem(
      'hostGameState',
      JSON.stringify({
        pin: state.pin,
        questions: state.questions,
        currentQuestion: state.currentQuestion,
        players: state.players
      })
    );
  }

  function showHostAuthScreen() {
    setHostPassword('');
    setHostAuthError('');
    setScreen('hostAuth');
  }

  function verifyHostPassword() {
    if (hostPassword.trim() !== HOST_PASSWORD) {
      setHostAuthError('Incorrect password');
      return;
    }
    setHostAuthError('');
    setScreen('host');
  }

  function generateGamePin() {
    const pin = Math.floor(100000 + Math.random() * 900000).toString();
    setGameState(prev => {
      const next = { ...prev, pin };
      return next;
    });
  }

  function addQuestion() {
    const questionId = Date.now();
    const question = {
      id: questionId,
      text: '',
      answers: ['', '', '', ''],
      correctAnswer: 0
    };
    setGameState(prev => ({ ...prev, questions: [...prev.questions, question] }));
  }

  function deleteQuestion(questionId) {
    setGameState(prev => ({
      ...prev,
      questions: prev.questions.filter(q => q.id !== questionId)
    }));
  }

  function updateQuestion(questionId, field, value) {
    setGameState(prev => ({
      ...prev,
      questions: prev.questions.map(question => {
        if (question.id !== questionId) return question;
        if (field === 'text') {
          return { ...question, text: value };
        }
        if (field.startsWith('answer')) {
          const index = Number(field.split('-')[1]);
          const answers = [...question.answers];
          answers[index] = value;
          return { ...question, answers };
        }
        if (field === 'correct') {
          return { ...question, correctAnswer: Number(value) };
        }
        return question;
      })
    }));
  }

  const canStart = useMemo(() => {
    if (!gameState.questions.length) return false;
    return gameState.questions.every(
      q => q.text.trim() && q.answers.every(a => a.trim()) && q.correctAnswer !== null
    );
  }, [gameState.questions]);

  function startGame() {
    if (!gameState.questions.length) {
      window.alert('Please add at least one question!');
      return;
    }

    setGameState(prev => {
      const next = {
        ...prev,
        isHost: true,
        currentQuestion: 0,
        players: {}
      };
      saveHostGameState(next);
      return next;
    });

    setScreen('hostGame');
    setLeaderboardVisible(false);
    setQuestionEnded(false);
    setShowNext(false);
    setShowEnd(false);

    simulatePlayers();
  }

  function calculateScores() {
    setGameState(prev => {
      const players = { ...prev.players };
      Object.keys(players).forEach(playerId => {
        if (Math.random() > 0.3) {
          const points = Math.floor(1000 + Math.random() * 2000);
          players[playerId] = { ...players[playerId], score: players[playerId].score + points };
        }
      });

      const next = { ...prev, players };
      saveHostGameState(next);
      return next;
    });
  }

  function endQuestion() {
    clearInterval(hostTimerRef.current);
    setQuestionEnded(true);
    calculateScores();

    clearTimeout(hostNextTimeoutRef.current);
    hostNextTimeoutRef.current = setTimeout(() => {
      setShowNext(true);
      if (gameStateRef.current.currentQuestion === gameStateRef.current.questions.length - 1) {
        setShowEnd(true);
      }
    }, 2000);
  }

  function nextQuestion() {
    setGameState(prev => ({ ...prev, currentQuestion: prev.currentQuestion + 1 }));
    setQuestionEnded(false);
    setShowNext(false);
    setShowEnd(false);
  }

  function endGame() {
    setLeaderboardVisible(true);
    setShowNext(false);
    setShowEnd(false);
  }

  function joinGame() {
    const pin = pinInput.trim();
    const name = playerNameInput.trim();

    if (!pin || pin.length !== 6) {
      setJoinError('Please enter a valid 6-digit PIN');
      return;
    }

    if (!name) {
      setJoinError('Please enter your name');
      return;
    }

    const savedState = localStorage.getItem('hostGameState');
    if (!savedState) {
      setJoinError('Game not found. Please check the PIN.');
      return;
    }

    const state = JSON.parse(savedState);
    if (state.pin !== pin) {
      setJoinError('Invalid PIN. Please check and try again.');
      return;
    }

    const playerId = Date.now().toString();
    if (!state.players) state.players = {};
    state.players[playerId] = { name, score: 0 };
    localStorage.setItem('hostGameState', JSON.stringify(state));

    setGameState(prev => ({
      ...prev,
      pin,
      playerName: name,
      playerId,
      isHost: false,
      playerScore: 0
    }));

    setPlayerView('waiting');
    lastQuestionIdRef.current = null;
    setScreen('playerGame');
  }

  function selectAnswer(selectedIndex) {
    clearInterval(playerTimerRef.current);

    const correctIndex = playerQuestion.correctAnswer;
    const isCorrect = selectedIndex === correctIndex;
    const points = isCorrect ? Math.floor(1000 + Math.random() * 2000) : 0;

    if (isCorrect) {
      setGameState(prev => ({ ...prev, playerScore: prev.playerScore + points }));
    }

    setSelectedAnswer(selectedIndex);

    clearTimeout(playerViewTimeoutRef.current);
    playerViewTimeoutRef.current = setTimeout(() => {
      showAnswerResult(isCorrect, points);
    }, 500);
  }

  function showAnswerResult(isCorrect, points) {
    setPlayerResult({ isCorrect, points });
    setPlayerView('result');

    clearTimeout(playerViewTimeoutRef.current);
    playerViewTimeoutRef.current = setTimeout(() => {
      setPlayerView('waiting');
    }, 3000);
  }

  function simulatePlayers() {
    setTimeout(() => {
      if (Math.random() > 0.5) {
        setGameState(prev => {
          const playerId = `demo-${Date.now()}`;
          const players = {
            ...prev.players,
            [playerId]: {
              name: `Demo Player ${Object.keys(prev.players).length}`,
              score: 0
            }
          };
          const next = { ...prev, players };
          saveHostGameState(next);
          return next;
        });
      }
    }, 2000);
  }

  const currentQuestion = gameState.questions[gameState.currentQuestion];
  const playerTimerWidth = `${(playerTimeLeft / 30) * 100}%`;
  const circumference = 2 * Math.PI * 45;
  const progress = (30 - timeLeft) / 30;
  const strokeDashoffset = circumference * (1 - Math.max(0, progress));

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
            <button className="btn btn-primary btn-large" onClick={verifyHostPassword}>
              Continue
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
            <div className="pin-label">Or enter PIN</div>
            <div id="game-pin" className="pin-value">
              {gameState.pin || '----'}
            </div>
            <button className="btn btn-small" onClick={generateGamePin}>
              Generate PIN
            </button>
          </div>

          <div className="quiz-setup">
            <h3>Create Quiz</h3>
            <div id="quiz-questions">
              {gameState.questions.map((question, index) => (
                <div className="question-item" key={question.id}>
                  <h4>Question {index + 1}</h4>
                  <textarea
                    placeholder="Enter question text"
                    value={question.text}
                    onChange={event => updateQuestion(question.id, 'text', event.target.value)}
                  ></textarea>
                  {[0, 1, 2, 3].map(i => (
                    <div className="answer-option-input" key={i}>
                      <input
                        type="radio"
                        name={`correct-${question.id}`}
                        value={i}
                        checked={question.correctAnswer === i}
                        onChange={event =>
                          updateQuestion(question.id, 'correct', event.target.value)
                        }
                      />
                      <input
                        type="text"
                        placeholder={`Answer ${i + 1}`}
                        value={question.answers[i]}
                        onChange={event =>
                          updateQuestion(question.id, `answer-${i}`, event.target.value)
                        }
                      />
                    </div>
                  ))}
                  <button className="delete-btn" onClick={() => deleteQuestion(question.id)}>
                    Delete
                  </button>
                </div>
              ))}
            </div>
            <button className="btn btn-primary" onClick={addQuestion}>
              + Add Question
            </button>
            <button
              className="btn btn-success btn-large"
              onClick={startGame}
              disabled={!canStart}
            >
              Start Game
            </button>
          </div>
        </div>
      </div>

      <div id="host-game-screen" className={`screen ${screen === 'hostGame' ? 'active' : ''}`}>
        <div className="container">
          <div className="game-header">
            <div className="game-info">
              <div>
                PIN: <span id="display-pin">{gameState.pin || ''}</span>
              </div>
              <div>
                Players: <span id="player-count">{Object.keys(gameState.players).length}</span>
              </div>
            </div>
          </div>

          {!leaderboardVisible && currentQuestion && (
            <div id="question-display" className="question-display">
              <div className="question-number">
                Question <span id="current-q-num">{gameState.currentQuestion + 1}</span> of{' '}
                <span id="total-questions">{gameState.questions.length}</span>
              </div>
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
                  {Math.max(0, timeLeft)}
                </div>
              </div>
              <h2 id="question-text" className="question-text">
                {currentQuestion.text}
              </h2>
              <div id="answer-options" className="answer-options">
                {currentQuestion.answers.map((answer, index) => {
                  let optionClass = `answer-option ${ANSWER_COLORS[index]}`;
                  if (questionEnded) {
                    optionClass += index === currentQuestion.correctAnswer ? ' correct' : ' wrong';
                  }
                  return (
                    <div className={optionClass} key={index}>
                      {ANSWER_EMOJIS[index]} {answer}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {(leaderboardVisible || !currentQuestion) && (
            <div id="leaderboard-display" className="leaderboard-display">
              <h3>Leaderboard</h3>
              <div id="leaderboard-list">
                {Object.values(gameState.players)
                  .sort((a, b) => b.score - a.score)
                  .slice(0, 10)
                  .map((player, index) => (
                    <div className="leaderboard-item" key={`${player.name}-${index}`}>
                      <div className="leaderboard-rank">#{index + 1}</div>
                      <div className="leaderboard-name">{player.name}</div>
                      <div className="leaderboard-score">{player.score}</div>
                    </div>
                  ))}
              </div>
              {showNext && (
                <button className="btn btn-primary" onClick={nextQuestion} id="next-btn">
                  Next Question
                </button>
              )}
              {showEnd && (
                <button className="btn btn-success" onClick={endGame} id="end-btn">
                  End Game
                </button>
              )}
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
              value={pinInput}
              onChange={event => setPinInput(event.target.value)}
              placeholder="Enter Game PIN"
              maxLength={6}
              pattern="[0-9]*"
              inputMode="numeric"
            />
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
              {gameState.playerName || ''}
            </div>
            <div className="player-score">
              Score: <span id="player-score">{gameState.playerScore}</span>
            </div>
          </div>

          {playerView === 'waiting' && (
            <div id="waiting-screen" className="waiting-screen">
              <div className="waiting-icon">⏳</div>
              <h3>Waiting for question...</h3>
              <div className="players-connected">
                Players connected: <span id="connected-players">{connectedPlayers}</span>
              </div>
            </div>
          )}

          {playerView === 'question' && playerQuestion && (
            <div id="question-screen" className="question-screen">
              <div className="question-number-small">
                Question <span id="player-q-num">{playerQuestionNum}</span> of{' '}
                <span>{playerTotalQuestions}</span>
              </div>
              <div className="timer-bar">
                <div className="timer-fill" id="timer-fill" style={{ width: playerTimerWidth }}></div>
              </div>
              <h2 id="player-question-text" className="question-text">
                {playerQuestion.text}
              </h2>
              <div id="player-answer-options" className="answer-options-player">
                {playerQuestion.answers.map((answer, index) => {
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
            </div>
          )}

          {playerView === 'result' && (
            <div id="answer-result" className="answer-result">
              <div className="result-icon" id="result-icon">
                {playerResult.isCorrect ? '✅' : '❌'}
              </div>
              <div
                className="result-text"
                id="result-text"
                style={{ color: playerResult.isCorrect ? '#38ef7d' : '#dc3545' }}
              >
                {playerResult.isCorrect ? 'Correct!' : 'Wrong Answer'}
              </div>
              <div className="result-points" id="result-points">
                {playerResult.isCorrect ? `+${playerResult.points} points` : '+0 points'}
              </div>
            </div>
          )}
        </div>
      </div>

    </>
  );
}

export default App;
