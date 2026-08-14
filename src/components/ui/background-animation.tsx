'use client';

import { useEffect, useRef } from 'react';

// Helper function to generate a random number within a range
function random(min: number, max: number) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

class Ball {
  x: number;
  y: number;
  velX: number;
  velY: number;
  image: HTMLImageElement;
  size: number;
  gravity: number;
  dampening: number;
  bounces: number;

  constructor(x: number, y: number, velX: number, velY: number, image: HTMLImageElement, size: number) {
    this.x = x;
    this.y = y;
    this.velX = velX;
    this.velY = velY;
    this.image = image;
    this.size = size;
    this.gravity = 0.1;
    this.dampening = 0.48;
    this.bounces = 0;
  }

  draw(ctx: CanvasRenderingContext2D) {
    // Opacity decreases with each bounce, reaching zero on the 3rd bounce.
    const opacity = Math.max(0, 1 - (this.bounces / 3));

    ctx.save();
    ctx.globalAlpha = opacity;
    ctx.drawImage(this.image, this.x - this.size, this.y - this.size, this.size * 2, this.size * 2);
    ctx.restore();
  }

  update(width: number, height: number) {
    // Apply gravity
    this.velY += this.gravity;

    // Floor collision (bounce)
    if ((this.y + this.size) >= height && this.velY > 0) {
      this.y = height - this.size; // prevent sinking
      this.velY *= -this.dampening;
      if (this.bounces < 3) {
        this.bounces++;
      }
    }

    this.x += this.velX;
    this.y += this.velY;
  }
}

const BackgroundAnimation = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const ballsRef = useRef<Ball[]>([]);
  const animationFrameIdRef = useRef<number | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let width = canvas.width = window.innerWidth;
    let height = canvas.height = window.innerHeight;

    const startAnimation = () => {
      // Stop any existing animation loop
      if (animationFrameIdRef.current) {
        cancelAnimationFrame(animationFrameIdRef.current);
      }

      // Initialize balls
      const img = new Image();
      img.src = '/bounce.png';
      img.onload = () => {
        ballsRef.current = [];
        for (let i = 0; i < 5; i++) {
          const size = random(20, 50);
          const ball = new Ball(
            random(size, width - size),
            random(-height, 0) - size,
            random(-1, 1) || 0.5,
            random(0.5, 1.5),
            img,
            size
          );
          ballsRef.current.push(ball);
        }
        loop(); // Start the animation loop only after balls are created
      };
    };

    const loop = () => {
      if (!ctx) return;

      ctx.fillStyle = 'rgb(24, 24, 27)'; // Changed to solid color to remove vapor trail
      ctx.fillRect(0, 0, width, height);

      // First, update and draw all balls currently in the animation.
      for (const ball of ballsRef.current) {
        ball.update(width, height);
        ball.draw(ctx);
      }

      // After drawing, filter out the balls that have completed their 3 bounces for the next frame.
      ballsRef.current = ballsRef.current.filter(ball => ball.bounces < 3);

      // Only continue the loop if there are balls left
      if (ballsRef.current.length > 0) {
        animationFrameIdRef.current = requestAnimationFrame(loop);
      } else if (animationFrameIdRef.current) {
        cancelAnimationFrame(animationFrameIdRef.current);
        animationFrameIdRef.current = null;
      }
    };

    const handleResize = () => {
      width = canvas.width = window.innerWidth;
      height = canvas.height = window.innerHeight;
      startAnimation();
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        startAnimation();
      }
    };

    startAnimation(); // Initial start

    window.addEventListener('resize', handleResize);
    document.addEventListener('visibilitychange', handleVisibilityChange);

    // Cleanup function
    return () => {
      if (animationFrameIdRef.current) {
        cancelAnimationFrame(animationFrameIdRef.current);
      }
      window.removeEventListener('resize', handleResize);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, []);

  return <canvas ref={canvasRef} className="fixed top-0 left-0 w-full h-full -z-50" />;
};

export default BackgroundAnimation;
