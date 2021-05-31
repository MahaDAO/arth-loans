import React, { useState } from 'react';
import styled from 'styled-components';
// import { DataGrid, GridColDef, GridValueGetterParams } from '@material-ui/data-grid';

export default () => (
    <>

        <RightTopCard className={'custom-mahadao-box'}
            style={{ padding: 0 }}
        >
            {/* <DataGrid/>/ */}
        </RightTopCard>
    </>
)


const RightTopCard = styled.div`
  @media (max-width: 600px) {
    margin-top: 8px;
  }
`;