import React, { useState, useEffect, useRef, useCallback } from 'react';
import styled from 'styled-components';
// import DataTable from 'react-data-table-component';
import { DataGrid, GridCellParams, GridColDef, GridColumnHeaderParams, GridPagination, GridValueGetterParams, useGridSlotComponentProps } from '@material-ui/data-grid';
import { makeStyles, withStyles } from '@material-ui/core';
import deleteActive from '../../assets/svg/delete_active.svg'
import deleteInactive from '../../assets/svg/delete_inactive.svg'
import copy from '../../assets/svg/copy.svg'
import { useMediaQuery } from 'react-responsive';


import {
  Percent,
  MINIMUM_COLLATERAL_RATIO,
  CRITICAL_COLLATERAL_RATIO,
  UserTrove,
  Decimal
} from "@liquity/lib-base";
import { BlockPolledLiquityStoreState } from "@liquity/lib-ethers";
import { useLiquitySelector } from "@liquity/lib-react";

import { shortenAddress } from "../../utils/shortenAddress";
import { useLiquity } from "../../hooks/LiquityContext";
import { COIN } from "../../strings";

import { Icon } from "../../components/Icon";
import { LoadingOverlay } from "../../components/LoadingOverlay";
import { Transaction } from "../../components/Transaction";
import { Tooltip } from "../../components/Tooltip";
import { Abbreviation } from "../../components/Abbreviation";
import { truncateMiddle } from '../../utils/formatBalance';
import CustomToolTip from '../../components/CustomToolTip';

const rowHeight = "40px";

const liquidatableInNormalMode = (trove: UserTrove, price: Decimal) =>
  [trove.collateralRatioIsBelowMinimum(price), "Collateral ratio not low enough"] as const;

const liquidatableInRecoveryMode = (
  trove: UserTrove,
  price: Decimal,
  totalCollateralRatio: Decimal,
  lusdInStabilityPool: Decimal
) => {
  const collateralRatio = trove.collateralRatio(price);

  if (collateralRatio.gte(MINIMUM_COLLATERAL_RATIO) && collateralRatio.lt(totalCollateralRatio)) {
    return [
      trove.debt.lte(lusdInStabilityPool),
      "There's not enough ARTH in the Stability pool to cover the debt"
    ] as const;
  } else {
    return liquidatableInNormalMode(trove, price);
  }
};

type RiskyTrovesProps = {
  // pageSize: number;
};

const select = ({
  numberOfTroves,
  price,
  total,
  lusdInStabilityPool,
  blockTag
}: BlockPolledLiquityStoreState) => ({
  numberOfTroves,
  price,
  recoveryMode: total.collateralRatioIsBelowCritical(price),
  totalCollateralRatio: total.collateralRatio(price),
  lusdInStabilityPool,
  blockTag
});



const Grid = withStyles({
  root: {
    display: 'flex',
    // flex: 1,
    border: '0px solid',
    width: '100%',
    maxWidth: undefined,
    '& .MuiDataGrid-cell': {
      borderBottom: '1px solid rgba(255, 255, 255, 0.04);',
      // display: 'none',
      minWidth: '0px',
      lineHeight: undefined,
      maxWidth: undefined,
      minHeight: 0,
      maxHeight: undefined
    },
    '& .MuiDataGrid-columnsContainer': {
      borderBottom: '1px solid rgba(255, 255, 255, 0.04);'
    },
    '& .MuiDataGrid-columnHeaderTitle': {
      overflow: 'visible',
      fontFamily: 'Inter',
      fontStyle: 'normal',
      fontWeight: 600,
      fontSize: '12px',
      lineHeight: '150%',
      textAlign: 'center',
      letterSpacing: '0.08em',
      textTransform: 'uppercase;',
      color: 'rgba(255, 255, 255, 0.32);'
    },
    '& .MuiDataGrid-iconSeparator': {
      display: 'none',
    },
    '& .MuiDataGrid-columnHeader-draggable': {
      display: 'block',
    },
    '& .MuiDataGrid-menuIcon': {
      display: 'none',
    },
    '& .MuiTablePagination-caption': {
      fontFamily: 'Inter;',
      fontStyle: 'normal;',
      fontWeight: 300,
      fontSize: '14px',
      lineHeight: '140%;',
      color: 'rgba(255, 255, 255, 0.64);'
    },
  },
  cell: {
    borderBottom: '1px solid rgba(255, 255, 255, 0.04);',
  },

})(DataGrid)
// export const RiskyTroves: React.FC<RiskyTrovesProps> = ({ pageSize }) => {
export default (props: RiskyTrovesProps) => {
  const {
    blockTag,
    numberOfTroves,
    recoveryMode,
    totalCollateralRatio,
    lusdInStabilityPool,
    price
  } = useLiquitySelector(select);

  const [datatable, setDatatable] = useState({})
  const isMobile = useMediaQuery({ 'maxWidth': '600px' })
  let mainRef = useRef<HTMLDivElement>()
  const [width, setWidth] = useState<number>(isMobile ? window.innerWidth : 1000)
  useEffect(() => {
    if (mainRef.current) {
      setWidth(mainRef.current.offsetWidth)
    }
  }, [mainRef]);
  const { liquity } = useLiquity();
  const pageSize = 5;
  const [loading, setLoading] = useState(true);
  const [troves, setTroves] = useState<UserTrove[]>();

  const [reload, setReload] = useState({});
  const forceReload = useCallback(() => setReload({}), []);

  const [page, setPage] = useState(0);
  const numberOfPages = Math.ceil(numberOfTroves / pageSize) || 1;
  const clampedPage = Math.min(page, numberOfPages - 1);

  const nextPage = () => {
    if (clampedPage < numberOfPages - 1) {
      setPage(clampedPage + 1);
    }
  };

  const previousPage = () => {
    if (clampedPage > 0) {
      setPage(clampedPage - 1);
    }
  };

  useEffect(() => {
    if (page !== clampedPage) {
      setPage(clampedPage);
    }
  }, [page, clampedPage]);

  useEffect(() => {
    let mounted = true;

    setLoading(true);
    liquity
      .getTroves(
        {
          first: 10,
          sortedBy: "ascendingCollateralRatio",
          // startingAt: clampedPage * pageSize
        },
        { blockTag }
      )
      .then(troves => {
        if (mounted) {
          // @ts-ignore
          setTroves(troves?.map(trove => {
            return {
              id: trove.ownerAddress,
              ownerAddress: trove.ownerAddress,
              status: trove.status,
              collateral: trove.collateral.shorten(),
              debt: trove.debt.shorten(),
              collateralRatio: trove.collateralRatio(price).shorten(),
              // collateralRatioIsBelowMinimum: trove.collateralRatioIsBelowMinimum,
              fullTrove: trove
            }
          }) || []);
          setLoading(false);
        }
      });

    return () => {
      mounted = false;
    };
    // Omit blockTag from deps on purpose
    // eslint-disable-next-line
  }, [liquity, clampedPage, pageSize, reload]);

  useEffect(() => {
    forceReload();
  }, [forceReload, numberOfTroves]);

  const [copied, setCopied] = useState<string>();

  useEffect(() => {
    if (copied !== undefined) {
      let cancelled = false;

      setTimeout(() => {
        if (!cancelled) {
          setCopied(undefined);
        }
      }, 2000);

      return () => {
        cancelled = true;
      };
    }
  }, [copied]);


  const columns: GridColDef[] = [
    {
      field: 'ownerAddress',
      headerName: 'Owner',
      width: width / 4.5,
      headerClassName: 'table-header',
      cellClassName: 'table-cell',
      resizable: true,
      align: 'left',
      headerAlign: 'left',
      renderHeader: (params: GridColumnHeaderParams) => {
        return (
          <>
            <div style={{ paddingLeft: isMobile ? 0 : 28, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>OWNER</div>
          </>
        )
      },
      renderCell: (params: GridCellParams) => (
        <>
          <CustomToolTip toolTipText={String(params.value)}>
            <div style={{ display: 'flex', alignItems: 'center', paddingLeft: isMobile ? 0 : 28, marginRight: 32 }}>
              {truncateMiddle(String(params.value || params.formattedValue), 20, '......')}
              <div style={{ marginLeft: 15, display: 'flex', alignItems: 'center', cursor: 'pointer' }} onClick={() => {
                navigator.clipboard.writeText(String(params.value || params.formattedValue))
              }} >
                <img src={copy} height={24} />
              </div>
            </div>
          </CustomToolTip>

        </>
      )
    },
    {
      field: 'collateral',
      headerName: 'Collateral (ETH)',
      cellClassName: 'table-cell',
      type: 'number',
      headerClassName: 'table-header',
      width: width / 5,
      resizable: true,
      align: 'center',
      headerAlign: 'center',
      sortable: false,
    },
    {
      headerName: 'Debt (ETH)',
      field: 'debt',
      headerClassName: 'table-header',
      cellClassName: 'table-cell',
      width: width / 5,
      align: 'center',
      headerAlign: 'center',
      resizable: true,
      sortable: false,
    },
    {
      headerName: 'Collateral Ratio',
      field: 'collateralRatio',
      headerAlign: 'center',
      sortable: true,
      align: 'center',
      headerClassName: 'table-header',
      cellClassName: 'table-cell',
      width: width / 5,
      resizable: true,
      // valueGetter: (params: GridValueGetterParams) =>
      //   `${params.getValue(params.id, 'firstName') || ''} ${params.getValue(params.id, 'lastName') || ''
      //   }`,
      renderCell: (params: GridCellParams) => (
        <>
          <div style={{ color: Number(params.value) * 100 < 150 ? '#FA4C69' : '#20C974' }}> {Number(params.value) * 100}%</div>
        </>
      )
    },
    {
      headerName: 'Action',
      field: 'action',
      headerAlign: 'center',
      sortable: false,
      align: 'center',
      headerClassName: 'table-header',
      cellClassName: 'table-cell',
      width: width / 5,
      resizable: false,
      renderCell: (params: GridCellParams) => (
        <>
          <Transaction
            id={`liquidate-${String(params.id)}`}
            tooltip="Liquidate"
            requires={[
              recoveryMode
                ? liquidatableInRecoveryMode(
                  // @ts-ignore
                  params.getValue(params.id, 'fullTrove'),
                  price,
                  totalCollateralRatio,
                  lusdInStabilityPool
                )
                : liquidatableInNormalMode(
                  // @ts-ignore
                  params.getValue(params.id, 'fullTrove'), price)
            ]}
            send={liquity.send.liquidate.bind(liquity.send, String(params.id))}
          >
            <div style={{
              display: 'flex',
              textAlign: 'center',
              cursor: params.getValue(params.id, 'collateralRatio') >= 150 ? 'not-allowed' : 'pointer',
              // border: '1px solid'
            }}>
              {params.getValue(params.id, 'collateralRatio') < 150 ? <img src={deleteActive} height="24px" /> : <img src={deleteInactive} height="24px" />}
            </div>
          </Transaction>

        </>
      )
    },
  ];

  // const rows = [
  //   { id: 1, owner: '0x694200000000', collateral: 56, debt: 35, collateralRatio: 150 },
  //   { id: 2, owner: '0x694200000000', collateral: 56, debt: 42, collateralRatio: 150 },
  //   { id: 3, owner: '0x694200000000', collateral: 56, debt: 45, collateralRatio: 18 },
  //   { id: 4, owner: '0x694200000000', collateral: 56, debt: 16, collateralRatio: 150 },
  //   { id: 5, owner: '0x694200000000', collateral: 56, debt: null, collateralRatio: 150 },
  //   { id: 6, owner: '0x694200000000', collateral: 56, debt: 150, collateralRatio: 150 },
  //   { id: 7, owner: '0x694200000000', collateral: 56, debt: 44, collateralRatio: 150 },
  //   { id: 8, owner: '0x694200000000', collateral: 56, debt: 36, collateralRatio: 150 },
  //   { id: 9, owner: '0x694200000000', collateral: 56, debt: 65, collateralRatio: 150 },
  // ];

  const CustomPagination = () => {
    const { state, apiRef } = useGridSlotComponentProps()
    return (
      <>
        <div style={{ width: '100%', height: '50px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingInline: 5, paddingLeft: 32 }}>
          <PageCounter>
            Page {state.pagination.page + 1} of {state.pagination.pageCount}
          </PageCounter>
          <Mutators>
            <Previous style={{ cursor: state.pagination.page === 0 ? 'not-allowed' : 'pointer' }} onClick={() => {
              if (state.pagination.page > 0)
                apiRef.current.setPage(state.pagination.page - 1)
            }}>Previous</Previous>
            <Next style={{ cursor: state.pagination.page + 1 === state.pagination.pageCount ? 'not-allowed' : 'pointer' }} onClick={() => {
              if (state.pagination.page + 1 !== state.pagination.pageCount)
                apiRef.current.setPage(state.pagination.page + 1)
            }}>Next</Next>
          </Mutators>
        </div>
      </>
    )
  }

  const CustomEmptyList = () => {
    return (
      <>
        <div>
          Empty Trove!
        </div>
      </>
    )
  }
  return (
    <>
      <RightTopCard className={'custom-mahadao-box'}
        style={{ padding: 0, marginTop: 32 }}
        ref={ref => mainRef.current?.offsetWidth}
      >
        {troves?.length > 0 && <Grid
          // className={'MuiSvgIcon-root'}
          onCellClick={(e, event) => {
            event.preventDefault();
          }}

          hideFooterSelectedRowCount
          columns={columns}
          rows={troves}
          rowHeight={60}
          pageSize={5}
          autoHeight
          // autoPageSize
          headerHeight={75}
          loading={loading}
          components={{
            Pagination: CustomPagination,
            NoRowsOverlay: CustomEmptyList
          }}
        // disableExtendRowFullWidth
        // showCellRightBorder
        />}
      </RightTopCard>
    </>
  )
}

const RightTopCard = styled.div`
  // background: red;
  // height: 400px;
  display: flex;
  // height: 400px;
  width: 100%;
  @media (max-width: 600px) {
    margin-top: 8px;
  }
`;

const PageCounter = styled.div`
font-family: Inter;
font-style: normal;
font-weight: 300;
font-size: 14px;
line-height: 140%;
color: rgba(255, 255, 255, 0.64);
`;


const Mutators = styled.div`
  padding: 0 30px;
  display: flex;
  flex-direction: row;
`;

const Previous = styled.div`
font-family: Inter;
font-style: normal;
font-weight: 300;
font-size: 14px;
line-height: 140%;
color: rgba(255, 255, 255, 0.64);
`;

const Next = styled.div`
font-family: Inter;
font-style: normal;
font-weight: 300;
font-size: 14px;
line-height: 140%;
color: rgba(255, 255, 255, 0.88);
margin: 0 0 0 18px;
`;