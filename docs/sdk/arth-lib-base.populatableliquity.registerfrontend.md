<!-- Do not edit this file. It is automatically generated by API Documenter. -->

[Home](./index.md) &gt; [@mahadao/arth-lib-base](./arth-lib-base.md) &gt; [PopulatableLiquity](./arth-lib-base.populatableliquity.md) &gt; [registerFrontend](./arth-lib-base.populatableliquity.registerfrontend.md)

## PopulatableLiquity.registerFrontend() method

Register current wallet address as a Liquity frontend.

<b>Signature:</b>

```typescript
registerFrontend(kickbackRate: Decimalish): Promise<PopulatedLiquityTransaction<P, SentLiquityTransaction<S, LiquityReceipt<R, void>>>>;
```

## Parameters

|  Parameter | Type | Description |
|  --- | --- | --- |
|  kickbackRate | [Decimalish](./arth-lib-base.decimalish.md) | The portion of LQTY rewards to pass onto users of the frontend (between 0 and 1). |

<b>Returns:</b>

Promise&lt;[PopulatedLiquityTransaction](./arth-lib-base.populatedliquitytransaction.md)<!-- -->&lt;P, [SentLiquityTransaction](./arth-lib-base.sentliquitytransaction.md)<!-- -->&lt;S, [LiquityReceipt](./arth-lib-base.liquityreceipt.md)<!-- -->&lt;R, void&gt;&gt;&gt;&gt;

