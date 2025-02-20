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
        this.phasing = false;  // Add this for phase-through mechanic
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
    }

    update() {
        // Apply gravity
        this.velocityY += GRAVITY;
        
        // Apply fast fall/phase
        if (this.phasing) {
            this.velocityY += GRAVITY * 2;  // Fall faster when holding S/Down
        }
        
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
    constructor(x, y, width) {
        super(x, y, width);
        this.visible = true;
        this.timer = 1000;  // Time before platform disappears
        this.playerTouched = false;
        this.alpha = 1;
    }

    update() {
        if (this.playerTouched) {
            this.timer -= 16;
            this.alpha = this.timer / 1000;
            if (this.timer <= 0) {
                this.visible = false;
            }
        }
    }

    draw() {
        if (this.visible) {
            ctx.globalAlpha = this.alpha;
            ctx.fillStyle = '#FF6B6B';  // Bright color to indicate it's special
            ctx.fillRect(this.x, this.y, this.width, this.height);
            
            // Add warning pattern
            ctx.fillStyle = '#FF4444';
            const patternSize = 10;
            for (let x = this.x; x < this.x + this.width; x += patternSize * 2) {
                ctx.fillRect(x, this.y, patternSize, this.height);
            }
            ctx.globalAlpha = 1;
        }
    }

    reset() {
        this.visible = true;
        this.timer = 1000;
        this.playerTouched = false;
        this.alpha = 1;
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

// Update LaserBeam class to show time until activation
class LaserBeam {
    constructor(x, y, width, interval = 2000, initialDelay = 0) {
        this.x = x;
        this.y = y;
        this.width = width;
        this.height = 4;
        this.active = false;
        this.interval = interval;
        this.timer = initialDelay;
        this.warning = false;
    }

    update() {
        this.timer += 16;
        if (this.timer >= this.interval) {
            this.timer = 0;
        }
        this.warning = this.timer >= this.interval - 500;
        this.active = this.timer >= this.interval - 300;
    }

    draw() {
        // Always show laser path
        ctx.fillStyle = 'rgba(255, 0, 0, 0.1)';
        ctx.fillRect(this.x, this.y - 1, this.width, this.height + 2);

        if (this.warning) {
            const warningIntensity = Math.sin(this.timer * 0.1) * 0.5 + 0.5;
            ctx.fillStyle = this.active ? 
                '#FF0000' : 
                `rgba(255, 0, 0, ${warningIntensity})`;
            ctx.fillRect(this.x, this.y, this.width, this.height);

            // Show time until activation
            if (!this.active) {
                const timeUntilActive = ((this.interval - 300 - this.timer) / 1000).toFixed(1);
                ctx.fillStyle = 'white';
                ctx.font = '20px Arial';
                ctx.textAlign = 'center';
                ctx.fillText(timeUntilActive + 's', this.x + this.width/2, this.y - 10);
            }
        } else {
            // Show time until warning
            const timeUntilWarning = ((this.interval - 500 - this.timer) / 1000).toFixed(1);
            if (timeUntilWarning > 0) {
                ctx.fillStyle = 'rgba(255, 255, 255, 0.5)';
                ctx.font = '20px Arial';
                ctx.textAlign = 'center';
                ctx.fillText(timeUntilWarning + 's', this.x + this.width/2, this.y - 10);
            }
        }
    }
}

class BouncePad {
    constructor(x, y, strength = -25) {
        this.x = x;
        this.y = y;
        this.width = 40;
        this.height = 10;
        this.strength = strength;
        this.activated = false;
        this.activationTimer = 0;
    }

    update() {
        if (this.activated) {
            this.activationTimer += 16;
            if (this.activationTimer >= 200) {
                this.activated = false;
                this.activationTimer = 0;
            }
        }
    }

    draw() {
        ctx.fillStyle = this.activated ? '#00FF00' : '#00AA00';
        ctx.beginPath();
        ctx.moveTo(this.x, this.y + this.height);
        ctx.lineTo(this.x + this.width/2, this.y);
        ctx.lineTo(this.x + this.width, this.y + this.height);
        ctx.fill();
    }

    bounce(player) {
        player.velocityY = this.strength;
        player.isJumping = true;
        player.hasDoubleJump = true;
        this.activated = true;
    }
}

// Update WindZone class to fix arrow movement
class WindZone {
    constructor(x, y, width, height, force = 3) {
        this.x = x;
        this.y = y;
        this.width = width;
        this.height = height;
        this.force = force;
        this.arrowOffset = 0;
    }

    draw() {
        // Make wind direction more visible
        ctx.fillStyle = 'rgba(255, 255, 255, 0.1)';
        ctx.fillRect(this.x, this.y, this.width, this.height);
        
        // Update arrow offset to match wind speed and direction
        this.arrowOffset = (this.arrowOffset + this.force * 0.3) % 40;
        if (this.arrowOffset < 0) this.arrowOffset += 40; // Handle negative force
        
        // Draw moving wind direction arrows
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.4)';
        ctx.lineWidth = 2;
        const arrowSpacing = 40;
        const arrowSize = 15;
        
        // Offset starting position based on direction
        const startOffset = this.arrowOffset;
        
        for (let y = this.y; y < this.y + this.height; y += arrowSpacing) {
            for (let x = this.x + startOffset; x < this.x + this.width; x += arrowSpacing) {
                if (x < this.x || x > this.x + this.width - arrowSize) continue;
                
                ctx.beginPath();
                if (this.force > 0) {
                    // Right-pointing arrow
                    ctx.moveTo(x, y);
                    ctx.lineTo(x + arrowSize, y);
                    ctx.lineTo(x + arrowSize - 5, y - 5);
                    ctx.moveTo(x + arrowSize, y);
                    ctx.lineTo(x + arrowSize - 5, y + 5);
                } else {
                    // Left-pointing arrow
                    ctx.moveTo(x + arrowSize, y);
                    ctx.lineTo(x, y);
                    ctx.lineTo(x + 5, y - 5);
                    ctx.moveTo(x, y);
                    ctx.lineTo(x + 5, y + 5);
                }
                ctx.stroke();
            }
        }
    }

    update(player) {
        // Increase wind force
        if (player.x < this.x + this.width &&
            player.x + player.width > this.x &&
            player.y < this.y + this.height &&
            player.y + player.height > this.y) {
            player.velocityX += this.force * 0.3; // Increased from 0.15
        }
    }
}

const levels = [
    // Level 1 - Basic Movement Tutorial
    {
        platforms: [
            { x: 0, y: 750, width: 1200 },  // Ground
            { x: 300, y: 600, width: 300 },  // Basic jump platform
            { x: 600, y: 450, width: 300 },  // Double jump platform
        ],
        movingPlatforms: [],
        verticalPlatforms: [],
        disappearingPlatforms: [],
        spikes: [
            { x: 400, y: 730 }  // Single spike to teach hazards
        ],
        coins: [
            { x: 350, y: 550 },  // Easy coins
            { x: 650, y: 400 },
        ],
        lasers: [],
        windZones: [],
        bouncePads: [],
        challengeTokens: [
            { x: 400, y: 500 }  // Simple challenge token
        ],
        goal: { x: 1100, y: 700 }
    },

    // Level 2 - Moving Platforms
    {
        platforms: [
            { x: 0, y: 750, width: 1200 },
            { x: 300, y: 600, width: 200 },
        ],
        movingPlatforms: [
            { x: 350, y: 500, width: 200, xRange: 200, speed: 2 }  // Introduce moving platforms
        ],
        verticalPlatforms: [],
        disappearingPlatforms: [],
        spikes: [
            { x: 400, y: 730 },
            { x: 600, y: 730 }
        ],
        coins: [
            { x: 400, y: 450 },
            { x: 850, y: 450 },
        ],
        lasers: [],
        windZones: [],
        bouncePads: [
            { x: 750, y: 600, strength: -20 }  // Introduce bounce pads gently
        ],
        challengeTokens: [
            { x: 800, y: 400 }
        ],
        goal: { x: 1100, y: 700 }
    },

    // Level 3 - Vertical Movement
    {
        platforms: [
            { x: 0, y: 750, width: 1200 },
            { x: 400, y: 600, width: 200 },
        ],
        movingPlatforms: [
            { x: 700, y: 500, width: 150, xRange: 200, speed: 2 }
        ],
        verticalPlatforms: [
            { x: 200, y: 400, width: 150, yRange: 200, speed: 2 }  // Introduce vertical platforms
        ],
        disappearingPlatforms: [
            { x: 500, y: 400, width: 150 }  // Introduce disappearing platforms
        ],
        spikes: [
            { x: 300, y: 730 },
            { x: 500, y: 730 }
        ],
        coins: [
            { x: 450, y: 550 },
            { x: 750, y: 450 },
            { x: 250, y: 350 },
        ],
        lasers: [],
        windZones: [
            { x: 600, y: 200, width: 200, height: 400, force: 1 }  // Gentle wind introduction
        ],
        bouncePads: [
            { x: 200, y: 600, strength: -20 }
        ],
        challengeTokens: [
            { x: 200, y: 250 }
        ],
        goal: { x: 1100, y: 700 }
    },

    // Level 4 - Laser Introduction
    {
        platforms: [
            { x: 0, y: 750, width: 1200 },
            { x: 300, y: 600, width: 200 },
            { x: 700, y: 600, width: 200 },
        ],
        movingPlatforms: [
            { x: 300, y: 500, width: 150, xRange: 150, speed: 2 }
        ],
        verticalPlatforms: [
            { x: 900, y: 400, width: 100, yRange: 200, speed: 2 }
        ],
        disappearingPlatforms: [
            { x: 500, y: 500, width: 150 }
        ],
        spikes: [
            { x: 300, y: 730 },
            { x: 500, y: 730 }
        ],
        coins: [
            { x: 320, y: 550 },
            { x: 620, y: 400 },
            { x: 920, y: 250 },
        ],
        lasers: [
            { x: 800, y: 300, width: 200, interval: 3000 }  // Introduce lasers with slow timing
        ],
        windZones: [
            { x: 850, y: 200, width: 150, height: 200, force: 2 }
        ],
        bouncePads: [
            { x: 850, y: 400, strength: -20 }
        ],
        challengeTokens: [
            { x: 900, y: 200 }
        ],
        goal: { x: 1100, y: 700 }
    },

    // Level 5 - Disappearing Platform Challenge (New design)
    {
        platforms: [
            { x: 0, y: 750, width: 1200 },  // Ground
            { x: 200, y: 600, width: 200 },  // Starting platform
        ],
        movingPlatforms: [
            { x: 700, y: 500, width: 150, xRange: 200, speed: 3 }  // Moving platform for timing
        ],
        verticalPlatforms: [],
        disappearingPlatforms: [
            { x: 400, y: 600, width: 150 },  // First disappearing platform
            { x: 600, y: 500, width: 150 },  // Second platform
            { x: 800, y: 400, width: 150 },  // Third platform
            { x: 600, y: 300, width: 150 },  // Fourth platform
            { x: 400, y: 200, width: 150 },  // Final platform to token
        ],
        spikes: [
            { x: 300, y: 730 },
            { x: 500, y: 730 },
            { x: 700, y: 730 },
            { x: 900, y: 730 }
        ],
        coins: [
            { x: 420, y: 550 },
            { x: 620, y: 450 },
            { x: 820, y: 350 }
        ],
        lasers: [
            { x: 300, y: 400, width: 200, interval: 2000 }  // Laser to make timing harder
        ],
        windZones: [
            { x: 500, y: 100, width: 300, height: 400, force: 2 }  // Gentle wind to affect jumps
        ],
        bouncePads: [
            { x: 300, y: 500, strength: -20 }  // Optional bounce pad for alternate route
        ],
        challengeTokens: [
            { x: 400, y: 150 }  // Requires mastering disappearing platforms
        ],
        goal: { x: 1100, y: 700 }
    },

    // Level 6 - Advanced Challenge
    {
        platforms: [
            { x: 0, y: 750, width: 1200 },  // Ground
            { x: 200, y: 600, width: 100 },  // Added some static platforms
            { x: 800, y: 600, width: 100 },
        ],
        movingPlatforms: [],
        verticalPlatforms: [
            { x: 200, y: 300, width: 100, yRange: 200, speed: 3 },  // Adjusted speeds and ranges
            { x: 400, y: 400, width: 100, yRange: 200, speed: 3 },
            { x: 600, y: 300, width: 100, yRange: 200, speed: 3 },
            { x: 800, y: 400, width: 100, yRange: 200, speed: 3 },
            { x: 1000, y: 300, width: 100, yRange: 200, speed: 3 },
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
            { x: 220, y: 250 },
            { x: 420, y: 350 },
            { x: 620, y: 250 },
            { x: 820, y: 350 },
        ],
        lasers: [
            { x: 200, y: 150, width: 300, interval: 800 },
            { x: 500, y: 100, width: 300, interval: 800, initialDelay: 400 }
        ],
        windZones: [
            { x: 300, y: 0, width: 400, height: 300, force: 5 },
            { x: 700, y: 0, width: 400, height: 300, force: -5 }  // Opposing winds
        ],
        bouncePads: [
            { x: 500, y: 300, strength: -35 }  // Strong bounce needed
        ],
        challengeTokens: [
            { x: 1020, y: 30 }  // Requires perfect execution
        ],
        goal: { x: 1100, y: 600 }
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
        challengeTokens: [
            { x: 950, y: 5 }
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
        challengeTokens: [
            { x: 920, y: 5 }
        ],
        goal: { x: 1100, y: 100 }
    },

    // Level 9 - Vertical Maze
    {
        platforms: [
            { x: 0, y: 750, width: 1200 },  // Ground
            { x: 100, y: 600, width: 200 },
            { x: 900, y: 600, width: 200 },
            { x: 300, y: 450, width: 200 },
            { x: 700, y: 450, width: 200 },
            { x: 500, y: 300, width: 200 },
            { x: 300, y: 200, width: 100 },  // Adjusted platform position
        ],
        movingPlatforms: [
            { x: 600, y: 200, width: 100, xRange: 200, speed: 3 }  // Added moving platform
        ],
        verticalPlatforms: [
            { x: 400, y: 300, width: 100, yRange: 300, speed: 2 },  // Adjusted speed and range
        ],
        disappearingPlatforms: [
            { x: 500, y: 150, width: 100 }  // Made platform smaller
        ],
        spikes: [
            { x: 350, y: 730 },
            { x: 550, y: 730 },
            { x: 750, y: 730 },
        ],
        coins: [
            { x: 150, y: 550 },
            { x: 950, y: 550 },
            { x: 550, y: 250 },
        ],
        challengeTokens: [
            { x: 750, y: 5 }
        ],
        goal: { x: 1100, y: 100 }
    },

    // Level 10 - Speed Run Challenge
    {
        platforms: [
            { x: 0, y: 750, width: 1200 },  // Ground
            { x: 100, y: 600, width: 150 },  // Starting platform
            { x: 1000, y: 300, width: 150 }  // Final platform
        ],
        movingPlatforms: [
            // Fast horizontal platforms in a zigzag pattern
            { x: 300, y: 600, width: 100, xRange: 150, speed: 6 },
            { x: 600, y: 500, width: 100, xRange: 150, speed: 6 },
            { x: 300, y: 400, width: 100, xRange: 150, speed: 6 },
            { x: 600, y: 300, width: 100, xRange: 150, speed: 6 }
        ],
        verticalPlatforms: [],  // No vertical platforms in this speed run
        disappearingPlatforms: [
            // Quick stepping stones
            { x: 400, y: 550, width: 80 },
            { x: 700, y: 450, width: 80 },
            { x: 400, y: 350, width: 80 }
        ],
        spikes: [
            // Strategic spike placement
            { x: 300, y: 730 },
            { x: 500, y: 730 },
            { x: 700, y: 730 },
            { x: 900, y: 730 },
            // Mid-air hazards
            { x: 500, y: 500 },
            { x: 500, y: 300 }
        ],
        coins: [
            { x: 350, y: 550 },
            { x: 650, y: 450 },
            { x: 350, y: 350 },
            { x: 1050, y: 250 }
        ],
        lasers: [
            // Fast laser timing
            { x: 450, y: 450, width: 150, interval: 1500 },
            { x: 450, y: 250, width: 150, interval: 1500, initialDelay: 750 }
        ],
        windZones: [
            // Speed boosting wind
            { x: 800, y: 200, width: 400, height: 300, force: 4 }
        ],
        bouncePads: [
            // Speed boost pads
            { x: 200, y: 500, strength: -25 },
            { x: 500, y: 400, strength: -25 },
            { x: 800, y: 300, strength: -25 }
        ],
        challengeTokens: [
            { x: 1050, y: 200 }  // High-risk token
        ],
        goal: { x: 1100, y: 250 }
    },

    // Level 11 - Vertical Tower Challenge
    {
        platforms: [
            { x: 0, y: 750, width: 1200 },  // Ground
            { x: 100, y: 600, width: 150 },  // Starting platform
            { x: 950, y: 100, width: 150 }   // Final platform
        ],
        movingPlatforms: [
            // Horizontal moving platforms at different heights
            { x: 300, y: 600, width: 100, xRange: 100, speed: 2 },
            { x: 600, y: 450, width: 100, xRange: 100, speed: 2 },
            { x: 300, y: 300, width: 100, xRange: 100, speed: 2 },
            { x: 600, y: 150, width: 100, xRange: 100, speed: 2 }
        ],
        verticalPlatforms: [
            // Vertical elevator platforms
            { x: 200, y: 400, width: 100, yRange: 500, speed: 2 },
            { x: 800, y: 200, width: 100, yRange: 500, speed: 2 }
        ],
        disappearingPlatforms: [
            // Bridge gaps between sections
            { x: 400, y: 500, width: 100 },
            { x: 700, y: 350, width: 100 },
            { x: 400, y: 200, width: 100 }
        ],
        spikes: [
            // Ground hazards
            { x: 300, y: 730 },
            { x: 500, y: 730 },
            { x: 700, y: 730 },
            { x: 900, y: 730 },
            // Wall hazards
            { x: 500, y: 400 },
            { x: 500, y: 200 }
        ],
        coins: [
            { x: 350, y: 550 },
            { x: 650, y: 400 },
            { x: 350, y: 250 },
            { x: 950, y: 150 }
        ],
        lasers: [
            // Vertical laser gates
            { x: 450, y: 400, width: 100, interval: 2500 },
            { x: 650, y: 250, width: 100, interval: 2500, initialDelay: 1250 }
        ],
        windZones: [
            // Alternating wind currents
            { x: 300, y: 400, width: 200, height: 200, force: 2 },
            { x: 700, y: 200, width: 200, height: 200, force: -2 }
        ],
        bouncePads: [
            // Recovery bounce pads
            { x: 150, y: 500, strength: -20 },
            { x: 850, y: 300, strength: -20 }
        ],
        challengeTokens: [
            { x: 950, y: 50 }  // At the very top
        ],
        goal: { x: 1050, y: 50 }
    },

    // Level 12 - Master Challenge (Fixed version)
    {
        platforms: [
            { x: 0, y: 750, width: 1200 },    // Ground
            { x: 200, y: 600, width: 200 },    // Starting area
            { x: 500, y: 500, width: 200 },    // First checkpoint
            { x: 800, y: 400, width: 200 },    // Second checkpoint
            { x: 500, y: 300, width: 200 },    // Third checkpoint
            { x: 200, y: 200, width: 200 }     // Final area
        ],
        movingPlatforms: [
            { x: 300, y: 550, width: 100, xRange: 150, speed: 4 },
            { x: 600, y: 450, width: 100, xRange: 150, speed: 4 },
            { x: 900, y: 350, width: 100, xRange: 150, speed: 4 },
            { x: 600, y: 250, width: 100, xRange: 150, speed: 4 }
        ],
        verticalPlatforms: [
            { x: 400, y: 400, width: 100, yRange: 200, speed: 3 },
            { x: 700, y: 300, width: 100, yRange: 200, speed: 3 },
            { x: 400, y: 200, width: 100, yRange: 200, speed: 3 }
        ],
        disappearingPlatforms: [
            { x: 350, y: 500, width: 100 },
            { x: 650, y: 400, width: 100 },
            { x: 350, y: 300, width: 100 }
        ],
        spikes: [
            { x: 300, y: 730 },
            { x: 500, y: 730 },
            { x: 700, y: 730 },
            { x: 900, y: 730 }
        ],
        coins: [
            { x: 350, y: 550 },
            { x: 650, y: 400 },
            { x: 350, y: 250 }
        ],
        lasers: [
            { x: 300, y: 450, width: 200, interval: 2000 },
            { x: 600, y: 350, width: 200, interval: 2000, initialDelay: 1000 },
            { x: 300, y: 250, width: 200, interval: 2000 }
        ],
        windZones: [
            { x: 400, y: 0, width: 400, height: 400, force: 3 },
            { x: 800, y: 0, width: 400, height: 400, force: -3 }
        ],
        bouncePads: [
            { x: 300, y: 600, strength: -25 },
            { x: 600, y: 500, strength: -25 },
            { x: 900, y: 400, strength: -25 },
            { x: 600, y: 300, strength: -25 }
        ],
        challengeTokens: [
            { x: 300, y: 50 }
        ],
        goal: { x: 1100, y: 700 }
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

function saveGameData() {
    const gameData = {
        levelStats: levelStats,
        bestFullRunTime: bestFullRunTime
    };
    localStorage.setItem('platformGameRecords', JSON.stringify(gameData));
}

function loadGameData() {
    const savedData = localStorage.getItem('platformGameRecords');
    if (savedData) {
        const gameData = JSON.parse(savedData);
        levelStats = gameData.levelStats || {};
        bestFullRunTime = gameData.bestFullRunTime || null;
    }
}

function saveLevelCompletion(levelIndex, time, tokens) {
    if (!levelStats[levelIndex] || time < levelStats[levelIndex].bestTime) {
        levelStats[levelIndex] = {
            bestTime: time,
            challengeTokens: Math.max(tokens, (levelStats[levelIndex]?.challengeTokens || 0))
        };
        saveGameData();  // Save immediately after updating
    } else if (tokens > (levelStats[levelIndex].challengeTokens || 0)) {
        levelStats[levelIndex].challengeTokens = tokens;
        saveGameData();  // Save immediately after updating
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
    try {
        const level = levels[levelIndex];
        if (!level) {
            console.error('Invalid level index:', levelIndex);
            gameState = GAME_STATE.MENU;
            return;
        }

        // Reset all arrays first
        platforms = [];
        movingPlatforms = [];
        verticalPlatforms = [];
        disappearingPlatforms = [];
        spikes = [];
        coins = [];
        lasers = [];
        windZones = [];
        bouncePads = [];
        challengeTokens = [];

        // Then load new level elements
        platforms = level.platforms?.map(p => new Platform(p.x, p.y, p.width)) || [];
        movingPlatforms = level.movingPlatforms?.map(p => 
            new MovingPlatform(p.x, p.y, p.width, p.xRange, p.speed)
        ) || [];
        verticalPlatforms = level.verticalPlatforms?.map(p =>
            new VerticalPlatform(p.x, p.y, p.width, p.yRange, p.speed)
        ) || [];
        disappearingPlatforms = level.disappearingPlatforms?.map(p =>
            new DisappearingPlatform(p.x, p.y, p.width)
        ) || [];
        spikes = level.spikes?.map(s => new Spike(s.x, s.y)) || [];
        coins = level.coins?.map(c => new Coin(c.x, c.y)) || [];
        lasers = level.lasers?.map(l => 
            new LaserBeam(l.x, l.y, l.width, l.interval, l.initialDelay)
        ) || [];
        windZones = level.windZones?.map(w => 
            new WindZone(w.x, w.y, w.width, w.height, w.force)
        ) || [];
        bouncePads = level.bouncePads?.map(b => 
            new BouncePad(b.x, b.y, b.strength)
        ) || [];
        challengeTokens = level.challengeTokens?.map(t => 
            new ChallengeToken(t.x, t.y)
        ) || [];

        if (level.goal) {
            goal = new Goal(level.goal.x, level.goal.y);
        }

        player.reset();
        levelStarted = false;
        currentLevelStartTime = null;

        if (currentLevel === 0 && gameState === GAME_STATE.PLAYING) {
            fullRunStartTime = Date.now();
        }
    } catch (error) {
        console.error('Error loading level:', error);
        gameState = GAME_STATE.MENU;
    }
}

function checkPlatformCollisions() {
    const allPlatforms = [...platforms, ...movingPlatforms, ...verticalPlatforms, ...disappearingPlatforms.filter(p => p.visible)];
    for (const platform of allPlatforms) {
        if (player.phasing && platform.y < canvas.height - 50) continue;

        if (player.y + player.height > platform.y &&
            player.y < platform.y + platform.height &&
            player.x + player.width > platform.x &&
            player.x < platform.x + platform.width) {
            
            if (player.velocityY > 0) {
                player.y = platform.y - player.height;
                player.velocityY = 0;
                player.isJumping = false;
                
                // Handle disappearing platform
                if (platform instanceof DisappearingPlatform) {
                    platform.playerTouched = true;
                }
                
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

function checkObstacleCollisions() {
    // Check laser collisions
    lasers.forEach(laser => {
        if (laser.active &&
            player.x < laser.x + laser.width &&
            player.x + player.width > laser.x &&
            player.y < laser.y + laser.height &&
            player.y + player.height > laser.y) {
            deathCount++;
            loadLevel(currentLevel);
            return;
        }
    });

    // Check bounce pad collisions with improved detection
    bouncePads.forEach(pad => {
        if (player.x < pad.x + pad.width &&
            player.x + player.width > pad.x &&
            player.y + player.height >= pad.y &&
            player.y + player.height <= pad.y + pad.height + 5 &&
            player.velocityY > 0) {
            pad.bounce(player);
        }
    });
}

function checkGoalCollision() {
    if (!allCoinsCollected()) return;
    
    if (player.x < goal.x + goal.width &&
        player.x + player.width > goal.x &&
        player.y < goal.y + goal.height &&
        player.y + player.height > goal.y) {
        if (levelStarted) {
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
                    saveGameData(); // Save after updating full run time
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
    
    ctx.fillText('Level: ' + (currentLevel + 1), 20, 30);
    ctx.fillText('Deaths: ' + deathCount, 20, 60);
    
    const remainingCoins = coins.filter(coin => !coin.collected).length;
    ctx.fillText('Coins: ' + (coins.length - remainingCoins) + '/' + coins.length, 20, 90);
    
    let totalCollected = 0;
    for (const levelNum in levelStats) {
        if (levelStats[levelNum].challengeTokens) {
            totalCollected += levelStats[levelNum].challengeTokens;
        }
    }
    ctx.fillText('Challenge Tokens: ' + totalCollected + '/12', 20, 120);
    
    // Show timer
    if (!levelStarted) {
        ctx.fillText('Time: 0:00.00', 20, 150);
    } else {
        const currentTime = Date.now() - currentLevelStartTime;
        ctx.fillText('Time: ' + formatTime(currentTime), 20, 150);
    }
    
    // Show personal best
    if (levelStats[currentLevel] && levelStats[currentLevel].bestTime) {
        ctx.fillText('PB: ' + formatTime(levelStats[currentLevel].bestTime), 20, 180);
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
    
    // Adjust layout for 12 levels
    const levelsPerRow = 4;
    const rows = Math.ceil(levels.length / levelsPerRow);
    const buttonSize = 100;  // Slightly smaller buttons
    const padding = 20;
    const totalWidth = levelsPerRow * (buttonSize + padding) - padding;
    const startX = (canvas.width - totalWidth) / 2;
    const startY = 250;  // Start lower to accommodate header
    
    // Draw level buttons
    for (let i = 0; i < levels.length; i++) {
        const row = Math.floor(i / levelsPerRow);
        const col = i % levelsPerRow;
        const x = startX + col * (buttonSize + padding);
        const y = startY + row * (buttonSize + padding);
        
        // Button background
        ctx.fillStyle = '#2a2a4a';
        ctx.fillRect(x, y, buttonSize, buttonSize);
        
        // Level number
        ctx.fillStyle = 'white';
        ctx.font = '24px Arial';
        ctx.textAlign = 'center';
        ctx.fillText((i + 1), x + buttonSize/2, y + 30);
        
        // Best time if exists
        if (levelStats[i]) {
            ctx.font = '14px Arial';
            ctx.fillText(formatTime(levelStats[i].bestTime), x + buttonSize/2, y + 50);
            
            // Challenge tokens
            if (levelStats[i].challengeTokens > 0) {
                ctx.fillStyle = COLORS.challengeToken.outer;
                ctx.fillText(`★ ${levelStats[i].challengeTokens}`, x + buttonSize/2, y + 70);
            }
        } else {
            ctx.font = '14px Arial';
            ctx.fillText('---', x + buttonSize/2, y + 50);
        }
    }
    
    // Return to menu text
    ctx.fillStyle = 'white';
    ctx.font = '24px Arial';
    ctx.textAlign = 'center';
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

    // Add challenge token count
    let totalCollected = 0;
    for (const levelNum in levelStats) {
        if (levelStats[levelNum].challengeTokens) {
            totalCollected += levelStats[levelNum].challengeTokens;
        }
    }
    ctx.fillText(`Challenge Tokens Collected: ${totalCollected}/12`, canvas.width/2, 570);
}

// Input handling
document.addEventListener('keydown', (event) => {
    switch(event.key.toLowerCase()) {  // Convert to lowercase to handle both cases
        case 'l':
            if (gameState === GAME_STATE.MENU) {
                gameState = GAME_STATE.LEVEL_SELECT;
            }
            break;
        case 'escape':
            if (gameState === GAME_STATE.LEVEL_SELECT) {
                gameState = GAME_STATE.MENU;
            } else if (gameState === GAME_STATE.PLAYING) {
                gameState = GAME_STATE.MENU;
                currentLevel = 0;
                fullRunStartTime = null;
            }
            break;
        case ' ':
        case 'w':
        case 'arrowup':
            if (gameState === GAME_STATE.PLAYING) {
                if (!levelStarted) {
                    levelStarted = true;
                    currentLevelStartTime = Date.now();
                    if (currentLevel === 0) {
                        fullRunStartTime = Date.now();
                    }
                }
                player.jump();
            } else if (gameState === GAME_STATE.MENU) {
                gameState = GAME_STATE.PLAYING;
                deathCount = 0;
                loadLevel(currentLevel);
            }
            break;
        case 'a':
        case 'arrowleft':
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
        case 'd':
        case 'arrowright':
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
        case 's':
        case 'arrowdown':
            if (gameState === GAME_STATE.PLAYING) {
                player.phasing = true;
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
    switch(event.key.toLowerCase()) {
        case 'a':
        case 'arrowleft':
            player.movingLeft = false;
            break;
        case 'd':
        case 'arrowright':
            player.movingRight = false;
            break;
        case 's':
        case 'arrowdown':
            player.phasing = false;
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
            lasers.forEach(laser => laser.update());
            bouncePads.forEach(pad => pad.update());
            windZones.forEach(zone => zone.update(player));
            player.update();
            
            // Check collisions
            checkPlatformCollisions();
            checkCoinCollisions();
            checkSpikeCollisions();
            checkObstacleCollisions();
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
            windZones.forEach(zone => zone.draw());
            bouncePads.forEach(pad => pad.draw());
            lasers.forEach(laser => laser.draw());
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
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    const x = (event.clientX - rect.left) * scaleX;
    const y = (event.clientY - rect.top) * scaleY;
    
    const levelsPerRow = 4;
    const buttonSize = 100;  // Match size from drawLevelSelect
    const padding = 20;
    const totalWidth = levelsPerRow * (buttonSize + padding) - padding;
    const startX = (canvas.width - totalWidth) / 2;
    const startY = 250;  // Match startY from drawLevelSelect
    
    for (let i = 0; i < levels.length; i++) {
        const row = Math.floor(i / levelsPerRow);
        const col = i % levelsPerRow;
        const buttonX = startX + col * (buttonSize + padding);
        const buttonY = startY + row * (buttonSize + padding);
        
        if (x >= buttonX && x <= buttonX + buttonSize &&
            y >= buttonY && y <= buttonY + buttonSize) {
            currentLevel = i;
            gameState = GAME_STATE.PLAYING;
            deathCount = 0;
            loadLevel(currentLevel);
            return;  // Exit after finding the clicked level
        }
    }
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

// Load saved data when the game starts
loadGameData(); 