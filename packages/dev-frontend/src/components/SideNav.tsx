import React, { useState, useRef } from "react";
import { Box, Button, Container, Flex } from "theme-ui";
import { Icon } from "./Icon";
import { LiquityLogo } from "./LiquityLogo";
import { Link } from "./Link";
import hamburger from '../assets/hamburger.svg'
import styled from 'styled-components';
import Logo from "./Logo";
import { NavLink } from "react-router-dom";
import close from '../assets/svg/Close.svg'
import OurButton from '../components/Button'
import { WalletInternal } from '../components/WalletInternal'

const logoHeight = "32px";

export const SideNav: React.FC = () => {
  const [walletInfo, setWallet] = useState<boolean>(false);
  const [isVisible, setIsVisible] = useState(false);
  const [disconnect, setDisconnect] = useState<boolean>(false);
  const overlay = useRef<HTMLDivElement>(null);

  if (!isVisible) {
    return (
      <Container sx={{ display: ["flex", "none"], flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingInline: 16 }}>
        <Logo />
        <Button variant="icon" onClick={() => setIsVisible(true)} style={{ zIndex: 100, }}>
          {/* <Icon name="bars" size="1x" color="white"/> */}
          <img src={hamburger} height='24px' />
        </Button>
      </Container>
    );
  }
  return (
    <Container
      // variant="infoOverlay"
      ref={overlay}
      onClick={e => {
        if (e.target === overlay.current) {
          // setIsVisible(false);
        }
      }}
      sx={{ display: ["flex", "none"], flexDirection: 'column', alignItems: 'center', height: '100%' }}
    >
      <div style={{ display: 'flex', flexDirection: 'row', justifyContent: 'space-between', width: '100%', alignItems: 'center', minHeight: 72, paddingInline: 16 }}>
        <Logo />
        <Button variant="icon" onClick={() => setIsVisible(false)} style={{ zIndex: 100, }}>
          <img src={close} height='24px' />
        </Button>
      </div>
      <StyledNav
        // onClick={() => setIsVisible(false)}
      >
        {!walletInfo ?
          <>
            <StyledLink to="/">Home</StyledLink>
            <StyledLink to="/risky-troves">Risky Loans</StyledLink>
            {/* <StyledLink to="/redemption">Redemption</StyledLink> */}
          </> :
          (
            <WalletInternal disconnect={disconnect} walletInfo={walletInfo} setWalletInfo={(val: boolean) => setWallet(val)} />
          )
        }
        {!walletInfo && <StyledDivLink>
          <OurButton
            text={'Connect'}
            variant={'transparent'}
            size={'sm'}
            // text={!account ? 'Connect' : 'Wallet Info'}
            // @ts-ignore
            onClick={(e) => {
              setWallet(!walletInfo);
            }}
          />
        </StyledDivLink>}
      </StyledNav>
    </Container>
  );
};

const StyledNav = styled.nav`
  align-items: center;
  display: flex;
  z-index: 100;
  flex-direction: column;
  width: 100%;
  left: 0px;
  background: #1e1d1d;
  // border-top: 1px solid rgba(255, 255, 255, 0.08);
  height: 100%;
`;

const StyledLink = styled(NavLink)`
  color: ${(props) => props.theme.color.grey[400]};
  height: 80px;
  width: 100%;
  display: flex;
  justify-content: center;
  align-items: center;
  font-size: 14px;
  color: rgba(255, 255, 255, 0.64);
  font-weight: 600;
  padding-left: ${(props) => props.theme.spacing[3]}px;
  padding-right: ${(props) => props.theme.spacing[3]}px;
  text-decoration: none;
  padding: 29px 0;
  border-bottom: 1px solid rgba(255, 255, 255, 0.08);
  &:hover {
    color: rgba(255, 255, 255, 0.64);
    background: rgba(255, 255, 255, 0.04);
    backdrop-filter: blur(70px);
  }
  &.active {
    color: rgba(255, 255, 255, 0.88);
  }
  background: #1e1d1d;
`;

const StyledDivLink = styled.div`
  color: ${(props) => props.theme.color.grey[400]};
  height: 80px;
  width: 100%;
  display: flex;
  justify-content: center;
  align-items: center;
  font-size: 14px;
  color: rgba(255, 255, 255, 0.64);
  font-weight: 600;
  padding-left: ${(props) => props.theme.spacing[3]}px;
  padding-right: ${(props) => props.theme.spacing[3]}px;
  text-decoration: none;
  padding: 29px 20%;
  border-bottom: 1px solid rgba(255, 255, 255, 0.08);
  &:hover {
    color: rgba(255, 255, 255, 0.64);
    background: rgba(255, 255, 255, 0.04);
    backdrop-filter: blur(70px);
  }
  &.active {
    color: rgba(255, 255, 255, 0.88);
  }
  background: #1e1d1d;
`;

const StyledButton = styled.div`
  height: 80px;
  width: 100%;
  display: flex;
  justify-content: center;
  align-items: center;
  font-size: 14px;
  color: rgba(255, 255, 255, 0.64);
  font-weight: 600;
  text-decoration: none;
  border-bottom: 1px solid rgba(255, 255, 255, 0.08);
  background: #1e1d1d;
  padding: 0 16px 0 16px;
  padding-bottom: ${(props) => props.theme.spacing[3]}px;
  &:hover {
    color: rgba(255, 255, 255, 0.64);
    // background: rgba(255, 255, 255, 0.04);
    // backdrop-filter: blur(70px);
  }
  &.active {
    // color: rgba(255, 255, 255, 0.88);
  }
`;
const ColorIcon = styled.div`
  background: ${(colorProps: { colorCode: string }) => colorProps.colorCode};
  width: 10px;
  border-radius: 50%;
  height: 10px;
  margin-right: 5px;
  margin-left: -10px;
`;