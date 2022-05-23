<!-- Do not edit this file. It is automatically generated by API Documenter. -->

[Home](./index.md) &gt; [@mahadao/arth-lib-base](./arth-lib-base.md) &gt; [Trove](./arth-lib-base.trove.md) &gt; [adjust](./arth-lib-base.trove.adjust.md)

## Trove.adjust() method

Calculate the result of an [adjustTrove()](./arth-lib-base.transactableliquity.adjusttrove.md) transaction on this Trove.

<b>Signature:</b>

```typescript
adjust(params: TroveAdjustmentParams<Decimalish>, borrowingRate?: Decimalish): Trove;
```

## Parameters

|  Parameter | Type | Description |
|  --- | --- | --- |
|  params | [TroveAdjustmentParams](./arth-lib-base.troveadjustmentparams.md)<!-- -->&lt;[Decimalish](./arth-lib-base.decimalish.md)<!-- -->&gt; | Parameters of the transaction. |
|  borrowingRate | [Decimalish](./arth-lib-base.decimalish.md) | Borrowing rate to use when adding to the Trove's debt. |

<b>Returns:</b>

[Trove](./arth-lib-base.trove.md)
