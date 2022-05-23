<!-- Do not edit this file. It is automatically generated by API Documenter. -->

[Home](./index.md) &gt; [@mahadao/arth-lib-ethers](./arth-lib-ethers.md) &gt; [EthersLiquity](./arth-lib-ethers.ethersliquity.md) &gt; [withdrawGainsFromStabilityPool](./arth-lib-ethers.ethersliquity.withdrawgainsfromstabilitypool.md)

## EthersLiquity.withdrawGainsFromStabilityPool() method

Withdraw [collateral gain](./arth-lib-base.stabilitydeposit.collateralgain.md) and [LQTY reward](./arth-lib-base.stabilitydeposit.lqtyreward.md) from Stability Deposit.

<b>Signature:</b>

```typescript
withdrawGainsFromStabilityPool(overrides?: EthersTransactionOverrides): Promise<StabilityPoolGainsWithdrawalDetails>;
```

## Parameters

|  Parameter | Type | Description |
|  --- | --- | --- |
|  overrides | [EthersTransactionOverrides](./arth-lib-ethers.etherstransactionoverrides.md) |  |

<b>Returns:</b>

Promise&lt;[StabilityPoolGainsWithdrawalDetails](./arth-lib-base.stabilitypoolgainswithdrawaldetails.md)<!-- -->&gt;

## Exceptions

Throws [EthersTransactionFailedError](./arth-lib-ethers.etherstransactionfailederror.md) in case of transaction failure.
