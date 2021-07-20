import React from "react";
import { Text, Flex, Box, Heading } from "theme-ui";

import { LiquityStoreState } from "@mahadao/arth-lib-base";
import { useLiquitySelector } from "@mahadao/arth-lib-react";

import { COIN, GT } from "../strings";
import { useLiquity } from "../hooks/LiquityContext";
import { shortenAddress } from "../utils/shortenAddress";

import { Icon } from "./Icon";
import Button from "./Button";
import AccountModal from '../components/Modals/AccountModal'

const select = ({ accountBalance, lusdBalance, lqtyBalance }: LiquityStoreState) => ({
  accountBalance,
  lusdBalance,
  lqtyBalance
});

export const UserAccount: React.FC = () => {
  const { account } = useLiquity();
  const { accountBalance, lusdBalance, lqtyBalance } = useLiquitySelector(select);
  const [showModal, toggleModal] = React.useState(false);

  return (
    <>
      {showModal && <AccountModal onClose={() => toggleModal(!showModal)} />}
      <Box sx={{ display: ["none", "flex"], alignSelf: 'center', marginRight: 108 }}>
        <Button
          variant={'transparent'}
          text={'Connect'}
          onClick={() => {
            toggleModal(!showModal)
          }}
        />
      </Box>
    </>
  );
};
