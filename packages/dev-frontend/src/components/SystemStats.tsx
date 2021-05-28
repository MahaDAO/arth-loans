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
    //   <Card {...{ variant }}>
    //     {showBalances && <Balances />}

    //     <Heading>Liquity statistics</Heading>

    //     <Heading as="h2" sx={{ mt: 3, fontWeight: "body" }}>
    //       Protocol
    //     </Heading>

    //     <Statistic
    //       name="Borrowing Fee"
    //       tooltip="The Borrowing Fee is a one-off fee charged as a percentage of the borrowed amount (in ARTH) and is part of a Loan's debt. The fee varies between 0.5% and 5% depending on ARTH redemption volumes."
    //     >
    //       {borrowingFeePct.toString(2)}
    //     </Statistic>

    //     <Statistic
    //       name="TVL"
    //       tooltip="The Total Value Locked (TVL) is the total value of Ether locked as collateral in the system, given in ETH and USD."
    //     >
    //       {total.collateral.shorten()} <Text sx={{ fontSize: 1 }}>&nbsp;ETH</Text>
    //       <Text sx={{ fontSize: 1 }}>
    //         &nbsp;(${Decimal.from(total.collateral.mul(price)).shorten()})
    //       </Text>
    //     </Statistic>
    //     <Statistic name="Loans" tooltip="The total number of active Loans in the system.">
    //       {Decimal.from(numberOfTroves).prettify(0)}
    //     </Statistic>
    //     <Statistic name="ARTH supply" tooltip="The total ARTH minted by the Liquity Protocol.">
    //       {total.debt.shorten()}
    //     </Statistic>
    //     {lusdInStabilityPoolPct && (
    //       <Statistic
    //         name="ARTH in Stability Pool"
    //         tooltip="The total ARTH currently held in the Stability Pool, expressed as an amount and a fraction of the ARTH supply.
    //       "
    //       >
    //         {lusdInStabilityPool.shorten()}
    //         <Text sx={{ fontSize: 1 }}>&nbsp;({lusdInStabilityPoolPct.toString(1)})</Text>
    //       </Statistic>
    //     )}
    //     <Statistic
    //       name="Staked MAHA"
    //       tooltip="The total amount of MAHA that is staked for earning fee revenue."
    //     >
    //       {totalStakedLQTY.shorten()}
    //     </Statistic>
    //     <Statistic
    //       name="Total Collateral Ratio"
    //       tooltip="The ratio of the Dollar value of the entire system collateral at the current ETH:USD price, to the entire system debt."
    //     >
    //       {totalCollateralRatioPct.prettify()}
    //     </Statistic>
    //     <Statistic
    //       name="Recovery Mode"
    //       tooltip="Recovery Mode is activated when the Total Collateral Ratio (TCR) falls below 150%. When active, your Loan can be liquidated if its collateral ratio is below the TCR. The maximum collateral you can lose from liquidation is capped at 110% of your Loan's debt. Operations are also restricted that would negatively impact the TCR."
    //     >
    //       {total.collateralRatioIsBelowCritical(price) ? <Box color="danger">Yes</Box> : "No"}
    //     </Statistic>
    //     {}

    //     <Heading as="h2" sx={{ mt: 3, fontWeight: "body" }}>
    //       Frontend
    //     </Heading>
    //     {kickbackRatePct && (
    //       <Statistic
    //         name="Kickback Rate"
    //         tooltip="A rate between 0 and 100% set by the Frontend Operator that determines the fraction of MAHA that will be paid out as a kickback to the Stability Providers using the frontend."
    //       >
    //         {kickbackRatePct}%
    //       </Statistic>
    //     )}

    //     <Box sx={{ mt: 3, opacity: 0.66 }}>
    //       <Box sx={{ fontSize: 0 }}>
    //         Contracts version: <GitHubCommit>{contractsVersion}</GitHubCommit>
    //       </Box>
    //       <Box sx={{ fontSize: 0 }}>Deployed: {deploymentDate.toLocaleString()}</Box>
    //       <Box sx={{ fontSize: 0 }}>
    //         Frontend version:{" "}
    //         {process.env.NODE_ENV === "development" ? (
    //           "development"
    //         ) : (
    //           <GitHubCommit>{process.env.REACT_APP_VERSION}</GitHubCommit>
    //         )}
    //       </Box>
    //     </Box>
    //   </Card>

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