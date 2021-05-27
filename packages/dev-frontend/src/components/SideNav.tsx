import React, { useState, useRef } from "react";
import { Box, Button, Container, Flex } from "theme-ui";
import { Icon } from "./Icon";
import { LiquityLogo } from "./LiquityLogo";
import { Link } from "./Link";
import hamburger from '../assets/hamburger.svg'
import Logo from "./Logo";
const logoHeight = "32px";

export const SideNav: React.FC = () => {
  const [isVisible, setIsVisible] = useState(false);
  const overlay = useRef<HTMLDivElement>(null);

  if (!isVisible) {
    return (
      <Container sx={{ display: ["flex", "none"], flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', }}>
        <Logo />
        <Button variant="icon" onClick={() => setIsVisible(true)} style={{ zIndex: 100,}}>
          {/* <Icon name="bars" size="1x" color="white"/> */}
          <img src={hamburger} height='24px' />
        </Button>
      </Container>
    );
  }
  return (
    <Container
      variant="infoOverlay"
      ref={overlay}
      onClick={e => {
        if (e.target === overlay.current) {
          setIsVisible(false);
        }
      }}
    >
      <Flex variant="layout.sidenav">
        <Button
          sx={{ position: "fixed", right: "25vw", m: 2 }}
          variant="icon"
          onClick={() => setIsVisible(false)}
        >
          <Icon name="times" size="2x" />
        </Button>
        <LiquityLogo height={logoHeight} p={2} />
        <Box as="nav" sx={{ m: 3, mt: 1, p: 0 }} onClick={() => setIsVisible(false)}>
          <Link to="/">Dashboard</Link>
          <Link to="/risky-troves">Risky Loans</Link>
          {/* <Link to="/redemption">Redemption</Link> */}
        </Box>
      </Flex>
    </Container>
  );
};
