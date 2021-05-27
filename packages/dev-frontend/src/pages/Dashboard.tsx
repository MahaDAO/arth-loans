// import { Container } from "theme-ui";
import React from 'react'
import styled from 'styled-components';
// import { withSnackbar, WithSnackbarProps } from 'notistack';
import { useParams } from 'react-router-dom';

import Container from '../components/Container';
// import MintTabContent from './components/Mint';
// import RedeemTabContent from './components/Redeem';
import { Trove } from "../components/Trove/Trove";
import { Stability } from "../components/Stability/Stability";
import { SystemStats } from "../components/SystemStats";
import { PriceManager } from "../components/PriceManager";
import { Staking } from "../components/Staking/Staking";
import Page from '../components/Page'

export const Dashboard = () => {
  return (
    <>
      <Page>
        <div style={{background: 'transparent'}}>
          hi
        </div>
      </Page>
    </>
  );

}

