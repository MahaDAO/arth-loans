// SPDX-License-Identifier: MIT

pragma solidity >=0.5.0 <0.6.0;

interface ILusd {
    function burn(uint256 amount) external;

    function poolMint(address who, uint256 amount) external;

    function poolBurnFrom(address who, uint256 amount) external;
}