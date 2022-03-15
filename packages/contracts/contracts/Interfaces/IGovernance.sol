// SPDX-License-Identifier: MIT

pragma solidity 0.6.11;

import "../Dependencies/IERC20.sol";
import "./IPriceFeed.sol";
import "../Dependencies/ISimpleERCFund.sol";
import "../Dependencies/IUniswapPairOracle.sol";

interface IGovernance {
    function setRedemptionFeeFloor(uint256 value) external;

    function setMaxBorrowingFee(uint256 value) external;

    function setBorrowingFeeFloor(uint256 value) external;

    function setLUSDGasCompensation(uint256 value) external;

    function setMinNetDebt(uint256 value) external;

    function setMCR(uint256 value) external;

    function setCCR(uint256 value) external;

    function MCR() external view returns (uint256);

    function CCR() external view returns (uint256);

    function REDEMPTION_FEE_FLOOR() external view returns (uint256);

    function LUSD_GAS_COMPENSATION() external view returns (uint256);

    function MIN_NET_DEBT() external view returns (uint256);

    function MAX_BORROWING_FEE() external view returns (uint256);

    function BORROWING_FEE_FLOOR() external view returns (uint256);
    
    function getDeploymentStartTime() external view returns (uint256);

    function getMaxDebtCeiling() external view returns (uint256);

    function getAllowMinting() external view returns (bool);

    function getPriceFeed() external view returns (IPriceFeed);

    function getStabilityFee() external view returns (uint256);

    function getStabilityFeeToken() external view returns (IERC20);

    function getStabilityTokenPairOracle() external view returns (IUniswapPairOracle);

    function getFund() external view returns (ISimpleERCFund);

    function chargeStabilityFee(address who, uint256 LUSDAmount) external;

    function sendToFund(address token, uint256 amount, string memory reason) external;
}
