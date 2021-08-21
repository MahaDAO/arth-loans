// SPDX-License-Identifier: MIT

pragma solidity >=0.5.0 <0.6.0;

interface Ierc20 {
    function transfer(address recipient, uint256 amount) external returns (bool);
}