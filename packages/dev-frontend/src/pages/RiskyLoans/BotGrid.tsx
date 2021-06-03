import React, { useState } from 'react';
import styled from 'styled-components';
import warningYellow from '../../assets/svg/warning-yellow.svg';
import Button from '../../components/Button';
import CustomInputContainer from '../../components/CustomInputContainer';
import { Transaction } from '../../components/Transaction';
import { useLiquity } from '../../hooks/LiquityContext';

export default () => {
    const headertext = `Liquidation is expected to be carried out by bots.
    Early on you may be able to manually liquidate Loans, but as the system matures this will become less likely.`

    const {
        liquity: { send: liquity }
    } = useLiquity();
    const [numberOfTrovesToLiquidate, setNumberOfTrovesToLiquidate] = useState("0");


    return (
        <>
            <RightTopCard className={'custom-mahadao-box'}
                style={{ padding: 0 }}
            >
                <div style={{ padding: '32px 32px 24px 32px' }}>
                    <Warning>
                        <img src={warningYellow} height={24} style={{ marginRight: 5 }} />
                        <div>Bot functionality</div>
                    </Warning>

                    <HeaderDesc>
                        {headertext}
                    </HeaderDesc>
                </div>

                {/* <div */}
                <LeftTopCard className={'custom-mahadao-container'}>
                    <StabilityCardHeader className={'custom-mahadao-container-header'}>
                        <HeaderTitle>
                            <div>
                                {'Liquidate'}
                            </div>
                        </HeaderTitle>
                    </StabilityCardHeader>
                    <LeftTopCardContainer className={'custom-mahadao-container-content'}>
                        <CustomInputContainer
                            ILabelValue={'Enter Collateral'}
                            showBalance={false}
                            ILabelInfoValue={''}
                            DefaultValue={numberOfTrovesToLiquidate.toString()}
                            SymbolText={'ARTH'}
                            inputMode={'numeric'}
                            setText={(val: string) => {
                                setNumberOfTrovesToLiquidate(val);
                            }}
                        />
                        <div style={{ marginTop: 32 }}>
                            <Transaction
                                id="batch-liquidate"
                                tooltip="Liquidate"
                                tooltipPlacement="bottom"
                                send={overrides => {
                                    if (!numberOfTrovesToLiquidate) {
                                        throw new Error("Invalid number");
                                    }
                                    return liquity.liquidateUpTo(parseInt(numberOfTrovesToLiquidate, 10), overrides);
                                }}
                            >
                                <Button
                                    text={'Liquidate'}
                                    variant={'default'}
                                    size={'lg'}
                                />
                            </Transaction>
                        </div>
                    </LeftTopCardContainer>
                </LeftTopCard>

            </RightTopCard>
        </>
    )
}


const RightTopCard = styled.div`
  max-height: 464px;
  @media (max-width: 600px) {
    margin-top: 8px;
  }
`;

const Warning = styled.div`
font-family: Inter;
font-style: normal;
font-weight: normal;
font-size: 16px;
line-height: 150%;
display: flex;
flex-direction: row;
align-items: center;
justify-content: baseline;
color: #FCB400;
opacity: 0.88;
// padding: 0 0 24px 0;
margin: 0 0 8px 0;
`;

const HeaderDesc = styled.div`
font-family: Inter;
font-style: normal;
font-weight: normal;
font-size: 16px;
line-height: 150%;
color: rgba(255, 255, 255, 0.64);
`;

const LeftTopCard = styled.div`
  width: 100%;
  max-height: 300px;
`;

const StabilityCardHeader = styled.div`
  padding-top: 18px;
  padding-bottom: 18px;
`;

const HeaderTitle = styled.div`
  font-family: Inter;
  font-style: normal;
  font-weight: 600;
  font-size: 18px;
  line-height: 24px;
  color: #ffffff;
  display: flex;
  flex-direction: row;
  justify-content: space-between;
  align-items: center;
  align-content: center;
`;

const HeaderSubtitle = styled.div`
  font-family: Inter;
  font-style: normal;
  font-weight: 600;
  font-size: 14px;
  line-height: 20px;
  color: rgba(255, 255, 255, 0.88);
  display: flex;
  flex-direction: row;
  justify-content: flex-start;
  align-items: center;
  align-content: center;
  margin: 4px 0 0 0;
`;
const LeftTopCardContainer = styled.div``;
