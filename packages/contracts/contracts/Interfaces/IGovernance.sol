// SPDX-License-Identifier: MIT

pragma solidity 0.6.11;

import "../Dependencies/IERC20.sol";
import "./IPriceFeed.sol";

interface IGovernance {
    function getMaxDebtCeiling() external view returns (uint256);

    function getAllowMinting() external view returns (bool);

    function getPriceFeed() external view returns (IPriceFeed);

    function getStabilityFee() external view returns (uint256);

    function getStabilityFeeToken() external view returns (IERC20);
}
