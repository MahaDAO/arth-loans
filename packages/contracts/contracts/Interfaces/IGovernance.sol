// SPDX-License-Identifier: MIT

pragma solidity 0.6.11;

import "./IPriceFeed.sol";

interface IGovernance {
    function getMaxDebtCeiling() external view returns (uint256);

    function getAllowMinting() external view returns (bool);

    function getPriceFeed() external view returns (IPriceFeed);
}
