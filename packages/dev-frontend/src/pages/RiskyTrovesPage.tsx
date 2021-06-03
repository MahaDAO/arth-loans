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
          style={{ marginBlock: 24, maxWidth: '1500px' }}
        >
          <Grid item lg={1} />
          <Grid item lg={9}>
            <Grid container
              spacing={3}
              style={{ padding: 0 }}
              direction={isMobile ? 'column' : 'row'}
              justify={'center'}
            >
              <Grid item lg={6} sm={12}>
                <BotGrid />
              </Grid>
              <Grid item lg={6} sm={12} style={{ marginTop: isMobile ? 24 : 0 }}>
                <SystemStats />
              </Grid>
            </Grid>
            <Grid item>
              <OwnerList />
            </Grid>
          </Grid>
          <Grid item lg={1} />
        </Grid>
      </Page>
    </>
    //   <Container variant="columns">
    //     <Container variant="left">
    //       <Card>
    //         <Box sx={{ p: [2, 3] }}>
    //           <InfoMessage title="Bot functionality">
    //             <Paragraph>Liquidation is expected to be carried out by bots.</Paragraph>
    //             <Paragraph>
    //               Early on you may be able to manually liquidate Loans, but as the system matures this
    //               will become less likely.
    //         </Paragraph>
    //           </InfoMessage>
    //         </Box>
    //       </Card>
    //       <LiquidationManager />
    //     </Container>

    //     <Container variant="right">
    //       <SystemStats />
    //     </Container>
    //     <RiskyTroves pageSize={10} />
    //   </Container>
    // </>
  )
}
