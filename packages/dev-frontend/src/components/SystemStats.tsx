import React from "react";
import { Card, Heading, Link, Box, Text } from "theme-ui";
import { AddressZero } from "@ethersproject/constants";
import { Decimal, Percent, LiquityStoreState } from "@liquity/lib-base";
import { useLiquitySelector } from "@liquity/lib-react";
import CustomToolTip from '../components/CustomToolTip'
import { useLiquity } from "../hooks/LiquityContext";
import { COIN, GT } from "../strings";
import { Statistic } from "./Statistic";
import styled from 'styled-components';

const selectBalances = ({ accountBalance, lusdBalance, lqtyBalance }: LiquityStoreState) => ({
  accountBalance,
  lusdBalance,
  lqtyBalance
});

const Balances: React.FC = () => {
  const { accountBalance, lusdBalance, lqtyBalance } = useLiquitySelector(selectBalances);

  return (
    <Box sx={{ mb: 3 }}>
      <Heading>My Account Balances</Heading>
      <Statistic name="ETH"> {accountBalance.prettify(4)}</Statistic>
      <Statistic name={COIN}> {lusdBalance.prettify()}</Statistic>
      <Statistic name={GT}>{lqtyBalance.prettify()}</Statistic>
    </Box>
  );
};

const GitHubCommit: React.FC<{ children?: string }> = ({ children }) =>
  children?.match(/[0-9a-f]{40}/) ? (
    <Link href={`https://github.com/liquity/dev/commit/${children}`}>{children.substr(0, 7)}</Link>
  ) : (
    <>unknown</>
  );

type SystemStatsProps = {
  variant?: string;
  showBalances?: boolean;
};

const select = ({
  numberOfTroves,
  price,
  total,
  lusdInStabilityPool,
  borrowingRate,
  redemptionRate,
  totalStakedLQTY,
  frontend
}: LiquityStoreState) => ({
  numberOfTroves,
  price,
  total,
  lusdInStabilityPool,
  borrowingRate,
  redemptionRate,
  totalStakedLQTY,
  kickbackRate: frontend.status === "registered" ? frontend.kickbackRate : null
});

export const SystemStats: React.FC<SystemStatsProps> = ({ variant = "info", showBalances }) => {
  const {
    liquity: {
      connection: { version: contractsVersion, deploymentDate, frontendTag }
    }
  } = useLiquity();

  const {
    numberOfTroves,
    price,
    lusdInStabilityPool,
    total,
    borrowingRate,
    totalStakedLQTY,
    kickbackRate
  } = useLiquitySelector(select);

  const lusdInStabilityPoolPct =
    total.debt.nonZero && new Percent(lusdInStabilityPool.div(total.debt));
  const totalCollateralRatioPct = new Percent(total.collateralRatio(price));
  const borrowingFeePct = new Percent(borrowingRate);
  const kickbackRatePct = frontendTag === AddressZero ? "100" : kickbackRate?.mul(100).prettify();

  return (
    <>
      <RightTopCard className={'custom-mahadao-box'}>
        <HeadingText sx={{ mb: 3 }}>
          Protocol Statistics
        </HeadingText>
        <div style={{ marginBottom: '8px' }}>
          <OneLineInput>
            <div style={{ flex: 1 }}>
              <TextForInfoTitle>Borrowing Fee</TextForInfoTitle>
            </div>
            <InputLabelSpanRight>
              {/* ${
                Number(getDisplayBalance(arthxPrice, 6, 6))
                  .toLocaleString('en-US', { maximumFractionDigits: 6 })
              } */}
              {borrowingFeePct.toString(2)}
            </InputLabelSpanRight>
          </OneLineInput>
        </div>
        <div style={{ marginBottom: '8px' }}>
          <OneLineInput>
            <div style={{ flex: 1 }}>
              <TextForInfoTitle>TVL</TextForInfoTitle>
            </div>
            <InputLabelSpanRight>
              {/* ${
                Number(getDisplayBalance(collatearlPrice, 6, 6))
                  .toLocaleString('en-US', { maximumFractionDigits: 6 })
              } */}
              {total.collateral.shorten()} <Text sx={{ fontSize: 1 }}>&nbsp;ETH</Text>
              <Text sx={{ fontSize: 1 }}>
                &nbsp;(${Decimal.from(total.collateral.mul(price)).shorten()})
              </Text>
            </InputLabelSpanRight>
          </OneLineInput>
        </div>
        <div style={{ marginBottom: '8px' }}>
          <OneLineInput>
            <div style={{ flex: 1 }}>
              <TextForInfoTitle>
                Loans
                {/* <CustomToolTip toolTipText={'loreum ipsum'} /> */}
              </TextForInfoTitle>
            </div>
            <InputLabelSpanRight>
              {/* {
                Number(getDisplayBalance(mintCR, 4, 4))
                  .toLocaleString('en-US', { maximumFractionDigits: 4 })
              }% */}
              {Decimal.from(numberOfTroves).prettify(0)}
            </InputLabelSpanRight>
          </OneLineInput>
        </div>
        <div style={{ marginBottom: '8px' }}>
          <OneLineInput>
            <div style={{ flex: 1 }}>
              <TextForInfoTitle>
                ARTH supply
                {/* <CustomToolTip toolTipText={'loreum ipsum'} /> */}
              </TextForInfoTitle>
            </div>
            <InputLabelSpanRight>
              {/* {
                Number(getDisplayBalance(redeemCR, 4, 4))
                  .toLocaleString('en-US', { maximumFractionDigits: 4 })
              }% */}
              {total.debt.shorten()}
            </InputLabelSpanRight>
          </OneLineInput>
        </div>
        {lusdInStabilityPoolPct && <div style={{ marginBottom: '8px' }}>
          <OneLineInput>
            <div style={{ flex: 1 }}>
              <TextForInfoTitle>ARTH in Stability Pool</TextForInfoTitle>
            </div>
            <InputLabelSpanRight>
              {/* {prettyNumber(getDisplayBalance(poolBalance, 18))} */}
              {lusdInStabilityPool.shorten()}
              <Text sx={{ fontSize: 1 }}>&nbsp;({lusdInStabilityPoolPct.toString(1)})</Text>
            </InputLabelSpanRight>
          </OneLineInput>
        </div>}
        <div style={{ marginBottom: '8px' }}>
          <OneLineInput>
            <div style={{ flex: 1 }}>
              <TextForInfoTitle>Staked MAHA</TextForInfoTitle>
            </div>
            <InputLabelSpanRight>{totalStakedLQTY.shorten()}</InputLabelSpanRight>
          </OneLineInput>
        </div>
        <div style={{ marginBottom: '8px' }}>
          <OneLineInput>
            <div style={{ flex: 1 }}>
              <TextForInfoTitle>
                Total Collateral Ratio
                {/* <CustomToolTip toolTipText={'loreum ipsum'} /> */}
              </TextForInfoTitle>
            </div>
            <InputLabelSpanRight>
              {/* {
                Number(getDisplayBalance(stabilityFee, 2, 2))
                  .toLocaleString('en-US', { maximumFractionDigits: 2 })
              }% */}
              {totalCollateralRatioPct.prettify()}
            </InputLabelSpanRight>
          </OneLineInput>
        </div>
        <div style={{ marginBottom: '8px' }}>
          <OneLineInput>
            <div style={{ flex: 1 }}>
              <TextForInfoTitle>
                Recovery Mode
                {/* <CustomToolTip toolTipText={'loreum ipsum'} /> */}
              </TextForInfoTitle>
            </div>
            <InputLabelSpanRight>
              {/* {
                Number(getDisplayBalance(mintingFee, 4, 4))
                  .toLocaleString('en-US', { maximumFractionDigits: 4 })
              }% */}
              {total.collateralRatioIsBelowCritical(price) ? <Box color="danger">Yes</Box> : "No"}
            </InputLabelSpanRight>
          </OneLineInput>
        </div>

        <HeadingText sx={{ mt: 32, mb: 3 }}>
          Frontend
        </HeadingText>

        {kickbackRatePct && <div style={{ marginBottom: '8px' }}>
          <OneLineInput>
            <div style={{ flex: 1 }}>
              <TextForInfoTitle>
                Kickback Rate
                <CustomToolTip toolTipText={'loreum ipsum'} />
              </TextForInfoTitle>
            </div>
            <InputLabelSpanRight>
              {/* {
                Number(getDisplayBalance(redeemingFee, 4, 4))
                  .toLocaleString('en-US', { maximumFractionDigits: 4 })
              }% */}
              {kickbackRatePct}%
            </InputLabelSpanRight>
          </OneLineInput>
        </div>}
      </RightTopCard>
    </>

  );
};

const RightTopCard = styled.div`
  width: 100%;
  @media (max-width: 600px) {
    margin-top: 8px;
  }
`;

const OneLineInput = styled.div`
  display: flex;
  flex-direction: row;
  align-items: baseline;
  justify-content: flex-start;
  margin: 5px 0 10px 0;
`;

const TextForInfoTitle = styled.div`
font-family: Inter;
font-style: normal;
font-weight: 300;
font-size: 16px;
line-height: 150%;
color: rgba(255, 255, 255, 0.88);
opacity: 0.64;
display: flex;
align-items: center;
`;

const InputLabelSpanRight = styled.span`
font-family: Inter;
font-style: normal;
font-weight: 600;
font-size: 16px;
line-height: 24px;
text-align: right;
color: rgba(255, 255, 255, 0.88);
margin-right: 5px;
`;

const RightBottomCard = styled.div`
  margin-top: 16px;
  @media (max-width: 600px) {
    margin-top: 24px;
  }
`;

const RightBottomCardTitle = styled.div`
  padding: 0;
  margin: 0;
  font-family: Inter;
  font-style: normal;
  font-weight: 600;
  font-size: 16px;
  line-height: 24px;
  color: rgba(255, 255, 255, 0.88);
`;

const HeadingText = styled(Heading)`
font-family: Inter;
font-style: normal;
font-weight: 600;
font-size: 16px;
line-height: 24px;
color: #FFFFFF;
`;