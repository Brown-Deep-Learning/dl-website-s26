"use client";

import React from "react";
import styled from "styled-components";
import { FaMapMarkerAlt, FaCalendarAlt, FaUser, FaStore } from "react-icons/fa";
import { SiCanvas, SiGooglescholar } from "react-icons/si";
import { RiQuestionLine } from "react-icons/ri";
import { MdOutlineDocumentScanner } from "react-icons/md";
import RecentItems from "./RecentItems";

const Section = styled.section`
  padding: 4rem 2rem;
  min-height: 100vh;
  display: flex;
  flex-direction: column;
  align-items: center;
  position: relative;
  z-index: var(--z-content);
  
  @media (max-width: 768px) {
    padding: 3rem 1rem;
  }
  
  @media (max-width: 480px) {
    padding: 2rem 0.5rem;
  }
`;

const ContentCard = styled.div`
  background: var(--white-glass);
  backdrop-filter: blur(5px);
  max-width: 1000px;
  width: 100%;
  border-radius: 15px;
  box-shadow: 
    0 10px 30px rgba(0,0,0,0.3),
    inset 0 1px 0 rgba(255, 255, 255, 0.5);
  overflow: hidden;
  border: 4px solid var(--chrome-silver);
  
  /* B&W Checkered Header */
  &::before {
    content: '';
    display: block;
    height: 30px;
    width: 100%;
    background-image: 
      linear-gradient(45deg, var(--diner-red) 25%, transparent 25%), 
      linear-gradient(-45deg, var(--diner-red) 25%, transparent 25%), 
      linear-gradient(45deg, transparent 75%, var(--diner-red) 75%), 
      linear-gradient(-45deg, transparent 75%, var(--diner-red) 75%);
    background-size: 20px 20px;
    background-position: 0 0, 0 10px, 10px -10px, -10px 0px;
    background-color: var(--diner-white);
  }
`;

const ContentBody = styled.div`
  padding: 2rem;
  display: flex;
  flex-direction: column;
  gap: 2rem;
  background: linear-gradient(to bottom, var(--cream) 0%, var(--diner-white) 100%);
  
  @media (max-width: 768px) {
    padding: 1.5rem;
    gap: 1.5rem;
  }
  
  @media (max-width: 480px) {
    padding: 1rem;
    gap: 1rem;
  }
`;

const TextContent = styled.div`
  text-align: left;
`;

const Heading = styled.h2`
  font-family: var(--font-retro);
  font-size: 2.5rem;
  color: var(--cherry-red);
  margin-bottom: 1rem;
  display: flex;
  align-items: center;
  gap: 1rem;
  text-transform: none;
  text-shadow: 2px 2px 0 var(--diner-black);
  
  svg {
    color: var(--mint-green);
    filter: drop-shadow(0 0 5px var(--mint-green));
  }
  
  @media (max-width: 768px) {
    font-size: 1.8rem;
    gap: 0.5rem;
  }
  
  @media (max-width: 480px) {
    font-size: 1.5rem;
  }
`;

const Paragraph = styled.p`
  font-family: var(--font-body);
  line-height: 1.7;
  color: var(--diner-black);
  margin-bottom: 1rem;
  font-size: 1.1rem;
`;

const InfoGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 1.5rem;
  background: linear-gradient(to bottom, var(--cream) 0%, var(--diner-white) 100%);
  padding: 2rem;
  border-radius: 15px;
  position: relative;
  
  /* Vintage checkered border effect */
  &::before {
    content: '';
    position: absolute;
    inset: 0;
    border-radius: 15px;
    padding: 8px;
    background-image: 
      linear-gradient(45deg, var(--diner-red) 25%, transparent 25%), 
      linear-gradient(-45deg, var(--diner-red) 25%, transparent 25%), 
      linear-gradient(45deg, transparent 75%, var(--diner-red) 75%), 
      linear-gradient(-45deg, transparent 75%, var(--diner-red) 75%);
    background-size: 16px 16px;
    background-position: 0 0, 0 8px, 8px -8px, -8px 0px;
    background-color: var(--chrome-silver);
    -webkit-mask: 
      linear-gradient(#fff 0 0) content-box, 
      linear-gradient(#fff 0 0);
    -webkit-mask-composite: xor;
    mask-composite: exclude;
    pointer-events: none;
  }
  
  box-shadow: 
    0 8px 20px rgba(0,0,0,0.2),
    inset 0 1px 0 rgba(255, 255, 255, 0.8);
  
  @media (max-width: 768px) {
    padding: 1.5rem;
    gap: 1rem;
  }
  
  @media (max-width: 480px) {
    grid-template-columns: 1fr;
    padding: 1.25rem;
    gap: 1rem;
  }
`;

const InfoItem = styled.div`
  display: flex;
  align-items: center;
  gap: 1rem;
`;

const InfoIcon = styled.div`
  font-size: 2.2rem;
  color: var(--cherry-red);
  filter: drop-shadow(2px 2px 0 rgba(0,0,0,0.2));
  transition: all 0.3s ease;
`;

const InfoText = styled.div`
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
  
  h3 {
    font-family: var(--font-display);
    font-size: 1.1rem;
    color: var(--diner-black);
    text-transform: uppercase;
    letter-spacing: 1.5px;
    font-weight: 700;
    text-shadow: 1px 1px 0 rgba(255, 255, 255, 0.5);
  }
  
  p {
    font-family: var(--font-body);
    font-size: 1rem;
    color: #333;
    font-weight: 500;
  }
`;

const LinksContainer = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: 1rem;
  justify-content: center;
  margin-top: 1rem;
`;

const ActionLink = styled.a`
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.8rem 1.5rem;
  background: var(--cherry-red);
  color: var(--cream);
  text-decoration: none;
  border-radius: 50px;
  font-family: var(--font-display);
  font-size: 1rem;
  text-transform: uppercase;
  letter-spacing: 1px;
  transition: all 0.2s;
  border: 2px solid var(--chrome-silver);
  box-shadow: 0 0 10px rgba(220, 20, 60, 0.3);
  
  &:hover {
    background: var(--neon-pink);
    transform: scale(1.05);
    box-shadow: 
      0 0 15px var(--neon-pink),
      0 0 30px var(--neon-pink);
  }
  
  @media (max-width: 768px) {
    padding: 0.6rem 1.2rem;
    font-size: 0.85rem;
  }
  
  @media (max-width: 480px) {
    padding: 0.5rem 1rem;
    font-size: 0.8rem;
    flex: 1 1 auto;
    justify-content: center;
  }
`;

const CourseDescription = () => {
  return (
    <Section id="course-description">
      <ContentCard>
        <ContentBody>
          <TextContent>
            <Heading><FaStore /> Our Menu</Heading>
            <Paragraph>
              Welcome to the Deep Learning Diner! Over the past few years, our signature "Deep Learning" recipes 
              (Deep Neural Networks) have become a staple in the tech industry, producing state-of-the-art 
              results in computer vision, natural language processing, and beyond.
            </Paragraph>
            <Paragraph>
              This course is designed to give you hands-on experience in our kitchen. You'll learn how to 
              prep ingredients, manage oven temperatures (gradients), and serve up delicious models from scratch.
              We emphasize ethical sourcing and responsible serving practices throughout.
            </Paragraph>
          </TextContent>

          <InfoGrid>
            <InfoItem>
              <InfoIcon><FaMapMarkerAlt /></InfoIcon>
              <InfoText>
                <h3>Location</h3>
                <p>Check C@B</p>
              </InfoText>
            </InfoItem>
            <InfoItem>
              <InfoIcon><FaCalendarAlt /></InfoIcon>
              <InfoText>
                <h3>Service Hours</h3>
                <p>Check C@B</p>
              </InfoText>
            </InfoItem>
            <InfoItem>
              <InfoIcon><FaUser /></InfoIcon>
              <InfoText>
                <h3>Head Chef</h3>
                <p>Prof. Randall Balestriero</p>
              </InfoText>
            </InfoItem>
          </InfoGrid>

          <LinksContainer>
            <ActionLink href="/documents/syllabus.pdf" target="_blank">
              <MdOutlineDocumentScanner /> Syllabus
            </ActionLink>
            <ActionLink href="https://edstem.org/" target="_blank">
              <RiQuestionLine /> Edstem
            </ActionLink>
            <ActionLink href="" target="_blank">
              <SiGooglescholar /> Gradescope
            </ActionLink>
            <ActionLink href="" target="_blank">
              <SiCanvas /> Canvas
            </ActionLink>
          </LinksContainer>
          
          <div style={{marginTop: '2rem'}}>
             <RecentItems />
          </div>
        </ContentBody>
      </ContentCard>
    </Section>
  );
};

export default CourseDescription;
