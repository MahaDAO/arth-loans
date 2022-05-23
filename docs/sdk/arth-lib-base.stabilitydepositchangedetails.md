<!-- Do not edit this file. It is automatically generated by API Documenter. -->

[Home](./index.md) &gt; [@mahadao/arth-lib-base](./arth-lib-base.md) &gt; [StabilityDepositChangeDetails](./arth-lib-base.stabilitydepositchangedetails.md)

## StabilityDepositChangeDetails interface

Details of a [depositLUSDInStabilityPool()](./arth-lib-base.transactableliquity.depositlusdinstabilitypool.md) or [withdrawLUSDFromStabilityPool()](./arth-lib-base.transactableliquity.withdrawlusdfromstabilitypool.md) transaction.

<b>Signature:</b>

```typescript
export interface StabilityDepositChangeDetails extends StabilityPoolGainsWithdrawalDetails 
```
<b>Extends:</b> [StabilityPoolGainsWithdrawalDetails](./arth-lib-base.stabilitypoolgainswithdrawaldetails.md)

## Properties

|  Property | Type | Description |
|  --- | --- | --- |
|  [change](./arth-lib-base.stabilitydepositchangedetails.change.md) | [StabilityDepositChange](./arth-lib-base.stabilitydepositchange.md)<!-- -->&lt;[Decimal](./arth-lib-base.decimal.md)<!-- -->&gt; | Change that was made to the deposit by this transaction. |
