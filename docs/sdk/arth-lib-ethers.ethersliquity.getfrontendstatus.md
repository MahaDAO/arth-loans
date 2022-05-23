<!-- Do not edit this file. It is automatically generated by API Documenter. -->

[Home](./index.md) &gt; [@mahadao/arth-lib-ethers](./arth-lib-ethers.md) &gt; [EthersLiquity](./arth-lib-ethers.ethersliquity.md) &gt; [getFrontendStatus](./arth-lib-ethers.ethersliquity.getfrontendstatus.md)

## EthersLiquity.getFrontendStatus() method

Check whether an address is registered as a Liquity frontend, and what its kickback rate is.

<b>Signature:</b>

```typescript
getFrontendStatus(address?: string, overrides?: EthersCallOverrides): Promise<FrontendStatus>;
```

## Parameters

|  Parameter | Type | Description |
|  --- | --- | --- |
|  address | string | Address to check. |
|  overrides | [EthersCallOverrides](./arth-lib-ethers.etherscalloverrides.md) |  |

<b>Returns:</b>

Promise&lt;[FrontendStatus](./arth-lib-base.frontendstatus.md)<!-- -->&gt;
