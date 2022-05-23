<!-- Do not edit this file. It is automatically generated by API Documenter. -->

[Home](./index.md) &gt; [@mahadao/arth-lib-base](./arth-lib-base.md) &gt; [PopulatableLiquity](./arth-lib-base.populatableliquity.md) &gt; [transferCollateralGainToTrove](./arth-lib-base.populatableliquity.transfercollateralgaintotrove.md)

## PopulatableLiquity.transferCollateralGainToTrove() method

Transfer [collateral gain](./arth-lib-base.stabilitydeposit.collateralgain.md) from Stability Deposit to Trove.

<b>Signature:</b>

```typescript
transferCollateralGainToTrove(): Promise<PopulatedLiquityTransaction<P, SentLiquityTransaction<S, LiquityReceipt<R, CollateralGainTransferDetails>>>>;
```
<b>Returns:</b>

Promise&lt;[PopulatedLiquityTransaction](./arth-lib-base.populatedliquitytransaction.md)<!-- -->&lt;P, [SentLiquityTransaction](./arth-lib-base.sentliquitytransaction.md)<!-- -->&lt;S, [LiquityReceipt](./arth-lib-base.liquityreceipt.md)<!-- -->&lt;R, [CollateralGainTransferDetails](./arth-lib-base.collateralgaintransferdetails.md)<!-- -->&gt;&gt;&gt;&gt;

## Remarks

The collateral gain is transfered to the Trove as additional collateral.

As a side-effect, the transaction will also pay out the Stability Deposit's [LQTY reward](./arth-lib-base.stabilitydeposit.lqtyreward.md)<!-- -->.
