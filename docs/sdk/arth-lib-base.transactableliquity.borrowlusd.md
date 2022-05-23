<!-- Do not edit this file. It is automatically generated by API Documenter. -->

[Home](./index.md) &gt; [@mahadao/arth-lib-base](./arth-lib-base.md) &gt; [TransactableLiquity](./arth-lib-base.transactableliquity.md) &gt; [borrowLUSD](./arth-lib-base.transactableliquity.borrowlusd.md)

## TransactableLiquity.borrowLUSD() method

Adjust existing Trove by borrowing more LUSD.

<b>Signature:</b>

```typescript
borrowLUSD(amount: Decimalish, maxBorrowingRate?: Decimalish): Promise<TroveAdjustmentDetails>;
```

## Parameters

|  Parameter | Type | Description |
|  --- | --- | --- |
|  amount | [Decimalish](./arth-lib-base.decimalish.md) | The amount of LUSD to borrow. |
|  maxBorrowingRate | [Decimalish](./arth-lib-base.decimalish.md) | Maximum acceptable [borrowing rate](./arth-lib-base.fees.borrowingrate.md)<!-- -->. |

<b>Returns:</b>

Promise&lt;[TroveAdjustmentDetails](./arth-lib-base.troveadjustmentdetails.md)<!-- -->&gt;

## Exceptions

Throws [TransactionFailedError](./arth-lib-base.transactionfailederror.md) in case of transaction failure.

## Remarks

Equivalent to:

```typescript
adjustTrove({ borrowLUSD: amount }, maxBorrowingRate)

```
