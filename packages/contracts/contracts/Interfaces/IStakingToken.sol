// SPDX-License-Identifier: MIT

pragma solidity 0.6.11;

import { IERC20 } from "../Dependencies/IERC20.sol";

interface IStakingToken is IERC20 {
    function deposit(uint256 _amount) external;
    function withdraw(uint256 _amount) external;
}