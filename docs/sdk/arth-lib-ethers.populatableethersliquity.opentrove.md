<!-- Do not edit this file. It is automatically generated by API Documenter. -->

[Home](./index.md) &gt; [@mahadao/arth-lib-ethers](./arth-lib-ethers.md) &gt; [PopulatableEthersLiquity](./arth-lib-ethers.populatableethersliquity.md) &gt; [openTrove](./arth-lib-ethers.populatableethersliquity.opentrove.md)

## PopulatableEthersLiquity.openTrove() method

Open a new Trove by depositing collateral and borrowing LUSD.

<b>Signature:</b>

```typescript
openTrove(params: TroveCreationParams<Decimalish>, maxBorrowingRate?: Decimalish, overrides?: EthersTransactionOverrides): Promise<PopulatedEthersLiquityTransaction<TroveCreationDetails>>;
```

## Parameters

|  Parameter | Type | Description |
|  --- | --- | --- |
|  params | [TroveCreationParams](./arth-lib-base.trovecreationparams.md)<!-- -->&lt;[Decimalish](./arth-lib-base.decimalish.md)<!-- -->&gt; | How much to deposit and borrow. |
|  maxBorrowingRate | [Decimalish](./arth-lib-base.decimalish.md) | Maximum acceptable [borrowing rate](./arth-lib-base.fees.borrowingrate.md)<!-- -->. |
|  overrides | [EthersTransactionOverrides](./arth-lib-ethers.etherstransactionoverrides.md) |  |

<b>Returns:</b>

Promise&lt;[PopulatedEthersLiquityTransaction](./arth-lib-ethers.populatedethersliquitytransaction.md)<!-- -->&lt;[TroveCreationDetails](./arth-lib-base.trovecreationdetails.md)<!-- -->&gt;&gt;

## Remarks

If `maxBorrowingRate` is omitted, the current borrowing rate plus 0.5% is used as maximum acceptable rate.

