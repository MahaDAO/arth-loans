import React, { useState, useEffect } from 'react';
import styled from 'styled-components';
import DataTable from 'react-data-table-component';
// import { XGrid } from '@material-ui/x-grid';

export default () => {
  const [datatable, setDatatable] = useState({})

  const columns = [
    {
      name: "Owner",
      selector: "owner",
      sortable: true,
      left: true
    },
    {
      name: "Collateral (ETH)",
      selector: "collateral",
      sortable: true,
      center: true
    },
    {
      name: "Debt (ETH)",
      selector: "debt",
      sortable: true,
      center: true
    },
    {
      name: "Collateral Ratio",
      selector: "collateralRatio",
      sortable: true,
      center: true
    }
  ];

  const rows = [
    {
      id: 1,
      owner: '0x000000000000',
      collateral: 64,
      debt: 420,
      collateralRatio: 140
    },
    {
      id: 2,
      owner: '0x690000000000',
      collateral: 64,
      debt: 420,
      collateralRatio: 150
    },
    {
      id: 3,
      owner: '0x694200000000',
      collateral: 64,
      debt: 420,
      collateralRatio: 158
    }
  ]
  return (
    <>

      <RightTopCard
      // style={{ padding: 0, border: '0.5px solid' }}
      >
        {/* <div> */}
        <DataTable
          // title="Movies"
          noHeader
          columns={columns}
          data={rows}
          // defaultSortField="title"
          // pagination
          // selectableRows
          responsive
          
          paginationPerPage={5}
          actions={<div>yoyoyoyooy</div>}
          paginationRowsPerPageOptions={[5]}
        // selectableRowsComponent={BootyCheckbox}

        />
        {/* </div> */}
      </RightTopCard>
    </>
  )
}

const RightTopCard = styled.div`
  background: red;
  @media (max-width: 600px) {
    margin-top: 8px;
  }
`;