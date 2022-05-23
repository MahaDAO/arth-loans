<!-- Do not edit this file. It is automatically generated by API Documenter. -->

[Home](./index.md) &gt; [@mahadao/arth-lib-ethers](./arth-lib-ethers.md) &gt; [SendableEthersLiquity](./arth-lib-ethers.sendableethersliquity.md) &gt; [withdrawLUSDFromStabilityPool](./arth-lib-ethers.sendableethersliquity.withdrawlusdfromstabilitypool.md)

## SendableEthersLiquity.withdrawLUSDFromStabilityPool() method

Withdraw LUSD from Stability Deposit.

<b>Signature:</b>

```typescript
withdrawLUSDFromStabilityPool(amount: Decimalish, overrides?: EthersTransactionOverrides): Promise<SentEthersLiquityTransaction<StabilityDepositChangeDetails>>;
```

## Parameters

|  Parameter | Type | Description |
|  --- | --- | --- |
|  amount | [Decimalish](./arth-lib-base.decimalish.md) | Amount of LUSD to withdraw. |
|  overrides | [EthersTransactionOverrides](./arth-lib-ethers.etherstransactionoverrides.md) |  |

<b>Returns:</b>

Promise&lt;[SentEthersLiquityTransaction](./arth-lib-ethers.sentethersliquitytransaction.md)<!-- -->&lt;[StabilityDepositChangeDetails](./arth-lib-base.stabilitydepositchangedetails.md)<!-- -->&gt;&gt;

## Remarks

As a side-effect, the transaction will also pay out the Stability Deposit's [collateral gain](./arth-lib-base.stabilitydeposit.collateralgain.md) and [LQTY reward](./arth-lib-base.stabilitydeposit.lqtyreward.md)<!-- -->.
