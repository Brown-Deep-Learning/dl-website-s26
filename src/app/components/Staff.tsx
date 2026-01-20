"use client";

import React from "react";
import styled, { keyframes } from "styled-components";
import Image from "next/image";
import staffData from "../data/staffData";
import { FaEnvelope } from "react-icons/fa";
import { GiChefToque, GiChickenLeg, GiFrenchFries } from "react-icons/gi";
import { useAssetPath } from "../hooks/useAssetPath";
import VintageSign from "./VintageSign";

const sizzle = keyframes`
  0%, 100% { transform: scale(1) rotate(0deg); }
  25% { transform: scale(1.02) rotate(-1deg); }
  75% { transform: scale(1.02) rotate(1deg); }
`;

const Section = styled.section`
  padding: 4rem 2rem;
  min-height: 100vh;
  display: flex;
  flex-direction: column;
  align-items: center;
  position: relative;
  z-index: var(--z-content);
`;

const StaffBasket = styled.div`
  width: 100%;
  max-width: 1200px;
  background: 
    repeating-linear-gradient(
      0deg,
      transparent,
      transparent 8px,
      var(--basket-wire) 8px,
      var(--basket-wire) 10px
    ),
    repeating-linear-gradient(
      90deg,
      transparent,
      transparent 8px,
      var(--basket-wire) 8px,
      var(--basket-wire) 10px
    ),
    linear-gradient(135deg, 
      rgba(40,40,40,0.4) 0%, 
      rgba(20,20,20,0.6) 100%
    );
  padding: 3rem 2rem;
  border-radius: 20px;
  border: 4px solid var(--basket-wire-light);
  margin-bottom: 4rem;
  position: relative;
  box-shadow: 0 10px 40px rgba(0,0,0,0.5);

  /* Basket Handle Top */
  &::before {
    content: '';
    position: absolute;
    top: -30px;
    left: 50%;
    transform: translateX(-50%);
    width: 200px;
    height: 30px;
    border: 6px solid var(--basket-handle);
    border-bottom: none;
    border-radius: 30px 30px 0 0;
  }
`;

const RoleHeader = styled.h3`
  font-family: var(--font-display);
  font-size: 2rem;
  color: var(--sesame-light);
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 1rem;
  margin-bottom: 2rem;
  text-transform: uppercase;
  letter-spacing: 2px;
  text-shadow: 2px 2px 0 var(--diner-black);

  svg {
    color: var(--sizzle-orange);
    filter: drop-shadow(0 0 5px var(--sizzle-orange));
    font-size: 2.5rem;
  }
`;

const Grid = styled.div`
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  gap: 2.5rem;
  width: 100%;
`;

const OrderTicket = styled.div`
  background: #fff;
  width: 280px;
  padding: 1.5rem;
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
  position: relative;
  box-shadow: 0 4px 10px rgba(0,0,0,0.2);
  transition: transform 0.3s ease;
  font-family: 'Courier New', monospace;
  will-change: transform;

  /* Jagged top/bottom for ticket look */
  background-image: 
    linear-gradient(135deg, transparent 5px, #fff 5px), 
    linear-gradient(225deg, transparent 5px, #fff 5px);
  background-position: top;
  background-size: 15px 15px;
  background-repeat: repeat-x;

  &::after {
    content: '';
    position: absolute;
    bottom: -15px;
    left: 0;
    right: 0;
    height: 15px;
    background-image: 
      linear-gradient(45deg, transparent 10px, #fff 10px), 
      linear-gradient(-45deg, transparent 10px, #fff 10px);
    background-size: 20px 20px;
    transform: rotate(180deg);
  }

  &:hover {
    transform: translateY(-5px) rotate(1deg);
    z-index: 2;
    box-shadow: 0 8px 20px rgba(0,0,0,0.3);
  }
`;

/* Flip Logic */
const FlipContainer = styled.div`
  width: 150px;
  height: 150px;
  margin-bottom: 1rem;
  perspective: 1000px;
  cursor: pointer;

  &:hover > div {
    transform: rotateY(180deg);
  }
`;

const Flipper = styled.div`
  position: relative;
  width: 100%;
  height: 100%;
  text-align: center;
  transition: transform 0.6s;
  transform-style: preserve-3d;
  will-change: transform;
`;

const Front = styled.div`
  position: absolute;
  width: 100%;
  height: 100%;
  backface-visibility: hidden;
  border-radius: 50%;
  overflow: hidden;
  border: 4px solid var(--diner-black);
  background: var(--diner-black);
`;

const Back = styled.div`
  position: absolute;
  width: 100%;
  height: 100%;
  backface-visibility: hidden;
  transform: rotateY(180deg);
  border-radius: 50%;
  overflow: hidden;
  border: 4px solid var(--sizzle-orange);
  background: var(--sizzle-orange);
`;

const StyledImage = styled(Image)`
  object-fit: cover;
`;

const TicketHeader = styled.div`
  border-bottom: 2px dashed var(--diner-black);
  width: 100%;
  margin-bottom: 1rem;
  padding-bottom: 0.5rem;
  color: var(--diner-black);
`;

const Name = styled.h4`
  font-family: var(--font-display); 
  font-size: 1.4rem;
  color: var(--diner-black);
  margin: 0;
  text-transform: uppercase;
  letter-spacing: 1px;
`;

const Description = styled.p`
  font-family: 'Courier New', monospace;
  font-size: 0.9rem;
  color: var(--diner-black);
  font-weight: bold;
  line-height: 1.4;
  margin-top: 0.5rem;
`;

// Ticket styled contact block (Keeping this but renaming slightly if needed, or reusing OrderTicket logic? user wanted staff to correspond to tickets)
// The original ContactTicket was for emails. I will keep it as is since it's "Order Ticket #1470" for contact info.
const ContactTicket = styled.div`
  background: #fff;
  padding: 2rem;
  width: 100%;
  max-width: 600px;
  margin: 0 auto 4rem;
  box-shadow: 0 4px 15px rgba(0,0,0,0.2);
  transform: rotate(-2deg);
  position: relative;
  font-family: 'Courier New', monospace;
  z-index: 5; /* Lower than VintageSign's z-index: 10 */

  /* Jagged top/bottom for ticket look */
  background-image: 
    linear-gradient(135deg, transparent 5px, #fff 5px), 
    linear-gradient(225deg, transparent 5px, #fff 5px);
  background-position: top;
  background-size: 15px 15px;
  background-repeat: repeat-x;

  &::after {
    content: '';
    position: absolute;
    bottom: -15px;
    left: 0;
    right: 0;
    height: 15px;
    background-image: 
      linear-gradient(45deg, transparent 10px, #fff 10px), 
      linear-gradient(-45deg, transparent 10px, #fff 10px);
    background-size: 20px 20px;
    transform: rotate(180deg);
  }

  h3 {
    font-family: var(--font-display);
    font-size: 1.8rem;
    color: var(--diner-black);
    text-align: center;
    border-bottom: 2px dashed var(--diner-black);
    padding-bottom: 1rem;
    margin-bottom: 1.5rem;
  }
  
  @media (max-width: 768px) {
    padding: 1.5rem;
    max-width: 90%;
    transform: rotate(-1deg);
    
    h3 {
      font-size: 1.4rem;
    }
  }
  
  @media (max-width: 480px) {
    padding: 1rem;
    margin-bottom: 3rem;
    
    h3 {
      font-size: 1.2rem;
      padding-bottom: 0.75rem;
      margin-bottom: 1rem;
    }
  }
`;

const ContactItem = styled.div`
  margin: 1rem 0;
  display: flex;
  justify-content: center;
  align-items: center;
  gap: 0.8rem;
  color: var(--diner-black);
  font-weight: bold;
  
  svg {
    color: var(--cherry-red);
    flex-shrink: 0;
  }
  
  a {
    color: var(--diner-black);
    text-decoration: none; 
    border-bottom: 1px solid var(--cherry-red);
    transition: all 0.2s;
    word-break: break-word;
    
    &:hover { 
      color: var(--cherry-red);
      background: rgba(220, 10, 60, 0.1);
    }
  }
  
  @media (max-width: 768px) {
    flex-direction: column;
    gap: 0.4rem;
    font-size: 0.9rem;
    text-align: center;
    
    a {
      font-size: 0.85rem;
    }
  }
  
  @media (max-width: 480px) {
    font-size: 0.85rem;
    
    a {
      font-size: 0.75rem;
    }
  }
`;

const Disclaimer = styled.p`
  font-size: 0.8rem;
  margin-top: 2rem;
  text-align: center;
  color: var(--basket-wire-dark);
  font-style: italic;
  opacity: 0.7;
`;

const Staff = () => {
  const getAssetPath = useAssetPath();

  return (
    <Section id="staff">
      <VintageSign text="Kitchen Crew" color="var(--crispy-gold)" rotate="2deg" />

      <ContactTicket>
        <h3>
          ORDER TICKET #1470
        </h3>
        <ContactItem>
          <FaEnvelope /> Head Chef: 
          <a href={`mailto:${staffData.professor.email}`}>{staffData.professor.email}</a>
        </ContactItem>
        <ContactItem>
          <FaEnvelope /> Sous Chefs: 
          <a href={`mailto:${staffData.emails.profAndHTAs}`}>{staffData.emails.profAndHTAs}</a>
        </ContactItem>
        <ContactItem>
          <FaEnvelope /> Full Crew: 
          <a href={`mailto:${staffData.emails.allTAs}`}>{staffData.emails.allTAs}</a>
        </ContactItem>
        <Disclaimer>
          *NOTICE: Kitchen is extremely busy during service hours*
        </Disclaimer>
      </ContactTicket>

      <StaffBasket>
        <RoleHeader><GiChefToque /> Deepest Fryer</RoleHeader>
        <Grid>
          <OrderTicket>
            <TicketHeader>ORDER #001</TicketHeader>
            <FlipContainer>
              <Flipper>
                <Front>
                  <StyledImage
                    src={getAssetPath(staffData.professor.image)}
                    alt={staffData.professor.name}
                    fill
                    sizes="150px"
                  />
                </Front>
                <Back>
                   <StyledImage
                    src={getAssetPath(staffData.professor.friedImage)}
                    alt={`${staffData.professor.name} fried`}
                    fill
                    sizes="150px"
                  />
                </Back>
              </Flipper>
            </FlipContainer>
            <Name>{staffData.professor.name}</Name>
            <Description>{staffData.professor.description}</Description>
          </OrderTicket>
        </Grid>

        <div style={{ height: '3rem' }} />

        <RoleHeader><GiChickenLeg /> Cooked Managers </RoleHeader>
        <Grid>
          {staffData.htas.map((hta, i) => (
            <OrderTicket key={i} style={{ animationDelay: `${i * 0.1}s` }}>
              <TicketHeader>ORDER #00{i + 2}</TicketHeader>
              <FlipContainer>
                <Flipper>
                  <Front>
                    <StyledImage
                      src={getAssetPath(hta.image)}
                      alt={hta.name}
                      fill
                      sizes="150px"
                    />
                  </Front>
                  <Back>
                     <StyledImage
                      src={getAssetPath(hta.friedImage)}
                      alt={`${hta.name} fried`}
                      fill
                      sizes="150px"
                    />
                  </Back>
                </Flipper>
              </FlipContainer>
              <Name>{hta.name}</Name>
              <Description>{hta.description}</Description>
            </OrderTicket>
          ))}
        </Grid>

        <div style={{ height: '3rem' }} />

        <RoleHeader><GiFrenchFries /> Fried Line Cooks </RoleHeader>
        <Grid>
          {staffData.utas.map((uta, i) => (
            <OrderTicket key={i} style={{ animationDelay: `${i * 0.05}s` }}>
              <TicketHeader>ORDER #10{i}</TicketHeader>
              <FlipContainer>
                <Flipper>
                  <Front>
                    <StyledImage
                      src={getAssetPath(uta.image)}
                      alt={uta.name}
                      fill
                      sizes="150px"
                    />
                  </Front>
                  <Back>
                     <StyledImage
                      src={getAssetPath(uta.friedImage)}
                      alt={`${uta.name} fried`}
                      fill
                      sizes="150px"
                    />
                  </Back>
                </Flipper>
              </FlipContainer>
              <Name>{uta.name}</Name>
              <Description>{uta.description}</Description>
            </OrderTicket>
          ))}
        </Grid>
      </StaffBasket>
    </Section>
  );
};

export default Staff;
