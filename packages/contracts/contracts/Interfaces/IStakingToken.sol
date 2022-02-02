// SPDX-License-Identifier: MIT

pragma solidity 0.6.11;

import { IERC20 } from "../Dependencies/IERC20.sol";

interface IStakingToken is IERC20 {
    function mintOnStake(address recipient_, uint256 amount_)
        external
        returns (bool);

    function burnOnWithdraw(address recipient_, uint256 amount_)
        external 
        returns (bool);
}