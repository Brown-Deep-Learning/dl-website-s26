"use client";

import React from "react";
import styled from "styled-components";

interface VintageSignProps {
  text: string;
  color?: string;
  rotate?: string;
}

const SignContainer = styled.div<{ $rotate: string }>`
  position: relative;
  display: inline-block;
  transform: rotate(${props => props.$rotate});
  margin-bottom: 3rem;
  z-index: 10;
  max-width: 95%;
  
  @media (max-width: 768px) {
    margin-bottom: 2rem;
  }
`;

const SignBoard = styled.div`
  background: var(--diner-black);
  padding: 1.5rem 3rem;
  border-radius: 50px;
  border: 6px solid var(--chrome-silver);
  box-shadow: 
    0 10px 20px rgba(0,0,0,0.5),
    inset 0 0 20px rgba(0,0,0,0.8),
    0 0 15px var(--chrome-silver);
  position: relative;
  
  /* Horizontal slats background pattern */
  background-image: repeating-linear-gradient(
    0deg,
    transparent,
    transparent 10px,
    rgba(30, 30, 30, 0.5) 10px,
    rgba(30, 30, 30, 0.5) 20px
  );
  
  @media (max-width: 768px) {
    padding: 1rem 1.5rem;
    border-radius: 30px;
    border-width: 4px;
  }
  
  @media (max-width: 480px) {
    padding: 0.75rem 1rem;
    border-radius: 20px;
    border-width: 3px;
  }
`;

const NeonText = styled.h2<{ $color: string }>`
  font-family: var(--font-retro, 'Pacifico', cursive);
  font-size: clamp(1.5rem, 5vw, 3rem);
  color: ${props => props.$color};
  margin: 0;
  text-align: center;
  white-space: nowrap;
  text-shadow: 
    0 0 5px ${props => props.$color},
    0 0 15px ${props => props.$color},
    0 0 30px ${props => props.$color};
    
  /* "Off" flickering effect for realism */
  @keyframes flicker {
    0%, 18%, 22%, 25%, 53%, 57%, 100% {
      opacity: 1;
    }
    20%, 24%, 55% {
      opacity: 0.7;
    }
  }
  
  animation: flicker 4s infinite alternate;
  
  @media (max-width: 768px) {
    font-size: clamp(1.25rem, 4.5vw, 2rem);
    text-shadow: 
      0 0 3px ${props => props.$color},
      0 0 8px ${props => props.$color},
      0 0 15px ${props => props.$color};
  }
  
  @media (max-width: 480px) {
    font-size: clamp(1rem, 4vw, 1.5rem);
  }
`;

const VintageSign: React.FC<VintageSignProps> = ({ 
  text, 
  color = "var(--cherry-red)", 
  rotate = "-2deg",
}) => {
  return (
    <SignContainer $rotate={rotate}>
      <SignBoard>
        <NeonText $color={color}>{text}</NeonText>
      </SignBoard>
    </SignContainer>
  );
};

export default VintageSign;
