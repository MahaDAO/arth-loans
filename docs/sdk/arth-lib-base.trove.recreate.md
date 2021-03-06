<!-- Do not edit this file. It is automatically generated by API Documenter. -->

[Home](./index.md) &gt; [@mahadao/arth-lib-base](./arth-lib-base.md) &gt; [Trove](./arth-lib-base.trove.md) &gt; [recreate](./arth-lib-base.trove.recreate.md)

## Trove.recreate() method

Calculate the parameters of an [openTrove()](./arth-lib-base.transactableliquity.opentrove.md) transaction that will result in the given Trove.

<b>Signature:</b>

```typescript
static recreate(that: Trove, borrowingRate?: Decimalish): TroveCreationParams<Decimal>;
```

## Parameters

|  Parameter | Type | Description |
|  --- | --- | --- |
|  that | [Trove](./arth-lib-base.trove.md) | The Trove to recreate. |
|  borrowingRate | [Decimalish](./arth-lib-base.decimalish.md) | Current borrowing rate. |

<b>Returns:</b>

[TroveCreationParams](./arth-lib-base.trovecreationparams.md)<!-- -->&lt;[Decimal](./arth-lib-base.decimal.md)<!-- -->&gt;

