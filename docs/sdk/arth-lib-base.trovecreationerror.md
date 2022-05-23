<!-- Do not edit this file. It is automatically generated by API Documenter. -->

[Home](./index.md) &gt; [@mahadao/arth-lib-base](./arth-lib-base.md) &gt; [TroveCreationError](./arth-lib-base.trovecreationerror.md)

## TroveCreationError type

Describes why a Trove could not be created.

<b>Signature:</b>

```typescript
export declare type TroveCreationError = "missingLiquidationReserve";
```

## Remarks

See [TroveChange](./arth-lib-base.trovechange.md)<!-- -->.

<h2>Possible values</h2>

<table>

<tr> <th> Value </th> <th> Reason </th> </tr>

<tr> <td> "missingLiquidationReserve" </td> <td> A Trove's debt cannot be less than the liquidation reserve. </td> </tr>

</table>

More errors may be added in the future.
