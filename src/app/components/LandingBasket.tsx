"use client";

import { useState } from "react";
import styled, { keyframes, css } from "styled-components";

// Animations
const float = keyframes`
  0%, 100% { transform: translateY(0px) rotate(0deg); }
  50% { transform: translateY(-10px) rotate(1deg); }
`;

const swing = keyframes`
  0% { transform: rotate(0deg); }
  20% { transform: rotate(15deg); }
  40% { transform: rotate(-10deg); }
  60% { transform: rotate(5deg); }
  80% { transform: rotate(-2deg); }
  100% { transform: rotate(0deg); }
`;

const blink = keyframes`
  0%, 100% { opacity: 1; }
  50% { opacity: 0.8; }
  52% { opacity: 0.2; }
  54% { opacity: 0.8; }
  56% { opacity: 1; }
  90% { opacity: 1; }
  92% { opacity: 0.2; }
  94% { opacity: 1; }
`;

const marqueemove = keyframes`
  0% { background-position: 0 0; }
  100% { background-position: 50px 50px; }
`;

const oilFlicker = keyframes`
  0%, 100% { 
    color: #fff;
    text-shadow: 
      0 0 5px var(--neon-blue),
      0 0 10px var(--neon-blue),
      0 0 20px var(--neon-blue),
      0 0 40px var(--neon-blue);
  }
  10%, 30%, 50%, 70%, 90% { 
    color: rgba(218, 175, 60, 0.95);
    text-shadow: 
      0 0 5px rgba(218, 175, 60, 0.8),
      0 0 10px rgba(184, 134, 11, 0.7),
      0 0 20px rgba(218, 175, 60, 0.6),
      0 0 40px rgba(139, 90, 19, 0.4);
  }
  15%, 35%, 55%, 75%, 95% { 
    color: rgba(255, 215, 0, 0.9);
    text-shadow: 
      0 0 5px rgba(255, 215, 0, 0.9),
      0 0 10px rgba(218, 175, 60, 0.8),
      0 0 20px rgba(184, 134, 11, 0.6),
      0 0 40px rgba(139, 90, 19, 0.5);
  }
`;

// Oil drip animation - slow viscous ooze
const oilOoze = keyframes`
  0% {
    transform: translateY(0) scaleY(1);
    opacity: 0;
  }
  5% {
    opacity: 0.9;
  }
  15% {
    transform: translateY(0) scaleY(1.3);
    opacity: 0.9;
  }
  35% {
    transform: translateY(15px) scaleY(1.1);
  }
  55% {
    transform: translateY(50vh) scaleY(1);
  }
  80% {
    transform: translateY(80vh) scaleY(0.9);
    opacity: 0.7;
  }
  100% {
    transform: translateY(100vh) scaleY(0.7);
    opacity: 0;
  }
`;

interface OilDropletProps {
  $delay: number;
  $right: number;
}

const OilDroplet = styled.div<OilDropletProps>`
  position: absolute;
  bottom: -5px;
  right: ${props => props.$right}px;
  width: 7px;
  height: 12px;
  background: radial-gradient(
    ellipse at 50% 30%,
    rgba(218, 175, 60, 0.9) 0%,
    rgba(184, 134, 11, 0.9) 40%,
    rgba(139, 90, 19, 0.85) 70%,
    rgba(110, 65, 10, 0.8) 100%
  );
  /* Teardrop shape: rounded top, pointed bottom */
  border-radius: 50% 50% 50% 50% / 60% 60% 40% 40%;
  clip-path: polygon(50% 0%, 100% 38%, 85% 75%, 50% 100%, 15% 75%, 0% 38%);
  animation: ${oilOoze} 14s ease-in-out infinite;
  animation-delay: ${props => props.$delay}s;
  filter: blur(0.2px);
  box-shadow: 
    0 2px 4px rgba(80, 50, 10, 0.4),
    inset 0 -2px 3px rgba(220, 180, 80, 0.3);
  z-index: 5;
  pointer-events: none;
`;

interface SwingProps {
  $isSwinging: boolean;
}

const Wrapper = styled.div`
  position: relative;
  width: 100%;
  height: 100vh;
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  z-index: var(--z-content);
  overflow: hidden;
  padding-bottom: 5vh;
`;

const MainTitleBox = styled.div`
  background: rgba(0, 0, 0, 0.6);
  backdrop-filter: blur(5px);
  padding: 1rem 2rem;
  border-radius: 15px;
  border: 3px solid var(--chrome-silver);
  box-shadow: 0 0 20px rgba(0,0,0,0.5), 0 0 10px var(--neon-pink);
  text-align: center;
  margin-bottom: 2rem;
  z-index: 20;
  transform: rotate(-2deg);
  
  @media (max-width: 768px) {
    padding: 0.75rem 1.5rem;
    margin-bottom: 1rem;
    border-width: 2px;
  }
`;

const LogoText = styled.h1`
  font-family: var(--font-retro);
  font-size: clamp(2rem, 8vw, 6rem);
  color: var(--cherry-red);
  margin: 0;
  line-height: 1.1;
  text-shadow: 
    2px 2px 0px #fff,
    4px 4px 0px #000;
  
  span {
    display: block;
    font-family: var(--font-display);
    font-size: 0.3em;
    color: var(--mint-green);
    letter-spacing: 2px;
    margin-top: 0.5rem;
    text-shadow: 1px 1px 0 #000;
  }
  
  @media (max-width: 768px) {
    font-size: clamp(1.5rem, 10vw, 3rem);
    text-shadow: 
      1px 1px 0px #fff,
      2px 2px 0px #000;
    
    span {
      font-size: 0.35em;
      letter-spacing: 1px;
      margin-top: 0.25rem;
    }
  }
`;

const VintageSignWrapper = styled.div<SwingProps>`
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: center;
  cursor: pointer;
  transition: transform 0.3s ease;
  
  /* Hover Float */
  animation: ${float} 6s ease-in-out infinite;

  ${props => props.$isSwinging && css`
    animation: ${swing} 1.5s ease-in-out forwards;
  `}

  &:hover {
    transform: scale(1.05);
  }
`;

const SignBoard = styled.div`
  position: relative;
  background: var(--diner-black);
  border: 8px solid var(--chrome-silver);
  border-radius: 30px;
  padding: 1.5rem 3rem;
  display: flex;
  flex-direction: column;
  align-items: center;
  box-shadow: 
    0 20px 50px rgba(0,0,0,0.6),
    inset 0 0 30px rgba(0,0,0,0.8),
    0 0 0 2px #fff,
    0 0 20px var(--neon-blue);
  z-index: 10;
  min-width: 300px;

  /* Decorative stars */
  &::before, &::after {
    content: '★';
    position: absolute;
    top: 50%;
    transform: translateY(-50%);
    color: var(--gold);
    font-size: 2rem;
    text-shadow: 0 0 10px var(--gold);
  }
  &::before { left: 1rem; }
  &::after { right: 1rem; }
  
  @media (max-width: 768px) {
    border-width: 5px;
    border-radius: 20px;
    padding: 1rem 1.5rem;
    min-width: 240px;
    
    &::before, &::after {
      font-size: 1.25rem;
    }
    &::before { left: 0.5rem; }
    &::after { right: 0.5rem; }
  }
`;

const SignInner = styled.div`
  border: 2px solid var(--cream);
  border-radius: 12px;
  padding: 1rem 2rem;
  background: radial-gradient(circle, #333 0%, #000 100%);
  width: 100%;
  text-align: center;
  
  @media (max-width: 768px) {
    padding: 0.75rem 1rem;
    border-radius: 8px;
  }
`;

const DinerText = styled.h2`
  position: relative;
  font-family: var(--font-retro);
  font-size: clamp(1.5rem, 6vw, 4rem);
  color: #fff;
  text-transform: uppercase;
  letter-spacing: clamp(2px, 1.5vw, 8px);
  margin: 0;
  text-shadow: 
    2px 2px 0px rgba(255, 255, 255, 0.3),
    0 0 5px var(--neon-blue),
    0 0 10px var(--neon-blue),
    0 0 20px var(--neon-blue),
    0 0 40px var(--neon-blue);
  animation: ${oilFlicker} 8s infinite;
  filter: contrast(1.1) saturate(1.2);
  
  /* Grease stains effect */
  &::before {
    content: attr(data-text);
    position: absolute;
    left: 0;
    top: 0;
    width: 100%;
    height: 100%;
    background: radial-gradient(
      ellipse 40% 30% at 20% 40%,
      rgba(218, 175, 60, 0.15) 0%,
      transparent 50%
    ),
    radial-gradient(
      ellipse 35% 25% at 70% 60%,
      rgba(184, 134, 11, 0.12) 0%,
      transparent 50%
    ),
    radial-gradient(
      ellipse 30% 20% at 50% 30%,
      rgba(255, 215, 0, 0.1) 0%,
      transparent 50%
    );
    pointer-events: none;
    filter: blur(2px);
    opacity: 0.7;
  }
  
  @media (max-width: 768px) {
    font-size: clamp(1.25rem, 5.5vw, 2.5rem);
    letter-spacing: clamp(1px, 1vw, 4px);
    text-shadow: 
      1px 1px 0px rgba(255, 255, 255, 0.3),
      0 0 3px var(--neon-blue),
      0 0 6px var(--neon-blue),
      0 0 12px var(--neon-blue);
  }
`;

// The big arrow pointing down
const ArrowContainer = styled.div`
  position: absolute;
  top: -40px;
  right: -70px; /* Bring it slightly closer */
  width: 150px;
  height: 200px;
  z-index: 20;
  transform: rotate(15deg);
  pointer-events: none;

  svg {
    width: 100%;
    height: 100%;
    filter: drop-shadow(0 0 10px var(--cherry-red));
  }
  
  /* Bulbs animation */
  .bulb {
    animation: ${blink} 1s infinite alternate;
  }
  .bulb:nth-child(2n) { animation-delay: 0.5s; }
  .bulb:nth-child(3n) { animation-delay: 0.2s; }

  @media (max-width: 768px) {
    top: -30px;
    right: -30px;
    width: 80px;
    height: 120px;
  }
`;

const ClickToEnterPlaque = styled.div`
  margin-top: -20px; /* Increase overlap */
  background: var(--cherry-red);
  color: var(--cream);
  padding: 1.5rem 1.5rem 0.5rem 1.5rem; /* Increase top padding */
  border-radius: 0 0 15px 15px;
  font-family: var(--font-retro);
  font-size: clamp(0.9rem, 3vw, 1.2rem);
  border: 4px solid var(--chrome-silver);
  border-top: none;
  box-shadow: 0 10px 20px rgba(0,0,0,0.4);
  z-index: 5;
  transform-origin: top center;
  animation: ${swing} 3s ease-in-out infinite alternate;
  
  @media (max-width: 768px) {
    margin-top: -15px;
    padding: 1rem 1rem 0.5rem 1rem;
    border-width: 3px;
    border-radius: 0 0 10px 10px;
  }
`;

const LandingDiner = () => {
  const [isSwinging, setIsSwinging] = useState(false);

  const handleEnter = () => {
    if (isSwinging) return;
    setIsSwinging(true);
    
    // Scroll down after animation
    setTimeout(() => {
      const lecturesSection = document.getElementById("course-description");
      if (lecturesSection) {
        lecturesSection.scrollIntoView({ behavior: "smooth" });
      }
    }, 800);

    // Reset after a while
    setTimeout(() => {
      setIsSwinging(false);
    }, 2000);
  };

  return (
    <Wrapper>
      <MainTitleBox>
        <LogoText>
          Deep Learning
          <span>CSCI 1470 @ Brown</span>
        </LogoText>
      </MainTitleBox>
      
      <VintageSignWrapper $isSwinging={isSwinging} onClick={handleEnter}>
        {/* Curvy Arrow SVG */}
        <ArrowContainer>
           <svg viewBox="0 0 100 150" fill="none" xmlns="http://www.w3.org/2000/svg">
             {/* Arrow Body */}
             <path d="M20,10 Q60,10 60,50 V100 L40,100 L70,140 L100,100 L80,100 V50 Q80,-10 20,-10 Z" 
                   fill="#FFD700" stroke="#B8860B" strokeWidth="2" />
             <path d="M30,15 Q50,15 50,55 V90 L40,90 L70,125 L100,90 L90,90 V55 Q90,5 30,5 Z" 
                   fill="#FF4500" />
             
             {/* Light Bulbs */}
             <circle className="bulb" cx="40" cy="10" r="3" fill="#FFF" />
             <circle className="bulb" cx="60" cy="25" r="3" fill="#FFF" />
             <circle className="bulb" cx="70" cy="45" r="3" fill="#FFF" />
             <circle className="bulb" cx="70" cy="65" r="3" fill="#FFF" />
             <circle className="bulb" cx="70" cy="85" r="3" fill="#FFF" />
             <circle className="bulb" cx="70" cy="105" r="3" fill="#FFF" />
             <circle className="bulb" cx="70" cy="125" r="3" fill="#FFF" /> {/* Tip fixed */}
           </svg>
        </ArrowContainer>

        <SignBoard>
          <SignInner>
            <DinerText>THE DEEP FRIED</DinerText>
            <DinerText>DL DINER</DinerText>
          </SignInner>
          {/* Staggered oil droplets from corner */}
          <OilDroplet $delay={0} $right={6} />
          <OilDroplet $delay={4} $right={6} />
          <OilDroplet $delay={8} $right={6} />
          <OilDroplet $delay={11} $right={6} />
        </SignBoard>

        <ClickToEnterPlaque>
          Click to enter 🧑🏽‍🍳
        </ClickToEnterPlaque>
      </VintageSignWrapper>
    </Wrapper>
  );
};

export default LandingDiner;