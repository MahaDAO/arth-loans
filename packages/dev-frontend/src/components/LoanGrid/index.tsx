import React, { useEffect, useState } from 'react'
import styled from 'styled-components';
// import { withSnackbar, WithSnackbarProps } from 'notistack';
import { useParams } from 'react-router-dom';
import Container from '../../components/Container';
import Page from '../../components/Page'
import PageHeader from '../../components/PageHeader';
import CustomInputContainer from '../../components/CustomInputContainer'
import textSetter from '../../components/CustomInputContainer/textSetter'
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
import TransparentInfoDiv from '../InfoDiv'
import { useMediaQuery } from 'react-responsive';
import CustomSuccessModal from '../CustomSuccessModal';
import { TroveView } from '../Trove/context/types';
import { LiquityStoreState, Percent } from '@arthloans/lib-base';
import { useLiquitySelector } from '@arthloans/lib-react';

interface LoanProps {
    type: 'loan' | 'redeem'
    setType: (val: 'loan' | 'redeem') => void
    view: TroveView;
}

const LoanGrid = (props: LoanProps) => {
    const select = ({ trove, price }: LiquityStoreState) => ({ trove, price });
    const { trove, price } = useLiquitySelector(select);
    let isMobile = useMediaQuery({ 'maxWidth': '600px' })
    const [stabilityValue, setStabilityValue] = useState('0')
    const [noArthBorrowed, setNoArthBorrow] = useState(true);
    const [noArthinStability, setNoArthStability] = useState(true);
    const [loanTaken, setLoanTaken] = useState(true)
    const [modifyMode, setModifyMode] = useState(false)
    const [collateralRatio, setCollRatio] = useState(150);
    const [action, setAction] = useState<'Loan' | 'Modify' | 'Close' | ''>('Loan')
    const [modal, setModal] = useState(false)
    const [successModal, setSuccessModal] = useState(false)
    let stringCollRatio = new Percent(trove.collateralRatio(price) ?? { toString: () => "N/A" }).prettify()
    const [collateralValue, setCollateralValue] = useState(loanTaken ? trove.collateral.prettify(2) : '0')
    const [debtValue, setDebtValue] = useState(loanTaken ? trove.debt.prettify(2) : '0')

    const LoanPool = () => (
        <LeftTopCard className={'custom-mahadao-container'}>
            <LeftTopCardHeader className={'custom-mahadao-container-header'}>
                <div style={{ display: 'flex' }}>
                    <TabContainer onClick={() => props.setType('loan')}>
                        <ActiveTab />
                        <TabTextActive>Loan</TabTextActive>
                    </TabContainer>
                    <TabContainer onClick={() => props.setType('redeem')}>
                        <TabText>Redeem</TabText>
                    </TabContainer>
                </div>
            </LeftTopCardHeader>
            <LeftTopCardContainer className={'custom-mahadao-container-content'}>
                {noArthBorrowed ? <Warning onClick={() => setNoArthBorrow(false)}>
                    <img src={warningYellow} height={24} style={{ marginRight: 5 }} />
                    <div>You haven't borrowed any ARTH yet.</div>
                </Warning> :
                    collateralRatio < 150 ? <Warning onClick={() => setNoArthBorrow(false)}>
                        <img src={warningYellow} height={24} style={{ marginRight: 5 }} />
                        <div>Keeping your CR above 150% can help avoid liquidation under Recovery Mode.</div>
                    </Warning> : <></>
                }
                {!loanTaken ? <CustomInputContainer
                    ILabelValue={'Enter Collateral'}
                    IBalanceValue={'`${getDisplayBalance(0, 0)}`'}
                    ILabelInfoValue={''}
                    // disabled={mintCR.lt(1e6)}
                    DefaultValue={collateralValue.toString()}
                    LogoSymbol={'ARTH'}
                    hasDropDown={false}
                    SymbolText={'ARTH'}
                    inputMode={'numeric'}
                    setText={(val: string) => {
                        textSetter(val, setCollateralValue)
                    }}
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
                    tagText={'MAX'}
                /> : modifyMode ?
                    <>
                        <CustomInputContainer
                            InfoOnlyMode={false}
                            ILabelValue={'Modify Collateral'}
                            IBalanceValue={'`${getDisplayBalance(0, 0)}`'}
                            ILabelInfoValue={''}
                            // disabled={mintCR.lt(1e6)}
                            DefaultValue={collateralValue.toString()}
                            LogoSymbol={'ARTH'}
                            hasDropDown={false}
                            SymbolText={'ARTH'}
                            inputMode={'numeric'}
                            setText={(val: string) => {
                                // setCollateralValue(val);
                                textSetter(val, setCollateralValue)
                            }}
                            tagText={'MAX'}
                        />
                    </>
                    :
                    <CustomInputContainer
                        InfoOnlyMode
                        InfoLeft={'Collateral'}
                        InfoRightUnit={'ETH'}
                        InfoRightValue={trove.collateral.prettify(4)}
                    />
                }
                <PlusMinusArrow>
                    <img src={arrowDown} alt="arrow" />
                </PlusMinusArrow>
                {!loanTaken ? <CustomInputContainer
                    ILabelValue={'Enter Debt Amount'}
                    IBalanceValue={'`${getDisplayBalance(0, 0)}`'}
                    ILabelInfoValue={''}
                    // disabled={mintCR.lt(1e6)}
                    DefaultValue={debtValue.toString()}
                    LogoSymbol={'ARTH'}
                    hasDropDown={false}
                    SymbolText={'ARTH'}
                    inputMode={'numeric'}
                    setText={(val: string) => {
                        textSetter(val, setDebtValue)
                    }}
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
                /> : modifyMode ?
                    <>
                        <CustomInputContainer
                            InfoOnlyMode={false}
                            ILabelValue={'Modify Debt Amount'}
                            IBalanceValue={'`${getDisplayBalance(0, 0)}`'}
                            IBalanceText={'Current Debt:'}
                            ILabelInfoValue={''}
                            // disabled={mintCR.lt(1e6)}
                            DefaultValue={debtValue.toString()}
                            LogoSymbol={'ARTH'}
                            hasDropDown={false}
                            SymbolText={'ARTH'}
                            inputMode={'numeric'}
                            setText={(val: string) => {
                                textSetter(val, setDebtValue)
                            }}
                        // tagText={'MAX'}
                        />
                    </>
                    :
                    <CustomInputContainer
                        InfoOnlyMode
                        InfoLeft={'Total Debt'}
                        InfoRightUnit={'ARTH'}
                        InfoRightValue={trove.debt.prettify()}
                    />
                }
                <div>
                    <TcContainer>
                        <OneLineInputwomargin>
                            <div style={{ flex: 1 }}>
                                <TextWithIcon>
                                    Liquidation Reserve
                                    <CustomToolTip toolTipText={'lol boi'} />
                                </TextWithIcon>
                            </div>
                            <OneLineInputwomargin>
                                <BeforeChip>
                                    {
                                        // Number(getDisplayBalance(tradingFee, 18, 6))
                                        //     .toLocaleString('en-US', { maximumFractionDigits: 6 })
                                        Number('0.05')
                                    }
                                </BeforeChip>
                                <TagChips>ARTH</TagChips>
                            </OneLineInputwomargin>
                        </OneLineInputwomargin>

                        <OneLineInputwomargin>
                            <div style={{ flex: 1 }}>
                                <TextWithIcon>
                                    Borrowing Fee
                                    <CustomToolTip toolTipText={'lol boi'} />
                                </TextWithIcon>
                            </div>
                            <OneLineInputwomargin>
                                <BeforeChip>
                                    {
                                        // Number(getDisplayBalance(tradingFee, 18, 6))
                                        //     .toLocaleString('en-US', { maximumFractionDigits: 6 })
                                        Number('0.05')
                                    }
                                </BeforeChip>
                                <TagChips>ARTH</TagChips>
                            </OneLineInputwomargin>
                        </OneLineInputwomargin>

                        <OneLineInputwomargin>
                            <div style={{ flex: 1 }}>
                                <TextWithIcon>
                                    Colleteral Ratio
                                    <CustomToolTip toolTipText={'lol boi'} />
                                </TextWithIcon>
                            </div>
                            <OneLineInputwomargin>
                                <BeforeChip style={{ color: Number(stringCollRatio) >= 150 ? '#20C974' : '#FA4C69' }}>
                                    {stringCollRatio}
                                </BeforeChip>
                                {/* <TagChips>ARTH</TagChips> */}
                            </OneLineInputwomargin>
                        </OneLineInputwomargin>
                    </TcContainer>
                    <div style={{ marginTop: '32px', display: 'flex', flexDirection: isMobile ? 'column-reverse' : 'row', width: '100%' }}>
                        {
                            <>
                                {loanTaken && <div style={{ display: 'flex', marginTop: isMobile ? 10 : 0, marginRight: isMobile ? 0 : 10, width: '100%' }}>
                                    <Button
                                        text={'Close Loan'}
                                        size={'lg'}
                                        variant={'transparent'}
                                        onClick={() => {
                                            setAction('Close')
                                            setModal(true)
                                        }}
                                    />
                                </div>}
                                <div style={{ display: 'flex', marginLeft: isMobile ? 0 : 10, width: '100%' }}>
                                    <Button
                                        text={loanTaken ? 'Modify Loan' : 'Take Loan'}
                                        size={'lg'}
                                        variant={'default'}
                                        disabled={
                                            (!loanTaken && (!Number(debtValue) ||
                                                !(Number(collateralValue))))
                                        }
                                        onClick={() => {
                                            if (!loanTaken) setModal(true)
                                            else if (loanTaken && !modifyMode) setModifyMode(true)
                                            else {
                                                setAction('Modify')
                                                setModal(true)
                                            }
                                        }}
                                    />
                                </div>
                            </>
                        }
                    </div>
                </div>
            </LeftTopCardContainer>
        </LeftTopCard>
    )

    const handleModalClose = () => {
        setModal(false)
    }
    return (
        <>
            <CustomSuccessModal
                modalOpen={successModal}
                setModalOpen={() => setSuccessModal(!successModal)}
                subTitle={'View transaction'}
                subTitleLink={'https://google.com'}
                title={
                    action === 'Loan' ? 'You took loan of ARTH successfully!' :
                        action === 'Close' ? 'You Closed Loan of ARTH successfully!' :
                            'You Modified Lan of ARTH Successfully!'
                }
                buttonText={'Close'}
                buttonType={'transparent'}
                buttonCustomOnClick={() => setSuccessModal(!successModal)}
            />
            <CustomModal
                open={modal}
                title={`Confirm ${action} ${action === 'Close' ? 'Loan' : 'ARTH'}`}
                closeButton
                handleClose={() => setModal(!modal)}
            >
                {action === 'Loan' &&
                    <>
                        <TransparentInfoDiv
                            labelData={`Your collateral amount`}
                            rightLabelUnit={'ETH'}
                            rightLabelValue={Number(collateralValue).toLocaleString()}
                        />
                        <TransparentInfoDiv
                            labelData={`Liquidation Reserve`}
                            rightLabelUnit={'ARTH'}
                            rightLabelValue={Number('200.00').toLocaleString()}
                        />
                        <TransparentInfoDiv
                            labelData={`Borrowing Fee`}
                            rightLabelUnit={'ARTH'}
                            rightLabelValue={Number('0.05').toLocaleString()}
                        />
                        <TransparentInfoDiv
                            labelData={`Collateral Ratio`}
                            // rightLabelUnit={'ARTH'}
                            rightLabelValue={`${collateralRatio}%`}
                        />
                        <Divider
                            style={{
                                background: 'rgba(255, 255, 255, 0.08)',
                                margin: '15px 0px',
                            }}
                        />
                        <TransparentInfoDiv
                            labelData={`You will receive ARTH`}
                            rightLabelUnit={'ARTH'}
                            rightLabelValue={Number('5432').toLocaleString()}
                        />
                        <div
                            style={{
                                flexDirection: isMobile ? 'column-reverse' : 'row',
                                display: 'flex',
                                width: '100%',
                                marginTop: '10%',
                                justifyContent: 'space-between',
                                alignItems: 'center',
                                // marginBottom: 8,
                            }}
                        >
                            <div style={{
                                width: '100%',
                                marginTop: isMobile ? 12 : 0,
                                marginRight: isMobile ? 0 : 10
                            }}>
                                <Button
                                    variant={'transparent'}
                                    text={'Cancel'}
                                    onClick={handleModalClose}
                                />
                            </div>
                            <div style={{
                                width: '100%',
                                marginTop: isMobile ? 12 : 0,
                                marginLeft: isMobile ? 0 : 10
                            }}>
                                <Button
                                    variant={'default'}
                                    onClick={handleModalClose}
                                    text={'Confirm Loan ARTH'}
                                />
                            </div>
                        </div>
                    </>
                }
                {action === 'Close' &&
                    <>
                        <TransparentInfoDiv
                            labelData={`Your collateral amount`}
                            rightLabelUnit={'ETH'}
                            rightLabelValue={Number(collateralValue).toLocaleString()}
                        />
                        <TransparentInfoDiv
                            labelData={`Borrowing Fee (0.05%)`}
                            rightLabelUnit={'ARTH'}
                            rightLabelValue={Number('0.05').toLocaleString()}
                        />
                        <Divider
                            style={{
                                background: 'rgba(255, 255, 255, 0.08)',
                                margin: '15px 0px',
                            }}
                        />
                        <TransparentInfoDiv
                            labelData={`You will receive ARTH`}
                            rightLabelUnit={'ARTH'}
                            rightLabelValue={Number('5432').toLocaleString()}
                        />
                        <div
                            style={{
                                flexDirection: isMobile ? 'column-reverse' : 'row',
                                display: 'flex',
                                width: '100%',
                                marginTop: '10%',
                                justifyContent: 'space-between',
                                alignItems: 'center',
                                // marginBottom: 8,
                            }}
                        >
                            <div style={{
                                width: '100%',
                                marginTop: isMobile ? 12 : 0,
                                marginRight: isMobile ? 0 : 10
                            }}>
                                <Button
                                    variant={'transparent'}
                                    onClick={handleModalClose}
                                    text={'Cancel'}
                                />
                            </div>
                            <div style={{
                                width: '100%',
                                marginTop: isMobile ? 12 : 0,
                                marginLeft: isMobile ? 0 : 10
                            }}>
                                <Button
                                    variant={'default'}
                                    onClick={handleModalClose}
                                    text={'Confirm Close Loan'}
                                />
                            </div>
                        </div>
                    </>
                }
                {action === 'Modify' &&
                    <>
                        <TransparentInfoDiv
                            labelData={`Your collateral amount`}
                            rightLabelUnit={'ETH'}
                            rightLabelValue={Number(collateralValue).toLocaleString()}
                        />
                        <TransparentInfoDiv
                            labelData={`Borrowing Fee (0.05%)`}
                            rightLabelUnit={'ARTH'}
                            rightLabelValue={Number('0.05').toLocaleString()}
                        />
                        <Divider
                            style={{
                                background: 'rgba(255, 255, 255, 0.08)',
                                margin: '15px 0px',
                            }}
                        />
                        <TransparentInfoDiv
                            labelData={`You will receive ARTH`}
                            rightLabelUnit={'ARTH'}
                            rightLabelValue={Number('5432').toLocaleString()}
                        />
                        <div
                            style={{
                                flexDirection: isMobile ? 'column-reverse' : 'row',
                                display: 'flex',
                                width: '100%',
                                marginTop: '10%',
                                justifyContent: 'space-between',
                                alignItems: 'center',
                                // marginBottom: 8,
                            }}
                        >
                            <div style={{
                                width: '100%',
                                marginTop: isMobile ? 12 : 0,
                                marginRight: isMobile ? 0 : 10
                            }}>
                                <Button
                                    variant={'transparent'}
                                    onClick={handleModalClose}
                                    text={'Cancel'}
                                />
                            </div>
                            <div style={{
                                width: '100%',
                                marginTop: isMobile ? 12 : 0,
                                marginLeft: isMobile ? 0 : 10
                            }}>
                                <Button
                                    variant={'default'}
                                    onClick={handleModalClose}
                                    text={'Confirm Modify Loan'}
                                />
                            </div>
                        </div>
                    </>
                }
            </CustomModal>
            {/* <LoanPool /> */}
            {LoanPool()}
            {/* <StabilityPool /> */}
        </>
    )
}

export default LoanGrid;

const TcContainer = styled.div`
  margin-top: 24px;
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


const TextForInfoTitle = styled.div`
  font-family: Inter;
  font-style: normal;
  font-weight: 300;
  font-size: 16px;
  line-height: 150%;
  color: #ffffff;
  opacity: 0.64;
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

const StabilityCardHeader = styled.div`
  padding-top: 32px;
  padding-bottom: 32px;
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
