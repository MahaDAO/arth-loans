<!-- Do not edit this file. It is automatically generated by API Documenter. -->

[Home](./index.md) &gt; [@mahadao/arth-lib-ethers](./arth-lib-ethers.md) &gt; [SentEthersLiquityTransaction](./arth-lib-ethers.sentethersliquitytransaction.md) &gt; [getReceipt](./arth-lib-ethers.sentethersliquitytransaction.getreceipt.md)

## SentEthersLiquityTransaction.getReceipt() method

Check whether the transaction has been mined, and whether it was successful.

<b>Signature:</b>

```typescript
getReceipt(): Promise<LiquityReceipt<EthersTransactionReceipt, T>>;
```
<b>Returns:</b>

Promise&lt;[LiquityReceipt](./arth-lib-base.liquityreceipt.md)<!-- -->&lt;[EthersTransactionReceipt](./arth-lib-ethers.etherstransactionreceipt.md)<!-- -->, T&gt;&gt;

## Remarks

Unlike [waitForReceipt()](./arth-lib-base.sentliquitytransaction.waitforreceipt.md)<!-- -->, this function doesn't wait for the transaction to be mined.
