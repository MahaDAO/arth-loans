// import { Container } from "theme-ui";
import React, { useState } from 'react'
import styled from 'styled-components';
// import { withSnackbar, WithSnackbarProps } from 'notistack';
import { useParams } from 'react-router-dom';
import Container from '../../components/Container';
import Page from '../../components/Page'
import PageHeader from '../../components/PageHeader';
import CustomInputContainer from '../../components/CustomInputContainer'
import { Trove } from "../../components/Trove/Trove";
import LoanGrid from "../../components/LoanGrid";
import RedeemGrid from "../../components/Redeem";
import { Stability } from "../../components/Stability/Stability";
import { SystemStats } from "../../components/SystemStats";
import { PriceManager } from "../../components/PriceManager";
import { Staking } from "../../components/Staking/Staking";
import { Grid } from '@material-ui/core';
import { withSnackbar } from 'notistack';
import arrowDown from '../../../assets/svg/arrowDown.svg';
import Button from '../../components/Button';
import { getDisplayBalance } from '../../utils/formatBalance';
import StabilityPool from './Stability'
import { useStabilityView } from '../../components/Stability/context/StabilityViewContext';
import { useTroveView } from '../../components/Trove/context/TroveViewContext';
const Home = (props: any) => {
  const [type, setType] = useState<'loan' | 'redeem'>('loan')
  const { view: stabilityView } = useStabilityView();
  const { view: troveView } = useTroveView();
  return (
    <Page>
      <PageHeader
        centeredHeader={true}
        title={'Interest Free Inflation Proof Loan'}
        subtitle={'Borrow ARTH with 0% interest'}
      />

      <Grid container style={{ marginTop: '24px' }} spacing={0}>
        <Grid item lg={2} />
        <Grid item lg={4} md={12} sm={12} xs={12}>

          {/* <Container > */}
          <Container >
            {/* <Trove /> */}
            {type === 'loan' ?
              <LoanGrid type={type} setType={setType} view={troveView}/>
              :
              <RedeemGrid type={type} setType={setType} />
            }
            <StabilityPool view={stabilityView} />
            {/* <Staking /> */}
          </Container>
        </Grid>
        <Grid item lg={4} md={12} sm={12} xs={12}>
          <SystemStats />
        </Grid>
        <Grid item lg={2} />
      </Grid>

);

    </Page>
  );

}

export default withSnackbar(Home)

const TcContainer = styled.div`
  margin-top: 24px;
`;

const OneLineInputwomargin = styled.div`
  display: flex;
  flex-direction: row;
  align-items: baseline;
  justify-content: flex-start;
`;

const LeftTopCard = styled.div``;

const LeftTopCardHeader = styled.div`
  display: flex;
  flex-direction: row;
  align-items: center;
  justify-content: space-between;
`;
const LeftTopCardContainer = styled.div``;
const TabContainer = styled.div`
  display: flex;
  justify-content: center;
  align-items: center;
  position: relative;
  padding: 32px 12px;
  width: 100px;
  height: 80px;
  z-index: 1;
  cursor: pointer;
`;

const TabText = styled.span`
  font-family: Inter;
  font-style: normal;
  font-weight: 600;
  font-size: 14px;
  line-height: 20px;
  text-align: center;
  color: rgba(255, 255, 255, 0.64);
`;

const ApproveButtonContainer = styled.div`
  display: flex;
`;

const TabTextActive = styled.span`
  font-family: Inter;
  font-style: normal;
  font-weight: 600;
  font-size: 14px;
  line-height: 20px;
  text-align: center;
  color: rgba(255, 255, 255, 0.88);
`;

const StakingDiv = styled.div`
  display: flex;
  flex-direction: column;
  padding: 5px 0 0 0;
`;

const ActiveTab = styled.div`
  position: absolute;
  width: 100px;
  padding: 32px 12px;
  background: linear-gradient(180deg, rgba(244, 127, 87, 0) 0%, #fd565620);
  height: 80px;
  z-index: 0;
  border-bottom: 2px solid #fd5656;
`;

const PlusMinusArrow = styled.div`
  width: 100%;
  border-radius: 1.33px;
  color: #ffffff;
  align-items: center;
  justify-content: center;
  display: flex;
  flex-direction: row;
  font-size: 20px;
  margin: 12px 0;
`;

const OneLineInput = styled.div`
  display: flex;
  flex-direction: row;
  align-items: baseline;
  justify-content: flex-start;
  margin: 5px 0 10px 0;
`;

const TextWithIcon = styled.div`
  font-family: Inter;
  font-style: normal;
  font-weight: 300;
  font-size: 12px;
  line-height: 130%;
  color: rgba(255, 255, 255, 0.88);
`;

const BeforeChip = styled.span`
  ont-family: Inter;
  font-style: normal;
  font-weight: 300;
  font-size: 12px;
  color: rgba(255, 255, 255, 0.64);
  margin-right: 5px;
`;

const TagChips = styled.div`
  background: rgba(255, 255, 255, 0.08);
  border-radius: 4px;
  padding: 2px 8px;
  font-family: Inter;
  font-style: normal;
  font-weight: 300;
  font-size: 12px;
  color: rgba(255, 255, 255, 0.64);
`;

const InputLabel = styled.p`
  font-family: Inter;
  font-style: normal;
  font-weight: 600;
  font-size: 14px;
  color: rgba(255, 255, 255, 0.64);
  margin: 0px;
`;

const InternalSpan = styled.span`
  font-family: Inter;
  font-style: normal;
  font-weight: 600;
  font-size: 12px;
  line-height: 150%;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: #ffffff;
`;

const InputNoDisplay = styled.span`
  background: rgba(255, 255, 255, 0.08);
  border-radius: 4px;
  padding: 2px 10px;
  height: 25px;
  display: flex;
  justify-content: center;
  align-items: center;
  margin: 0px 0px 0px 8px;
`;

const TimeSpan = styled.div`
  font-family: Inter;
  font-style: normal;
  font-weight: 300;
  font-size: 12px;
  line-height: 130%;
  color: rgba(255, 255, 255, 0.88);
`;

const CheckboxDiv = styled.div`
  background: rgba(255, 255, 255, 0.08);
  border-radius: 6px;
  padding: 5px 0px 0px 5px;
  display: flex;
  justify-content: center;
  align-items: center;
  font-family: Inter;
  font-style: normal;
  font-weight: 600;
  font-size: 14px;
  line-height: 20px;
  text-align: center;
  color: rgba(255, 255, 255, 0.88);
  margin: 15px 0px 0px 0px;
`;
