<!-- Do not edit this file. It is automatically generated by API Documenter. -->

[Home](./index.md) &gt; [@mahadao/arth-lib-base](./arth-lib-base.md) &gt; [SendableLiquity](./arth-lib-base.sendableliquity.md)

## SendableLiquity interface

Send Liquity transactions.

<b>Signature:</b>

```typescript
export interface SendableLiquity<R = unknown, S = unknown> extends _SendableFrom<TransactableLiquity, R, S> 
```
<b>Extends:</b> \_SendableFrom&lt;[TransactableLiquity](./arth-lib-base.transactableliquity.md)<!-- -->, R, S&gt;

## Remarks

The functions return an object implementing [SentLiquityTransaction](./arth-lib-base.sentliquitytransaction.md)<!-- -->, which can be used to monitor the transaction and get its details when it succeeds.

Implemented by [SendableEthersLiquity](./arth-lib-ethers.sendableethersliquity.md)<!-- -->.

## Methods

|  Method | Description |
|  --- | --- |
|  [adjustTrove(params, maxBorrowingRate)](./arth-lib-base.sendableliquity.adjusttrove.md) | Adjust existing Trove by changing its collateral, debt, or both. |
|  [borrowLUSD(amount, maxBorrowingRate)](./arth-lib-base.sendableliquity.borrowlusd.md) | Adjust existing Trove by borrowing more LUSD. |
|  [claimCollateralSurplus()](./arth-lib-base.sendableliquity.claimcollateralsurplus.md) | Claim leftover collateral after a liquidation or redemption. |
|  [closeTrove()](./arth-lib-base.sendableliquity.closetrove.md) | Close existing Trove by repaying all debt and withdrawing all collateral. |
|  [depositCollateral(amount)](./arth-lib-base.sendableliquity.depositcollateral.md) | Adjust existing Trove by depositing more collateral. |
|  [depositLUSDInStabilityPool(amount, frontendTag)](./arth-lib-base.sendableliquity.depositlusdinstabilitypool.md) | Make a new Stability Deposit, or top up existing one. |
|  [liquidate(address)](./arth-lib-base.sendableliquity.liquidate.md) | Liquidate one or more undercollateralized Troves. |
|  [liquidateUpTo(maximumNumberOfTrovesToLiquidate)](./arth-lib-base.sendableliquity.liquidateupto.md) | Liquidate the least collateralized Troves up to a maximum number. |
|  [openTrove(params, maxBorrowingRate)](./arth-lib-base.sendableliquity.opentrove.md) | Open a new Trove by depositing collateral and borrowing LUSD. |
|  [redeemLUSD(amount, maxRedemptionRate)](./arth-lib-base.sendableliquity.redeemlusd.md) | Redeem LUSD to native currency (e.g. Ether) at face value. |
|  [registerFrontend(kickbackRate)](./arth-lib-base.sendableliquity.registerfrontend.md) | Register current wallet address as a Liquity frontend. |
|  [repayLUSD(amount)](./arth-lib-base.sendableliquity.repaylusd.md) | Adjust existing Trove by repaying some of its debt. |
|  [sendLUSD(toAddress, amount)](./arth-lib-base.sendableliquity.sendlusd.md) | Send LUSD tokens to an address. |
|  [transferCollateralGainToTrove()](./arth-lib-base.sendableliquity.transfercollateralgaintotrove.md) | Transfer [collateral gain](./arth-lib-base.stabilitydeposit.collateralgain.md) from Stability Deposit to Trove. |
|  [withdrawCollateral(amount)](./arth-lib-base.sendableliquity.withdrawcollateral.md) | Adjust existing Trove by withdrawing some of its collateral. |
|  [withdrawGainsFromStabilityPool()](./arth-lib-base.sendableliquity.withdrawgainsfromstabilitypool.md) | Withdraw [collateral gain](./arth-lib-base.stabilitydeposit.collateralgain.md) and [LQTY reward](./arth-lib-base.stabilitydeposit.lqtyreward.md) from Stability Deposit. |
|  [withdrawLUSDFromStabilityPool(amount)](./arth-lib-base.sendableliquity.withdrawlusdfromstabilitypool.md) | Withdraw LUSD from Stability Deposit. |

