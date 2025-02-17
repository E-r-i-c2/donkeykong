const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

const GRAVITY = 0.5;
const JUMP_FORCE = -12;
const MOVEMENT_SPEED = 5.5;
const DOUBLE_JUMP_FORCE = -10;

const AIR_RESISTANCE = 0.99;
const GROUND_FRICTION = 0.90;

const GAME_STATE = {
    MENU: 'menu',
    PLAYING: 'playing',
    PAUSED: 'paused'
};

let gameState = GAME_STATE.MENU;

// Add these variables after the gameState declaration
let deathCount = 0;
let speedrunTimer = 0;
let speedrunStartTime = 0;

class Player {
    constructor() {
        this.reset();
    }

    reset() {
        this.x = 50;
        this.y = 700;
        this.width = 30;
        this.height = 40;
        this.velocityY = 0;
        this.velocityX = 0;
        this.isJumping = false;
        this.hasDoubleJump = true;
        this.score = 0;
    }

    update() {
        // Apply gravity
        this.velocityY += GRAVITY;
        
        // Apply air resistance
        this.velocityY *= AIR_RESISTANCE;
        
        // Apply movement with ground friction
        if (!this.isJumping) {
            this.velocityX *= GROUND_FRICTION;
        } else {
            this.velocityX *= AIR_RESISTANCE;
        }

        // Update position
        this.y += this.velocityY;
        this.x += this.velocityX;

        // Floor collision
        if (this.y + this.height > canvas.height) {
            this.y = canvas.height - this.height;
            this.velocityY = 0;
            this.isJumping = false;
        }

        // Keep player in bounds
        if (this.x < 0) {
            this.x = 0;
            this.velocityX = 0;
        }
        if (this.x + this.width > canvas.width) {
            this.x = canvas.width - this.width;
            this.velocityX = 0;
        }
    }

    draw() {
        ctx.fillStyle = 'red';
        ctx.fillRect(this.x, this.y, this.width, this.height);
    }

    jump() {
        if (!this.isJumping) {
            this.velocityY = JUMP_FORCE;
            this.isJumping = true;
            this.hasDoubleJump = true;
        } else if (this.hasDoubleJump) {
            this.velocityY = DOUBLE_JUMP_FORCE;
            this.hasDoubleJump = false;
        }
    }
}

class Platform {
    constructor(x, y, width) {
        this.x = x;
        this.y = y;
        this.width = width;
        this.height = 20;
    }

    draw() {
        ctx.fillStyle = 'brown';
        ctx.fillRect(this.x, this.y, this.width, this.height);
    }
}

class Coin {
    constructor(x, y) {
        this.x = x;
        this.y = y;
        this.width = 15;
        this.height = 15;
        this.collected = false;
    }

    draw() {
        if (!this.collected) {
            ctx.fillStyle = 'gold';
            ctx.beginPath();
            ctx.arc(this.x + this.width/2, this.y + this.height/2, this.width/2, 0, Math.PI * 2);
            ctx.fill();
        }
    }
}

class Goal {
    constructor(x, y) {
        this.x = x;
        this.y = y;
        this.width = 30;
        this.height = 50;
    }

    draw() {
        ctx.fillStyle = allCoinsCollected() ? 'green' : 'gray';
        ctx.fillRect(this.x, this.y, this.width, this.height);
    }
}

class Spike {
    constructor(x, y) {
        this.x = x;
        this.y = y;
        this.width = 20;
        this.height = 20;
    }

    draw() {
        ctx.fillStyle = 'red';
        ctx.beginPath();
        ctx.moveTo(this.x, this.y + this.height);
        ctx.lineTo(this.x + this.width/2, this.y);
        ctx.lineTo(this.x + this.width, this.y + this.height);
        ctx.closePath();
        ctx.fill();
    }
}

class MovingPlatform extends Platform {
    constructor(x, y, width, xRange, speed) {
        super(x, y, width);
        this.startX = x;
        this.xRange = xRange;
        this.speed = speed;
        this.direction = 1;
    }

    update() {
        this.x += this.speed * this.direction;
        if (Math.abs(this.x - this.startX) > this.xRange) {
            this.direction *= -1;
        }
    }

    draw() {
        ctx.fillStyle = 'brown';
        ctx.fillRect(this.x, this.y, this.width, this.height);
    }
}

class VerticalPlatform extends Platform {
    constructor(x, y, width, yRange, speed) {
        super(x, y, width);
        this.startY = y;
        this.yRange = yRange;
        this.speed = speed;
        this.direction = 1;
    }

    update() {
        this.y += this.speed * this.direction;
        if (Math.abs(this.y - this.startY) > this.yRange) {
            this.direction *= -1;
        }
    }
}

class DisappearingPlatform extends Platform {
    constructor(x, y, width, duration = 1000) {
        super(x, y, width);
        this.visible = true;
        this.duration = duration;
        this.timer = duration;
    }

    update() {
        if (this.playerTouched) {
            this.timer -= 16; // Assuming 60fps
            if (this.timer <= 0) {
                this.visible = false;
            }
        }
    }

    draw() {
        if (this.visible) {
            ctx.fillStyle = `rgba(139, 69, 19, ${this.timer/this.duration})`;
            ctx.fillRect(this.x, this.y, this.width, this.height);
        }
    }

    reset() {
        this.visible = true;
        this.timer = this.duration;
        this.playerTouched = false;
    }
}

const levels = [
    // Level 1 - Tutorial
    {
        platforms: [
            { x: 0, y: 750, width: 1200 },
            { x: 300, y: 600, width: 200 },
            { x: 600, y: 450, width: 200 },
        ],
        movingPlatforms: [],
        verticalPlatforms: [],
        disappearingPlatforms: [],
        spikes: [],
        coins: [
            { x: 350, y: 550 },
            { x: 650, y: 400 },
        ],
        goal: { x: 1100, y: 700 }
    },
    // Level 2 - Moving Platforms
    {
        platforms: [
            { x: 0, y: 750, width: 300 },
            { x: 900, y: 750, width: 300 },
        ],
        movingPlatforms: [
            { x: 350, y: 600, width: 150, xRange: 300, speed: 2 }
        ],
        verticalPlatforms: [],
        disappearingPlatforms: [
            { x: 800, y: 500, width: 150 }
        ],
        spikes: [
            { x: 400, y: 730 },
            { x: 600, y: 730 },
            { x: 800, y: 730 },
        ],
        coins: [
            { x: 400, y: 550 },
            { x: 850, y: 450 },
        ],
        goal: { x: 1100, y: 700 }
    },
    // Level 3 - Vertical and Moving Platforms
    {
        platforms: [
            { x: 0, y: 750, width: 200 },
            { x: 1000, y: 750, width: 200 },
            { x: 400, y: 600, width: 200 },
        ],
        movingPlatforms: [
            { x: 700, y: 500, width: 150, xRange: 200, speed: 3 },
        ],
        verticalPlatforms: [
            { x: 200, y: 400, width: 150, yRange: 200, speed: 2 }
        ],
        spikes: [
            { x: 300, y: 730 },
            { x: 500, y: 730 },
            { x: 700, y: 730 },
            { x: 900, y: 730 },
        ],
        coins: [
            { x: 450, y: 550 },
            { x: 750, y: 450 },
            { x: 250, y: 350 },
        ],
        goal: { x: 1100, y: 700 }
    },
    // Level 4 - Timing Challenge
    {
        platforms: [
            { x: 0, y: 750, width: 200 },
            { x: 1000, y: 750, width: 200 },
        ],
        movingPlatforms: [
            { x: 300, y: 600, width: 100, xRange: 150, speed: 3 },
            { x: 600, y: 450, width: 100, xRange: 150, speed: 3 },
        ],
        verticalPlatforms: [
            { x: 900, y: 300, width: 100, yRange: 300, speed: 3 }
        ],
        disappearingPlatforms: [
            { x: 400, y: 500, width: 100 },
            { x: 700, y: 350, width: 100 },
        ],
        spikes: [
            { x: 300, y: 730 },
            { x: 500, y: 730 },
            { x: 700, y: 730 },
            { x: 900, y: 730 },
        ],
        coins: [
            { x: 320, y: 550 },
            { x: 620, y: 400 },
            { x: 920, y: 250 },
        ],
        goal: { x: 1100, y: 700 }
    },
    // Level 5 - Disappearing Path
    {
        platforms: [
            { x: 0, y: 750, width: 200 },
            { x: 1000, y: 750, width: 200 },
        ],
        movingPlatforms: [],
        verticalPlatforms: [],
        disappearingPlatforms: [
            { x: 200, y: 600, width: 100 },
            { x: 350, y: 500, width: 100 },
            { x: 500, y: 400, width: 100 },
            { x: 650, y: 300, width: 100 },
            { x: 800, y: 400, width: 100 },
        ],
        spikes: [
            { x: 250, y: 730 },
            { x: 450, y: 730 },
            { x: 650, y: 730 },
            { x: 850, y: 730 },
        ],
        coins: [
            { x: 220, y: 550 },
            { x: 520, y: 350 },
            { x: 820, y: 350 },
        ],
        goal: { x: 1100, y: 700 }
    },
    // Level 6 - Vertical Challenge
    {
        platforms: [
            { x: 0, y: 750, width: 200 },
        ],
        movingPlatforms: [
            { x: 400, y: 650, width: 150, xRange: 200, speed: 3 },
        ],
        verticalPlatforms: [
            { x: 200, y: 400, width: 100, yRange: 250, speed: 4 },
            { x: 600, y: 300, width: 100, yRange: 300, speed: 4 },
            { x: 1000, y: 200, width: 100, yRange: 400, speed: 4 },
        ],
        disappearingPlatforms: [],
        spikes: [
            { x: 350, y: 730 },
            { x: 550, y: 730 },
            { x: 750, y: 730 },
        ],
        coins: [
            { x: 220, y: 300 },
            { x: 620, y: 200 },
            { x: 1020, y: 150 },
        ],
        goal: { x: 1100, y: 100 }
    },
    // Level 7 - Synchronized Platforms
    {
        platforms: [
            { x: 0, y: 750, width: 150 },
        ],
        movingPlatforms: [
            { x: 200, y: 600, width: 100, xRange: 150, speed: 4 },
            { x: 500, y: 450, width: 100, xRange: 150, speed: 4 },
            { x: 800, y: 300, width: 100, xRange: 150, speed: 4 },
        ],
        verticalPlatforms: [
            { x: 350, y: 500, width: 100, yRange: 150, speed: 3 },
            { x: 650, y: 350, width: 100, yRange: 150, speed: 3 },
            { x: 950, y: 200, width: 100, yRange: 150, speed: 3 },
        ],
        disappearingPlatforms: [],
        spikes: [
            { x: 200, y: 730 },
            { x: 400, y: 730 },
            { x: 600, y: 730 },
            { x: 800, y: 730 },
            { x: 1000, y: 730 },
        ],
        coins: [
            { x: 220, y: 550 },
            { x: 520, y: 400 },
            { x: 820, y: 250 },
        ],
        goal: { x: 1100, y: 150 }
    },
    // Level 8 - The Ultimate Test
    {
        platforms: [
            { x: 0, y: 750, width: 150 },
        ],
        movingPlatforms: [
            { x: 200, y: 650, width: 80, xRange: 200, speed: 5 },
            { x: 600, y: 500, width: 80, xRange: 200, speed: 5 },
        ],
        verticalPlatforms: [
            { x: 400, y: 300, width: 80, yRange: 300, speed: 4 },
            { x: 800, y: 200, width: 80, yRange: 400, speed: 4 },
        ],
        disappearingPlatforms: [
            { x: 300, y: 550, width: 80 },
            { x: 500, y: 400, width: 80 },
            { x: 700, y: 300, width: 80 },
            { x: 900, y: 200, width: 80 },
        ],
        spikes: [
            { x: 200, y: 730 },
            { x: 400, y: 730 },
            { x: 600, y: 730 },
            { x: 800, y: 730 },
            { x: 1000, y: 730 },
        ],
        coins: [
            { x: 320, y: 500 },
            { x: 520, y: 350 },
            { x: 720, y: 250 },
            { x: 920, y: 150 },
        ],
        goal: { x: 1100, y: 100 }
    }
];

let currentLevel = 0;
let platforms = [];
let movingPlatforms = [];
let verticalPlatforms = [];
let disappearingPlatforms = [];
let spikes = [];
let coins = [];
let goal = null;
const player = new Player();

function loadLevel(levelIndex) {
    const level = levels[levelIndex];
    platforms = level.platforms.map(p => new Platform(p.x, p.y, p.width));
    movingPlatforms = level.movingPlatforms.map(p => 
        new MovingPlatform(p.x, p.y, p.width, p.xRange, p.speed)
    );
    verticalPlatforms = level.verticalPlatforms.map(p =>
        new VerticalPlatform(p.x, p.y, p.width, p.yRange, p.speed)
    );
    disappearingPlatforms = level.disappearingPlatforms?.map(p =>
        new DisappearingPlatform(p.x, p.y, p.width)
    ) || [];
    spikes = level.spikes.map(s => new Spike(s.x, s.y));
    coins = level.coins.map(c => new Coin(c.x, c.y));
    goal = new Goal(level.goal.x, level.goal.y);
    player.reset();
}

function checkPlatformCollisions() {
    const allPlatforms = [...platforms, ...movingPlatforms, ...verticalPlatforms, ...disappearingPlatforms];
    for (const platform of allPlatforms) {
        if (player.y + player.height > platform.y &&
            player.y < platform.y + platform.height &&
            player.x + player.width > platform.x &&
            player.x < platform.x + platform.width) {
            
            if (player.velocityY > 0) {
                player.y = platform.y - player.height;
                player.velocityY = 0;
                player.isJumping = false;
                
                // Move player with moving platform
                if (platform instanceof MovingPlatform) {
                    player.x += platform.speed * platform.direction;
                }
            }
        }
    }
}

function checkCoinCollisions() {
    coins.forEach(coin => {
        if (!coin.collected &&
            player.x < coin.x + coin.width &&
            player.x + player.width > coin.x &&
            player.y < coin.y + coin.height &&
            player.y + player.height > coin.y) {
            coin.collected = true;
            player.score += 100;
        }
    });
}

function allCoinsCollected() {
    return coins.every(coin => coin.collected);
}

function checkSpikeCollisions() {
    for (const spike of spikes) {
        if (player.x < spike.x + spike.width &&
            player.x + player.width > spike.x &&
            player.y < spike.y + spike.height &&
            player.y + player.height > spike.y) {
            deathCount++;
            loadLevel(currentLevel);
            return;
        }
    }
}

function checkGoalCollision() {
    if (!allCoinsCollected()) return;
    
    if (player.x < goal.x + goal.width &&
        player.x + player.width > goal.x &&
        player.y < goal.y + goal.height &&
        player.y + player.height > goal.y) {
        if (currentLevel < levels.length - 1) {
            currentLevel++;
            loadLevel(currentLevel);
        } else {
            speedrunTimer = Date.now() - speedrunStartTime;
            alert(`Congratulations! You beat all levels!\n` +
                  `Final Score: ${player.score}\n` +
                  `Total Deaths: ${deathCount}\n` +
                  `Final Time: ${formatTime(speedrunTimer)}`);
            currentLevel = 0;
            gameState = GAME_STATE.MENU;
        }
    }
}

// Add this function to format time
function formatTime(ms) {
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    const remainingMs = Math.floor((ms % 1000) / 10);
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}.${remainingMs.toString().padStart(2, '0')}`;
}

// Update drawScore function
function drawScore() {
    ctx.fillStyle = 'black';
    ctx.font = '20px Arial';
    ctx.textAlign = 'left';
    
    ctx.fillText('Score: ' + player.score, 20, 30);
    ctx.fillText('Level: ' + (currentLevel + 1), 20, 60);
    ctx.fillText('Deaths: ' + deathCount, 20, 90);
    
    const remainingCoins = coins.filter(coin => !coin.collected).length;
    ctx.fillText('Coins remaining: ' + remainingCoins, 20, 120);
    
    // Draw speedrun timer
    const currentTime = gameState === GAME_STATE.PLAYING ? Date.now() - speedrunStartTime : speedrunTimer;
    ctx.fillText('Time: ' + formatTime(currentTime), 20, 150);
}

// Add menu rendering function
function drawMenu() {
    ctx.fillStyle = 'black';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    
    ctx.fillStyle = 'white';
    ctx.font = '48px Arial';
    ctx.textAlign = 'center';
    ctx.fillText('Platform Adventure', canvas.width/2, 200);
    
    ctx.font = '24px Arial';
    ctx.fillText('Press SPACE to Start', canvas.width/2, 300);
    ctx.fillText('Controls:', canvas.width/2, 400);
    ctx.fillText('Arrow Keys to Move', canvas.width/2, 440);
    ctx.fillText('Up Arrow / Space to Jump', canvas.width/2, 470);
    ctx.fillText('ESC to Pause', canvas.width/2, 500);
}

// Input handling
document.addEventListener('keydown', (event) => {
    switch(event.key) {
        case 'Escape':
            if (gameState === GAME_STATE.PLAYING) {
                gameState = GAME_STATE.PAUSED;
            } else if (gameState === GAME_STATE.PAUSED) {
                gameState = GAME_STATE.PLAYING;
            }
            break;
        case ' ':
            if (gameState === GAME_STATE.MENU) {
                gameState = GAME_STATE.PLAYING;
                deathCount = 0;
                speedrunStartTime = Date.now();
                loadLevel(currentLevel);
            } else if (gameState === GAME_STATE.PLAYING) {
                player.jump();
            }
            break;
        case 'ArrowLeft':
            if (gameState === GAME_STATE.PLAYING) {
                player.velocityX = -MOVEMENT_SPEED;
            }
            break;
        case 'ArrowRight':
            if (gameState === GAME_STATE.PLAYING) {
                player.velocityX = MOVEMENT_SPEED;
            }
            break;
        case 'ArrowUp':
            if (gameState === GAME_STATE.PLAYING) {
                player.jump();
            }
            break;
    }
});

document.addEventListener('keyup', (event) => {
    switch(event.key) {
        case 'ArrowLeft':
        case 'ArrowRight':
            player.velocityX = 0;
            break;
    }
});

function gameLoop() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    switch(gameState) {
        case GAME_STATE.MENU:
            drawMenu();
            break;
            
        case GAME_STATE.PAUSED:
            // Draw the game state but paused
            platforms.forEach(platform => platform.draw());
            movingPlatforms.forEach(platform => platform.draw());
            verticalPlatforms.forEach(platform => platform.draw());
            disappearingPlatforms.forEach(platform => platform.draw());
            spikes.forEach(spike => spike.draw());
            coins.forEach(coin => coin.draw());
            goal.draw();
            player.draw();
            drawScore();
            
            // Draw pause menu
            ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
            ctx.fillRect(0, 0, canvas.width, canvas.height);
            ctx.fillStyle = 'white';
            ctx.font = '48px Arial';
            ctx.textAlign = 'center';
            ctx.fillText('PAUSED', canvas.width/2, canvas.height/2);
            ctx.font = '24px Arial';
            ctx.fillText('Press ESC to Resume', canvas.width/2, canvas.height/2 + 50);
            break;
            
        case GAME_STATE.PLAYING:
            // Update game objects
            movingPlatforms.forEach(platform => platform.update());
            verticalPlatforms.forEach(platform => platform.update());
            disappearingPlatforms.forEach(platform => platform.update());
            player.update();
            
            // Check collisions
            checkPlatformCollisions();
            checkCoinCollisions();
            checkSpikeCollisions();
            checkGoalCollision();

            // Draw game objects
            platforms.forEach(platform => platform.draw());
            movingPlatforms.forEach(platform => platform.draw());
            verticalPlatforms.forEach(platform => platform.draw());
            disappearingPlatforms.forEach(platform => platform.draw());
            spikes.forEach(spike => spike.draw());
            coins.forEach(coin => coin.draw());
            goal.draw();
            player.draw();
            drawScore();
            break;
    }

    requestAnimationFrame(gameLoop);
}

// Start with the menu instead of loading level
gameLoop(); 
gameLoop(); 