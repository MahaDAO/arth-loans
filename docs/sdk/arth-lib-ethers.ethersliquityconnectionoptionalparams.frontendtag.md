<!-- Do not edit this file. It is automatically generated by API Documenter. -->

[Home](./index.md) &gt; [@mahadao/arth-lib-ethers](./arth-lib-ethers.md) &gt; [EthersLiquityConnectionOptionalParams](./arth-lib-ethers.ethersliquityconnectionoptionalparams.md) &gt; [frontendTag](./arth-lib-ethers.ethersliquityconnectionoptionalparams.frontendtag.md)

## EthersLiquityConnectionOptionalParams.frontendTag property

Address that will receive LQTY rewards from newly created Stability Deposits by default.

<b>Signature:</b>

```typescript
readonly frontendTag?: string;
```

## Remarks

For example [depositLUSDInStabilityPool(amount, frontendTag?)](./arth-lib-ethers.ethersliquity.depositlusdinstabilitypool.md) will tag newly made Stability Deposits with this address when its `frontendTag` parameter is omitted.

