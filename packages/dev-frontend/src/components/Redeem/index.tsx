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
import { Grid } from '@material-ui/core';
import { withSnackbar } from 'notistack';
import arrowDown from '../../assets/svg/arrowDown.svg';
import warningYellow from '../../assets/svg/warning-yellow.svg';
import Button from '../../components/Button';
import { getDisplayBalance } from '../../utils/formatBalance';
import CustomToolTip from '../CustomToolTip';
import CustomModal from '../CustomModal';

interface LoanProps {
    type: 'loan' | 'redeem'
    setType: (val: 'loan' | 'redeem') => void
}

const RedeemGrid = (props: LoanProps) => {
    const [redeemValue, setRedeemValue] = useState('0')
    const [noArthBorrowed, setNoArthBorrow] = useState(true);
    const [stabilityValue, setStabilityValue] = useState('0')
    const [noArthinStability, setNoArthStability] = useState(true);

    const RedeemTab = () => {
        return (
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
                            setRedeemValue(val);
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
                                !true ? (
                                    <Button
                                        text={'Connect Wallet'}
                                        size={'lg'}
                                    // onClick={() => connect('injected').then(() => {
                                    //     localStorage.removeItem('disconnectWallet')
                                    // })}
                                    />
                                ) : (
                                    !true ? (
                                        <>
                                            <ApproveButtonContainer>
                                                <Button
                                                // text={
                                                //     isCollatApproved
                                                //         ? `Approved ${selectedCollateralCoin}`
                                                //         : !isCollatApproving
                                                //             ? `Approve ${selectedCollateralCoin}`
                                                //             : 'Approving...'
                                                // }
                                                // size={'lg'}
                                                // disabled={
                                                //     mintCR.lt(1e6) ||
                                                //     isInputFieldError ||
                                                //     isCollatApproved ||
                                                //     !Number(collateralValue)
                                                // }
                                                // onClick={approveCollat}
                                                // loading={isCollatApproving}
                                                />
                                            </ApproveButtonContainer>
                                            <br />
                                        </>
                                    ) : (
                                        <Button
                                            text={'Take Loan'}
                                            size={'lg'}
                                            variant={'default'}
                                            disabled={
                                                // mintCR.lt(1e6) ||
                                                // isInputFieldError ||
                                                // !isCollatApproved ||
                                                // !Number(debtValue) ||
                                                !(Number(redeemValue))
                                            }
                                        // onClick={() => setOpenModal(1)}
                                        />
                                    )
                                )
                            }
                        </div>
                    </div>
                </LeftTopCardContainer>
            </LeftTopCard>

        )
    }
    const StabilityPool = () => {
        return (
            <div style={{ marginTop: 20 }}>
                <LeftTopCard className={'custom-mahadao-container'}>
                    <StabilityCardHeader className={'custom-mahadao-container-header'}>
                        <HeaderTitle>
                            <div>
                                {'Stability Pool'}
                                {/* <CustomToolTip toolTipText={'loreum ipsum'} /> */}
                            </div>
                        </HeaderTitle>
                        <HeaderSubtitle>
                            {/* {prettyNumber(getDisplayBalance(arthxRecollateralizeAmount, 18, 3))} <HardChip>ARTHX</HardChip>{' '} */}
                            <TextForInfoTitle>You can earn ETH and MAHA rewards by depositing ARTH.</TextForInfoTitle>
                        </HeaderSubtitle>
                    </StabilityCardHeader>
                    <LeftTopCardContainer className={'custom-mahadao-container-content'}>
                        {noArthinStability && <Warning onClick={() => setNoArthStability(false)}>
                            <img src={warningYellow} height={24} style={{ marginRight: 5 }} />
                            <div>You haven't borrowed any ARTH yet.</div>
                        </Warning>}
                        <CustomInputContainer
                            ILabelValue={'Enter Collateral'}
                            IBalanceValue={'`${getDisplayBalance(0, 0)}`'}
                            ILabelInfoValue={''}
                            // disabled={mintCR.lt(1e6)}
                            DefaultValue={stabilityValue.toString()}
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
                                setStabilityValue(val);
                            }}
                            tagText={'MAX'}
                        // errorCallback={(flag: boolean) => { setIsInputFieldError(flag) }}
                        />
                        <div>
                            <TcContainer>
                                <OneLineInputwomargin>
                                    <div style={{ flex: 1 }}>
                                        <TextWithIcon>
                                            Reward
                                        <CustomToolTip toolTipText={'lol boi'} />
                                        </TextWithIcon>
                                    </div>
                                    <OneLineInputwomargin>
                                        <BeforeChip>
                                            {
                                                // Number(getDisplayBalance(tradingFee, 18, 6))
                                                //     .toLocaleString('en-US', { maximumFractionDigits: 6 })
                                                Number('0.00')
                                            }
                                        </BeforeChip>
                                        <TagChips>MAHA</TagChips>
                                    </OneLineInputwomargin>
                                </OneLineInputwomargin>

                                <OneLineInputwomargin>
                                    <div style={{ flex: 1 }}>
                                        <TextWithIcon>
                                            Pool Share
                                        <CustomToolTip toolTipText={'lol boi'} />
                                        </TextWithIcon>
                                    </div>
                                    <OneLineInputwomargin>
                                        <BeforeChip>
                                            {
                                                // Number(getDisplayBalance(tradingFee, 18, 6))
                                                //     .toLocaleString('en-US', { maximumFractionDigits: 6 })
                                                Number('0.0')
                                            }%
                                        </BeforeChip>
                                        {/* <TagChips>ARTH</TagChips> */}
                                    </OneLineInputwomargin>
                                </OneLineInputwomargin>

                                <OneLineInputwomargin>
                                    <div style={{ flex: 1 }}>
                                        <TextWithIcon>
                                            MAHA Apy
                                        <CustomToolTip toolTipText={'lol boi'} />
                                        </TextWithIcon>
                                    </div>
                                    <OneLineInputwomargin>
                                        <BeforeChip>
                                            {
                                                // Number(getDisplayBalance(tradingFee, 18, 6))
                                                //     .toLocaleString('en-US', { maximumFractionDigits: 6 })
                                                Number('60.76')
                                            }%
                                    </BeforeChip>
                                        {/* <TagChips>ARTH</TagChips> */}
                                    </OneLineInputwomargin>
                                </OneLineInputwomargin>
                            </TcContainer>
                            <div style={{ marginTop: '32px' }}>
                                {
                                    !true ? (
                                        <Button
                                            text={'Connect Wallet'}
                                            size={'lg'}
                                        // onClick={() => connect('injected').then(() => {
                                        //     localStorage.removeItem('disconnectWallet')
                                        // })}
                                        />
                                    ) : (
                                        !true ? (
                                            <>
                                                <ApproveButtonContainer>
                                                    <Button
                                                    // text={
                                                    //     isCollatApproved
                                                    //         ? `Approved ${selectedCollateralCoin}`
                                                    //         : !isCollatApproving
                                                    //             ? `Approve ${selectedCollateralCoin}`
                                                    //             : 'Approving...'
                                                    // }
                                                    // size={'lg'}
                                                    // disabled={
                                                    //     mintCR.lt(1e6) ||
                                                    //     isInputFieldError ||
                                                    //     isCollatApproved ||
                                                    //     !Number(collateralValue)
                                                    // }
                                                    // onClick={approveCollat}
                                                    // loading={isCollatApproving}
                                                    />
                                                </ApproveButtonContainer>
                                                <br />
                                            </>
                                        ) : (
                                            <Button
                                                text={'Deposit'}
                                                size={'lg'}
                                                variant={'default'}
                                                disabled={
                                                    // mintCR.lt(1e6) ||
                                                    // isInputFieldError ||
                                                    // !isCollatApproved ||
                                                    // !Number(debtValue) ||
                                                    !(Number(stabilityValue))
                                                }
                                            // onClick={() => setOpenModal(1)}
                                            />
                                        )
                                    )
                                }
                            </div>
                        </div>
                    </LeftTopCardContainer>
                </LeftTopCard>
            </div>
        )
    }
    return (
        <>
            <CustomModal
                open={false}
            >
                <></>
            </CustomModal>
            <RedeemTab />
            {/* <StabilityPool /> */}
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
