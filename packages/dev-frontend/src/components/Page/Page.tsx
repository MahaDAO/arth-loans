import React from 'react';
import styled from 'styled-components';
import chakra from '../../assets/svg/BG.svg';

const Page: React.FC = ({ children }) => (
  <StyledPage>
    <GradientDiv />
    <div className="chakra-home">
      <img src={chakra} height={1900} alt="chakra" />
    </div>
    <StyledMain>{children}</StyledMain>
  </StyledPage>
);

const GradientDiv = styled.div`
  background: linear-gradient(180deg, #2a2827 0%, rgba(42, 40, 39, 0) 100%);
  height: 270px;
  position: absolute;
  // border: 1px solid;
  width: 100%;
  z-index: 5;
  top: 72px;
`;

const StyledPage = styled.div`
  display: flex;
  flex-direction: column;
  position: relative;
  background-color: #161616;
  width: 100%;
`;

const StyledMain = styled.div`
  align-items: center;
  display: flex;
  flex-direction: column;
  // background-color: red;
  min-height: calc(100vh - 72px);
  // padding-bottom: ${(props) => props?.theme?.spacing[5] || 32}px;
  padding-top: 72px;
  z-index: 5;
`;

const StyledImg = styled.img`
    position: fixed;
    display: flex;
    align-items: center;
    justify-content: center;
    align-self: center;
    z-index: -10;

`;
export default Page;
