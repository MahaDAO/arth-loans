<!-- Do not edit this file. It is automatically generated by API Documenter. -->

[Home](./index.md) &gt; [@mahadao/arth-lib-base](./arth-lib-base.md) &gt; [TransactableLiquity](./arth-lib-base.transactableliquity.md) &gt; [liquidateUpTo](./arth-lib-base.transactableliquity.liquidateupto.md)

## TransactableLiquity.liquidateUpTo() method

Liquidate the least collateralized Troves up to a maximum number.

<b>Signature:</b>

```typescript
liquidateUpTo(maximumNumberOfTrovesToLiquidate: number): Promise<LiquidationDetails>;
```

## Parameters

|  Parameter | Type | Description |
|  --- | --- | --- |
|  maximumNumberOfTrovesToLiquidate | number | Stop after liquidating this many Troves. |

<b>Returns:</b>

Promise&lt;[LiquidationDetails](./arth-lib-base.liquidationdetails.md)<!-- -->&gt;

## Exceptions

Throws [TransactionFailedError](./arth-lib-base.transactionfailederror.md) in case of transaction failure.

