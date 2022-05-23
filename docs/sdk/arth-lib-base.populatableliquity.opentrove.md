<!-- Do not edit this file. It is automatically generated by API Documenter. -->

[Home](./index.md) &gt; [@mahadao/arth-lib-base](./arth-lib-base.md) &gt; [PopulatableLiquity](./arth-lib-base.populatableliquity.md) &gt; [openTrove](./arth-lib-base.populatableliquity.opentrove.md)

## PopulatableLiquity.openTrove() method

Open a new Trove by depositing collateral and borrowing LUSD.

<b>Signature:</b>

```typescript
openTrove(params: TroveCreationParams<Decimalish>, maxBorrowingRate?: Decimalish): Promise<PopulatedLiquityTransaction<P, SentLiquityTransaction<S, LiquityReceipt<R, TroveCreationDetails>>>>;
```

## Parameters

|  Parameter | Type | Description |
|  --- | --- | --- |
|  params | [TroveCreationParams](./arth-lib-base.trovecreationparams.md)<!-- -->&lt;[Decimalish](./arth-lib-base.decimalish.md)<!-- -->&gt; | How much to deposit and borrow. |
|  maxBorrowingRate | [Decimalish](./arth-lib-base.decimalish.md) | Maximum acceptable [borrowing rate](./arth-lib-base.fees.borrowingrate.md)<!-- -->. |

<b>Returns:</b>

Promise&lt;[PopulatedLiquityTransaction](./arth-lib-base.populatedliquitytransaction.md)<!-- -->&lt;P, [SentLiquityTransaction](./arth-lib-base.sentliquitytransaction.md)<!-- -->&lt;S, [LiquityReceipt](./arth-lib-base.liquityreceipt.md)<!-- -->&lt;R, [TroveCreationDetails](./arth-lib-base.trovecreationdetails.md)<!-- -->&gt;&gt;&gt;&gt;

## Remarks

If `maxBorrowingRate` is omitted, the current borrowing rate plus 0.5% is used as maximum acceptable rate.
