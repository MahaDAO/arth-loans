import { Button } from "theme-ui";

import { Decimal, TroveChange } from "@arthloans/lib-base";

import { useLiquity } from "../../hooks/LiquityContext";
import { useTransactionFunction } from "../Transaction";

type TroveActionProps = {
  transactionId: string;
  change: Exclude<TroveChange<Decimal>, { type: "invalidCreation" }>;
  maxBorrowingRate: Decimal;
};

export const TroveAction: React.FC<TroveActionProps> = ({
  children,
  transactionId,
  change,
  maxBorrowingRate
}) => {
  const { liquity } = useLiquity();

  const [sendTransaction] = useTransactionFunction(
    transactionId,
    change.type === "creation"
      ? liquity.send.openTrove.bind(liquity.send, change.params, maxBorrowingRate)
      : change.type === "closure"
        ? liquity.send.closeTrove.bind(liquity.send)
        : liquity.send.adjustTrove.bind(liquity.send, change.params, maxBorrowingRate)
  );

  return <Button onClick={sendTransaction}>{children}</Button>;
};
