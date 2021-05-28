// @ts-nocheck
import React, { CSSProperties, useEffect, useState } from 'react';
import styled from 'styled-components';
import { InputBase } from '@material-ui/core';

import TokenSymbol from '../TokenSymbol';
import CustomDropDown from '../CustomDropDown';
import DownArrow from '../../assets/img/ArrowDown.svg';
import { Link } from 'react-router-dom';
import { correctString } from './RegexValidation';

type props = {
  ILabelValue: string;
  IBalanceValue: string;
  showBalance?: boolean;
  ILabelInfoValue?: string;
  value?: string;
  DefaultValue: string;
  LogoSymbol: string;
  hasDropDown: boolean;
  disabled?: boolean;
  SymbolText: string;
  setText?: (val: string) => void;
  inputMode?: 'none' | 'text' | 'tel' | 'url' | 'email' | 'numeric' | 'decimal' | 'search';
  tagText?: string;
  onTagTextClick?: () => void;
  dropDownValues?: string[];
  ondropDownValueChange?: (data: string) => void;
  multiIcons?: boolean;
  symbols?: string[];
  dontShowBackgroundContainer?: boolean;
  href?: string;
  to?: string;
  Istate?: 'default' | 'error' | 'warning';
  msg?: string;
  DisableMsg?: string;
  errorCallback?: (flag: boolean) => void;
};

interface ICStatesInterface {
  IState: 'default' | 'error' | 'warning';
  IMsg: string;
}

const CustomInputContainer: React.FC<props> = (props) => {
  const {
    ILabelValue,
    IBalanceValue,
    showBalance = true,
    ILabelInfoValue,
    DefaultValue,
    LogoSymbol,
    hasDropDown,
    SymbolText,
    tagText = '',
    dropDownValues,
    ondropDownValueChange,
    multiIcons = false,
    symbols,
    disabled,
    Istate = 'default',
    msg = '',
    DisableMsg = '',
  } = props;
  const [ICStates, setICStates] = useState<ICStatesInterface>({ IState: Istate, IMsg: msg });
  const [modalOpen, setModalOpen] = useState<boolean>(false);

  useEffect(() => {
    let temp = { IState: Istate, IMsg: msg };
    setICStates(temp);
  }, [Istate, msg]);

  const Redirection = () => {
    if (props?.href) {
      return (
        <HrefLink href={props.href} target="__blank">
          <ILabelInfo>{ILabelInfoValue}</ILabelInfo>
        </HrefLink>
      );
    } else if (props?.to) {
      return (
        <ToLink to={'/mint'}>
          <ILabelInfo>{ILabelInfoValue}</ILabelInfo>
        </ToLink>
      );
    } else {
      return <ILabelInfo>{ILabelInfoValue}</ILabelInfo>;
    }
  };

  const checkForErrors = async (val: string) => {
    if (Number(val) > Number(IBalanceValue)) {
      const temp: ICStatesInterface = {
        IState: 'error',
        IMsg: 'Amount canont be more than your balance',
      };
      setICStates(temp);
      if (props.errorCallback) props.errorCallback(true);
      return true;
    } else {
      const temp: ICStatesInterface = {
        IState: 'default',
        IMsg: '',
      };
      setICStates(temp);
      if (props.errorCallback) props.errorCallback(false);
      return true;
    }
  };

  const IConatinerStyle = () => {
    let returnObj: CSSProperties = {}
    if (props.dontShowBackgroundContainer) {
      returnObj['padding'] = '0px';
      returnObj['backgroundColor'] = 'transparent';
    }
    if (DisableMsg !== "") {
      returnObj['opacity'] = "0.32";
    }
    return returnObj;
  }

  return (
    <div style={{ position: 'relative' }}>
      {DisableMsg !== '' && <TotalDisable><DMsg>{DisableMsg}</DMsg></TotalDisable>}
      <IConatiner style={IConatinerStyle()}>
        <ILabelContainer>
          <ILabelLeft>
            <ILabel>{ILabelValue}</ILabel>
            {ILabelInfoValue !== '' && Redirection()}
          </ILabelLeft>
          <ILabelRight>
            {showBalance && <ILabelBalance>{`Balance  ${Number(IBalanceValue).toLocaleString()}`}</ILabelBalance>}
          </ILabelRight>
        </ILabelContainer>
        <IFieldConatiner className={`input-${ICStates.IState}`}>
          <InputBase
            inputMode={props?.inputMode}
            placeholder={DefaultValue || '0'}
            // defaultValue={DefaultValue}
            value={DefaultValue}
            inputProps={{ 'aria-label': 'naked' }}
            style={{
              padding: '8px 12px',
              color: '#FFFFFF',
              flex: 1,
              fontFamily: 'Inter !important',
            }}
            type={'number'}
            onChange={(event) => {
              const proceed = checkForErrors(event.target.value);
              if (Number(event.target.value) && Number(event.target.value) < 0) return
              if (proceed) props?.setText(event.target.value.length > 1 ? correctString(event.target.value) : event.target.value);
            }}
          />
          {tagText !== '' && (
            <MaxTagConatiner
              onClick={() => {
                props?.setText(IBalanceValue.toString());
              }}
            >
              {tagText}
            </MaxTagConatiner>
          )}
          <IFieldRightContainer
            onClick={() => {
              if (hasDropDown) setModalOpen(!modalOpen);
            }}
          >
            {/*<Select
              width='500px'
              style={{
                background: 'red'
              }}
              options={options}
              defaultValue={options[0]}
              components={{ Option: IconOption, Menu }}
              menuColor='red'
            />*/}
            <IFieldRightContainerLogo>
              {multiIcons && symbols ? (
                <LLabel>
                  {symbols.map((s, index) => (
                    <TokenSymbol key={s} symbol={s} size={25} style={index === 1 ? { zIndex: 2, marginLeft: -5 } : { zIndex: 2 }} />
                  ))}
                </LLabel>
              ) : (
                <TokenSymbol symbol={LogoSymbol} size={25} />
              )}
            </IFieldRightContainerLogo>
            <IFieldRightContainerText>{SymbolText}</IFieldRightContainerText>
            {hasDropDown && (
              <IFieldRightContainerDropDown>
                {/*<KeyboardArrowDown fontSize='default' />*/}
                <img alt="arrow" src={DownArrow} height={20} style={{ marginLeft: 10 }} />
              </IFieldRightContainerDropDown>
            )}
            {modalOpen && hasDropDown && ondropDownValueChange && (
              <BackgroundAbsolute
                onClick={() => {
                  setModalOpen(!modalOpen);
                }}
              />
            )}
            {modalOpen && hasDropDown && ondropDownValueChange && (
              <CustomDropDown
                dropDownValues={dropDownValues}
                ondropDownValueChange={ondropDownValueChange}
              />
            )}
          </IFieldRightContainer>
        </IFieldConatiner>
        {ICStates.IMsg !== '' && (
          <p className={`input-font-${ICStates.IState}`}>{ICStates.IMsg}</p>
        )}
      </IConatiner>
    </div>
  );
};

export default CustomInputContainer;

const TotalDisable = styled.div`
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background: rgba(255, 255, 255, 0.16);
  box-sizing: border-box;
  border-radius: 12px;
  z-index: 12;
  display: flex;
  justify-content: center;
  align-items: center;
  border: 1px solid #FFFFFF29;
`;

const DMsg = styled.p`
  font-family: Inter;
  font-style: normal;
  font-weight: 600;
  font-size: 16px;
  line-height: 24px;
  color: #FFFFFF;
  margin-bottom: 0;
`

const HrefLink = styled.a`
  z-index: 1;
`;
const ToLink = styled(Link)`
  z-index: 1;
`;
const BackgroundAbsolute = styled.div`
  position: fixed;
  top: 0;
  left: 0;
  background: transparent;
  width: 100vw;
  height: 100vh;
  z-index: 11;
`;
const IConatiner = styled.div`
  background: rgba(255, 255, 255, 0.08);
  border-radius: 8px;
  padding: 12px;
`;
const ILabelContainer = styled.div`
  display: flex;
  flex-direction: row;
  align-items: center;
`;
const ILabelLeft = styled.div`
  display: flex;
  align-items: center;
  flex: 1;
`;
const ILabelRight = styled.div``;
const ILabel = styled.p`
  font-family: Inter;
  font-style: normal;
  font-weight: 600;
  font-size: 14px;
  line-height: 20px;
  color: rgba(255, 255, 255, 0.64);
  margin-bottom: 12px;
`;
const ILabelInfo = styled.p`
  font-family: Inter;
  font-style: normal;
  font-weight: 300;
  font-size: 14px;
  line-height: 20px;
  color: #f7653b;
  margin-left: 5px;
  margin-bottom: 12px;
`;
const ILabelBalance = styled.p`
  font-family: Inter;
  font-style: normal;
  font-weight: 600;
  font-size: 14px;
  line-height: 20px;
  text-align: right;
  color: rgba(255, 255, 255, 0.64);
  margin-bottom: 12px;
`;
const LLabel = styled.div`
  display: flex;
  flex-direction: row;
  align-items: center;
`;

const IFieldConatiner = styled.div`
  display: flex;
  flex-direction: row;
  background: #151414;
  border-radius: 6px;
  max-height: 44px;
`;
const IFieldRightContainer = styled.div`
  padding: 10px 12px;
  background: #1f1e1e;
  border-radius: 0px 6px 6px 0px;
  display: flex;
  align-items: center;
  position: relative;
  cursor: pointer;
`;
const MaxTagConatiner = styled.div`
  font-family: Inter;
  font-style: normal;
  font-weight: 600;
  font-size: 14px;
  color: #f7653b;
  padding: 10px 12px;
  background: transparent;
  border-radius: 0px 6px 6px 0px;
  display: flex;
  align-items: center;
  position: relative;
  cursor: pointer;
`;
const IFieldRightContainerLogo = styled.span``;
const IFieldRightContainerText = styled.span`
  font-family: Inter;
  font-style: normal;
  font-weight: 600;
  font-size: 14px;
  line-height: 20px;
  color: rgba(255, 255, 255, 0.64);
  margin-left: 5px;
`;
const IFieldRightContainerDropDown = styled.span`
  margin-left: 5px;
`;
