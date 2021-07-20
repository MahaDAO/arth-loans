import { Button } from "theme-ui";

import { LiquityStoreState } from "@arthloans/lib-base";
import { useLiquitySelector } from "@arthloans/lib-react";

import { useLiquity } from "../../hooks/LiquityContext";
import { useTransactionFunction } from "../Transaction";

const selectLQTYStake = ({ lqtyStake }: LiquityStoreState) => lqtyStake;

export const StakingGainsAction: React.FC = () => {
  const { liquity } = useLiquity();
  const { collateralGain, lusdGain } = useLiquitySelector(selectLQTYStake);

  const [sendTransaction] = useTransactionFunction(
    "stake",
    liquity.send.withdrawGainsFromStaking.bind(liquity.send)
  );

  return (
    <Button onClick={sendTransaction} disabled={collateralGain.isZero && lusdGain.isZero}>
      Claim gains
    </Button>
  );
};
