// SPDX-License-Identifier: agpl-3.0

pragma solidity 0.6.11;

interface IFlashLoanReceiver {
  function executeOperation(
    uint256 amount,
    uint256 premium,
    address initiator,
    bytes calldata params
  ) external returns (bool);
}