const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
const scoreDisplay = document.getElementById('score');

const gridSize = 20;  // Size of each grid cell
const tileCount = canvas.width / gridSize; //Number of tiles
let snake = [{ x: 10, y: 10 }]; // Initial snake position (array of objects)
let food = { x: 5, y: 5 };       // Initial food position

let dx = 1;        // Change in x (1 = right, -1 = left, 0 = none)
let dy = 0;        // Change in y (1 = down, -1 = up, 0 = none)
let score = 0;

// Game Loop
function gameLoop() {
  setTimeout(function onTick() {
    clearCanvas();
    moveSnake();
    drawSnake();
    drawFood();
    checkCollision();
    gameLoop(); // Call gameLoop again to continue the loop
  }, 100); // Delay between frames (milliseconds). Lower number = faster speed
}

function clearCanvas() {
  ctx.fillStyle = '#ddd'; // background color
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  ctx.strokeStyle = 'black'; // border color
  ctx.strokeRect(0, 0, canvas.width, canvas.height);
}

function drawSnake() {
  snake.forEach(part => {
    ctx.fillStyle = 'green';  // Snake color
    ctx.fillRect(part.x * gridSize, part.y * gridSize, gridSize, gridSize);

    ctx.strokeStyle = 'darkgreen'; // Snake border color
    ctx.strokeRect(part.x * gridSize, part.y * gridSize, gridSize, gridSize);
  });
}

function drawFood() {
  ctx.fillStyle = 'red';  // Food color
  ctx.fillRect(food.x * gridSize, food.y * gridSize, gridSize, gridSize);
}

function moveSnake() {
  const head = { x: snake[0].x + dx, y: snake[0].y + dy };

  // Check if snake eats food
  if (head.x === food.x && head.y === food.y) {
    score += 10;
    scoreDisplay.textContent = 'Score: ' + score;
    food = {
      x: Math.floor(Math.random() * tileCount),
      y: Math.floor(Math.random() * tileCount)
    };
  } else {
    snake.pop(); // Remove the last part of the snake
  }

  snake.unshift(head); // Add the new head to the beginning
}

function checkCollision() {
  const head = snake[0];

  // Check if snake hits the walls
  if (head.x < 0 || head.x >= tileCount || head.y < 0 || head.y >= tileCount) {
    gameOver();
  }

  // Check if snake hits itself
  for (let i = 1; i < snake.length; i++) {
    if (head.x === snake[i].x && head.y === snake[i].y) {
      gameOver();
    }
  }
}

function gameOver() {
  alert('Game Over! Score: ' + score);
  snake = [{ x: 10, y: 10 }]; // Reset snake position
  dx = 1;
  dy = 0;
  score = 0;
  scoreDisplay.textContent = 'Score: ' + score;
}

// Key press event listener
document.addEventListener('keydown', function(event) {
  switch (event.key) {
    case 'ArrowLeft':
      if (dx !== 1) { // Prevent going directly backwards
        dx = -1;
        dy = 0;
      }
      break;
    case 'ArrowUp':
      if (dy !== 1) {
        dx = 0;
        dy = -1;
      }
      break;
    case 'ArrowRight':
      if (dx !== -1) {
        dx = 1;
        dy = 0;
      }
      break;
    case 'ArrowDown':
      if (dy !== -1) {
        dx = 0;
        dy = 1;
      }
      break;
  }
});

// Start the game loop
gameLoop();
