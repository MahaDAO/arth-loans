import React, { useState } from 'react';
import styled from 'styled-components';
import { getDisplayBalance } from '../../utils/formatBalance';
// import useCore from '../../hooks/useCore';
import TokenSymbol from '../TokenSymbol';
import { IconButton } from '@material-ui/core';
import metamask from '../../assets/svg/metamask.svg';
import copy from '../../assets/svg/copy.svg';
import Button from '../Button';
import Grid from '@material-ui/core/Grid';
import CustomModal from '../CustomModal';
// import useTokenBalanceOf from '../../hooks/state/useTokenBalanceOf';
// import { useWallet } from 'use-wallet';
import { truncateMiddle } from '../../utils/formatBalance';

interface props {
  onClose: () => void;
}

const AccountModal: React.FC<props> = (props) => {
  // const core = useCore();

  // const { account, reset } = useWallet();

  const [ConfirmationModal, setConfirmationModal] = useState<boolean>(false);

  const arthBalance = 55 // useTokenBalanceOf(core.ARTH, account);
  const mahaBalance = 55 // useTokenBalanceOf(core.MAHA, account);
  const arthxBalance = 55 // useTokenBalanceOf(core.ARTHX, account);
  let account = '0x123123123123123'
  return (
    <MainDiv>
      <BackgroundAbsolute onClick={props.onClose} />
      <CustomModal
        closeButton
        handleClose={props.onClose}
        open={ConfirmationModal}
        modalTitleStyle={{}}
        modalContainerStyle={{}}
        modalBodyStyle={{}}
        title={`Disconnect Wallet`}
      >
        <>
          <PrimaryText>Are you sure you want to disconnect {truncateMiddle(account, 15)} ?</PrimaryText>
          <SecondaryText>{account}</SecondaryText>
          <Grid container spacing={2} style={{ marginTop: '32px' }}>
            <Grid item lg={6} md={6} sm={6} xs={6}>
              <Button
                variant={'transparent'}
                text="Cancel"
                size={'lg'}
                onClick={props.onClose}
              />
            </Grid>
            <Grid item lg={6} md={6} sm={6} xs={6}>
              <Button
                text={'Disconnect'}
                size={'lg'}
                onClick={() => {
                  localStorage.setItem('disconnectWallet', '1')
                  // reset()
                  props.onClose()
                  window.location.reload();
                }}
              />
            </Grid>
          </Grid>
        </>
      </CustomModal>
      <PositionDiv>
        <WalletDiv>
          <StyledLink>
            <span>Your Account</span>
            <AccountDetails>
              <IconButton>
                <img height={32} src={metamask} alt="metamask" />
              </IconButton>
              <span>{truncateMiddle(account, 15)}</span>
              <IconButton>
                <img height={24} src={copy} alt="copy" />
              </IconButton>
            </AccountDetails>
          </StyledLink>
          <div style={{ height: '4px', width: '100%' }} />
          <StyledRows>
            <RowName>
              <IconButton>
                <TokenSymbol symbol={'MAHA'} size={44} />
              </IconButton>
              <span>{55 
              // || getDisplayBalance(mahaBalance)
              } MAHA</span>
            </RowName>
            {/* <DollarValue>${props?.walletData?.mahaDollars}</DollarValue> */}
          </StyledRows>

          <StyledRows>
            <RowName>
              <IconButton>
                <TokenSymbol symbol={'ARTH'} size={44} />
              </IconButton>
              <span>{55 
              // || getDisplayBalance(arthBalance)
              } ARTH</span>
            </RowName>
            {/* <DollarValue>${props?.walletData?.arthDollars}</DollarValue> */}
          </StyledRows>

          <StyledRows>
            <RowName>
              <IconButton>
                <TokenSymbol symbol={'ARTHX'} size={44} />
              </IconButton>
              <span>{55 
              // || getDisplayBalance(arthxBalance)
              } ARTHX</span>
            </RowName>
            {/* <DollarValue>${props?.walletData?.arthxDollars}</DollarValue> */}
          </StyledRows>

          <StyledRows style={{ margin: '20px 0' }}>
            <Button
              text={'Disconnect'}
              size={'lg'}
              variant={'transparent'}
              onClick={() => setConfirmationModal(true)}
            />
          </StyledRows>
        </WalletDiv>
      </PositionDiv>
    </MainDiv>
  );
};

const BackgroundAbsolute = styled.div`
  position: absolute;
  top: 0;
  left: 0;
  background: transparent;
  width: 100vw;
  height: 100vh;
  z-index: 1;
`;
const PrimaryText = styled.p`
  font-family: Inter;
  font-style: normal;
  font-weight: 600;
  font-size: 14px;
  line-height: 20px;
  text-align: center;
  color: rgba(255, 255, 255, 0.88);
  margin-bottom: 8px;
`;

const SecondaryText = styled.p`
  font-family: Inter;
  font-style: normal;
  font-weight: 300;
  font-size: 14px;
  line-height: 140%;
  text-align: center;
  color: rgba(255, 255, 255, 0.64);
  margin-bottom: 0;
`;

const MainDiv = styled.div`
  position: absolute;
  top: 0;
  left: 0;
  background: transparent;
  width: 100vw;
  height: 100vh;
`;

const PositionDiv = styled.div`
  box-sizing: border-box;
  margin: 0px auto;
  max-width: 1200px;
  padding: 0px 24px;
  width: 100%;
  position: relative;
`;

const WalletDiv = styled.div`
  position: absolute;
  background: linear-gradient(180deg, #48423e 0%, #373030 100%);
  border-radius: 12px;
  right: 22px;
  top: 72px;
  width: 380px;
  z-index: 10;
  transition: 1s ease-in-out;
`;

const StyledLink = styled.div`
  padding: 24px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.08);
  &:hover {
    border-radius: 12px;
    color: rgba(255, 255, 255, 0.64);
    background: rgba(255, 255, 255, 0.04);
    backdrop-filter: blur(70px);
  }
  &.active {
    color: rgba(255, 255, 255, 0.88);
  }
  display: flex;
  align-items: center;
  justify-content: space-between;
  font-family: Inter;
  font-style: normal;
  font-weight: 600;
  font-size: 16px;
  line-height: 24px;
  color: #ffffff;
  cursor: pointer;
`;

const AccountDetails = styled.div`
  display: flex;
  flex-direction: row;
  justify-content: space-evenly;
  align-items: center;
`;

const StyledRows = styled.div`
  // margin-top: 16px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  width: 100%;
  padding: 0px 24px;
`;

const RowName = styled.div`
  display: flex;
  align-items: center;
  justify-content: baseline;
  font-family: Inter;
  font-style: normal;
  font-weight: 600;
  font-size: 14px;
  line-height: 20px;
  color: rgba(255, 255, 255, 0.88);
  // border: 1px solid;
  margin-left: -15px;
`;

const DollarValue = styled.div`
  font-family: Inter;
  font-style: normal;
  font-weight: 600;
  font-size: 14px;
  line-height: 20px;
  text-align: right;
  color: rgba(255, 255, 255, 0.64);
  display: flex;
  align-items: center;
`;

export default AccountModal;
