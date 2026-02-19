"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import styled, { keyframes, css } from "styled-components";
import Image from "next/image";
import { useAssetPath } from "../hooks/useAssetPath";

// ===== ANIMATIONS =====

// Oil bubbles rise with viscous movement - slower and more realistic
const riseBubble = keyframes`
  0% {
    transform: translateY(0) scale(1);
    opacity: 0.85;
  }
  15% {
    opacity: 0.95;
  }
  40% {
    transform: translateY(-35px) scale(1.05);
    opacity: 0.9;
  }
  70% {
    transform: translateY(-80px) scale(0.8);
    opacity: 0.5;
  }
  100% {
    transform: translateY(-120px) scale(0.4);
    opacity: 0;
  }
`;

// More pronounced viscous wobble for oil
const viscousWobble = keyframes`
  0%, 100% { 
    transform: translateX(0) scaleX(1) scaleY(1);
  }
  15% { 
    transform: translateX(-6px) scaleX(1.08) scaleY(0.94);
  }
  35% { 
    transform: translateX(-3px) scaleX(0.96) scaleY(1.05);
  }
  65% { 
    transform: translateX(5px) scaleX(1.06) scaleY(0.95);
  }
  85% { 
    transform: translateX(3px) scaleX(0.98) scaleY(1.03);
  }
`;

// Gentle bob in oil for food items
const bobInOil = keyframes`
  0%, 100% {
    transform: translateY(0) rotate(0deg);
  }
  25% {
    transform: translateY(-8px) rotate(2deg);
  }
  50% {
    transform: translateY(-4px) rotate(0deg);
  }
  75% {
    transform: translateY(-10px) rotate(-2deg);
  }
`;

// Horizontal drift for food items
const driftLeft = keyframes`
  0% { left: 105%; }
  100% { left: -25%; }
`;

const driftRight = keyframes`
  0% { left: -25%; }
  100% { left: 105%; }
`;

// Slow wave animation for oil surface
const waveAnimation = keyframes`
  0% { transform: translateX(0); }
  100% { transform: translateX(-50%); }
`;

// Shimmer animation for oil glossiness
const shimmer = keyframes`
  0% {
    background-position: 200% 0;
  }
  100% {
    background-position: -200% 0;
  }
`;

// Subtle pulse for oil sediment
const sedimentPulse = keyframes`
  0%, 100% {
    opacity: 0.2;
  }
  50% {
    opacity: 0.35;
  }
`;

// Heat distortion effect
const heatDistortion = keyframes`
  0%, 100% {
    transform: translateY(0) scaleY(1);
  }
  25% {
    transform: translateY(-2px) scaleY(1.02);
  }
  50% {
    transform: translateY(0) scaleY(0.98);
  }
  75% {
    transform: translateY(2px) scaleY(1.01);
  }
`;

// Foam bubbles popping/shifting
const foamShift = keyframes`
  0% { transform: translateX(0) translateY(0); }
  33% { transform: translateX(2px) translateY(-1px); }
  66% { transform: translateX(-1px) translateY(1px); }
  100% { transform: translateX(0) translateY(0); }
`;

// ===== HELPER FUNCTIONS =====

// Smoothly interpolate between two colors based on darkness level (0-1)
const interpolateColor = (lightColor: number[], darkColor: number[], darkness: number): string => {
  const r = Math.round(lightColor[0] + (darkColor[0] - lightColor[0]) * darkness);
  const g = Math.round(lightColor[1] + (darkColor[1] - lightColor[1]) * darkness);
  const b = Math.round(lightColor[2] + (darkColor[2] - lightColor[2]) * darkness);
  return `rgb(${r}, ${g}, ${b})`;
};

// Generate realistic oil gradient with deep amber tones - Enhanced for Deep Fried theme
const getOilGradient = (darkness: number): string => {
  // Fresh golden-amber oil colors (richer, deeper saturation)
  const lightColors = [
    [130, 75, 8],     // 0% - deep caramelized base
    [145, 88, 10],    // 15%
    [165, 100, 12],   // 30%
    [185, 115, 18],   // 45%
    [205, 135, 28],   // 60% - golden honey
    [220, 155, 40],   // 75%
    [235, 170, 55],   // 90%
    [250, 190, 70],   // 100% - bright golden surface
  ];
  
  // Used/dark oil colors (brownish, murky - more realistic sizzling oil)
  const darkColors = [
    [70, 42, 6],      // 0% - very dark caramelized base
    [82, 50, 8],      // 15%
    [95, 58, 10],     // 30%
    [115, 68, 12],    // 45%
    [135, 82, 16],    // 60%
    [152, 95, 22],    // 75%
    [170, 108, 30],   // 90%
    [188, 125, 40],   // 100%
  ];
  
  const stops = [0, 15, 30, 45, 60, 75, 90, 100];
  
  const gradientStops = stops.map((stop, i) => {
    const color = interpolateColor(lightColors[i], darkColors[i], darkness);
    return `${color} ${stop}%`;
  });
  
  return `linear-gradient(to top, ${gradientStops.join(', ')})`;
};

// ===== STYLED COMPONENTS =====

interface OilContainerProps {
  $fillPercent: number;
  $darkness: number;
  $isVisible: boolean;
}

const OilContainer = styled.div.attrs<OilContainerProps>(props => ({
  style: {
    height: `${Math.min(Math.max(props.$fillPercent, 0), 100)}vh`,
    background: getOilGradient(props.$darkness),
    opacity: props.$isVisible ? (props.$fillPercent >= 100 ? 1 : (0.88 + props.$darkness * 0.08)) : 0,
  }
}))<OilContainerProps>`
  position: fixed;
  bottom: 0;
  left: 0;
  width: 100vw;
  z-index: var(--z-oil-overlay);
  pointer-events: none;
  overflow: visible;
  transition: opacity 0.5s ease-out;
  will-change: opacity;
`;

// Inner oil texture layer for viscosity effect with more depth
const OilTexture = styled.div`
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background-image: 
    /* Darker sediment patches at bottom */
    radial-gradient(ellipse 400px 300px at 15% 90%, rgba(80, 45, 10, 0.35) 0%, transparent 60%),
    radial-gradient(ellipse 350px 250px at 85% 95%, rgba(90, 50, 12, 0.3) 0%, transparent 60%),
    radial-gradient(ellipse 300px 200px at 50% 100%, rgba(70, 40, 8, 0.25) 0%, transparent 60%),
    /* Mid-level oil texture */
    radial-gradient(ellipse 450px 350px at 35% 50%, rgba(180, 110, 30, 0.12) 0%, transparent 65%),
    radial-gradient(ellipse 380px 280px at 75% 45%, rgba(170, 100, 25, 0.1) 0%, transparent 65%),
    /* Surface shimmer areas */
    radial-gradient(ellipse 300px 180px at 20% 10%, rgba(220, 150, 50, 0.15) 0%, transparent 70%),
    radial-gradient(ellipse 250px 150px at 70% 15%, rgba(210, 140, 45, 0.12) 0%, transparent 70%);
  pointer-events: none;
`;

// Animated shimmer layer for oily shine - more visible
const OilShimmer = styled.div`
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background: linear-gradient(
    90deg,
    transparent 0%,
    rgba(255, 255, 255, 0.02) 20%,
    rgba(255, 220, 120, 0.12) 40%,
    rgba(255, 240, 160, 0.18) 50%,
    rgba(255, 220, 120, 0.12) 60%,
    rgba(255, 255, 255, 0.02) 80%,
    transparent 100%
  );
  background-size: 200% 100%;
  animation: ${shimmer} 18s ease-in-out infinite;
  pointer-events: none;
  opacity: 0.7;
`;

// Oil sheen/highlight layer
const OilSheen = styled.div`
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background: linear-gradient(
    145deg,
    rgba(255, 240, 180, 0.08) 0%,
    transparent 20%,
    transparent 80%,
    rgba(255, 235, 160, 0.06) 100%
  );
  pointer-events: none;
`;

// Heat haze effect near bottom
const HeatHaze = styled.div`
  position: absolute;
  bottom: 0;
  left: 0;
  width: 100%;
  height: 30%;
  background: linear-gradient(
    to top,
    rgba(255, 200, 80, 0.15) 0%,
    rgba(255, 180, 60, 0.08) 50%,
    transparent 100%
  );
  animation: ${heatDistortion} 2.5s ease-in-out infinite;
  pointer-events: none;
  filter: blur(3px);
`;

// Foam bubbles layer at top
const FoamLayer = styled.div`
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 120px;
  background-image: 
    radial-gradient(circle at 10% 20%, rgba(255, 250, 220, 0.3) 0%, transparent 5px),
    radial-gradient(circle at 15% 15%, rgba(255, 250, 220, 0.4) 0%, transparent 6px),
    radial-gradient(circle at 20% 25%, rgba(255, 250, 220, 0.25) 0%, transparent 4px),
    radial-gradient(circle at 25% 18%, rgba(255, 250, 220, 0.35) 0%, transparent 7px),
    radial-gradient(circle at 30% 22%, rgba(255, 250, 220, 0.2) 0%, transparent 5px),
    radial-gradient(circle at 35% 16%, rgba(255, 250, 220, 0.3) 0%, transparent 6px),
    radial-gradient(circle at 40% 24%, rgba(255, 250, 220, 0.25) 0%, transparent 4px),
    radial-gradient(circle at 45% 20%, rgba(255, 250, 220, 0.4) 0%, transparent 8px),
    radial-gradient(circle at 50% 15%, rgba(255, 250, 220, 0.2) 0%, transparent 5px),
    radial-gradient(circle at 55% 25%, rgba(255, 250, 220, 0.3) 0%, transparent 6px),
    radial-gradient(circle at 60% 18%, rgba(255, 250, 220, 0.35) 0%, transparent 7px),
    radial-gradient(circle at 65% 22%, rgba(255, 250, 220, 0.25) 0%, transparent 4px),
    radial-gradient(circle at 70% 16%, rgba(255, 250, 220, 0.3) 0%, transparent 6px),
    radial-gradient(circle at 75% 24%, rgba(255, 250, 220, 0.2) 0%, transparent 5px),
    radial-gradient(circle at 80% 20%, rgba(255, 250, 220, 0.35) 0%, transparent 7px),
    radial-gradient(circle at 85% 15%, rgba(255, 250, 220, 0.25) 0%, transparent 5px),
    radial-gradient(circle at 90% 25%, rgba(255, 250, 220, 0.3) 0%, transparent 6px),
    radial-gradient(circle at 95% 18%, rgba(255, 250, 220, 0.4) 0%, transparent 7px);
  background-size: 300px 100px;
  background-repeat: repeat-x;
  animation: ${foamShift} 4s ease-in-out infinite, ${waveAnimation} 20s linear infinite;
  opacity: 0.7;
  pointer-events: none;
`;

// SVG Wave Surface for oil top
interface WaveSurfaceProps {
  $isPaused: boolean;
}

const WaveSurface = styled.div<WaveSurfaceProps>`
  position: absolute;
  top: -35px;
  left: 0;
  width: 200%;
  height: 70px;
  animation: ${waveAnimation} 14s linear infinite;
  animation: ${waveAnimation} 14s linear infinite;
  will-change: transform;
  will-change: transform;
`;

const WaveSVG = styled.svg`
  width: 100%;
  height: 100%;
`;

// Oil bubble - more opaque and amber-colored
interface BubbleProps {
  $left: number;
  $bottom: number;
  $size: number;
  $duration: number;
  $delay: number;
  $isPaused: boolean;
  $cluster: boolean; // New: for clustered bubbles near heat source
}

const Bubble = styled.div.attrs<BubbleProps>(props => ({
  style: {
    left: `${props.$left}%`,
    bottom: `${props.$bottom}%`,
    width: `${props.$size}px`,
    height: `${props.$size * 0.85}px`, // More elliptical for viscous oil
    animationDuration: `${props.$duration}s, ${props.$duration * 0.7}s`,
    animationDelay: `${props.$delay}s, 0s`,
  }
}))<BubbleProps>`
  position: absolute;
  background: radial-gradient(
    ellipse at 35% 25%,
    rgba(255, 240, 180, 0.95) 0%,
    rgba(235, 180, 70, 0.85) 12%,
    rgba(210, 150, 50, 0.7) 25%,
    rgba(185, 120, 35, 0.5) 50%,
    rgba(150, 90, 20, 0.3) 75%,
    transparent 100%
  );
  border-radius: 50%;
  animation: ${riseBubble} ease-out infinite, ${viscousWobble} ease-in-out infinite;
  animation: ${riseBubble} ease-out infinite, ${viscousWobble} ease-in-out infinite;
  box-shadow: 
    /* Inner shadow for depth */
    inset -2px -3px 6px rgba(140, 85, 20, 0.4),
    inset 2px 2px 4px rgba(255, 235, 170, 0.6),
    /* Outer glow */
    0 0 8px rgba(230, 170, 60, 0.3),
    0 0 4px rgba(200, 140, 40, 0.4);
  border: 1.5px solid rgba(240, 200, 100, 0.5);
  will-change: transform, opacity;
  filter: blur(0.3px); /* Slight blur for realism */
`;

// Small static bubbles for texture - more visible
interface SmallBubbleProps {
  $left: number;
  $bottom: number;
  $size: number;
}

const SmallBubble = styled.div.attrs<SmallBubbleProps>(props => ({
  style: {
    left: `${props.$left}%`,
    bottom: `${props.$bottom}%`,
    width: `${props.$size}px`,
    height: `${props.$size * 0.9}px`,
  }
}))<SmallBubbleProps>`
  position: absolute;
  background: radial-gradient(
    circle at 40% 30%,
    rgba(255, 230, 150, 0.6) 0%,
    rgba(220, 170, 80, 0.4) 40%,
    rgba(180, 120, 40, 0.2) 70%,
    transparent 100%
  );
  border-radius: 50%;
  box-shadow: 
    inset -1px -1px 2px rgba(140, 85, 20, 0.3),
    inset 1px 1px 2px rgba(255, 240, 180, 0.4);
  border: 0.5px solid rgba(230, 190, 110, 0.4);
  pointer-events: none;
`;

// Oil sediment/dark patches
interface SedimentProps {
  $left: number;
  $top: number;
  $size: number;
  $delay: number;
  $duration: number;
}

const Sediment = styled.div.attrs<SedimentProps>(props => ({
  style: {
    left: `${props.$left}%`,
    top: `${props.$top}%`,
    width: `${props.$size}px`,
    height: `${props.$size * 0.6}px`,
    animationDelay: `${props.$delay}s`,
  }
}))<SedimentProps>`
  position: absolute;
  background: radial-gradient(
    ellipse at center,
    rgba(60, 35, 10, 0.4) 0%,
    rgba(80, 45, 12, 0.25) 40%,
    transparent 70%
  );
  border-radius: 50%;
  animation: ${sedimentPulse} 4s ease-in-out infinite;
  filter: blur(8px);
  pointer-events: none;
`;

// Floating food items
interface FoodItemProps {
  $left: number;
  $top: number;
  $size: number;
  $delay: number;
  $duration: number;
  $isPaused: boolean;
  $rotation: number;
  $isLeftToRight: boolean;
}

const FoodItem = styled.div.attrs<FoodItemProps>(props => ({
    // Note: We don't set 'left' here because the animation handles x-position
  style: {
    top: `${props.$top}%`,
    width: `${props.$size}px`,
    height: `${props.$size}px`,
    animationDelay: `${props.$delay}s, ${props.$delay}s`, // Delay for both drift and bob
    animationDuration: `${props.$duration}s, 3s`, // Drift duration, Bob duration
    transform: `rotate(${props.$rotation}deg)`,
  }
}))<FoodItemProps>`
  position: absolute;
  /* Combine horizontal drift and vertical bobbing */
  animation: 
    ${props => props.$isLeftToRight ? driftRight : driftLeft} linear infinite,
    ${bobInOil} ease-in-out infinite;

  animation-fill-mode: both;
  animation-fill-mode: both;
  filter: drop-shadow(0 4px 8px rgba(0, 0, 0, 0.3));
  pointer-events: none;
  z-index: 10;
`;

// Mute button - vintage diner theme
const MuteButton = styled.button<{ $isMuted: boolean; $isVisible: boolean }>`
  position: fixed;
  bottom: 30px;
  left: 30px;
  width: 60px;
  height: 60px;
  border-radius: 50%;
  background: conic-gradient(
    from 180deg,
    #b0b0b0 0%,
    #ffffff 10%,
    #888888 45%,
    #555555 50%,
    #888888 55%,
    #ffffff 90%,
    #b0b0b0 100%
  );
  border: 2px solid var(--chrome-silver, #c0c0c0);
  box-shadow: 
    inset 0 0 5px rgba(0,0,0,0.8),
    inset 2px 2px 5px rgba(255,255,255,0.6),
    0 5px 15px rgba(0,0,0,0.5);
  cursor: pointer;
  z-index: 9999; /* Ensure it's above everything including oil overlay */
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.3s ease;
  opacity: ${props => props.$isVisible ? 1 : 0};
  pointer-events: ${props => props.$isVisible ? 'auto' : 'none'};
  transform: ${props => props.$isVisible ? 'scale(1)' : 'scale(0.8)'};
  
  &:hover {
    transform: scale(1.05);
    box-shadow: 
      inset 0 0 8px rgba(0,0,0,0.9),
      inset 2px 2px 5px rgba(255,255,255,0.7),
      0 8px 20px rgba(0,0,0,0.6);
  }

  &:active {
    transform: scale(0.95);
  }

  &::before {
    content: '';
    position: absolute;
    inset: 6px;
    border-radius: 50%;
    background: radial-gradient(circle at 30% 30%, var(--cream, #f5f5dc), #dcdcdc);
    box-shadow: inset 0 2px 8px rgba(0,0,0,0.4);
  }
`;

const MuteIcon = styled.span<{ $isMuted: boolean }>`
  position: relative;
  z-index: 1;
  font-size: 24px;
  display: flex;
  align-items: center;
  justify-content: center;
  
  ${props => props.$isMuted ? `
    &::after {
      content: '';
      position: absolute;
      width: 2px;
      height: 35px;
      background: var(--cherry-red, #d32f2f);
      transform: rotate(45deg);
      border-radius: 2px;
    }
  ` : ''}
`;

// ===== MAIN COMPONENT =====

interface BubbleData {
  id: number;
  left: number;
  bottom: number;
  size: number;
  duration: number;
  delay: number;
  cluster: boolean; // New: for heat source clustering
}

interface SmallBubbleData {
  id: number;
  left: number;
  bottom: number;
  size: number;
  duration: number;
  delay: number;
}

interface SedimentData {
  id: number;
  left: number;
  top: number;
  size: number;
  delay: number;
  duration: number;
}

interface FoodData {
  id: number;
  svg: string;
  left: number;
  top: number;
  size: number;
  delay: number;
  duration: number;
  rotation: number;
  isLeftToRight: boolean;
}

const friedFoodSVGs = [
  "/svgs/fries.svg",
  "/svgs/chicken.svg", 
  "/svgs/onion-ring.svg",
  "/svgs/shrimp.svg",
  "/svgs/burger.svg",
  "/svgs/corn_dog.svg",
  "/svgs/donut.svg",
  "/svgs/hot_dog.svg"
];

const DeepFriedOverlay = () => {
  const [isVisible, setIsVisible] = useState(false);
  const [showFoods, setShowFoods] = useState(false);
  
  const [bubbles, setBubbles] = useState<BubbleData[]>([]);
  const [smallBubbles, setSmallBubbles] = useState<SmallBubbleData[]>([]);
  const [sediments, setSediments] = useState<SedimentData[]>([]);
  const [foods, setFoods] = useState<FoodData[]>([]);
  
  const containerRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLElement | null>(null);
  const rafIdRef = useRef<number | null>(null);
  const lastScrollTimeRef = useRef<number>(0);
  
  const targetFillRef = useRef(0);
  const targetDarknessRef = useRef(0);
  const currentFillRef = useRef(0);
  const currentDarknessRef = useRef(0);
  


  useEffect(() => {
    // More bubbles, with clustering near bottom (heat source)
    const newBubbles: BubbleData[] = Array.from({ length: 28 }).map((_, i) => {
      const isCluster = i < 18; // Most bubbles cluster near bottom
      const bottom = isCluster 
        ? Math.random() * 15 + 5    // 5-20% from bottom (heat source)
        : Math.random() * 40 + 20;  // 20-60% from bottom (dispersed)
      
      return {
        id: i,
        left: Math.random() * 90 + 5,
        bottom,
        size: isCluster 
          ? Math.random() * 12 + 8   // 8-20px for clustered
          : Math.random() * 8 + 6,   // 6-14px for dispersed
        duration: isCluster
          ? Math.random() * 3 + 4    // 4-7s (slower, more viscous)
          : Math.random() * 2 + 5,   // 5-7s
        delay: Math.random() * 3,
        cluster: isCluster,
      };
    });
    setBubbles(newBubbles);

    // More small static bubbles for texture
    const newSmallBubbles: SmallBubbleData[] = Array.from({ length: 45 }).map((_, i) => ({
      id: i,
      left: Math.random() * 95 + 2.5,
      bottom: Math.random() * 80 + 10,
      size: Math.random() * 4 + 3, // 3-7px
      duration: 0,
       delay: 0,
    }));
    setSmallBubbles(newSmallBubbles);

    // Oil sediment/dark patches
    const newSediments: SedimentData[] = Array.from({ length: 8 }).map((_, i) => ({
      id: i,
      left: Math.random() * 90 + 5,
      top: Math.random() * 60 + 40, // Bottom 60%
      size: Math.random() * 150 + 100, // 100-250px
      delay: Math.random() * 3,
      duration: 0,
    }));
    setSediments(newSediments);

    // Floating food items using SVGs
    // Use slots to prevent initial overlap in vertical space, but they drift so X overlap is inevitable eventually.
    // However, by spacing them out in time and starting Y, we reduce clutter.
    const numberOfFoods = 12;
    const newFoods: FoodData[] = Array.from({ length: numberOfFoods }).map((_, i) => {
      // Create vertical zones to distribute items - WIDER RANGE (5% to 90%)
      const zoneHeight = 85 / numberOfFoods; 
      const top = (i * zoneHeight) + 5 + (Math.random() * 5); // 5% offset + random

      const direction = Math.random() > 0.5; // 50/50 chance
      const duration = Math.random() * 20 + 25; // 25-45s drift time (much slower)

      return {
        id: i,
        svg: friedFoodSVGs[i % friedFoodSVGs.length],
        left: 0, // Handled by animation
        top,
        size: Math.random() * 30 + 50, // 50-80px
        // Use negative delay to have them start at random positions along the path immediately
        delay: Math.random() * -duration, 
        duration,
        rotation: Math.random() * 30 - 15,
        isLeftToRight: direction,
      };
    });
    setFoods(newFoods);
  }, []);

  // Direct DOM manipulation animation loop
  useEffect(() => {
    const animate = () => {
      const container = containerRef.current;
      if (!container) {
        rafIdRef.current = requestAnimationFrame(animate);
        return;
      }

      const targetFill = targetFillRef.current;
      const targetDark = targetDarknessRef.current;
      
      const fillLerpFactor = 0.12;
      const darknessLerpFactor = 0.06;
      
      const newFill = currentFillRef.current + (targetFill - currentFillRef.current) * fillLerpFactor;
      const newDarkness = currentDarknessRef.current + (targetDark - currentDarknessRef.current) * darknessLerpFactor;
      
      currentFillRef.current = newFill;
      currentDarknessRef.current = newDarkness;
      
      const clampedFill = Math.min(Math.max(newFill, 0), 100);
      container.style.height = `${clampedFill}vh`;
      container.style.background = getOilGradient(newDarkness);
      container.style.opacity = newFill > 0.5 ? (newFill >= 100 ? '1' : String(0.88 + newDarkness * 0.08)) : '0';
      
      if (newFill > 1 && !isVisible) {
        setIsVisible(true);
      } else if (newFill < 0.5 && isVisible) {
        setIsVisible(false);
      }
      
      const shouldShowFoods = newFill >= 60;
      if (shouldShowFoods !== showFoods) {
        setShowFoods(shouldShowFoods);
      }
      
      rafIdRef.current = requestAnimationFrame(animate);
    };
    
    rafIdRef.current = requestAnimationFrame(animate);
    
    return () => {
      if (rafIdRef.current) {
        cancelAnimationFrame(rafIdRef.current);
      }
    };
  }, [isVisible, showFoods]);


  // Handle scroll detection
  const handleScroll = useCallback(() => {
    const now = performance.now();
    // const timeSinceLastScroll = now - lastScrollTimeRef.current;
    // lastScrollTimeRef.current = now;
    
    const timeSinceLastScroll = now - lastScrollTimeRef.current;
    lastScrollTimeRef.current = now;
    
    const scrollContainer = scrollContainerRef.current;
    if (!scrollContainer) return;

    const assignmentsSection = document.getElementById("assignments");
    if (!assignmentsSection) return;

    const viewportHeight = window.innerHeight;
    const assignmentsRect = assignmentsSection.getBoundingClientRect();
    const assignmentsTop = assignmentsRect.top;
    const assignmentsBottom = assignmentsRect.bottom;
    const assignmentsHeight = assignmentsBottom - assignmentsTop;
    
    const triggerPoint = viewportHeight - 300;
    
    if (assignmentsTop > triggerPoint) {
      targetFillRef.current = 0;
      targetDarknessRef.current = 0;
    } else if (assignmentsTop <= triggerPoint && assignmentsTop > 0) {
      const progress = (triggerPoint - assignmentsTop) / triggerPoint;
      targetFillRef.current = Math.min(progress * 100, 100);
      targetDarknessRef.current = 0;
    } else if (assignmentsTop <= 0 && assignmentsBottom > 0) {
      targetFillRef.current = 100;
      const scrolledIntoAssignments = Math.abs(assignmentsTop);
      const darknessProgress = Math.min(scrolledIntoAssignments / (assignmentsHeight * 0.8), 1);
      targetDarknessRef.current = darknessProgress * 0.5;
    } else if (assignmentsBottom <= 0) {
      targetFillRef.current = 100;
      targetDarknessRef.current = 1;
    }
  }, []);



  useEffect(() => {
    const container = document.querySelector('[class*="scrollContainer"]') as HTMLElement;
    scrollContainerRef.current = container;

    if (container) {
      container.addEventListener("scroll", handleScroll, { passive: true });
      handleScroll();
    }

    window.addEventListener("scroll", handleScroll, { passive: true });

    return () => {
      if (container) {
        container.removeEventListener("scroll", handleScroll);
      }
      window.removeEventListener("scroll", handleScroll);
    };
  }, [handleScroll]);

  // Dynamic wave color based on darkness - deeper amber tones
  const waveColor = interpolateColor([200, 140, 45], [140, 85, 20], currentDarknessRef.current);
  const waveDarkColor = interpolateColor([160, 110, 30], [110, 65, 15], currentDarknessRef.current);
  const getAssetPath = useAssetPath();

  return (
    <>
    <OilContainer ref={containerRef} $fillPercent={0} $darkness={0} $isVisible={isVisible}>
      {/* Wavy Surface SVG - realistic oil waves */}
      <WaveSurface $isPaused={false}>
        <WaveSVG viewBox="0 0 1200 70" preserveAspectRatio="none">
          <defs>
            <linearGradient id="oilWaveGradient" x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor="transparent" />
              <stop offset="35%" stopColor={waveColor} stopOpacity="0.75" />
              <stop offset="100%" stopColor={waveDarkColor} />
            </linearGradient>
            {/* Glossy highlight gradient - more visible */}
            <linearGradient id="highlightGradient" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="rgba(255,255,255,0)" />
              <stop offset="25%" stopColor="rgba(255,245,200,0.15)" />
              <stop offset="50%" stopColor="rgba(255,250,220,0.22)" />
              <stop offset="75%" stopColor="rgba(255,245,200,0.15)" />
              <stop offset="100%" stopColor="rgba(255,255,255,0)" />
            </linearGradient>
          </defs>
          {/* Primary wave - thicker, more viscous look */}
          <path
            d="M0,35 
               C80,18 160,52 240,35 
               C320,18 400,52 480,35 
               C560,18 640,52 720,35
               C800,18 880,52 960,35
               C1040,18 1120,52 1200,35
               L1200,70 L0,70 Z"
            fill="url(#oilWaveGradient)"
          />
          {/* Secondary smaller wave for oil surface texture */}
          <path
            d="M0,42 
               C50,35 100,50 150,42 
               C200,34 250,50 300,42 
               C350,34 400,50 450,42
               C500,34 550,50 600,42
               C650,34 700,50 750,42
               C800,34 850,50 900,42
               C950,34 1000,50 1050,42
               C1100,34 1150,50 1200,42
               L1200,70 L0,70 Z"
            fill="url(#oilWaveGradient)"
            opacity="0.6"
          />
          {/* Highlight strip on wave crest - more prominent */}
          <path
            d="M0,35 
               C80,18 160,52 240,35 
               C320,18 400,52 480,35 
               C560,18 640,52 720,35
               C800,18 880,52 960,35
               C1040,18 1120,52 1200,35"
            fill="none"
            stroke="url(#highlightGradient)"
            strokeWidth="4"
          />
        </WaveSVG>
      </WaveSurface>
      
      {/* Oil texture layer */}
      <OilTexture />
      
      {/* Animated shimmer */}
      <OilShimmer />
      
      {/* Oil sheen for realism */}
      <OilSheen />
      
      {/* Heat haze effect */}
      <HeatHaze />

      {/* Foam Layer - Top bubbles */}
      <FoamLayer />
      
      {/* Oil sediment patches */}
      {isVisible && sediments.map((sediment) => (
        <Sediment
          key={sediment.id}
          $left={sediment.left}
          $top={sediment.top}
          $size={sediment.size}
          $delay={sediment.delay}
          $duration={sediment.duration}
        />
      ))}
      
      {/* Small static bubbles for texture */}
      {isVisible && smallBubbles.map((bubble) => (
        <SmallBubble
          key={bubble.id}
          $left={bubble.left}
          $bottom={bubble.bottom}
          $size={bubble.size}
        />
      ))}
      
      {/* Rising animated bubbles with clustering */}
      {isVisible && bubbles.map((bubble) => (
        <Bubble
          key={bubble.id}
          $left={bubble.left}
          $bottom={bubble.bottom}
          $size={bubble.size}
          $duration={bubble.duration}
          $delay={bubble.delay}
          $cluster={bubble.cluster}
          $isPaused={false}
        />
      ))}
      
      {/* Floating Food Items using SVGs */}
      {isVisible && showFoods && foods.map((food) => (
        <FoodItem
          key={food.id}
          $left={food.left} // Not used for styling if drift is active, but passed anyway
          $top={food.top}
          $size={food.size}
          $delay={food.delay}
          $duration={food.duration}
          $isPaused={false}
          $rotation={food.rotation}
          $isLeftToRight={food.isLeftToRight}
        >
          <Image
            src={getAssetPath(food.svg)}
            alt="Fried food"
            width={food.size}
            height={food.size}
            style={{ width: '100%', height: '100%', objectFit: 'contain' }}
          />
        </FoodItem>
      ))}
      
    </OilContainer>
    
    </>
  );
};

export default DeepFriedOverlay;