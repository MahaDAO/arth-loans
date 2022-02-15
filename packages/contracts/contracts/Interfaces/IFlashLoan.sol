// SPDX-License-Identifier: agpl-3.0

pragma solidity 0.6.11;

interface IFlashLoan {
    function flashLoan(
        address receiverAddress,
        uint256 amount,
        bytes calldata params
    ) external;
}