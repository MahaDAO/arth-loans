import React from "react";
import { Flex } from "theme-ui";

import { LiquityStoreState } from "@mahadao/arth-lib-base";
import { useLiquitySelector } from "@mahadao/arth-lib-react";

const selector = ({ remainingLiquidityMiningLQTYReward }: LiquityStoreState) => ({
  remainingLiquidityMiningLQTYReward
});

export const RemainingLQTY: React.FC = () => {
  const { remainingLiquidityMiningLQTYReward } = useLiquitySelector(selector);

  return (
    <Flex sx={{ mr: 2, fontSize: 2, fontWeight: "medium" }}>
      {remainingLiquidityMiningLQTYReward.prettify(0)} MAHA remaining
    </Flex>
  );
};
