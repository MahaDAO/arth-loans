<!-- Do not edit this file. It is automatically generated by API Documenter. -->

[Home](./index.md) &gt; [@mahadao/arth-lib-base](./arth-lib-base.md) &gt; [TroveAdjustmentDetails](./arth-lib-base.troveadjustmentdetails.md)

## TroveAdjustmentDetails interface

Details of an [adjustTrove()](./arth-lib-base.transactableliquity.adjusttrove.md) transaction.

<b>Signature:</b>

```typescript
export interface TroveAdjustmentDetails 
```

## Properties

|  Property | Type | Description |
|  --- | --- | --- |
|  [fee](./arth-lib-base.troveadjustmentdetails.fee.md) | [Decimal](./arth-lib-base.decimal.md) | Amount of LUSD added to the Trove's debt as borrowing fee. |
|  [newTrove](./arth-lib-base.troveadjustmentdetails.newtrove.md) | [Trove](./arth-lib-base.trove.md) | New state of the adjusted Trove directly after the transaction. |
|  [params](./arth-lib-base.troveadjustmentdetails.params.md) | [TroveAdjustmentParams](./arth-lib-base.troveadjustmentparams.md)<!-- -->&lt;[Decimal](./arth-lib-base.decimal.md)<!-- -->&gt; | Parameters of the adjustment. |

