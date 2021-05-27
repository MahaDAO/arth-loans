import React from "react";
import { Text, Flex, Box, Heading } from "theme-ui";

import { LiquityStoreState } from "@liquity/lib-base";
import { useLiquitySelector } from "@liquity/lib-react";

import { COIN, GT } from "../strings";
import { useLiquity } from "../hooks/LiquityContext";
import { shortenAddress } from "../utils/shortenAddress";

import { Icon } from "./Icon";
import Button from "./Button";

const select = ({ accountBalance, lusdBalance, lqtyBalance }: LiquityStoreState) => ({
  accountBalance,
  lusdBalance,
  lqtyBalance
});

export const UserAccount: React.FC = () => {
  const { account } = useLiquity();
  const { accountBalance, lusdBalance, lqtyBalance } = useLiquitySelector(select);

  return (
    <Box sx={{ display: ["none", "flex"], alignSelf: 'center' }}>
      <Button
        variant={'transparent'}
        text={'Connect'}
        onClick={()=>{
          
        }}
      />
    </Box>
  );
};
