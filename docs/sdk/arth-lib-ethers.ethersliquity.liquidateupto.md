<!-- Do not edit this file. It is automatically generated by API Documenter. -->

[Home](./index.md) &gt; [@mahadao/arth-lib-ethers](./arth-lib-ethers.md) &gt; [EthersLiquity](./arth-lib-ethers.ethersliquity.md) &gt; [liquidateUpTo](./arth-lib-ethers.ethersliquity.liquidateupto.md)

## EthersLiquity.liquidateUpTo() method

Liquidate the least collateralized Troves up to a maximum number.

<b>Signature:</b>

```typescript
liquidateUpTo(maximumNumberOfTrovesToLiquidate: number, overrides?: EthersTransactionOverrides): Promise<LiquidationDetails>;
```

## Parameters

|  Parameter | Type | Description |
|  --- | --- | --- |
|  maximumNumberOfTrovesToLiquidate | number | Stop after liquidating this many Troves. |
|  overrides | [EthersTransactionOverrides](./arth-lib-ethers.etherstransactionoverrides.md) |  |

<b>Returns:</b>

Promise&lt;[LiquidationDetails](./arth-lib-base.liquidationdetails.md)<!-- -->&gt;

## Exceptions

Throws [EthersTransactionFailedError](./arth-lib-ethers.etherstransactionfailederror.md) in case of transaction failure.
