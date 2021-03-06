<!-- Do not edit this file. It is automatically generated by API Documenter. -->

[Home](./index.md) &gt; [@mahadao/arth-lib-base](./arth-lib-base.md) &gt; [Fees](./arth-lib-base.fees.md) &gt; [borrowingRate](./arth-lib-base.fees.borrowingrate.md)

## Fees.borrowingRate() method

Calculate the current borrowing rate.

<b>Signature:</b>

```typescript
borrowingRate(when?: Date): Decimal;
```

## Parameters

|  Parameter | Type | Description |
|  --- | --- | --- |
|  when | Date | Optional timestamp that can be used to calculate what the borrowing rate would decay to at a point of time in the future. |

<b>Returns:</b>

[Decimal](./arth-lib-base.decimal.md)

## Remarks

By default, the fee is calculated at the time of the latest block. This can be overridden using the `when` parameter.

To calculate the borrowing fee in LUSD, multiply the borrowed LUSD amount by the borrowing rate.

## Example


```typescript
const fees = await liquity.getFees();

const borrowedLUSDAmount = 100;
const borrowingRate = fees.borrowingRate();
const borrowingFeeLUSD = borrowingRate.mul(borrowedLUSDAmount);

```

