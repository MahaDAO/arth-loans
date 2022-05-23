<!-- Do not edit this file. It is automatically generated by API Documenter. -->

[Home](./index.md) &gt; [@mahadao/arth-lib-ethers](./arth-lib-ethers.md) &gt; [SentEthersLiquityTransaction](./arth-lib-ethers.sentethersliquitytransaction.md)

## SentEthersLiquityTransaction class

A transaction that has already been sent.

<b>Signature:</b>

```typescript
export declare class SentEthersLiquityTransaction<T = unknown> implements SentLiquityTransaction<EthersTransactionResponse, LiquityReceipt<EthersTransactionReceipt, T>> 
```
<b>Implements:</b> [SentLiquityTransaction](./arth-lib-base.sentliquitytransaction.md)<!-- -->&lt;[EthersTransactionResponse](./arth-lib-ethers.etherstransactionresponse.md)<!-- -->, [LiquityReceipt](./arth-lib-base.liquityreceipt.md)<!-- -->&lt;[EthersTransactionReceipt](./arth-lib-ethers.etherstransactionreceipt.md)<!-- -->, T&gt;&gt;

## Remarks

Returned by [SendableEthersLiquity](./arth-lib-ethers.sendableethersliquity.md) functions.

The constructor for this class is marked as internal. Third-party code should not call the constructor directly or create subclasses that extend the `SentEthersLiquityTransaction` class.

## Properties

|  Property | Modifiers | Type | Description |
|  --- | --- | --- | --- |
|  [rawSentTransaction](./arth-lib-ethers.sentethersliquitytransaction.rawsenttransaction.md) |  | [EthersTransactionResponse](./arth-lib-ethers.etherstransactionresponse.md) | Ethers' representation of a sent transaction. |

## Methods

|  Method | Modifiers | Description |
|  --- | --- | --- |
|  [getReceipt()](./arth-lib-ethers.sentethersliquitytransaction.getreceipt.md) |  | Check whether the transaction has been mined, and whether it was successful. |
|  [waitForReceipt()](./arth-lib-ethers.sentethersliquitytransaction.waitforreceipt.md) |  | Wait for the transaction to be mined, and check whether it was successful. |
