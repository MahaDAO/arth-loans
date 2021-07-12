import React, { useState } from 'react';
import styled from 'styled-components';
import InfoIcon from '@material-ui/icons/Info';
import HtmlTooltip from '../HtmlTooltip';

type props = {
  toolTipText?: string;
  iconStyle?: object;
  children?: any;
};

const CustomToolTip: React.FC<props> = (props) => {
  const { toolTipText, iconStyle, children } = props;

  //   return <div />;

  if (!toolTipText) {
    return <InfoIcon fontSize="default" style={{ transform: 'scale(0.6)' }} />;
  }

  return (
    <HtmlTooltip
      title={
        <React.Fragment>
          <ToolTipFont>{toolTipText}</ToolTipFont>
        </React.Fragment>
      }
    >
      {!children ? <InfoIcon
        fontSize="default"
        style={{ transform: 'scale(0.6)', cursor: 'pointer', marginBottom: '2px' }}
      /> : children}
    </HtmlTooltip>
  );
};

export default CustomToolTip;

const ToolTipFont = styled.p`
  padding: 0;
  margin: 0;
`;
