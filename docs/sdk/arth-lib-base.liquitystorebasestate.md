<!-- Do not edit this file. It is automatically generated by API Documenter. -->

[Home](./index.md) &gt; [@mahadao/arth-lib-base](./arth-lib-base.md) &gt; [LiquityStoreBaseState](./arth-lib-base.liquitystorebasestate.md)

## LiquityStoreBaseState interface

State variables read from the blockchain.

<b>Signature:</b>

```typescript
export interface LiquityStoreBaseState 
```

## Properties

|  Property | Type | Description |
|  --- | --- | --- |
|  [accountBalance](./arth-lib-base.liquitystorebasestate.accountbalance.md) | [Decimal](./arth-lib-base.decimal.md) | User's native currency balance (e.g. Ether). |
|  [collateralSurplusBalance](./arth-lib-base.liquitystorebasestate.collateralsurplusbalance.md) | [Decimal](./arth-lib-base.decimal.md) | Amount of leftover collateral available for withdrawal to the user. |
|  [frontend](./arth-lib-base.liquitystorebasestate.frontend.md) | [FrontendStatus](./arth-lib-base.frontendstatus.md) | Status of currently used frontend. |
|  [lusdBalance](./arth-lib-base.liquitystorebasestate.lusdbalance.md) | [Decimal](./arth-lib-base.decimal.md) | User's LUSD token balance. |
|  [lusdInStabilityPool](./arth-lib-base.liquitystorebasestate.lusdinstabilitypool.md) | [Decimal](./arth-lib-base.decimal.md) | Total amount of LUSD currently deposited in the Stability Pool. |
|  [numberOfTroves](./arth-lib-base.liquitystorebasestate.numberoftroves.md) | number | Number of Troves that are currently open. |
|  [ownFrontend](./arth-lib-base.liquitystorebasestate.ownfrontend.md) | [FrontendStatus](./arth-lib-base.frontendstatus.md) | Status of user's own frontend. |
|  [price](./arth-lib-base.liquitystorebasestate.price.md) | [Decimal](./arth-lib-base.decimal.md) | Current price of the native currency (e.g. Ether) in USD. |
|  [stabilityDeposit](./arth-lib-base.liquitystorebasestate.stabilitydeposit.md) | [StabilityDeposit](./arth-lib-base.stabilitydeposit.md) | User's stability deposit. |
|  [total](./arth-lib-base.liquitystorebasestate.total.md) | [Trove](./arth-lib-base.trove.md) | Total collateral and debt in the Liquity system. |
|  [totalRedistributed](./arth-lib-base.liquitystorebasestate.totalredistributed.md) | [Trove](./arth-lib-base.trove.md) | Total collateral and debt per stake that has been liquidated through redistribution. |
|  [troveBeforeRedistribution](./arth-lib-base.liquitystorebasestate.trovebeforeredistribution.md) | [TroveWithPendingRedistribution](./arth-lib-base.trovewithpendingredistribution.md) | User's Trove in its state after the last direct modification. |

