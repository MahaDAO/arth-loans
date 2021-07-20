import React from "react";
import { Flex } from "theme-ui";

import { LiquityStoreState } from "@mahadao/arth-lib-base";
import { useLiquitySelector } from "@mahadao/arth-lib-react";

const selector = ({ remainingStabilityPoolLQTYReward }: LiquityStoreState) => ({
  remainingStabilityPoolLQTYReward
});

export const RemainingLQTY: React.FC = () => {
  const { remainingStabilityPoolLQTYReward } = useLiquitySelector(selector);

  return (
    <Flex sx={{ mr: 2, fontSize: 2, fontWeight: "medium" }}>
      {remainingStabilityPoolLQTYReward.prettify(0)} MAHA remaining
    </Flex>
  );
};
