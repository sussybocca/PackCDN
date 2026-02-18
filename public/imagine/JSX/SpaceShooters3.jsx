import React, { useRef, useEffect, useState } from 'react';

/**
 * SpaceShooters 3 - Advanced React component for a canvas-based space shooter game.
 * Features: player movement, shooting, alien waves, enemy bullets, collision detection,
 * scoring, lives, game over/win screens, and restart functionality.
 */
const SpaceShooters3 = () => {
  // Canvas dimensions
  const CANVAS_WIDTH = 800;
  const CANVAS_HEIGHT = 600;

  // Player settings
  const PLAYER_WIDTH = 50;
  const PLAYER_HEIGHT = 30;
  const PLAYER_SPEED = 5;

  // Alien settings
  const ALIEN_ROWS = 4;
  const ALIEN_COLS = 8;
  const ALIEN_WIDTH = 40;
  const ALIEN_HEIGHT = 30;
  const ALIEN_SPACING = 10;
  const ALIEN_BASE_SPEED = 1.5;

  // Bullet settings
  const BULLET_WIDTH = 4;
  const BULLET_HEIGHT = 12;
  const PLAYER_BULLET_SPEED = -7; // upward
  const ENEMY_BULLET_SPEED = 5;    // downward
  const PLAYER_SHOT_COOLDOWN = 250; // milliseconds
  const ENEMY_SHOT_COOLDOWN = 800;  // milliseconds

  // Refs for mutable game state (avoids re-renders on every frame)
  const canvasRef = useRef(null);
  const animationRef = useRef(null);
  const gameStateRef = useRef({
    playerX: CANVAS_WIDTH / 2 - PLAYER_WIDTH / 2,
    aliens: [],
    bullets: [],         // player bullets
    enemyBullets: [],    // enemy bullets
    alienDirection: 1,   // 1 = right, -1 = left
    alienMoveDown: false,
    lastShotTime: 0,
    lastEnemyShotTime: 0,
    gameActive: true,
    score: 0,
    lives: 3,
    win: false,
    gameOver: false,
  });

  // React state for UI elements that need to update (score, lives, game status)
  const [score, setScore] = useState(0);
  const [lives, setLives] = useState(3);
  const [gameStatus, setGameStatus] = useState('playing'); // 'playing', 'gameover', 'win'

  // Key press flags
  const keysPressed = useRef({
    left: false,
    right: false,
    space: false,
  });

  // Initialize alien grid
  const createAliens = () => {
    const aliens = [];
    const startX = (CANVAS_WIDTH - (ALIEN_COLS * (ALIEN_WIDTH + ALIEN_SPACING))) / 2;
    const startY = 50;
    for (let row = 0; row < ALIEN_ROWS; row++) {
      for (let col = 0; col < ALIEN_COLS; col++) {
        aliens.push({
          x: startX + col * (ALIEN_WIDTH + ALIEN_SPACING),
          y: startY + row * (ALIEN_HEIGHT + ALIEN_SPACING),
          width: ALIEN_WIDTH,
          height: ALIEN_HEIGHT,
          alive: true,
          points: (ALIEN_ROWS - row) * 10, // more points for higher rows
        });
      }
    }
    return aliens;
  };

  // Reset game to initial state
  const restartGame = () => {
    gameStateRef.current = {
      playerX: CANVAS_WIDTH / 2 - PLAYER_WIDTH / 2,
      aliens: createAliens(),
      bullets: [],
      enemyBullets: [],
      alienDirection: 1,
      alienMoveDown: false,
      lastShotTime: 0,
      lastEnemyShotTime: 0,
      gameActive: true,
      score: 0,
      lives: 3,
      win: false,
      gameOver: false,
    };
    setScore(0);
    setLives(3);
    setGameStatus('playing');
    keysPressed.current = { left: false, right: false, space: false };
  };

  // Collision detection helper
  const rectCollide = (r1, r2) => {
    return r1.x < r2.x + r2.width &&
           r1.x + r1.width > r2.x &&
           r1.y < r2.y + r2.height &&
           r1.y + r1.height > r2.y;
  };

  // Game loop
  const gameLoop = (timestamp) => {
    const state = gameStateRef.current;
    const ctx = canvasRef.current?.getContext('2d');
    if (!ctx || !state.gameActive) return;

    // 1. Handle player movement
    if (keysPressed.current.left && state.playerX > 0) {
      state.playerX -= PLAYER_SPEED;
    }
    if (keysPressed.current.right && state.playerX < CANVAS_WIDTH - PLAYER_WIDTH) {
      state.playerX += PLAYER_SPEED;
    }

    // 2. Handle shooting (player)
    if (keysPressed.current.space && timestamp - state.lastShotTime > PLAYER_SHOT_COOLDOWN) {
      state.bullets.push({
        x: state.playerX + PLAYER_WIDTH / 2 - BULLET_WIDTH / 2,
        y: CANVAS_HEIGHT - PLAYER_HEIGHT - BULLET_HEIGHT - 5,
        width: BULLET_WIDTH,
        height: BULLET_HEIGHT,
        active: true,
      });
      state.lastShotTime = timestamp;
    }

    // 3. Update player bullets
    state.bullets = state.bullets.filter(b => b.active && b.y + b.height > 0);
    state.bullets.forEach(b => b.y += PLAYER_BULLET_SPEED);

    // 4. Update aliens movement
    const aliens = state.aliens.filter(a => a.alive);
    if (aliens.length === 0) {
      // Win condition
      state.gameActive = false;
      state.win = true;
      setGameStatus('win');
    } else {
      // Move aliens
      let moveDown = false;
      aliens.forEach(alien => {
        alien.x += state.alienDirection * ALIEN_BASE_SPEED;
        // Check if any alien hits the edge
        if (state.alienDirection === 1 && alien.x + alien.width >= CANVAS_WIDTH - 10) {
          state.alienDirection = -1;
          moveDown = true;
        } else if (state.alienDirection === -1 && alien.x <= 10) {
          state.alienDirection = 1;
          moveDown = true;
        }
      });

      if (moveDown) {
        aliens.forEach(alien => alien.y += ALIEN_HEIGHT / 2);
      }

      // Check if aliens reached the bottom (game over)
      aliens.forEach(alien => {
        if (alien.y + alien.height >= CANVAS_HEIGHT - PLAYER_HEIGHT - 20) {
          state.gameActive = false;
          state.gameOver = true;
          setGameStatus('gameover');
        }
      });
    }

    // 5. Enemy shooting
    if (aliens.length > 0 && timestamp - state.lastEnemyShotTime > ENEMY_SHOT_COOLDOWN) {
      // Random alien shoots
      const shooter = aliens[Math.floor(Math.random() * aliens.length)];
      state.enemyBullets.push({
        x: shooter.x + shooter.width / 2 - BULLET_WIDTH / 2,
        y: shooter.y + shooter.height,
        width: BULLET_WIDTH,
        height: BULLET_HEIGHT,
        active: true,
      });
      state.lastEnemyShotTime = timestamp;
    }

    // 6. Update enemy bullets
    state.enemyBullets = state.enemyBullets.filter(b => b.active && b.y < CANVAS_HEIGHT);
    state.enemyBullets.forEach(b => b.y += ENEMY_BULLET_SPEED);

    // 7. Collision detection: player bullets vs aliens
    state.bullets.forEach(bullet => {
      aliens.forEach(alien => {
        if (bullet.active && alien.alive && rectCollide(bullet, alien)) {
          bullet.active = false;
          alien.alive = false;
          state.score += alien.points;
          setScore(state.score);
        }
      });
    });

    // 8. Collision detection: enemy bullets vs player
    const playerRect = {
      x: state.playerX,
      y: CANVAS_HEIGHT - PLAYER_HEIGHT - 10,
      width: PLAYER_WIDTH,
      height: PLAYER_HEIGHT,
    };
    state.enemyBullets.forEach(bullet => {
      if (bullet.active && rectCollide(bullet, playerRect)) {
        bullet.active = false;
        state.lives -= 1;
        setLives(state.lives);
        if (state.lives <= 0) {
          state.gameActive = false;
          state.gameOver = true;
          setGameStatus('gameover');
        }
      }
    });

    // 9. Collision detection: aliens vs player
    aliens.forEach(alien => {
      if (alien.alive && rectCollide(alien, playerRect)) {
        state.gameActive = false;
        state.gameOver = true;
        setGameStatus('gameover');
      }
    });

    // 10. Clean up inactive bullets
    state.bullets = state.bullets.filter(b => b.active);
    state.enemyBullets = state.enemyBullets.filter(b => b.active);

    // 11. Draw everything
    draw(ctx, state);

    // Continue loop if game is active
    if (state.gameActive) {
      animationRef.current = requestAnimationFrame(gameLoop);
    }
  };

  // Drawing function
  const draw = (ctx, state) => {
    ctx.clearRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

    // Draw stars (background)
    ctx.fillStyle = '#111';
    ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
    ctx.fillStyle = '#fff';
    for (let i = 0; i < 100; i++) {
      if (i % 2 === 0) continue; // lazy random
      ctx.fillRect(Math.random() * CANVAS_WIDTH, Math.random() * CANVAS_HEIGHT, 2, 2);
    }

    // Draw player
    ctx.fillStyle = '#0af';
    ctx.fillRect(state.playerX, CANVAS_HEIGHT - PLAYER_HEIGHT - 10, PLAYER_WIDTH, PLAYER_HEIGHT);
    // Add a little cockpit
    ctx.fillStyle = '#fff';
    ctx.fillRect(state.playerX + PLAYER_WIDTH/2 - 5, CANVAS_HEIGHT - PLAYER_HEIGHT - 15, 10, 10);

    // Draw aliens (only alive ones)
    state.aliens.filter(a => a.alive).forEach(alien => {
      ctx.fillStyle = '#f0f';
      ctx.fillRect(alien.x, alien.y, alien.width, alien.height);
      // Alien eyes
      ctx.fillStyle = '#000';
      ctx.fillRect(alien.x + 8, alien.y + 8, 6, 6);
      ctx.fillRect(alien.x + alien.width - 14, alien.y + 8, 6, 6);
    });

    // Draw player bullets
    ctx.fillStyle = '#ff0';
    state.bullets.forEach(b => ctx.fillRect(b.x, b.y, b.width, b.height));

    // Draw enemy bullets
    ctx.fillStyle = '#f00';
    state.enemyBullets.forEach(b => ctx.fillRect(b.x, b.y, b.width, b.height));

    // Draw UI text (score, lives) directly on canvas
    ctx.fillStyle = '#fff';
    ctx.font = '20px Arial';
    ctx.fillText(`Score: ${state.score}`, 10, 30);
    ctx.fillText(`Lives: ${state.lives}`, CANVAS_WIDTH - 100, 30);
  };

  // Setup and cleanup effects
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    // Set canvas dimensions
    canvas.width = CANVAS_WIDTH;
    canvas.height = CANVAS_HEIGHT;

    // Initialize game state
    restartGame();

    // Event listeners for keyboard
    const handleKeyDown = (e) => {
      e.preventDefault();
      if (e.key === 'ArrowLeft') keysPressed.current.left = true;
      if (e.key === 'ArrowRight') keysPressed.current.right = true;
      if (e.key === ' ') {
        e.preventDefault(); // prevent page scroll
        keysPressed.current.space = true;
      }
    };
    const handleKeyUp = (e) => {
      if (e.key === 'ArrowLeft') keysPressed.current.left = false;
      if (e.key === 'ArrowRight') keysPressed.current.right = false;
      if (e.key === ' ') {
        e.preventDefault();
        keysPressed.current.space = false;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);

    // Start game loop
    animationRef.current = requestAnimationFrame(gameLoop);

    // Cleanup
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, []); // empty deps to run only once on mount

  // Render overlay messages when game not active
  const renderOverlay = () => {
    if (gameStatus === 'gameover') {
      return (
        <div style={overlayStyle}>
          <h1>GAME OVER</h1>
          <p>Final Score: {score}</p>
          <button onClick={restartGame} style={buttonStyle}>Restart</button>
        </div>
      );
    } else if (gameStatus === 'win') {
      return (
        <div style={overlayStyle}>
          <h1>YOU WIN!</h1>
          <p>Final Score: {score}</p>
          <button onClick={restartGame} style={buttonStyle}>Play Again</button>
        </div>
      );
    }
    return null;
  };

  // Styles
  const containerStyle = {
    position: 'relative',
    width: CANVAS_WIDTH,
    height: CANVAS_HEIGHT,
    margin: '0 auto',
    border: '2px solid #333',
  };

  const overlayStyle = {
    position: 'absolute',
    top: 0,
    left: 0,
    width: '100%',
    height: '100%',
    backgroundColor: 'rgba(0,0,0,0.7)',
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'center',
    alignItems: 'center',
    color: 'white',
    fontSize: '2rem',
  };

  const buttonStyle = {
    padding: '10px 20px',
    fontSize: '1.2rem',
    backgroundColor: '#0af',
    border: 'none',
    color: 'white',
    cursor: 'pointer',
    borderRadius: '5px',
    marginTop: '20px',
  };

  return (
    <div style={containerStyle}>
      <canvas ref={canvasRef} style={{ display: 'block' }} />
      {renderOverlay()}
      {/* Optional: HUD using React (already drawn on canvas, but we can also display with divs) */}
      <div style={{ position: 'absolute', top: 10, left: 10, color: 'white', fontSize: 20 }}>
        {/* Score: {score} - already on canvas, but we can keep as backup */}
      </div>
    </div>
  );
};

export default SpaceShooters3;
