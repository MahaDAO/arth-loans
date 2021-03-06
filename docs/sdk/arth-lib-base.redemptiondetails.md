<!-- Do not edit this file. It is automatically generated by API Documenter. -->

[Home](./index.md) &gt; [@mahadao/arth-lib-base](./arth-lib-base.md) &gt; [RedemptionDetails](./arth-lib-base.redemptiondetails.md)

## RedemptionDetails interface

Details of a [redeemLUSD()](./arth-lib-base.transactableliquity.redeemlusd.md) transaction.

<b>Signature:</b>

```typescript
export interface RedemptionDetails 
```

## Properties

|  Property | Type | Description |
|  --- | --- | --- |
|  [actualLUSDAmount](./arth-lib-base.redemptiondetails.actuallusdamount.md) | [Decimal](./arth-lib-base.decimal.md) | Amount of LUSD that was actually redeemed by the transaction. |
|  [attemptedLUSDAmount](./arth-lib-base.redemptiondetails.attemptedlusdamount.md) | [Decimal](./arth-lib-base.decimal.md) | Amount of LUSD the redeemer tried to redeem. |
|  [collateralTaken](./arth-lib-base.redemptiondetails.collateraltaken.md) | [Decimal](./arth-lib-base.decimal.md) | Amount of collateral (e.g. Ether) taken from Troves by the transaction. |
|  [fee](./arth-lib-base.redemptiondetails.fee.md) | [Decimal](./arth-lib-base.decimal.md) | Amount of native currency (e.g. Ether) deducted as fee from collateral taken. |

