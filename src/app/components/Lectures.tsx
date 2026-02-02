"use client";

import React from "react";
import styled from "styled-components";
import { lectureGroups } from "../data/lectureData";
import { FaVideo, FaFileAlt } from "react-icons/fa";
import VintageSign from "./VintageSign";

// Styled Components
const Section = styled.section`
  padding: 4rem 2rem;
  min-height: 100vh;
  display: flex;
  flex-direction: column;
  align-items: center;
  position: relative;
  z-index: var(--z-content);
`;



const MenuBoard = styled.div`
  background: var(--diner-black);
  padding: 3rem;
  border-radius: 15px;
  box-shadow: 
    0 10px 30px rgba(0,0,0,0.4),
    inset 0 0 30px rgba(0, 0, 0, 0.5);
  width: 100%;
  max-width: 1000px;
  position: relative;
  border: 4px solid var(--chrome-silver);
  
  /* Menu board frame */
  &::before {
    content: '✦ TODAY\\'S SPECIALS ✦';
    position: absolute;
    top: -15px;
    left: 50%;
    transform: translateX(-50%);
    background: var(--cherry-red);
    color: var(--cream);
    padding: 5px 20px;
    border-radius: 20px;
    font-family: var(--font-display);
    letter-spacing: 2px;
    border: 2px solid var(--chrome-silver);
    box-shadow: 0 0 10px var(--cherry-red);
  }
`;

const CategoryTitle = styled.h3`
  font-family: var(--font-display);
  font-size: 1.8rem;
  color: var(--mint-green);
  border-bottom: 2px dashed var(--chrome-silver);
  margin: 2rem 0 1rem;
  padding-bottom: 0.5rem;
  display: flex;
  justify-content: space-between;
  align-items: flex-end;
  text-transform: uppercase;
  letter-spacing: 2px;
  text-shadow: 0 0 5px var(--mint-green);
  
  &::after {
    content: '⭐';
    font-size: 1.2rem;
  }
`;

const MenuItem = styled.li`
  list-style: none;
  display: grid;
  grid-template-columns: auto 1fr auto;
  gap: 1.5rem;
  align-items: center;
  padding: 1rem 0;
  border-bottom: 1px dashed rgba(192, 192, 192, 0.2);
  transition: all 0.2s;
  
  &:hover {
    background: rgba(152, 251, 152, 0.1);
    padding-left: 10px;
    border-radius: 5px;
  }
`;

const ItemDate = styled.span`
  font-family: var(--font-display);
  font-weight: bold;
  color: var(--neon-pink);
  font-size: 0.9rem;
  text-shadow: 0 0 5px var(--neon-pink);
`;

const ItemInfo = styled.div`
  display: flex;
  flex-direction: column;
`;

const ItemName = styled.span`
  font-family: var(--font-display);
  font-size: 1.3rem;
  color: var(--cream);
  text-transform: uppercase;
  letter-spacing: 1px;
`;

const ActionButtons = styled.div`
  display: flex;
  gap: 0.5rem;
`;

const ActionBtn = styled.a`
  display: flex;
  align-items: center;
  gap: 5px;
  padding: 5px 12px;
  border: 2px solid var(--chrome-silver);
  border-radius: 20px;
  color: var(--cream);
  font-size: 0.8rem;
  text-decoration: none;
  transition: all 0.2s;
  background: transparent;
  font-family: var(--font-display);
  text-transform: uppercase;
  
  &:hover {
    background: var(--cherry-red);
    border-color: var(--cherry-red);
    box-shadow: 0 0 10px var(--cherry-red);
  }
`;

const Lectures = () => {
  return (
    <Section id="lectures">
      <VintageSign text="Daily Specials" color="var(--cherry-red)" rotate="-2deg" />
      
      <MenuBoard>
        {lectureGroups.map((group, i) => (
          <div key={i}>
            {group.title && (
              <CategoryTitle>{group.title}</CategoryTitle>
            )}
            <ul>
              {group.lectures.map((lecture) => (
                <MenuItem key={lecture.id}>
                  <ItemDate>{lecture.date || "TBA"}</ItemDate>
                  
                  <ItemInfo>
                    <ItemName>
                      {lecture.title || "To Be Announced"}
                      {i % 2 === 0 && <span style={{marginLeft: '8px'}}>🍳</span>}
                    </ItemName>
                  </ItemInfo>
                  
                  <ActionButtons>
                    {lecture.slidesLink && (
                      <ActionBtn href={lecture.slidesLink} target="_blank">
                        <FaFileAlt /> Slides
                      </ActionBtn>
                    )}
                    {lecture.recordingLink && (
                      <ActionBtn href={lecture.recordingLink} target="_blank">
                        <FaVideo /> Video
                      </ActionBtn>
                    )}
                  </ActionButtons>
                </MenuItem>
              ))}
            </ul>
          </div>
        ))}
      </MenuBoard>
    </Section>
  );
};

export default Lectures;
