<!-- Do not edit this file. It is automatically generated by API Documenter. -->

[Home](./index.md) &gt; [@mahadao/arth-lib-base](./arth-lib-base.md) &gt; [TransactableLiquity](./arth-lib-base.transactableliquity.md) &gt; [liquidate](./arth-lib-base.transactableliquity.liquidate.md)

## TransactableLiquity.liquidate() method

Liquidate one or more undercollateralized Troves.

<b>Signature:</b>

```typescript
liquidate(address: string | string[]): Promise<LiquidationDetails>;
```

## Parameters

|  Parameter | Type | Description |
|  --- | --- | --- |
|  address | string \| string\[\] | Address or array of addresses whose Troves to liquidate. |

<b>Returns:</b>

Promise&lt;[LiquidationDetails](./arth-lib-base.liquidationdetails.md)<!-- -->&gt;

## Exceptions

Throws [TransactionFailedError](./arth-lib-base.transactionfailederror.md) in case of transaction failure.
