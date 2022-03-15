// SPDX-License-Identifier: MIT

pragma solidity 0.6.11;

import "./BaseMath.sol";
import "./LiquityMath.sol";
import "./IERC20.sol";
import "../Interfaces/IGovernance.sol";
import "../Interfaces/IActivePool.sol";
import "../Interfaces/IDefaultPool.sol";
import "../Interfaces/IPriceFeed.sol";
import "../Interfaces/ILiquityBase.sol";

/*
 * Base contract for TroveManager, BorrowerOperations and StabilityPool. Contains global system constants and
 * common functions.
 */
contract LiquityBase is BaseMath, ILiquityBase {
    using SafeMath for uint256;

    uint256 public constant _100pct = 1000000000000000000; // 1e18 == 100%

    uint256 public constant PERCENT_DIVISOR = 200; // dividing by 200 yields 0.5%

    IActivePool public activePool;
    IDefaultPool public defaultPool;
    IGovernance public governance;

    // --- Gas compensation functions ---

    function getPriceFeed() public view override returns (IPriceFeed) {
        return governance.getPriceFeed();
    }

    // Returns the composite debt (drawn debt + gas compensation) of a trove, for the purpose of ICR calculation
    function _getCompositeDebt(uint256 _debt) internal view returns (uint256) {
        return _debt.add(
            governance.LUSD_GAS_COMPENSATION()
        );
    }

    function _getNetDebt(uint256 _debt) internal view returns (uint256) {
        return _debt.sub(
            governance.LUSD_GAS_COMPENSATION()
        );
    }

    // Return the amount of ETH to be drawn from a trove's collateral and sent as gas compensation.
    function _getCollGasCompensation(uint256 _entireColl) internal pure returns (uint256) {
        return _entireColl / PERCENT_DIVISOR;
    }

    function getEntireSystemColl() public view returns (uint256 entireSystemColl) {
        uint256 activeColl = activePool.getETH();
        uint256 liquidatedColl = defaultPool.getETH();
        return activeColl.add(liquidatedColl);
    }

    function getEntireSystemDebt() public view returns (uint256 entireSystemDebt) {
        uint256 activeDebt = activePool.getLUSDDebt();
        uint256 closedDebt = defaultPool.getLUSDDebt();
        return activeDebt.add(closedDebt);
    }

    function _getTCR(uint256 _price) internal view returns (uint256 TCR) {
        uint256 entireSystemColl = getEntireSystemColl();
        uint256 entireSystemDebt = getEntireSystemDebt();
        TCR = LiquityMath._computeCR(entireSystemColl, entireSystemDebt, _price);
        return TCR;
    }

    function _checkRecoveryMode(uint256 _price) internal view returns (bool) {
        uint256 TCR = _getTCR(_price);
        return TCR < governance.CCR();
    }

    function _requireUserAcceptsFee(
        uint256 _fee,
        uint256 _amount,
        uint256 _maxFeePercentage
    ) internal pure {
        uint256 feePercentage = _fee.mul(DECIMAL_PRECISION).div(_amount);
        require(feePercentage <= _maxFeePercentage, "Fee exceeded provided maximum");
    }
}
