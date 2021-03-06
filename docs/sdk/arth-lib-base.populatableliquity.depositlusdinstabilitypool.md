<!-- Do not edit this file. It is automatically generated by API Documenter. -->

[Home](./index.md) &gt; [@mahadao/arth-lib-base](./arth-lib-base.md) &gt; [PopulatableLiquity](./arth-lib-base.populatableliquity.md) &gt; [depositLUSDInStabilityPool](./arth-lib-base.populatableliquity.depositlusdinstabilitypool.md)

## PopulatableLiquity.depositLUSDInStabilityPool() method

Make a new Stability Deposit, or top up existing one.

<b>Signature:</b>

```typescript
depositLUSDInStabilityPool(amount: Decimalish, frontendTag?: string): Promise<PopulatedLiquityTransaction<P, SentLiquityTransaction<S, LiquityReceipt<R, StabilityDepositChangeDetails>>>>;
```

## Parameters

|  Parameter | Type | Description |
|  --- | --- | --- |
|  amount | [Decimalish](./arth-lib-base.decimalish.md) | Amount of LUSD to add to new or existing deposit. |
|  frontendTag | string | Address that should receive a share of this deposit's LQTY rewards. |

<b>Returns:</b>

Promise&lt;[PopulatedLiquityTransaction](./arth-lib-base.populatedliquitytransaction.md)<!-- -->&lt;P, [SentLiquityTransaction](./arth-lib-base.sentliquitytransaction.md)<!-- -->&lt;S, [LiquityReceipt](./arth-lib-base.liquityreceipt.md)<!-- -->&lt;R, [StabilityDepositChangeDetails](./arth-lib-base.stabilitydepositchangedetails.md)<!-- -->&gt;&gt;&gt;&gt;

## Remarks

The `frontendTag` parameter is only effective when making a new deposit.

As a side-effect, the transaction will also pay out an existing Stability Deposit's [collateral gain](./arth-lib-base.stabilitydeposit.collateralgain.md) and [LQTY reward](./arth-lib-base.stabilitydeposit.lqtyreward.md)<!-- -->.

