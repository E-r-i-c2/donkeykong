const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

const GRAVITY = 0.55;
const JUMP_FORCE = -16;
const MOVEMENT_SPEED = 6;
const DOUBLE_JUMP_FORCE = -8;

const AIR_RESISTANCE = 0.98;
const GROUND_FRICTION = 0.80;

const GAME_STATE = {
    MENU: 'menu',
    LEVEL_SELECT: 'level_select',
    PLAYING: 'playing',
    PAUSED: 'paused',
    COMPLETE: 'complete'
};

let gameState = GAME_STATE.MENU;

// Add these variables after the gameState declaration
let deathCount = 0;
let speedrunTimer = 0;
let speedrunStartTime = 0;

// Add level-specific timing
let currentLevelStartTime = 0;

// Add these variables for tracking unsegmented runs
let fullRunStartTime = null;
let bestFullRunTime = null;

// Add this variable to track if the level has started
let levelStarted = false;

// Add these sprite definitions at the top after the constants
const SPRITES = {
    player: {
        width: 32,
        height: 48,
        frames: 4,
        currentFrame: 0,
        animationSpeed: 0.15,
        frameTime: 0
    }
};

// Update the color palette for alien theme
const COLORS = {
    background: '#0B0B1A',     // Deep space blue
    player: {
        main: '#00FF9D',       // Alien green
        secondary: '#7AFFCD',   // Light alien green
        trail: '#00FF9D33'     // Glowing trail
    },
    platform: {
        main: '#2B2B4E',       // Alien metal
        top: '#3D3D69',        // Light metal highlight
        bottom: '#1A1A33'      // Dark metal shadow
    },
    coin: {
        outer: '#7B52FF',      // Energy crystal purple
        inner: '#B599FF',      // Light energy purple
        glow: '#7B52FF44'      // Energy glow
    },
    challengeToken: {
        outer: '#FF1F1F',      // Rare crystal red
        inner: '#FF7070',      // Light crystal red
        glow: '#FF1F1F66'      // Strong energy glow
    },
    goal: {
        active: '#00FFFF',     // Portal cyan
        inactive: '#2B2B4E',   // Inactive portal
        glowActive: '#00FFFF55',
        glowInactive: '#2B2B4E22'
    },
    spike: {
        main: '#FF3D3D',       // Danger red
        glow: '#FF3D3D44'      // Danger glow
    },
    ground: {
        main: '#1a1a2e',      // Dark space ground
        pattern: '#232338',    // Slightly lighter for pattern
        glow: '#2a2a4a'       // Ground highlight
    },
    stars: ['#ffffff', '#ffffaa', '#aaaaff']  // Star colors
};

class Player {
    constructor() {
        this.reset();
        this.movingLeft = false;
        this.movingRight = false;
        this.facingRight = true;
        this.animationFrame = 0;
        this.animationTimer = 0;
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
        
        // Apply air resistance only to vertical movement
        this.velocityY *= AIR_RESISTANCE;
        
        // Handle horizontal movement directly instead of using velocity
        if (this.movingLeft) {
            this.velocityX = -MOVEMENT_SPEED;
        } else if (this.movingRight) {
            this.velocityX = MOVEMENT_SPEED;
        } else {
            // Only apply friction when no movement keys are pressed
            this.velocityX *= GROUND_FRICTION;
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

        // Update facing direction
        if (this.movingLeft) {
            this.facingRight = false;
        } else if (this.movingRight) {
            this.facingRight = true;
        }
    }

    draw() {
        // Update animation timer
        if (this.movingLeft || this.movingRight) {
            this.animationTimer += 0.15;
            if (this.animationTimer >= 1) {
                this.animationTimer = 0;
                this.animationFrame = (this.animationFrame + 1) % 4;
            }
        }

        ctx.save();
        
        // Alien trail effect
        if (this.isJumping || Math.abs(this.velocityX) > 0.5) {
            ctx.fillStyle = COLORS.player.trail;
            for (let i = 1; i <= 3; i++) {
                ctx.fillRect(this.x - 2 * i, this.y, this.width + 4 * i, this.height);
            }
        }
        
        // Alien body
        ctx.fillStyle = COLORS.player.main;
        ctx.beginPath();
        ctx.roundRect(this.x, this.y, this.width, this.height, 8);
        ctx.fill();
        
        // Alien head/antenna
        ctx.fillStyle = COLORS.player.secondary;
        ctx.beginPath();
        ctx.roundRect(this.x, this.y, this.width, 15, 8);
        ctx.fill();
        
        // Alien eyes (two instead of one)
        ctx.fillStyle = 'white';
        if (this.facingRight) {
            ctx.fillRect(this.x + this.width - 14, this.y + 4, 4, 4);
            ctx.fillRect(this.x + this.width - 22, this.y + 4, 4, 4);
        } else {
            ctx.fillRect(this.x + 10, this.y + 4, 4, 4);
            ctx.fillRect(this.x + 18, this.y + 4, 4, 4);
        }
        
        ctx.restore();
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
        this.height = 32;  // Increased for better visibility
    }

    draw() {
        // Platform shadow
        ctx.fillStyle = 'rgba(0, 0, 0, 0.3)';
        ctx.fillRect(this.x + 4, this.y + 4, this.width, this.height);
        
        // Main platform body
        ctx.fillStyle = COLORS.platform.main;
        ctx.fillRect(this.x, this.y, this.width, this.height);
        
        // Platform top highlight
        ctx.fillStyle = COLORS.platform.top;
        ctx.fillRect(this.x, this.y, this.width, 6);
        
        // Platform bottom shadow
        ctx.fillStyle = COLORS.platform.bottom;
        ctx.fillRect(this.x, this.y + this.height - 8, this.width, 8);
        
        // Add grid pattern for more visual interest
        ctx.strokeStyle = COLORS.platform.top;
        ctx.lineWidth = 1;
        ctx.globalAlpha = 0.2;
        for (let i = 0; i < this.width; i += 20) {
            ctx.beginPath();
            ctx.moveTo(this.x + i, this.y);
            ctx.lineTo(this.x + i, this.y + this.height);
            ctx.stroke();
        }
        ctx.globalAlpha = 1.0;
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
            // Outer glow
            ctx.beginPath();
            ctx.arc(this.x + this.width/2, this.y + this.height/2, this.width/1.5, 0, Math.PI * 2);
            ctx.fillStyle = COLORS.coin.glow;
            ctx.fill();
            
            // Main coin
            ctx.beginPath();
            ctx.arc(this.x + this.width/2, this.y + this.height/2, this.width/2, 0, Math.PI * 2);
            ctx.fillStyle = COLORS.coin.outer;
            ctx.fill();
            
            // Inner detail
            ctx.beginPath();
            ctx.arc(this.x + this.width/2, this.y + this.height/2, this.width/3, 0, Math.PI * 2);
            ctx.fillStyle = COLORS.coin.inner;
            ctx.fill();
        }
    }
}

class Goal {
    constructor(x, y) {
        this.x = x;
        this.y = y;
        this.width = 60;       // Increased from 30
        this.height = 100;     // Increased from 50
        this.pulseTime = 0;
    }

    draw() {
        const isActive = allCoinsCollected();
        const baseColor = isActive ? COLORS.goal.active : COLORS.goal.inactive;
        const glowColor = isActive ? COLORS.goal.glowActive : COLORS.goal.glowInactive;
        
        this.pulseTime += 0.05;
        const pulse = Math.sin(this.pulseTime) * 0.2 + 1;
        
        // Portal effect with pulse
        for (let i = 0; i < 3; i++) {
            ctx.fillStyle = glowColor;
            ctx.beginPath();
            ctx.ellipse(
                this.x + this.width/2,
                this.y + this.height/2,
                (this.width + i*16) * pulse,
                (this.height + i*16) * pulse/2,
                0,
                0,
                Math.PI * 2
            );
            ctx.fill();
        }
        
        // Portal center
        ctx.fillStyle = baseColor;
        ctx.beginPath();
        ctx.ellipse(
            this.x + this.width/2,
            this.y + this.height/2,
            this.width/2,
            this.height/4,
            0,
            0,
            Math.PI * 2
        );
        ctx.fill();

        // Add "FINISH" text when active
        if (isActive) {
            ctx.fillStyle = 'white';
            ctx.font = '20px Arial';
            ctx.textAlign = 'center';
            ctx.fillText('FINISH', this.x + this.width/2, this.y - 10);
        }
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
        // Glow effect
        ctx.fillStyle = COLORS.spike.glow;
        ctx.beginPath();
        ctx.moveTo(this.x - 2, this.y + this.height + 2);
        ctx.lineTo(this.x + this.width/2, this.y - 2);
        ctx.lineTo(this.x + this.width + 2, this.y + this.height + 2);
        ctx.closePath();
        ctx.fill();
        
        // Main spike
        ctx.fillStyle = COLORS.spike.main;
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

// Add new ChallengeToken class
class ChallengeToken extends Coin {
    constructor(x, y) {
        super(x, y);
        this.pulseTime = 0;
    }

    draw() {
        if (!this.collected) {
            this.pulseTime += 0.05;
            const pulse = Math.sin(this.pulseTime) * 0.2 + 1;

            // Outer glow with pulse
            ctx.beginPath();
            ctx.arc(this.x + this.width/2, this.y + this.height/2, (this.width/1.5) * pulse, 0, Math.PI * 2);
            ctx.fillStyle = COLORS.challengeToken.glow;
            ctx.fill();
            
            // Main token
            ctx.beginPath();
            ctx.arc(this.x + this.width/2, this.y + this.height/2, this.width/2, 0, Math.PI * 2);
            ctx.fillStyle = COLORS.challengeToken.outer;
            ctx.fill();
            
            // Inner star shape
            ctx.save();
            ctx.translate(this.x + this.width/2, this.y + this.height/2);
            ctx.rotate(this.pulseTime);
            ctx.beginPath();
            for (let i = 0; i < 5; i++) {
                const angle = (i * 2 * Math.PI / 5) - Math.PI / 2;
                const x = Math.cos(angle) * this.width/4;
                const y = Math.sin(angle) * this.width/4;
                i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
            }
            ctx.closePath();
            ctx.fillStyle = COLORS.challengeToken.inner;
            ctx.fill();
            ctx.restore();
        }
    }
}

const levels = [
    // Level 1 - Tutorial
    {
        platforms: [
            { x: 0, y: 750, width: 1200 },  // Ground
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
        challengeTokens: [
            { x: 400, y: 300 }
        ],
        goal: { x: 1100, y: 700 }
    },
    // Level 2 - Moving Platforms
    {
        platforms: [
            { x: 0, y: 750, width: 1200 },  // Ground
            { x: 300, y: 600, width: 200 },
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
            { x: 0, y: 750, width: 1200 },  // Ground
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
            { x: 0, y: 750, width: 1200 },  // Ground
            { x: 300, y: 600, width: 100 },
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
            { x: 0, y: 750, width: 1200 },  // Ground
            { x: 200, y: 600, width: 100 },
            { x: 350, y: 500, width: 100 },
            { x: 500, y: 400, width: 100 },
            { x: 650, y: 300, width: 100 },
            { x: 800, y: 400, width: 100 },
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
            { x: 0, y: 750, width: 1200 },  // Ground
            { x: 200, y: 600, width: 100 },
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
            { x: 0, y: 750, width: 1200 },  // Ground
            { x: 200, y: 600, width: 100 },
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
            { x: 0, y: 750, width: 1200 },  // Ground
            { x: 200, y: 600, width: 100 },
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
let challengeTokens = [];
const player = new Player();

// Add level statistics tracking
const levelStats = {};

function saveLevelCompletion(levelIndex, time, tokens) {
    if (!levelStats[levelIndex] || time < levelStats[levelIndex].bestTime) {
        levelStats[levelIndex] = {
            bestTime: time,
            challengeTokens: tokens
        };
    }
}

function drawLevelComplete() {
    ctx.fillStyle = 'rgba(0, 0, 0, 0.8)';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    
    ctx.fillStyle = 'white';
    ctx.font = '48px Arial';
    ctx.textAlign = 'center';
    ctx.fillText('Level Complete!', canvas.width/2, canvas.height/2 - 100);
    
    ctx.font = '24px Arial';
    const levelTime = Date.now() - speedrunStartTime;
    ctx.fillText(`Time: ${formatTime(levelTime)}`, canvas.width/2, canvas.height/2 - 40);
    
    const tokens = challengeTokens.filter(t => t.collected).length;
    ctx.fillText(`Challenge Tokens: ${tokens}/${challengeTokens.length}`, 
        canvas.width/2, canvas.height/2);
    
    ctx.fillText('Press SPACE to continue', canvas.width/2, canvas.height/2 + 100);
}

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
    challengeTokens = level.challengeTokens?.map(t => new ChallengeToken(t.x, t.y)) || [];
    goal = new Goal(level.goal.x, level.goal.y);
    player.reset();
    levelStarted = false;
    currentLevelStartTime = null;  // Don't set time until first input
    
    // Start tracking full run time when starting from level 1
    if (currentLevel === 0 && gameState === GAME_STATE.PLAYING) {
        fullRunStartTime = Date.now();
    }
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
        if (levelStarted) {  // Only save time if level was started
            const levelTime = Date.now() - currentLevelStartTime;
            saveLevelCompletion(currentLevel, levelTime, challengeTokens.filter(t => t.collected).length);
        }
        
        if (currentLevel < levels.length - 1) {
            currentLevel++;
            loadLevel(currentLevel);
        } else {
            if (fullRunStartTime) {
                const fullRunTime = Date.now() - fullRunStartTime;
                if (!bestFullRunTime || fullRunTime < bestFullRunTime) {
                    bestFullRunTime = fullRunTime;
                }
            }
            gameState = GAME_STATE.MENU;
            currentLevel = 0;
            fullRunStartTime = null;
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
    ctx.fillStyle = 'white';
    ctx.font = '20px Arial';
    ctx.textAlign = 'left';
    
    ctx.fillText('Score: ' + player.score, 20, 30);
    ctx.fillText('Level: ' + (currentLevel + 1), 20, 60);
    ctx.fillText('Deaths: ' + deathCount, 20, 90);
    
    const remainingCoins = coins.filter(coin => !coin.collected).length;
    ctx.fillText('Coins: ' + (coins.length - remainingCoins) + '/' + coins.length, 20, 120);
    
    const challengeCount = challengeTokens.filter(token => token.collected).length;
    ctx.fillText('Challenge Tokens: ' + challengeCount + '/' + challengeTokens.length, 20, 150);
    
    // Show timer
    if (!levelStarted) {
        ctx.fillText('Time: 0:00.00', 20, 180);
    } else {
        const currentTime = Date.now() - currentLevelStartTime;
        ctx.fillText('Time: ' + formatTime(currentTime), 20, 180);
    }
    
    // Show personal best
    if (levelStats[currentLevel] && levelStats[currentLevel].bestTime) {
        ctx.fillText('PB: ' + formatTime(levelStats[currentLevel].bestTime), 20, 210);
    }
}

// Add level select rendering
function drawLevelSelect() {
    drawBackground();
    
    ctx.fillStyle = 'white';
    ctx.font = '48px Arial';
    ctx.textAlign = 'center';
    ctx.fillText('Select Level', canvas.width/2, 100);
    
    // Draw best times at the top
    ctx.font = '24px Arial';
    const segmentedBest = calculateSegmentedBestTime();
    if (segmentedBest) {
        ctx.fillText(`Best Segmented: ${formatTime(segmentedBest)}`, canvas.width/2, 150);
    } else {
        ctx.fillText('Best Segmented: --:--.--', canvas.width/2, 150);
    }
    
    if (bestFullRunTime) {
        ctx.fillText(`Best Full Run: ${formatTime(bestFullRunTime)}`, canvas.width/2, 180);
    } else {
        ctx.fillText('Best Full Run: --:--.--', canvas.width/2, 180);
    }
    
    // Adjust startY to account for new header content
    const startY = 220;
    
    const levelsPerRow = 4;
    const buttonSize = 120;  // Increased size for more info
    const padding = 20;
    const startX = (canvas.width - (levelsPerRow * (buttonSize + padding))) / 2;
    
    levels.forEach((level, index) => {
        const row = Math.floor(index / levelsPerRow);
        const col = index % levelsPerRow;
        const x = startX + col * (buttonSize + padding);
        const y = startY + row * (buttonSize + padding);
        
        // Level button background
        ctx.fillStyle = '#2a2a4a';
        ctx.fillRect(x, y, buttonSize, buttonSize);
        
        // Level number
        ctx.fillStyle = 'white';
        ctx.font = '32px Arial';
        ctx.fillText(index + 1, x + buttonSize/2, y + 30);
        
        // Stats if exists
        if (levelStats[index]) {
            ctx.font = '16px Arial';
            ctx.fillText('PB: ' + formatTime(levelStats[index].bestTime), 
                x + buttonSize/2, y + 60);
                
            // Challenge token display
            if (levelStats[index].challengeTokens > 0) {
                ctx.fillStyle = COLORS.challengeToken.outer;
                ctx.fillText(`★ ${levelStats[index].challengeTokens}`, 
                    x + buttonSize/2, y + 85);
            }
        } else {
            ctx.font = '16px Arial';
            ctx.fillText('Not completed', x + buttonSize/2, y + 60);
        }
        
        // Show total coins in level
        ctx.fillStyle = COLORS.coin.outer;
        ctx.font = '14px Arial';
        ctx.fillText(`${levels[index].coins.length} coins`, 
            x + buttonSize/2, y + buttonSize - 20);
    });
    
    ctx.fillStyle = 'white';
    ctx.font = '24px Arial';
    ctx.fillText('Press ESC to return to main menu', canvas.width/2, canvas.height - 50);
}

// Update menu to include level select option
function drawMenu() {
    drawBackground();
    
    ctx.fillStyle = 'white';
    ctx.font = '48px Arial';
    ctx.textAlign = 'center';
    ctx.fillText('Alien Platform Adventure', canvas.width/2, 200);
    
    ctx.font = '24px Arial';
    ctx.fillText('Press SPACE to Start', canvas.width/2, 300);
    ctx.fillText('Press L for Level Select', canvas.width/2, 350);
    ctx.fillText('Controls:', canvas.width/2, 400);
    ctx.fillText('Arrow Keys to Move', canvas.width/2, 440);
    ctx.fillText('Up Arrow / Space to Jump', canvas.width/2, 470);
    ctx.fillText('R to Restart Level', canvas.width/2, 500);
    ctx.fillText('ESC to Exit to Menu', canvas.width/2, 530);
}

// Input handling
document.addEventListener('keydown', (event) => {
    switch(event.key) {
        case 'l':
        case 'L':
            if (gameState === GAME_STATE.MENU) {
                gameState = GAME_STATE.LEVEL_SELECT;
            }
            break;
        case 'Escape':
            if (gameState === GAME_STATE.LEVEL_SELECT) {
                gameState = GAME_STATE.MENU;
            } else if (gameState === GAME_STATE.PLAYING) {
                gameState = GAME_STATE.MENU;
                currentLevel = 0;
                fullRunStartTime = null;
            }
            break;
        case ' ':
            if (gameState === GAME_STATE.MENU) {
                gameState = GAME_STATE.PLAYING;
                deathCount = 0;
                loadLevel(currentLevel);
            } else if (gameState === GAME_STATE.PLAYING) {
                if (!levelStarted) {
                    levelStarted = true;
                    currentLevelStartTime = Date.now();
                    if (currentLevel === 0) {
                        fullRunStartTime = Date.now();
                    }
                }
                player.jump();
            }
            break;
        case 'ArrowLeft':
            if (gameState === GAME_STATE.PLAYING) {
                if (!levelStarted) {
                    levelStarted = true;
                    currentLevelStartTime = Date.now();
                    if (currentLevel === 0) {
                        fullRunStartTime = Date.now();
                    }
                }
                player.movingLeft = true;
                player.movingRight = false;
            }
            break;
        case 'ArrowRight':
            if (gameState === GAME_STATE.PLAYING) {
                if (!levelStarted) {
                    levelStarted = true;
                    currentLevelStartTime = Date.now();
                    if (currentLevel === 0) {
                        fullRunStartTime = Date.now();
                    }
                }
                player.movingRight = true;
                player.movingLeft = false;
            }
            break;
        case 'ArrowUp':
            if (gameState === GAME_STATE.PLAYING) {
                if (!levelStarted) {
                    levelStarted = true;
                    currentLevelStartTime = Date.now();
                    if (currentLevel === 0) {
                        fullRunStartTime = Date.now();
                    }
                }
                player.jump();
            }
            break;
        case 'r':
        case 'R':
            if (gameState === GAME_STATE.PLAYING) {
                levelStarted = false;
                currentLevelStartTime = null;
                loadLevel(currentLevel);
            }
            break;
    }
});

document.addEventListener('keyup', (event) => {
    switch(event.key) {
        case 'ArrowLeft':
            player.movingLeft = false;
            break;
        case 'ArrowRight':
            player.movingRight = false;
            break;
    }
});

// Add challenge token collection functionality
function checkChallengeTokenCollisions() {
    challengeTokens.forEach(token => {
        if (!token.collected &&
            player.x < token.x + token.width &&
            player.x + player.width > token.x &&
            player.y < token.y + token.height &&
            player.y + player.height > token.y) {
            token.collected = true;
            player.score += 500; // More points for challenge tokens
            
            // Add collection effect
            createCollectionEffect(token.x, token.y);
        }
    });
}

// Add particle effect system
const particles = [];

class Particle {
    constructor(x, y, color) {
        this.x = x;
        this.y = y;
        this.color = color;
        this.size = Math.random() * 4 + 2;
        this.speedX = (Math.random() - 0.5) * 8;
        this.speedY = (Math.random() - 0.5) * 8;
        this.life = 1;
    }

    update() {
        this.x += this.speedX;
        this.y += this.speedY;
        this.life -= 0.02;
        this.size *= 0.97;
    }

    draw() {
        ctx.fillStyle = this.color + Math.floor(this.life * 255).toString(16).padStart(2, '0');
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
        ctx.fill();
    }
}

function createCollectionEffect(x, y) {
    for (let i = 0; i < 20; i++) {
        particles.push(new Particle(x, y, COLORS.challengeToken.outer));
    }
}

function gameLoop() {
    drawBackground();

    switch(gameState) {
        case GAME_STATE.MENU:
            drawMenu();
            break;
            
        case GAME_STATE.LEVEL_SELECT:
            drawLevelSelect();
            break;
            
        case GAME_STATE.COMPLETE:
            drawLevelComplete();
            break;
            
        case GAME_STATE.PAUSED:
            // Draw the game state but paused
            platforms.forEach(platform => platform.draw());
            movingPlatforms.forEach(platform => platform.draw());
            verticalPlatforms.forEach(platform => platform.draw());
            disappearingPlatforms.forEach(platform => platform.draw());
            spikes.forEach(spike => spike.draw());
            coins.forEach(coin => coin.draw());
            challengeTokens.forEach(token => token.draw());
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
            // Update particles
            for (let i = particles.length - 1; i >= 0; i--) {
                particles[i].update();
                if (particles[i].life <= 0) {
                    particles.splice(i, 1);
                }
            }

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
            checkChallengeTokenCollisions();

            // Draw game objects
            platforms.forEach(platform => platform.draw());
            movingPlatforms.forEach(platform => platform.draw());
            verticalPlatforms.forEach(platform => platform.draw());
            disappearingPlatforms.forEach(platform => platform.draw());
            spikes.forEach(spike => spike.draw());
            coins.forEach(coin => coin.draw());
            challengeTokens.forEach(token => token.draw());
            goal.draw();
            player.draw();
            drawScore();

            // Draw particles
            particles.forEach(particle => particle.draw());

            // Draw ground decorative elements after everything else
            const groundHeight = 50;
            ctx.fillStyle = COLORS.ground.main;
            ctx.fillRect(0, canvas.height - groundHeight, canvas.width, groundHeight);
            
            // Ground pattern
            ctx.fillStyle = COLORS.ground.pattern;
            const patternSize = 30;
            for (let x = 0; x < canvas.width; x += patternSize) {
                ctx.beginPath();
                ctx.moveTo(x, canvas.height - groundHeight);
                ctx.lineTo(x + patternSize/2, canvas.height);
                ctx.lineTo(x + patternSize, canvas.height - groundHeight);
                ctx.fill();
            }
            
            // Ground glow
            ctx.fillStyle = COLORS.ground.glow;
            ctx.fillRect(0, canvas.height - groundHeight - 2, canvas.width, 2);
            break;
    }

    requestAnimationFrame(gameLoop);
}

// Start with the menu instead of loading level
gameLoop(); 

// Add this function to draw the background
function drawBackground() {
    // Space background with stars
    ctx.fillStyle = COLORS.background;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    
    // Draw stars (randomly placed but consistent pattern)
    const starSeed = currentLevel * 1000;
    for (let i = 0; i < 100; i++) {
        const x = (Math.sin(starSeed + i) * 0.5 + 0.5) * canvas.width;
        const y = (Math.cos(starSeed + i) * 0.5 + 0.5) * canvas.height;
        const size = (Math.sin(starSeed + i * 2) * 0.5 + 0.5) * 2 + 1;
        ctx.fillStyle = COLORS.stars[i % COLORS.stars.length];
        ctx.beginPath();
        ctx.arc(x, y, size, 0, Math.PI * 2);
        ctx.fill();
    }
}

// Update the level select click handler
canvas.addEventListener('click', (event) => {
    if (gameState !== GAME_STATE.LEVEL_SELECT) return;
    
    const rect = canvas.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;
    
    const levelsPerRow = 4;
    const buttonSize = 100;
    const padding = 20;
    const startX = (canvas.width - (levelsPerRow * (buttonSize + padding))) / 2;
    const startY = 200;
    
    levels.forEach((level, index) => {
        const row = Math.floor(index / levelsPerRow);
        const col = index % levelsPerRow;
        const buttonX = startX + col * (buttonSize + padding);
        const buttonY = startY + row * (buttonSize + padding);
        
        if (x >= buttonX && x <= buttonX + buttonSize &&
            y >= buttonY && y <= buttonY + buttonSize) {
            currentLevel = index;
            gameState = GAME_STATE.PLAYING;
            deathCount = 0;
            speedrunStartTime = Date.now();
            loadLevel(currentLevel);
        }
    });
}); 

// Update all level goals to be positioned better with new size
levels.forEach(level => {
    // Adjust the goal position to account for larger size
    level.goal.y -= 25;  // Move up to compensate for increased height
}); 

// Add this function to calculate segmented best time
function calculateSegmentedBestTime() {
    let total = 0;
    for (let i = 0; i < levels.length; i++) {
        if (levelStats[i] && levelStats[i].bestTime) {
            total += levelStats[i].bestTime;
        } else {
            return null; // Return null if not all levels are completed
        }
    }
    return total;
} 