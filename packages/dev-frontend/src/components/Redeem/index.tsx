import React, { useEffect, useState } from 'react'
import styled from 'styled-components';
// import { withSnackbar, WithSnackbarProps } from 'notistack';
import { useParams } from 'react-router-dom';
import Container from '../../components/Container';
import Page from '../../components/Page'
import PageHeader from '../../components/PageHeader';
import CustomInputContainer from '../../components/CustomInputContainer'
import { Trove } from "../../components/Trove/Trove";
// import LoanGrid from "../../components/LoanGrid";
import { Stability } from "../../components/Stability/Stability";
import { SystemStats } from "../../components/SystemStats";
import { PriceManager } from "../../components/PriceManager";
import { Staking } from "../../components/Staking/Staking";
import { Divider, Grid } from '@material-ui/core';
import { withSnackbar } from 'notistack';
import arrowDown from '../../assets/svg/arrowDown.svg';
import warningYellow from '../../assets/svg/warning-yellow.svg';
import Button from '../../components/Button';
import { getDisplayBalance } from '../../utils/formatBalance';
import CustomToolTip from '../CustomToolTip';
import CustomModal from '../CustomModal';
import textSetter from '../CustomInputContainer/textSetter';
import TransparentInfoDiv from '../InfoDiv';
import { useMediaQuery } from 'react-responsive';
import CustomSuccessModal from '../CustomSuccessModal';

interface LoanProps {
    type: 'loan' | 'redeem'
    setType: (val: 'loan' | 'redeem') => void
}

const RedeemGrid = (props: LoanProps) => {
    const [redeemValue, setRedeemValue] = useState('0')
    const [noArthBorrowed, setNoArthBorrow] = useState(true);
    const [stabilityValue, setStabilityValue] = useState('0')
    const [noArthinStability, setNoArthStability] = useState(true);
    const [redeemModal, setRedeemModal] = useState(false);
    const [redeemSuccess, setRedeemSuccessfull] = useState(false);
    const isMobile = useMediaQuery({ 'maxWidth': '600px' })
    const RedeemTab = () => (
        <LeftTopCard className={'custom-mahadao-container'}>
            <LeftTopCardHeader className={'custom-mahadao-container-header'}>
                <div style={{ display: 'flex' }}>
                    <TabContainer onClick={() => props.setType('loan')}>
                        <TabText>Loan</TabText>
                    </TabContainer>
                    <TabContainer onClick={() => props.setType('redeem')}>
                        <ActiveTab />
                        <TabTextActive>Redeem</TabTextActive>
                    </TabContainer>
                </div>
            </LeftTopCardHeader>
            <LeftTopCardContainer className={'custom-mahadao-container-content'}>
                {noArthBorrowed && <Warning onClick={() => setNoArthBorrow(false)}>
                    <img src={warningYellow} height={24} style={{ marginRight: 5 }} />
                    <div>You haven't borrowed any ARTH yet.</div>
                </Warning>}
                <CustomInputContainer
                    ILabelValue={'Enter Collateral'}
                    IBalanceValue={'`${getDisplayBalance(0, 0)}`'}
                    ILabelInfoValue={''}
                    // disabled={mintCR.lt(1e6)}
                    DefaultValue={redeemValue.toString()}
                    LogoSymbol={'ARTH'}
                    hasDropDown={true}
                    // dropDownValues={collateralTypes}
                    // ondropDownValueChange={(data: string) => {
                    //     setSelectedCollateralCoin(data);
                    //     setTimeout(() => {
                    //         onCollateralValueChange(collateralValue.toString());
                    //     }, 1000);
                    // }}
                    // DisableMsg={
                    //     mintCR.lt(1e6)
                    //         ? 'Currently Mint Collateral ratio is not 100%'
                    //         : ''
                    // }
                    // SymbolText={selectedCollateralCoin}
                    SymbolText={'ARTH'}
                    inputMode={'numeric'}
                    setText={(val: string) => {
                        textSetter(val, setRedeemValue)
                    }}
                    tagText={'MAX'}
                // errorCallback={(flag: boolean) => { setIsInputFieldError(flag) }}
                />

                <div>
                    <TcContainer>

                        <OneLineInputwomargin>
                            <div style={{ flex: 1 }}>
                                <TextWithIcon>
                                    Stability Fee
                                        <CustomToolTip toolTipText={'lol boi'} />
                                </TextWithIcon>
                            </div>
                            <OneLineInputwomargin>
                                <BeforeChip>
                                    {
                                        // Number(getDisplayBalance(tradingFee, 18, 6))
                                        //     .toLocaleString('en-US', { maximumFractionDigits: 6 })
                                        Number('180.65')
                                    }%
                                    </BeforeChip>
                                <TagChips>MAHA</TagChips>
                            </OneLineInputwomargin>
                        </OneLineInputwomargin>
                    </TcContainer>
                    <div style={{ marginTop: '32px' }}>
                        {
                            <Button
                                text={'Redeem'}
                                size={'lg'}
                                variant={'default'}
                                disabled={
                                    // mintCR.lt(1e6) ||
                                    // isInputFieldError ||
                                    // !isCollatApproved ||
                                    // !Number(debtValue) ||
                                    !(Number(redeemValue))
                                }
                                onClick={() => setRedeemModal(true)}
                            />}
                    </div>
                </div>
            </LeftTopCardContainer>
        </LeftTopCard>

    )
    return (
        <>
            <CustomSuccessModal
                modalOpen={redeemSuccess}
                setModalOpen={() => setRedeemSuccessfull(!redeemSuccess)}
                title={'Redeeming ARTH Successfull!'}
                subTitle={'View Transaction'}
                buttonText={'Close'}
            />
            <CustomModal
                open={redeemModal}
                title={'Confirm Redeem ARTH'}
                closeButton
                handleClose={() => setRedeemModal(false)}
            >
                <>
                    <TransparentInfoDiv
                        labelData={'Your ARTH amount'}
                        rightLabelUnit={'ARTH'}
                        rightLabelValue={'1500.00'}
                    />

                    <TransparentInfoDiv
                        labelData={'Stability Fee'}
                        rightLabelUnit={'MAHA'}
                        rightLabelValue={'0.05'}
                    />

                    <Divider
                        style={{
                            background: 'rgba(255, 255, 255, 0.08)',
                            margin: '15px 0px',
                        }}
                    />

                    <TransparentInfoDiv
                        labelData={'You will receive ARTH'}
                        rightLabelUnit={'ARTH'}
                        rightLabelValue={'1455'}
                    />

                    <div style={{ marginTop: 24, display: 'flex', flexDirection: isMobile ? 'column-reverse' : 'row' }}>
                        <div style={{ display: 'flex', width: '100%', marginTop: isMobile ? 10 : 0, marginRight: isMobile ? 0 : 10 }}>
                            <Button
                                variant={'transparent'}
                                text={'Cancel'}
                                onClick={() => {
                                    setRedeemModal(false)
                                }}
                            />
                        </div>
                        <div style={{ display: 'flex', width: '100%', marginLeft: isMobile ? 0 : 10 }}>
                            <Button
                                variant={'default'}
                                text={'Redeem ARTH'}
                                onClick={() => {
                                    setRedeemModal(false)
                                    setRedeemSuccessfull(true)
                                }}
                            />
                        </div>

                    </div>

                </>
            </CustomModal>
            {RedeemTab()}
        </>
    )
}

export default RedeemGrid;

const TcContainer = styled.div`
  margin-top: 24px;
`;


const TextForInfoTitle = styled.div`
  font-family: Inter;
  font-style: normal;
  font-weight: 300;
  font-size: 16px;
  line-height: 150%;
  color: #ffffff;
  opacity: 0.64;
`;


const StabilityCardHeader = styled.div`
  padding-top: 32px;
  padding-bottom: 32px;
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
padding: 0 0 24px 0;
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
font-weight: 600;
font-size: 12px;
line-height: 150%;
letter-spacing: 0.08em;
text-transform: uppercase;
color: rgba(255, 255, 255, 0.32);
  display: flex;
  align-items: center;
`;

const BeforeChip = styled.span`
font-family: Inter;
font-style: normal;
font-weight: 600;
font-size: 14px;
line-height: 20px;
text-align: right;
color: rgba(255, 255, 255, 0.88);
  margin-right: 5px;
`;

const TagChips = styled.div`
  background: rgba(255, 255, 255, 0.08);
  border-radius: 4px;
  padding: 2px 8px;
  font-family: Inter;
  font-style: normal;
  font-weight: 600;
  font-size: 14px;
  line-height: 20px;
  text-align: right;
  color: rgba(255, 255, 255, 0.88);
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
