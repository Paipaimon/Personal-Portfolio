/**
 * Canvas Background Controller
 * Manages the interactive canvas grid as a background layer
 */
class CanvasBackgroundController {
    constructor(canvasElement, themeManager) {
        this.canvas = canvasElement;
        this.ctx = canvasElement.getContext('2d');
        this.themeManager = themeManager;
        
        // Animation constants
        this.FADE_DURATION = 200;
        
        // State variables
        this.state = {
            width: 0,
            height: 0,
            offsetX: 0,
            offsetY: 0,
            isDragging: false,
            lastMouseX: 0,
            lastMouseY: 0,
            hoverX: 0,
            hoverY: 0,
            hasMouse: false,
            
            // Interactive blocks storage - Requirements 4.4: Performance limits
            erasableBlocks: [], 
            maxErasableBlocks: 200,
            
            // Performance monitoring
            frameCount: 0,
            lastFrameTime: 0,
            fps: 60,
            performanceWarningThreshold: 30 // FPS threshold for performance warnings
        };
        
        // Bind methods
        this.handleMouseDown = this.handleMouseDown.bind(this);
        this.handleMouseMove = this.handleMouseMove.bind(this);
        this.handleMouseUp = this.handleMouseUp.bind(this);
        this.handleMouseLeave = this.handleMouseLeave.bind(this);
        this.handleTouchStart = this.handleTouchStart.bind(this);
        this.handleTouchMove = this.handleTouchMove.bind(this);
        this.handleTouchEnd = this.handleTouchEnd.bind(this);
        this.resize = this.resize.bind(this);
        this.loop = this.loop.bind(this);
        
        // Block click callback
        this.onBlockClickCallback = null;
    }
    
    /**
     * Initialize the canvas background controller
     */
    initialize() {
        this.setupEventListeners();
        this.resize();
        this.startAnimationLoop();
        
        // Listen for theme changes
        this.themeManager.onThemeChange(() => {
            this.draw();
        });
    }
    
    /**
     * Set up all event listeners
     */
    setupEventListeners() {
        // Mouse events
        this.canvas.addEventListener('mousedown', this.handleMouseDown);
        window.addEventListener('mousemove', this.handleMouseMove);
        window.addEventListener('mouseup', this.handleMouseUp);
        window.addEventListener('mouseleave', this.handleMouseLeave);
        
        // Touch events
        this.canvas.addEventListener('touchstart', this.handleTouchStart, { passive: false });
        this.canvas.addEventListener('touchmove', this.handleTouchMove, { passive: false });
        this.canvas.addEventListener('touchend', this.handleTouchEnd);
        
        // Window events
        window.addEventListener('resize', this.resize);
    }
    
    /**
     * Handle canvas resize with mobile optimization
     */
    resize() {
        this.state.width = window.innerWidth;
        this.state.height = window.innerHeight;
        
        // Mobile optimization: adjust canvas resolution for performance
        const isMobile = window.innerWidth <= 768;
        const pixelRatio = window.devicePixelRatio || 1;
        
        if (isMobile) {
            // Reduce pixel ratio on mobile for better performance
            const mobilePixelRatio = Math.min(pixelRatio, 2);
            this.canvas.width = this.state.width * mobilePixelRatio;
            this.canvas.height = this.state.height * mobilePixelRatio;
            this.ctx.scale(mobilePixelRatio, mobilePixelRatio);
            
            // Adjust performance limits for mobile
            this.state.maxErasableBlocks = Math.min(30, this.state.maxErasableBlocks);
            this.state.performanceWarningThreshold = 25; // Lower FPS threshold for mobile
        } else {
            this.canvas.width = this.state.width * pixelRatio;
            this.canvas.height = this.state.height * pixelRatio;
            this.ctx.scale(pixelRatio, pixelRatio);
            
            // Desktop performance settings
            this.state.maxErasableBlocks = 200;
            this.state.performanceWarningThreshold = 30;
        }
        
        // Set CSS size
        this.canvas.style.width = this.state.width + 'px';
        this.canvas.style.height = this.state.height + 'px';
        
        this.draw();
    }
    
    /**
     * Convert screen coordinates to grid coordinates (no zoom)
     */
    getGridFromScreen(screenX, screenY) {
        const gridSize = 50; // Fixed grid size, no scaling
        return {
            gridX: Math.floor((screenX - this.state.offsetX) / gridSize),
            gridY: Math.floor((screenY - this.state.offsetY) / gridSize)
        };
    }
    
    /**
     * Core drawing function (no zoom)
     */
    draw() {
        const currentTheme = this.themeManager.getCurrentTheme();
        const canvasTheme = currentTheme.canvas;
        const gridSize = 50; // Fixed grid size, no scaling

        // 1. Clear canvas with theme background
        this.ctx.fillStyle = canvasTheme.bgColor;
        this.ctx.fillRect(0, 0, this.state.width, this.state.height);

        // 2. Calculate visible range
        const startCol = Math.floor(-this.state.offsetX / gridSize);
        const endCol = startCol + (this.state.width / gridSize) + 1;
        const startRow = Math.floor(-this.state.offsetY / gridSize);
        const endRow = startRow + (this.state.height / gridSize) + 1;

        this.ctx.lineWidth = 1;

        // 3. Draw vertical lines with improved edge handling
        for (let col = startCol; col <= endCol; col++) {
            // Use Math.floor and add 0.5 for crisp 1px lines
            const x = Math.floor(col * gridSize + this.state.offsetX) + 0.5; 
            this.ctx.beginPath();
            this.ctx.strokeStyle = (col === 0) ? canvasTheme.axisColor : canvasTheme.lineColor;
            this.ctx.moveTo(x, 0);
            this.ctx.lineTo(x, this.state.height);
            this.ctx.stroke();
        }

        // 4. Draw horizontal lines with improved edge handling
        for (let row = startRow; row <= endRow; row++) {
            // Use Math.floor and add 0.5 for crisp 1px lines
            const y = Math.floor(row * gridSize + this.state.offsetY) + 0.5;
            this.ctx.beginPath();
            this.ctx.strokeStyle = (row === 0) ? canvasTheme.axisColor : canvasTheme.lineColor;
            this.ctx.moveTo(0, y);
            this.ctx.lineTo(this.state.width, y);
            this.ctx.stroke();
        }

        // 5. Draw interactive blocks with animation (仿照 canvas.html 的简洁方法)
        // Requirements 4.2: Ensure blocks use correct theme colors
        // Requirements 4.3: Implement click animations
        this.state.erasableBlocks.forEach(block => {
            const blockThemeConfig = this.themeManager.getThemeConfig(block.targetThemeKey);
            if (!blockThemeConfig || !blockThemeConfig.canvas) {
                console.warn(`Invalid theme config for block with theme: ${block.targetThemeKey}`);
                return;
            }
            
            const blockColor = blockThemeConfig.canvas.blockColor;
            this.ctx.fillStyle = blockColor;

            let sizeScale = 1;
            let opacity = 1;

            // Handle click fade-out animation - Requirements 4.3
            if (block.isClicked) {
                sizeScale = 1 - block.fadeProgress; // 0% -> 100% 进度时，尺寸从 1 到 0
                opacity = 1 - block.fadeProgress;   // 0% -> 100% 进度时，透明度从 1 到 0
            }
            
            // 确保尺寸不会是负数
            sizeScale = Math.max(0, sizeScale);
            opacity = Math.max(0, opacity);

            const initialDrawX = block.gridX * gridSize + this.state.offsetX;
            const initialDrawY = block.gridY * gridSize + this.state.offsetY;

            // 计算实际绘制尺寸和位置 (向中心缩小)
            const scaledSize = gridSize * sizeScale;
            const offset = (gridSize - scaledSize) / 2;
            const drawX = initialDrawX + offset;
            const drawY = initialDrawY + offset;

            this.ctx.globalAlpha = opacity;

            // Only draw if block is visible on screen
            if (drawX + scaledSize > 0 && drawX < this.state.width && 
                drawY + scaledSize > 0 && drawY < this.state.height) {
                // 直接绘制，不使用额外的 Math.floor 处理，避免边缘不平滑
                this.ctx.fillRect(drawX, drawY, scaledSize, scaledSize);
            }

            // Reset global alpha
            this.ctx.globalAlpha = 1.0;
        });

        // 6. Draw hover highlight (仿照 canvas.html 的简洁方法)
        if (this.state.hasMouse) {
            const { gridX, gridY } = this.getGridFromScreen(this.state.hoverX, this.state.hoverY);
            const drawX = gridX * gridSize + this.state.offsetX;
            const drawY = gridY * gridSize + this.state.offsetY;

            this.ctx.fillStyle = canvasTheme.highlightColor;
            this.ctx.globalAlpha = canvasTheme.highlightOpacity;
            this.ctx.fillRect(drawX, drawY, gridSize, gridSize);
            this.ctx.globalAlpha = 1.0;
        }
    }
    
    /**
     * Update fading block animations
     */
    updateFadingBlocks(currentTime) {
        const completedBlocks = [];
        this.state.erasableBlocks.forEach((block, index) => {
            if (block.isClicked && block.fadeStartTime) {
                const elapsedTime = currentTime - block.fadeStartTime;
                block.fadeProgress = Math.min(1, elapsedTime / this.FADE_DURATION);

                if (block.fadeProgress >= 1) {
                    completedBlocks.push(index);
                }
            }
        });

        // Remove completed animations
        for (let i = completedBlocks.length - 1; i >= 0; i--) {
            this.state.erasableBlocks.splice(completedBlocks[i], 1);
        }
    }
    
    /**
     * Generate interactive blocks randomly
     * Requirements 4.1: Random generation with 1/50 probability
     * Requirements 4.2: Assign correct theme colors
     * Requirements 4.4: Performance limits for block count
     */
    generateInteractiveBlocks(x, y) {
        // Performance limit check - Requirements 4.4
        if (this.state.erasableBlocks.length >= this.state.maxErasableBlocks) {
            return;
        }
        
        // 1/50 probability (0.02) - Requirements 4.1
        if (Math.random() < 0.02) {
            const { gridX, gridY } = this.getGridFromScreen(x, y);
            const exists = this.state.erasableBlocks.some(b => b.gridX === gridX && b.gridY === gridY);
            
            if (!exists) {
                // Requirements 4.2: Ensure blocks are assigned correct theme colors
                const availableThemes = this.themeManager.getAvailableThemes();
                const targetTheme = availableThemes[Math.floor(Math.random() * availableThemes.length)];
                
                // Validate that the target theme has valid color configuration
                const themeConfig = this.themeManager.getThemeConfig(targetTheme);
                if (!themeConfig || !themeConfig.canvas || !themeConfig.canvas.blockColor) {
                    console.warn(`Invalid theme configuration for ${targetTheme}, skipping block generation`);
                    return;
                }
                
                const newBlock = { 
                    gridX, 
                    gridY, 
                    targetThemeKey: targetTheme,
                    isClicked: false,
                    fadeProgress: 0,
                    fadeStartTime: null,
                    // Store the block color for validation
                    blockColor: themeConfig.canvas.blockColor
                };
                
                this.state.erasableBlocks.push(newBlock);
                
                // Log block generation for debugging
                console.log(`Generated block at (${gridX}, ${gridY}) with theme ${targetTheme} and color ${themeConfig.canvas.blockColor}`);
            }
        }
    }
    
    /**
     * Handle mouse down events
     * Requirements 4.3: Implement click animations and theme switching
     */
    handleMouseDown(e) {
        const clickX = e.clientX;
        const clickY = e.clientY;
        
        const { gridX, gridY } = this.getGridFromScreen(clickX, clickY);
        
        // Check for block clicks - Requirements 4.3
        const hitBlock = this.state.erasableBlocks.find(b => 
            b.gridX === gridX && b.gridY === gridY && !b.isClicked
        );
        
        if (hitBlock) {
            // Start fade animation - Requirements 4.3
            hitBlock.isClicked = true;
            hitBlock.fadeStartTime = performance.now();
            
            console.log(`Block clicked at (${gridX}, ${gridY}) with target theme: ${hitBlock.targetThemeKey}`);
            
            // Trigger theme change - Requirements 4.3
            if (this.onBlockClickCallback) {
                this.onBlockClickCallback(hitBlock.targetThemeKey);
            }
            
            this.state.isDragging = false;
            return;
        }

        // Start dragging if no block was clicked
        this.state.isDragging = true;
        this.state.lastMouseX = clickX;
        this.state.lastMouseY = clickY;
    }
    
    /**
     * Handle mouse move events
     */
    handleMouseMove(e) {
        this.state.hasMouse = true;
        this.state.hoverX = e.clientX;
        this.state.hoverY = e.clientY;

        // Generate interactive blocks
        if (!this.state.isDragging) {
            this.generateInteractiveBlocks(e.clientX, e.clientY);
        }

        // Handle dragging
        if (this.state.isDragging) {
            const deltaX = e.clientX - this.state.lastMouseX;
            const deltaY = e.clientY - this.state.lastMouseY;
            this.state.offsetX += deltaX;
            this.state.offsetY += deltaY;
            this.state.lastMouseX = e.clientX;
            this.state.lastMouseY = e.clientY;
        }
    }
    
    /**
     * Handle mouse up events
     */
    handleMouseUp() {
        this.state.isDragging = false;
    }
    
    /**
     * Handle mouse leave events
     */
    handleMouseLeave() {
        this.state.isDragging = false;
        this.state.hasMouse = false;
    }
    
    /**
     * Handle touch start events with improved mobile support
     * Requirements 4.3: Touch support for click animations and theme switching
     * Requirements 5.3: Touch event handling for theme changes
     */
    handleTouchStart(e) {
        e.preventDefault(); // Prevent default touch behaviors
        
        const touch = e.touches[0];
        const rect = this.canvas.getBoundingClientRect();
        const touchX = touch.clientX - rect.left;
        const touchY = touch.clientY - rect.top;
        
        const { gridX, gridY } = this.getGridFromScreen(touchX, touchY);
        
        // Check for block touch - Requirements 4.3, 5.3
        const hitBlock = this.state.erasableBlocks.find(b => 
            b.gridX === gridX && b.gridY === gridY && !b.isClicked
        );
        
        if (hitBlock) {
            // Provide haptic feedback if available
            if (navigator.vibrate) {
                navigator.vibrate(50); // Short vibration for feedback
            }
            
            // Start fade animation - Requirements 4.3
            hitBlock.isClicked = true;
            hitBlock.fadeStartTime = performance.now();
            
            console.log(`Block touched at (${gridX}, ${gridY}) with target theme: ${hitBlock.targetThemeKey}`);
            
            // Trigger theme change - Requirements 5.3
            if (this.onBlockClickCallback) {
                this.onBlockClickCallback(hitBlock.targetThemeKey);
            }
            
            this.state.isDragging = false;
            return;
        }

        // Start touch dragging
        this.state.isDragging = true;
        this.state.lastMouseX = touchX;
        this.state.lastMouseY = touchY;
        this.state.hasMouse = true;
        this.state.hoverX = touchX;
        this.state.hoverY = touchY;
        
        // Store initial touch for gesture detection
        this.state.initialTouchX = touchX;
        this.state.initialTouchY = touchY;
        this.state.touchStartTime = performance.now();
    }
    
    /**
     * Handle touch move events with enhanced mobile support
     * Requirements 4.1: Generate blocks with higher probability for touch (1/20 = 0.05)
     * Requirements 4.2: Assign correct theme colors
     * Requirements 5.2: Adapt canvas rendering for mobile devices
     */
    handleTouchMove(e) {
        e.preventDefault(); // Prevent scrolling and other default behaviors
        
        const touch = e.touches[0];
        const rect = this.canvas.getBoundingClientRect();
        const touchX = touch.clientX - rect.left;
        const touchY = touch.clientY - rect.top;
        
        this.state.hoverX = touchX;
        this.state.hoverY = touchY;

        // Generate blocks with higher probability for touch (1/15 = 0.067) - Requirements 4.1
        // Increased probability for better mobile experience
        if (!this.state.isDragging && this.state.erasableBlocks.length < this.state.maxErasableBlocks) {
            const isMobile = window.innerWidth <= 768;
            const touchProbability = isMobile ? 0.08 : 0.05; // Higher on mobile
            
            if (Math.random() < touchProbability) {
                const { gridX, gridY } = this.getGridFromScreen(touchX, touchY);
                if (!this.state.erasableBlocks.some(b => b.gridX === gridX && b.gridY === gridY)) {
                    const availableThemes = this.themeManager.getAvailableThemes();
                    const targetTheme = availableThemes[Math.floor(Math.random() * availableThemes.length)];
                    
                    // Validate theme configuration - Requirements 4.2
                    const themeConfig = this.themeManager.getThemeConfig(targetTheme);
                    if (themeConfig && themeConfig.canvas && themeConfig.canvas.blockColor) {
                        this.state.erasableBlocks.push({ 
                            gridX, 
                            gridY, 
                            targetThemeKey: targetTheme,
                            isClicked: false,
                            fadeProgress: 0,
                            fadeStartTime: null,
                            blockColor: themeConfig.canvas.blockColor
                        });
                        
                        console.log(`Touch generated block at (${gridX}, ${gridY}) with theme ${targetTheme}`);
                    }
                }
            }
        }

        // Handle touch dragging
        if (this.state.isDragging) {
            const deltaX = touchX - this.state.lastMouseX;
            const deltaY = touchY - this.state.lastMouseY;
            
            this.state.offsetX += deltaX;
            this.state.offsetY += deltaY;
            this.state.lastMouseX = touchX;
            this.state.lastMouseY = touchY;
            
            // Store velocity for potential momentum scrolling
            this.state.velocityX = deltaX;
            this.state.velocityY = deltaY;
        }
    }
    
    /**
     * Handle touch end events with momentum and gesture detection
     * Requirements 5.3: Touch event handling for theme changes
     */
    handleTouchEnd(e) {
        // Detect tap vs drag gesture
        if (this.state.touchStartTime) {
            const touchDuration = performance.now() - this.state.touchStartTime;
            const touchDistance = Math.sqrt(
                Math.pow(this.state.hoverX - (this.state.initialTouchX || 0), 2) +
                Math.pow(this.state.hoverY - (this.state.initialTouchY || 0), 2)
            );
            
            // If it was a quick tap with minimal movement, treat as click
            if (touchDuration < 200 && touchDistance < 10) {
                console.log('Quick tap detected on canvas');
            }
        }
        
        // Apply momentum scrolling on mobile
        if (this.state.isDragging && window.innerWidth <= 768) {
            const velocityX = this.state.velocityX || 0;
            const velocityY = this.state.velocityY || 0;
            
            // Apply momentum if velocity is significant
            if (Math.abs(velocityX) > 2 || Math.abs(velocityY) > 2) {
                this.applyMomentum(velocityX, velocityY);
            }
        }
        
        this.state.isDragging = false;
        
        // Clear touch state
        this.state.initialTouchX = null;
        this.state.initialTouchY = null;
        this.state.touchStartTime = null;
        this.state.velocityX = 0;
        this.state.velocityY = 0;
    }
    
    /**
     * Apply momentum scrolling for smooth mobile experience
     * Requirements 5.2: Adapt canvas rendering for mobile devices
     */
    applyMomentum(velocityX, velocityY) {
        const friction = 0.95;
        const minVelocity = 0.5;
        
        const animate = () => {
            velocityX *= friction;
            velocityY *= friction;
            
            this.state.offsetX += velocityX;
            this.state.offsetY += velocityY;
            
            if (Math.abs(velocityX) > minVelocity || Math.abs(velocityY) > minVelocity) {
                requestAnimationFrame(animate);
            }
        };
        
        requestAnimationFrame(animate);
    }
    
    /**
     * Set callback for block click events
     */
    onBlockClick(callback) {
        this.onBlockClickCallback = callback;
    }
    
    /**
     * Start the animation loop
     */
    startAnimationLoop() {
        requestAnimationFrame(this.loop);
    }
    
    /**
     * Animation loop with performance monitoring
     * Requirements 4.4: Performance limits and monitoring
     */
    loop(currentTime) {
        // Performance monitoring - Requirements 4.4
        this.updatePerformanceMetrics(currentTime);
        
        // Update fading blocks
        this.updateFadingBlocks(currentTime);
        
        // Draw the canvas
        this.draw();
        
        // Check performance and adjust if needed
        this.checkPerformanceAndAdjust();
        
        requestAnimationFrame(this.loop);
    }
    
    /**
     * Update performance metrics
     * Requirements 4.4: Monitor FPS for performance limits
     */
    updatePerformanceMetrics(currentTime) {
        if (this.state.lastFrameTime > 0) {
            const deltaTime = currentTime - this.state.lastFrameTime;
            this.state.fps = 1000 / deltaTime;
        }
        
        this.state.lastFrameTime = currentTime;
        this.state.frameCount++;
        
        // Log performance every 300 frames (approximately every 5 seconds at 60fps)
        if (this.state.frameCount % 300 === 0) {
            console.log(`Canvas performance: ${Math.round(this.state.fps)} FPS, ${this.state.erasableBlocks.length} blocks`);
        }
    }
    
    /**
     * Check performance and adjust block generation if needed
     * Requirements 4.4: Automatic performance adjustment
     */
    checkPerformanceAndAdjust() {
        // If FPS drops below threshold, reduce max blocks
        if (this.state.fps < this.state.performanceWarningThreshold) {
            if (this.state.maxErasableBlocks > 20) {
                this.state.maxErasableBlocks = Math.max(20, this.state.maxErasableBlocks - 5);
                console.warn(`Performance degradation detected (${Math.round(this.state.fps)} FPS). Reducing max blocks to ${this.state.maxErasableBlocks}`);
                
                // Remove excess blocks if current count exceeds new limit
                if (this.state.erasableBlocks.length > this.state.maxErasableBlocks) {
                    const excessBlocks = this.state.erasableBlocks.length - this.state.maxErasableBlocks;
                    this.state.erasableBlocks.splice(0, excessBlocks);
                    console.log(`Removed ${excessBlocks} excess blocks for performance`);
                }
            }
        }
        // If performance is good, gradually increase max blocks back to original limit
        else if (this.state.fps > 55 && this.state.maxErasableBlocks < 50) {
            this.state.maxErasableBlocks = Math.min(50, this.state.maxErasableBlocks + 1);
        }
    }
    
    /**
     * Cleanup method
     */
    destroy() {
        // Remove event listeners
        this.canvas.removeEventListener('mousedown', this.handleMouseDown);
        window.removeEventListener('mousemove', this.handleMouseMove);
        window.removeEventListener('mouseup', this.handleMouseUp);
        window.removeEventListener('mouseleave', this.handleMouseLeave);
        this.canvas.removeEventListener('touchstart', this.handleTouchStart);
        this.canvas.removeEventListener('touchmove', this.handleTouchMove);
        this.canvas.removeEventListener('touchend', this.handleTouchEnd);
        window.removeEventListener('resize', this.resize);
    }
    
    /**
     * Get current performance and block statistics
     * Requirements 4.4: Performance monitoring
     */
    getPerformanceStats() {
        return {
            fps: Math.round(this.state.fps),
            blockCount: this.state.erasableBlocks.length,
            maxBlocks: this.state.maxErasableBlocks,
            frameCount: this.state.frameCount,
            canvasSize: {
                width: this.state.width,
                height: this.state.height
            },
            performanceGood: this.state.fps >= this.state.performanceWarningThreshold
        };
    }
    
    /**
     * Get current block information for debugging
     * Requirements 4.2: Block color assignment validation
     */
    getBlockInfo() {
        return this.state.erasableBlocks.map(block => ({
            position: `(${block.gridX}, ${block.gridY})`,
            targetTheme: block.targetThemeKey,
            blockColor: block.blockColor,
            isClicked: block.isClicked,
            fadeProgress: block.fadeProgress
        }));
    }
    
    /**
     * Force cleanup of all blocks (for testing/debugging)
     */
    clearAllBlocks() {
        this.state.erasableBlocks = [];
        console.log('All interactive blocks cleared');
    }
}