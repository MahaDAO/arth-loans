// SPDX-License-Identifier: MIT

pragma solidity 0.8.0;

import "../Dependencies/SafeMath.sol";
import "../Dependencies/LiquityMath.sol";
import "../Dependencies/IERC20.sol";
import "../Interfaces/IBorrowerOperations.sol";
import "../Interfaces/ITroveManager.sol";
import "../Interfaces/IStabilityPool.sol";
import "../Interfaces/IPriceFeed.sol";
import "./BorrowerOperationsScript.sol";
import "./ETHTransferScript.sol";


contract BorrowerWrappersScript is BorrowerOperationsScript, ETHTransferScript {
    using SafeMath for uint256;

    string public constant NAME = "BorrowerWrappersScript";

    ITroveManager immutable troveManager;
    IStabilityPool immutable stabilityPool;

    IERC20 immutable lusdToken;

    constructor(
        address _borrowerOperationsAddress,
        address _troveManagerAddress
    )
        BorrowerOperationsScript(IBorrowerOperations(_borrowerOperationsAddress))
    {
        checkContract(_troveManagerAddress);
        ITroveManager troveManagerCached = ITroveManager(_troveManagerAddress);
        troveManager = troveManagerCached;

        IStabilityPool stabilityPoolCached = troveManagerCached.stabilityPool();
        checkContract(address(stabilityPoolCached));
        stabilityPool = stabilityPoolCached;

        address lusdTokenCached = address(troveManagerCached.lusdToken());
        checkContract(lusdTokenCached);
        lusdToken = IERC20(lusdTokenCached);
    }

    function claimCollateralAndOpenTrove(
        uint256 _maxFee,
        uint256 _LUSDAmount,
        uint256 _ETHAmount,
        address _upperHint,
        address _lowerHint,
        address _frontEndTag
    ) external payable {
        uint256 balanceBefore = address(this).balance;

        // Claim collateral
        borrowerOperations.claimCollateral();

        uint256 balanceAfter = address(this).balance;

        // already checked in CollSurplusPool
        assert(balanceAfter > balanceBefore);

        uint256 totalCollateral = balanceAfter.sub(balanceBefore).add(_ETHAmount);

        // Open trove with obtained collateral, plus collateral sent by user
        borrowerOperations.openTrove(_maxFee, _LUSDAmount, totalCollateral, _upperHint, _lowerHint, _frontEndTag);
    }

    function claimSPRewardsAndRecycle(
        uint256 _maxFee,
        address _upperHint,
        address _lowerHint
    ) external {
        uint256 collBalanceBefore = address(this).balance;

        // Claim rewards
        stabilityPool.withdrawFromSP(0);

        uint256 collBalanceAfter = address(this).balance;
        uint256 claimedCollateral = collBalanceAfter.sub(collBalanceBefore);

        // Add claimed ETH to trove, get more LUSD and stake it into the Stability Pool
        if (claimedCollateral > 0) {
            _requireUserHasTrove(address(this));
            uint256 LUSDAmount = _getNetLUSDAmount(claimedCollateral);
            borrowerOperations.adjustTrove(
                _maxFee,
                0,
                LUSDAmount,
                claimedCollateral,
                true,
                _upperHint,
                _lowerHint
            );
            // Provide withdrawn LUSD to Stability Pool
            if (LUSDAmount > 0) {
                stabilityPool.provideToSP(LUSDAmount, address(0));
            }
        }
    }

    function claimStakingGainsAndRecycle(
        uint256 _maxFee,
        address _upperHint,
        address _lowerHint
    ) external {
        uint256 collBalanceBefore = address(this).balance;
        uint256 lusdBalanceBefore = lusdToken.balanceOf(address(this));

        uint256 gainedCollateral = address(this).balance.sub(collBalanceBefore); // stack too deep issues :'(
        uint256 gainedLUSD = lusdToken.balanceOf(address(this)).sub(lusdBalanceBefore);

        uint256 netLUSDAmount;
        // Top up trove and get more LUSD, keeping ICR constant
        if (gainedCollateral > 0) {
            _requireUserHasTrove(address(this));
            netLUSDAmount = _getNetLUSDAmount(gainedCollateral);
            borrowerOperations.adjustTrove(
                _maxFee,
                0,
                netLUSDAmount,
                gainedCollateral,
                true,
                _upperHint,
                _lowerHint
            );
        }

        uint256 totalLUSD = gainedLUSD.add(netLUSDAmount);
        if (totalLUSD > 0) {
            stabilityPool.provideToSP(totalLUSD, address(0));

            // Providing to Stability Pool also triggers LQTY claim, so stake it if any
            // uint256 lqtyBalanceAfter = lqtyToken.balanceOf(address(this));
            // uint256 claimedLQTY = lqtyBalanceAfter.sub(lqtyBalanceBefore);
            // if (claimedLQTY > 0) {
            //     lqtyStaking.stake(claimedLQTY);
            // }
        }
    }

    function _getNetLUSDAmount(uint256 _collateral) internal returns (uint256) {
        IPriceFeed priceFeed = troveManager.getPriceFeed();
        uint256 price = priceFeed.fetchPrice();
        uint256 ICR = troveManager.getCurrentICR(address(this), price);

        uint256 LUSDAmount = _collateral.mul(price).div(ICR);
        uint256 borrowingRate = troveManager.getBorrowingRateWithDecay();
        uint256 netDebt = LUSDAmount.mul(LiquityMath.DECIMAL_PRECISION).div(
            LiquityMath.DECIMAL_PRECISION.add(borrowingRate)
        );

        return netDebt;
    }

    function _requireUserHasTrove(address _depositor) internal view {
        require(
            troveManager.getTroveStatus(_depositor) == 1,
            "BorrowerWrappersScript: caller must have an active trove"
        );
    }
}
