import React from "react";
import { Container, Card, Box, Paragraph } from "theme-ui";
import { SystemStats } from "../components/SystemStats";
import { LiquidationManager } from "../components/LiquidationManager";
import { RiskyTroves } from "../components/RiskyTroves";
import { InfoMessage } from "../components/InfoMessage";
import Page from "../components/Page";
import PageHeader from "../components/PageHeader";
import { Grid } from "@material-ui/core";
import BotGrid from './RiskyLoans/BotGrid';
import OwnerList from './RiskyLoans/OwnerList';
import { useMediaQuery } from "react-responsive";

export const RiskyTrovesPage = () => {
  const isMobile = useMediaQuery({ 'maxWidth': '600px' })
  return (
    <>
      <Page>
        <PageHeader
          centeredHeader={true}
          title={'Interest Free Inflation Proof Loan'}
          subtitle={'Borrow ARTH with 0% interest'}
        />
        <Grid
          container
          justify={'center'}
          style={{ marginBlock: 24 }}
        >
          <Grid item lg={1} />
          <Grid item lg={8}>
            <Grid container
              spacing={5}
              style={{height: '100%'}}
              direction={isMobile ? 'column' : 'row'}
              justify={'center'}
            >
              <Grid item lg={5} sm={12}>
                <BotGrid />
              </Grid>
              <Grid item lg={5} sm={12}>
                <SystemStats />
              </Grid>
            </Grid>
            <Grid item sm={12} lg={12}>
              {/* <OwnerList /> */}
            </Grid>
          </Grid>
          <Grid item lg={1} />
        </Grid>
      </Page>
    </>
  )
}
