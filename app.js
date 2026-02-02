// Game State
let gameState = {
    pin: null,
    questions: [],
    currentQuestion: 0,
    players: {},
    isHost: false,
    playerName: null,
    playerId: null,
    playerScore: 0,
    timer: null,
    timeLeft: 30
};

// Color mapping for answers
const answerColors = ['answer-option-1', 'answer-option-2', 'answer-option-3', 'answer-option-4'];
const answerEmojis = ['🔴', '🔵', '🟢', '🟡'];

// Screen Management
function showScreen(screenId) {
    document.querySelectorAll('.screen').forEach(screen => {
        screen.classList.remove('active');
    });
    document.getElementById(screenId).classList.add('active');
}

function showHostScreen() {
    showScreen('host-screen');
    if (!gameState.pin) {
        generateGamePin();
    }
    loadQuestions();
}

function showJoinScreen() {
    showScreen('join-screen');
    document.getElementById('join-pin').value = '';
    document.getElementById('player-name').value = '';
    document.getElementById('join-error').textContent = '';
}

// Game PIN Management
function generateGamePin() {
    gameState.pin = Math.floor(100000 + Math.random() * 900000).toString();
    document.getElementById('game-pin').textContent = gameState.pin;
    saveGameState();
}

// Question Management
function addQuestion() {
    const questionId = Date.now();
    const question = {
        id: questionId,
        text: '',
        answers: ['', '', '', ''],
        correctAnswer: 0
    };
    gameState.questions.push(question);
    saveGameState();
    renderQuestions();
}

function deleteQuestion(questionId) {
    gameState.questions = gameState.questions.filter(q => q.id !== questionId);
    saveGameState();
    renderQuestions();
    checkStartButton();
}

function updateQuestion(questionId, field, value) {
    const question = gameState.questions.find(q => q.id === questionId);
    if (question) {
        if (field === 'text') {
            question.text = value;
        } else if (field.startsWith('answer')) {
            const index = parseInt(field.split('-')[1]);
            question.answers[index] = value;
        } else if (field === 'correct') {
            question.correctAnswer = parseInt(value);
        }
        saveGameState();
        checkStartButton();
    }
}

function renderQuestions() {
    const container = document.getElementById('quiz-questions');
    container.innerHTML = '';
    
    gameState.questions.forEach((question, index) => {
        const questionDiv = document.createElement('div');
        questionDiv.className = 'question-item';
        questionDiv.innerHTML = `
            <h4>Question ${index + 1}</h4>
            <textarea 
                placeholder="Enter question text"
                oninput="updateQuestion(${question.id}, 'text', this.value)"
                value="${question.text}">${question.text}</textarea>
            ${[0, 1, 2, 3].map(i => `
                <div class="answer-option-input">
                    <input type="radio" 
                        name="correct-${question.id}" 
                        value="${i}"
                        ${question.correctAnswer === i ? 'checked' : ''}
                        onchange="updateQuestion(${question.id}, 'correct', this.value)">
                    <input type="text" 
                        placeholder="Answer ${i + 1}"
                        value="${question.answers[i]}"
                        oninput="updateQuestion(${question.id}, 'answer-${i}', this.value)">
                </div>
            `).join('')}
            <button class="delete-btn" onclick="deleteQuestion(${question.id})">Delete</button>
        `;
        container.appendChild(questionDiv);
    });
}

function checkStartButton() {
    const canStart = gameState.questions.length > 0 && 
        gameState.questions.every(q => 
            q.text.trim() && 
            q.answers.every(a => a.trim()) && 
            q.correctAnswer !== null
        );
    document.getElementById('start-btn').disabled = !canStart;
}

// Game State Persistence (using localStorage)
function saveGameState() {
    if (gameState.isHost) {
        localStorage.setItem('hostGameState', JSON.stringify({
            pin: gameState.pin,
            questions: gameState.questions,
            currentQuestion: gameState.currentQuestion,
            players: gameState.players
        }));
    }
}

function loadGameState() {
    const saved = localStorage.getItem('hostGameState');
    if (saved) {
        const state = JSON.parse(saved);
        if (state.pin === gameState.pin) {
            gameState.questions = state.questions || [];
            gameState.currentQuestion = state.currentQuestion || 0;
            gameState.players = state.players || {};
        }
    }
}

function loadQuestions() {
    loadGameState();
    renderQuestions();
    checkStartButton();
}

// Start Game (Host)
function startGame() {
    if (gameState.questions.length === 0) {
        alert('Please add at least one question!');
        return;
    }
    
    gameState.isHost = true;
    gameState.currentQuestion = 0;
    gameState.players = {};
    saveGameState();
    
    showScreen('host-game-screen');
    document.getElementById('display-pin').textContent = gameState.pin;
    showQuestion();
    
    // Simulate player connections (for demo)
    simulatePlayers();
}

function showQuestion() {
    const question = gameState.questions[gameState.currentQuestion];
    if (!question) {
        showLeaderboard();
        return;
    }
    
    document.getElementById('current-q-num').textContent = gameState.currentQuestion + 1;
    document.getElementById('total-questions').textContent = gameState.questions.length;
    document.getElementById('question-text').textContent = question.text;
    
    const optionsContainer = document.getElementById('answer-options');
    optionsContainer.innerHTML = '';
    
    question.answers.forEach((answer, index) => {
        const optionDiv = document.createElement('div');
        optionDiv.className = `answer-option ${answerColors[index]}`;
        optionDiv.textContent = `${answerEmojis[index]} ${answer}`;
        optionsContainer.appendChild(optionDiv);
    });
    
    // Start timer
    startTimer();
    
    // Broadcast question to players (simulated)
    broadcastToPlayers('question', {
        question: question,
        questionNum: gameState.currentQuestion + 1,
        totalQuestions: gameState.questions.length
    });
}

function startTimer() {
    gameState.timeLeft = 30;
    document.getElementById('timer-text').textContent = gameState.timeLeft;
    
    const timerCircle = document.querySelector('.timer-progress');
    const circumference = 2 * Math.PI * 45;
    timerCircle.style.strokeDasharray = circumference;
    
    gameState.timer = setInterval(() => {
        gameState.timeLeft--;
        document.getElementById('timer-text').textContent = gameState.timeLeft;
        
        const progress = (30 - gameState.timeLeft) / 30;
        timerCircle.style.strokeDashoffset = circumference * (1 - progress);
        
        if (gameState.timeLeft <= 0) {
            clearInterval(gameState.timer);
            endQuestion();
        }
    }, 1000);
}

function endQuestion() {
    clearInterval(gameState.timer);
    const question = gameState.questions[gameState.currentQuestion];
    
    // Show correct answer
    const options = document.querySelectorAll('.answer-option');
    options[question.correctAnswer].classList.add('correct');
    options.forEach((opt, index) => {
        if (index !== question.correctAnswer) {
            opt.classList.add('wrong');
        }
    });
    
    // Calculate scores
    calculateScores();
    
    // Show next button
    setTimeout(() => {
        document.getElementById('next-btn').style.display = 'block';
        if (gameState.currentQuestion === gameState.questions.length - 1) {
            document.getElementById('end-btn').style.display = 'block';
        }
    }, 2000);
    
    broadcastToPlayers('questionEnd', {});
}

function nextQuestion() {
    gameState.currentQuestion++;
    document.getElementById('next-btn').style.display = 'none';
    document.getElementById('end-btn').style.display = 'none';
    
    // Reset timer circle
    const timerCircle = document.querySelector('.timer-progress');
    timerCircle.style.strokeDashoffset = 0;
    
    showQuestion();
}

function calculateScores() {
    // In a real implementation, this would calculate based on player answers
    // For demo, we'll simulate some scores
    Object.keys(gameState.players).forEach(playerId => {
        const player = gameState.players[playerId];
        // Simulate random scoring
        if (Math.random() > 0.3) {
            const points = Math.floor(1000 + Math.random() * 2000);
            player.score += points;
        }
    });
    saveGameState();
    updatePlayerCount();
}

function showLeaderboard() {
    document.getElementById('question-display').style.display = 'none';
    document.getElementById('leaderboard-display').style.display = 'block';
    
    const leaderboard = Object.values(gameState.players)
        .sort((a, b) => b.score - a.score)
        .slice(0, 10);
    
    const listContainer = document.getElementById('leaderboard-list');
    listContainer.innerHTML = '';
    
    leaderboard.forEach((player, index) => {
        const item = document.createElement('div');
        item.className = 'leaderboard-item';
        item.innerHTML = `
            <div class="leaderboard-rank">#${index + 1}</div>
            <div class="leaderboard-name">${player.name}</div>
            <div class="leaderboard-score">${player.score}</div>
        `;
        listContainer.appendChild(item);
    });
}

function endGame() {
    showLeaderboard();
    document.getElementById('next-btn').style.display = 'none';
    document.getElementById('end-btn').style.display = 'none';
}

function updatePlayerCount() {
    document.getElementById('player-count').textContent = Object.keys(gameState.players).length;
}

// Player Functions
function joinGame() {
    const pin = document.getElementById('join-pin').value;
    const name = document.getElementById('player-name').value.trim();
    
    if (!pin || pin.length !== 6) {
        document.getElementById('join-error').textContent = 'Please enter a valid 6-digit PIN';
        return;
    }
    
    if (!name) {
        document.getElementById('join-error').textContent = 'Please enter your name';
        return;
    }
    
    // Check if game exists (in real app, this would check server)
    const savedState = localStorage.getItem('hostGameState');
    if (!savedState) {
        document.getElementById('join-error').textContent = 'Game not found. Please check the PIN.';
        return;
    }
    
    const state = JSON.parse(savedState);
    if (state.pin !== pin) {
        document.getElementById('join-error').textContent = 'Invalid PIN. Please check and try again.';
        return;
    }
    
    gameState.pin = pin;
    gameState.playerName = name;
    gameState.playerId = Date.now().toString();
    gameState.isHost = false;
    gameState.playerScore = 0;
    
    // Add player to game (simulated)
    if (!state.players) state.players = {};
    state.players[gameState.playerId] = {
        name: name,
        score: 0
    };
    localStorage.setItem('hostGameState', JSON.stringify(state));
    
    showScreen('player-game-screen');
    document.getElementById('player-name-display').textContent = name;
    document.getElementById('player-score').textContent = '0';
    
    // Listen for questions
    listenForQuestions();
}

function listenForQuestions() {
    // Poll for game updates (in real app, use WebSockets)
    const pollInterval = setInterval(() => {
        const savedState = localStorage.getItem('hostGameState');
        if (savedState) {
            const state = JSON.parse(savedState);
            if (state.pin === gameState.pin) {
                const question = state.questions && state.questions[state.currentQuestion];
                if (question) {
                    showPlayerQuestion(question, state.currentQuestion + 1, state.questions.length);
                }
            }
        }
    }, 500);
    
    // Store interval ID for cleanup
    gameState.pollInterval = pollInterval;
}

function showPlayerQuestion(question, questionNum, totalQuestions) {
    document.getElementById('waiting-screen').style.display = 'none';
    document.getElementById('question-screen').style.display = 'block';
    document.getElementById('answer-result').style.display = 'none';
    
    document.getElementById('player-q-num').textContent = questionNum;
    document.getElementById('player-question-text').textContent = question.text;
    
    const optionsContainer = document.getElementById('player-answer-options');
    optionsContainer.innerHTML = '';
    
    question.answers.forEach((answer, index) => {
        const optionDiv = document.createElement('div');
        optionDiv.className = `answer-option-player ${answerColors[index]}`;
        optionDiv.textContent = `${answerEmojis[index]} ${answer}`;
        optionDiv.onclick = () => selectAnswer(index, question.correctAnswer);
        optionsContainer.appendChild(optionDiv);
    });
    
    // Start player timer
    startPlayerTimer();
}

function startPlayerTimer() {
    let timeLeft = 30;
    const timerFill = document.getElementById('timer-fill');
    
    const timer = setInterval(() => {
        timeLeft--;
        timerFill.style.width = `${(timeLeft / 30) * 100}%`;
        
        if (timeLeft <= 0) {
            clearInterval(timer);
            showAnswerResult(false, 0);
        }
    }, 1000);
    
    gameState.playerTimer = timer;
}

function selectAnswer(selectedIndex, correctIndex) {
    clearInterval(gameState.playerTimer);
    
    const isCorrect = selectedIndex === correctIndex;
    const points = isCorrect ? Math.floor(1000 + Math.random() * 2000) : 0;
    
    if (isCorrect) {
        gameState.playerScore += points;
        document.getElementById('player-score').textContent = gameState.playerScore;
    }
    
    // Update selected answer visual
    document.querySelectorAll('.answer-option-player').forEach((opt, index) => {
        opt.classList.remove('selected');
        if (index === selectedIndex) {
            opt.classList.add('selected');
        }
    });
    
    // Show result after a delay
    setTimeout(() => {
        showAnswerResult(isCorrect, points);
    }, 500);
}

function showAnswerResult(isCorrect, points) {
    document.getElementById('question-screen').style.display = 'none';
    document.getElementById('answer-result').style.display = 'block';
    
    const resultIcon = document.getElementById('result-icon');
    const resultText = document.getElementById('result-text');
    const resultPoints = document.getElementById('result-points');
    
    if (isCorrect) {
        resultIcon.textContent = '✅';
        resultText.textContent = 'Correct!';
        resultText.style.color = '#38ef7d';
        resultPoints.textContent = `+${points} points`;
    } else {
        resultIcon.textContent = '❌';
        resultText.textContent = 'Wrong Answer';
        resultText.style.color = '#dc3545';
        resultPoints.textContent = '+0 points';
    }
    
    // Wait for next question
    setTimeout(() => {
        document.getElementById('waiting-screen').style.display = 'block';
        document.getElementById('answer-result').style.display = 'none';
    }, 3000);
}

// Broadcast functions (simulated - in real app, use WebSockets)
function broadcastToPlayers(event, data) {
    // In a real implementation, this would send to all connected players via WebSocket
    // For now, we rely on polling from the player side
}

function simulatePlayers() {
    // Simulate some players joining (for demo purposes)
    setTimeout(() => {
        if (Math.random() > 0.5) {
            const playerId = 'demo-' + Date.now();
            gameState.players[playerId] = {
                name: 'Demo Player ' + Object.keys(gameState.players).length,
                score: 0
            };
            saveGameState();
            updatePlayerCount();
        }
    }, 2000);
}

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    // Check if returning to a game
    const savedState = localStorage.getItem('hostGameState');
    if (savedState) {
        const state = JSON.parse(savedState);
        if (state.pin) {
            gameState.pin = state.pin;
            document.getElementById('game-pin').textContent = state.pin;
        }
    }
});
