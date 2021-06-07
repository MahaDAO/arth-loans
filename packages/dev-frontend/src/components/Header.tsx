import React from "react";
import { LiquityStoreState } from "@liquity/lib-base";
import { useLiquitySelector } from "@liquity/lib-react";
import { Container, Flex } from "theme-ui";
import { AddressZero } from "@ethersproject/constants";
import { useLiquity } from "../hooks/LiquityContext";
import styled from 'styled-components';

import { Nav } from "./Nav";
import { SideNav } from "./SideNav";

const select = ({ frontend }: LiquityStoreState) => ({
  frontend
});

export const Header: React.FC = ({ children }) => {
  const {
    config: { frontendTag }
  } = useLiquity();
  const { frontend } = useLiquitySelector(select);
  const isFrontendRegistered = frontendTag === AddressZero || frontend.status === "registered";
  return (
    <TopBarContainer>
      <Flex sx={{ alignItems: "center", flex: 1}}>
        {isFrontendRegistered && (
          <>
            <SideNav />
            <Nav />
          </>
        )}
      </Flex>

      {children}
    </TopBarContainer>
  );
};

const TopBarContainer = styled(Container)`
  position: fixed;
  z-index: 100;
  display: flex;
  flex-direction: row;
  background: rgba(0, 0, 0, 0.08);
  border-bottom: 1px solid rgba(255, 255, 255, 0.1);
  // opacity: 0.7;
  height: 72px;
  width: 100%;
  top: 0;
  padding:0 16px;
  backdrop-filter: blur(72px);
`;
