<!-- Do not edit this file. It is automatically generated by API Documenter. -->

[Home](./index.md) &gt; [@mahadao/arth-lib-base](./arth-lib-base.md) &gt; [LiquityStoreDerivedState](./arth-lib-base.liquitystorederivedstate.md) &gt; [redemptionRate](./arth-lib-base.liquitystorederivedstate.redemptionrate.md)

## LiquityStoreDerivedState.redemptionRate property

Current redemption rate.

<b>Signature:</b>

```typescript
redemptionRate: Decimal;
```

## Remarks

Note that the actual rate paid by a redemption transaction will depend on the amount of LUSD being redeemed.

Use [Fees.redemptionRate()](./arth-lib-base.fees.redemptionrate.md) to calculate a precise redemption rate.
