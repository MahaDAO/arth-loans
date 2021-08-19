// SPDX-License-Identifier: MIT

pragma solidity 0.6.11;

import "../Dependencies/IERC20.sol";
import "../Dependencies/SafeMath.sol";
import "../Interfaces/IController.sol";
import "../Interfaces/ITroveManager.sol";
import "../Dependencies/CheckContract.sol";
import "../Interfaces/IBorrowerOperations.sol";

contract LeverageScript is CheckContract {
    using SafeMath for uint256;

    ITroveManager immutable troveManager;
    IBorrowerOperations immutable borrowerOperations;

    IERC20 immutable wethToken;
    IERC20 immutable lusdToken;

    address public immutable coreControllerAddress;

    // Amount of LUSD to be locked in gas pool on opening troves
    uint256 public constant LUSD_GAS_COMPENSATION = 5e18;

    constructor(
        ITroveManager _troveManager,
        IBorrowerOperations _borrowerOperations,
        IERC20 _wethToken,
        IERC20 _lusdToken,
        address _coreControllerAddress
    ) public {
        checkContract(address(_borrowerOperations));
        borrowerOperations = _borrowerOperations;

        checkContract(address(_wethToken));
        wethToken = _wethToken;

        checkContract(address(_lusdToken));
        lusdToken = _lusdToken;

        checkContract(_coreControllerAddress);
        coreControllerAddress = _coreControllerAddress;

        checkContract(address(_troveManager));
        troveManager = _troveManager;
    }

    function openTrove(
        uint256 _maxFee,
        uint256 _LUSDAmount,
        uint256 _ETHAmount,
        address _upperHint,
        address _lowerHint,
        address _frontEndTag
    ) external {
        // Take collateral from user.
        wethToken.transferFrom(msg.sender, address(this), _ETHAmount);
        // Approve BO to spend user's collateral.
        wethToken.approve(address(borrowerOperations), _ETHAmount);

        uint256 lusdBalanceBefore = lusdToken.balanceOf(address(this));
        borrowerOperations.openTrove(_maxFee, _LUSDAmount, _ETHAmount, _upperHint, _lowerHint, _frontEndTag);
        uint256 lusdBalanceAfter = lusdToken.balanceOf(address(this));

        // Moves the LUSD debt amount to user's wallet.
        lusdToken.transfer(msg.sender, lusdBalanceAfter.sub(lusdBalanceBefore));
    }

    function addColl(
        uint256 _ETHAmount,
        address _upperHint,
        address _lowerHint
    ) external {
        // Take collateral from user.
        wethToken.transferFrom(msg.sender, address(this), _ETHAmount);
        // Approve BO to spend user's collateral.
        wethToken.approve(address(borrowerOperations), _ETHAmount);

        borrowerOperations.addColl(_ETHAmount, _upperHint, _lowerHint);
    }

    function withdrawColl(
        uint256 _amount,
        address _upperHint,
        address _lowerHint
    ) external {
        uint256 wethBalanceBefore = wethToken.balanceOf(address(this));
        borrowerOperations.withdrawColl(_amount, _upperHint, _lowerHint);
        uint256 wethBalanceAfter = wethToken.balanceOf(address(this));

        // Move the withdrawn weth to user's wallet.
        wethToken.transfer(msg.sender, wethBalanceAfter.sub(wethBalanceBefore));
    }

    function withdrawLUSD(
        uint256 _maxFee,
        uint256 _amount,
        address _upperHint,
        address _lowerHint
    ) external {
        uint256 lusdBalanceBefore = lusdToken.balanceOf(address(this));
        borrowerOperations.withdrawLUSD(_maxFee, _amount, _upperHint, _lowerHint);
        uint256 lusdBalanceAfter = lusdToken.balanceOf(address(this));

        // Moves the LUSD debt amount to user's wallet.
        lusdToken.transfer(msg.sender, lusdBalanceAfter.sub(lusdBalanceBefore));
    }

    function repayLUSD(
        uint256 _amount,
        address _upperHint,
        address _lowerHint
    ) external {
        lusdToken.transferFrom(msg.sender, address(this), _amount);
        lusdToken.approve(coreControllerAddress, _amount);

        borrowerOperations.repayLUSD(_amount, _upperHint, _lowerHint);
    }

    function closeTrove() external {
        // Get the trove debt.
        uint256 troveDebt = troveManager.getTroveDebt(address(this));
        uint256 debt = troveDebt.sub(LUSD_GAS_COMPENSATION);

        // Get the debt tokens from user.
        lusdToken.transferFrom(msg.sender, address(this), debt);
        // Approve controller to burn this debt.
        lusdToken.approve(coreControllerAddress, debt);

        uint256 collateralBalanceBefore = wethToken.balanceOf(address(this));
        borrowerOperations.closeTrove();
        uint256 collateralBalanceAfter = wethToken.balanceOf(address(this));

        // Transfer back the collateral to user's wallet.
        wethToken.transfer(msg.sender, collateralBalanceAfter.sub(collateralBalanceBefore));
    }

    function adjustTrove(
        uint256 _maxFee,
        uint256 _collWithdrawal,
        uint256 _debtChange,
        uint256 _ETHAmount,
        bool isDebtIncrease,
        address _upperHint,
        address _lowerHint
    ) external payable {
        borrowerOperations.adjustTrove(
            _maxFee,
            _collWithdrawal,
            _debtChange,
            _ETHAmount,
            isDebtIncrease,
            _upperHint,
            _lowerHint
        );
    }

    function claimCollateral() external {
        uint256 collateralBalanceBefore = wethToken.balanceOf(address(this));
        borrowerOperations.claimCollateral();
        uint256 collateralBalanceAfter = wethToken.balanceOf(address(this));

        // Transfer back the collateral to user's wallet.
        wethToken.transfer(msg.sender, collateralBalanceAfter.sub(collateralBalanceBefore));
    }
}
