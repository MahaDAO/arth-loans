<!-- Do not edit this file. It is automatically generated by API Documenter. -->

[Home](./index.md) &gt; [@mahadao/arth-lib-base](./arth-lib-base.md) &gt; [SendableLiquity](./arth-lib-base.sendableliquity.md) &gt; [withdrawLUSDFromStabilityPool](./arth-lib-base.sendableliquity.withdrawlusdfromstabilitypool.md)

## SendableLiquity.withdrawLUSDFromStabilityPool() method

Withdraw LUSD from Stability Deposit.

<b>Signature:</b>

```typescript
withdrawLUSDFromStabilityPool(amount: Decimalish): Promise<SentLiquityTransaction<S, LiquityReceipt<R, StabilityDepositChangeDetails>>>;
```

## Parameters

|  Parameter | Type | Description |
|  --- | --- | --- |
|  amount | [Decimalish](./arth-lib-base.decimalish.md) | Amount of LUSD to withdraw. |

<b>Returns:</b>

Promise&lt;[SentLiquityTransaction](./arth-lib-base.sentliquitytransaction.md)<!-- -->&lt;S, [LiquityReceipt](./arth-lib-base.liquityreceipt.md)<!-- -->&lt;R, [StabilityDepositChangeDetails](./arth-lib-base.stabilitydepositchangedetails.md)<!-- -->&gt;&gt;&gt;

## Remarks

As a side-effect, the transaction will also pay out the Stability Deposit's [collateral gain](./arth-lib-base.stabilitydeposit.collateralgain.md) and [LQTY reward](./arth-lib-base.stabilitydeposit.lqtyreward.md)<!-- -->.

