<!-- Do not edit this file. It is automatically generated by API Documenter. -->

[Home](./index.md) &gt; [@mahadao/arth-lib-base](./arth-lib-base.md) &gt; [ReadableLiquity](./arth-lib-base.readableliquity.md)

## ReadableLiquity interface

Read the state of the Liquity protocol.

<b>Signature:</b>

```typescript
export interface ReadableLiquity 
```

## Remarks

Implemented by [EthersLiquity](./arth-lib-ethers.ethersliquity.md)<!-- -->.

## Methods

|  Method | Description |
|  --- | --- |
|  [getCollateralSurplusBalance(address)](./arth-lib-base.readableliquity.getcollateralsurplusbalance.md) | Get the amount of leftover collateral available for withdrawal by an address. |
|  [getFees()](./arth-lib-base.readableliquity.getfees.md) | Get a calculator for current fees. |
|  [getFrontendStatus(address)](./arth-lib-base.readableliquity.getfrontendstatus.md) | Check whether an address is registered as a Liquity frontend, and what its kickback rate is. |
|  [getLUSDBalance(address)](./arth-lib-base.readableliquity.getlusdbalance.md) | Get the amount of LUSD held by an address. |
|  [getLUSDInStabilityPool()](./arth-lib-base.readableliquity.getlusdinstabilitypool.md) | Get the total amount of LUSD currently deposited in the Stability Pool. |
|  [getNumberOfTroves()](./arth-lib-base.readableliquity.getnumberoftroves.md) | Get number of Troves that are currently open. |
|  [getPrice()](./arth-lib-base.readableliquity.getprice.md) | Get the current price of the native currency (e.g. Ether) in USD. |
|  [getStabilityDeposit(address)](./arth-lib-base.readableliquity.getstabilitydeposit.md) | Get the current state of a Stability Deposit. |
|  [getTotal()](./arth-lib-base.readableliquity.gettotal.md) | Get the total amount of collateral and debt in the Liquity system. |
|  [getTotalRedistributed()](./arth-lib-base.readableliquity.gettotalredistributed.md) | Get the total collateral and debt per stake that has been liquidated through redistribution. |
|  [getTrove(address)](./arth-lib-base.readableliquity.gettrove.md) | Get the current state of a Trove. |
|  [getTroveBeforeRedistribution(address)](./arth-lib-base.readableliquity.gettrovebeforeredistribution.md) | Get a Trove in its state after the last direct modification. |
|  [getTroves(params)](./arth-lib-base.readableliquity.gettroves_1.md) | Get a slice from the list of Troves. |

