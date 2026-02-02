# Kahoot Clone - Mobile Quiz Game

A mobile-friendly, Kahoot-inspired quiz game built with HTML, CSS, and JavaScript. Perfect for interactive learning and fun quiz sessions on mobile devices.

## Features

- 🎯 **Host Mode**: Create and host quiz games with custom questions
- 📱 **Player Mode**: Join games with a PIN and answer questions
- ⏱️ **Timer**: 30-second countdown for each question
- 🏆 **Leaderboard**: Real-time scoring and rankings
- 🎨 **Beautiful UI**: Modern, colorful design optimized for mobile
- 📊 **Score Tracking**: Points awarded based on speed and correctness
- 🔄 **Real-time Updates**: Synchronized game state across devices

## How to Use

### As a Host (Teacher/Game Master)

1. Open the app on your device
2. Click "Host Game"
3. A 6-digit PIN will be generated
4. Add questions with 4 answer options each
5. Mark the correct answer for each question
6. Click "Start Game" when ready
7. Share the PIN with players
8. Questions will appear automatically
9. View the leaderboard after each question

### As a Player

1. Open the app on your device
2. Click "Join Game"
3. Enter the 6-digit PIN from the host
4. Enter your name
5. Wait for questions to appear
6. Answer questions by tapping your choice
7. See your score and ranking

## Technical Details

### Technologies
- **HTML5**: Structure and semantic markup
- **CSS3**: Modern styling with gradients, animations, and responsive design
- **Vanilla JavaScript**: Game logic and state management
- **LocalStorage**: Client-side data persistence (simulated multiplayer)

### Mobile Optimization
- Touch-friendly buttons and interactions
- Responsive design for all screen sizes
- Prevents text selection and zoom on mobile
- Optimized for portrait orientation
- Fast loading and smooth animations

### Game Flow

1. **Home Screen**: Choose to host or join
2. **Host Setup**: Create questions and generate PIN
3. **Game Start**: Host starts, players join
4. **Question Phase**: 
   - Host sees question with timer
   - Players see question and answer options
   - 30-second timer counts down
5. **Results Phase**:
   - Correct answers highlighted
   - Scores calculated
   - Leaderboard displayed
6. **Next Question**: Host proceeds to next question
7. **Final Leaderboard**: Winner announced

## File Structure

```
kahoot-clone/
├── index.html      # Main HTML structure
├── styles.css      # All styling and animations
├── app.js          # Game logic and state management
└── README.md       # This file
```

## Browser Compatibility

- ✅ Chrome/Edge (Mobile & Desktop)
- ✅ Safari (iOS)
- ✅ Firefox (Mobile & Desktop)
- ✅ Samsung Internet

## Future Enhancements

- [ ] WebSocket integration for true real-time multiplayer
- [ ] Server-side game state management
- [ ] Multiple game modes (classic, team mode, etc.)
- [ ] Question categories and difficulty levels
- [ ] Sound effects and music
- [ ] Question images and media support
- [ ] Player avatars and profiles
- [ ] Game history and statistics

## Notes

Currently, the multiplayer functionality uses localStorage for demonstration purposes. In a production environment, you would need:

- A backend server (Node.js, Python, etc.)
- WebSocket server (Socket.io, ws, etc.)
- Database for persistent game state
- User authentication system

## License

Free to use and modify for educational purposes.

## Credits

Inspired by Kahoot! - A game-based learning platform.
