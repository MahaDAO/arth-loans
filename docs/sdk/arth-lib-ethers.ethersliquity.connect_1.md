<!-- Do not edit this file. It is automatically generated by API Documenter. -->

[Home](./index.md) &gt; [@mahadao/arth-lib-ethers](./arth-lib-ethers.md) &gt; [EthersLiquity](./arth-lib-ethers.ethersliquity.md) &gt; [connect](./arth-lib-ethers.ethersliquity.connect_1.md)

## EthersLiquity.connect() method

Connect to the Liquity protocol and create an `EthersLiquity` object.

<b>Signature:</b>

```typescript
static connect(signerOrProvider: EthersSigner | EthersProvider, optionalParams?: EthersLiquityConnectionOptionalParams): Promise<EthersLiquity>;
```

## Parameters

|  Parameter | Type | Description |
|  --- | --- | --- |
|  signerOrProvider | [EthersSigner](./arth-lib-ethers.etherssigner.md) \| [EthersProvider](./arth-lib-ethers.ethersprovider.md) | Ethers <code>Signer</code> or <code>Provider</code> to use for connecting to the Ethereum network. |
|  optionalParams | [EthersLiquityConnectionOptionalParams](./arth-lib-ethers.ethersliquityconnectionoptionalparams.md) | Optional parameters that can be used to customize the connection. |

<b>Returns:</b>

Promise&lt;[EthersLiquity](./arth-lib-ethers.ethersliquity.md)<!-- -->&gt;

