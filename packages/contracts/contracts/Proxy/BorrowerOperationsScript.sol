// SPDX-License-Identifier: MIT

pragma solidity 0.6.11;

import "../Dependencies/IERC20.sol";
import "../Dependencies/SafeMath.sol";
import "../Interfaces/IController.sol";
import "../Interfaces/ITroveManager.sol";
import "../Dependencies/CheckContract.sol";
import "../Interfaces/IBorrowerOperations.sol";
import "../Dependencies/IUniswapV2Router02.sol";

contract BorrowerOperationsScript is CheckContract {
    using SafeMath for uint256;

    IERC20 immutable wethToken;
    IERC20 immutable lusdToken;

    IUniswapV2Router02 immutable router;
    ITroveManager immutable troveManager;
    IBorrowerOperations immutable borrowerOperations;

    address[] public lusdToCollateralPath;
    address public immutable coreControllerAddress;

    uint256 public constant LUSD_GAS_COMPENSATION = 5e18;

    constructor(
        IERC20 _wethToken,
        IERC20 _lusdToken,
        IUniswapV2Router02 _router,
        ITroveManager _troveManager,
        IBorrowerOperations _borrowerOperations,
        address _coreControllerAddress,
        address[] memory _lusdToCollateralPath
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

        CheckContract(address(_router));
        router =  _router;

        lusdToCollateralPath = _lusdToCollateralPath;
    }

    function openTrove(
        uint256 _maxFee,
        uint256 _LUSDAmount,
        uint256 _ETHAmount,
        address _upperHint,
        address _lowerHint,
        address _frontEndTag
    ) external {
        wethToken.transferFrom(msg.sender, address(this), _ETHAmount);
        wethToken.approve(address(borrowerOperations), _ETHAmount);
        
        borrowerOperations.openTrove(_maxFee, _LUSDAmount, _ETHAmount, _upperHint, _lowerHint, _frontEndTag);
        
        lusdToken.transfer(msg.sender, _LUSDAmount);
    }

    function openTroveAndAddColl(
        uint256 _maxFee,
        uint256 _LUSDAmount,
        uint256 _ETHAmount,
        address _upperHint,
        address _lowerHint,
        address _frontEndTag,
        address _addCollUpperHint,
        address _addCollLowerHint
    ) external {
        wethToken.transferFrom(msg.sender, address(this), _ETHAmount);
        wethToken.approve(address(borrowerOperations), _ETHAmount);
        
        borrowerOperations.openTrove(_maxFee, _LUSDAmount, _ETHAmount, _upperHint, _lowerHint, _frontEndTag);

        lusdToken.approve(address(router), _LUSDAmount);
        uint256[] memory expectedAmountOuts = router.getAmountsOut(_LUSDAmount, lusdToCollateralPath);
        uint256 expectedETHTopupAmount = expectedAmountOuts[expectedAmountOuts.length - 1];
        uint256[] memory amountOuts = router.swapExactTokensForTokens(
            _LUSDAmount,
            expectedETHTopupAmount,
            lusdToCollateralPath,
            address(this),
            block.timestamp
        );
        uint256 _ETHTopupAmount = amountOuts[amountOuts.length -1];
        require(_ETHTopupAmount >= expectedETHTopupAmount, 'Tx: swap failed');

        wethToken.approve(address(borrowerOperations), _ETHTopupAmount);
        borrowerOperations.addColl(_ETHTopupAmount, _addCollUpperHint, _addCollLowerHint);
    }

    function addColl(
        uint256 _ETHAmount,
        address _upperHint,
        address _lowerHint
    ) external {
        wethToken.transferFrom(msg.sender, address(this), _ETHAmount);
        wethToken.approve(address(borrowerOperations), _ETHAmount);

        borrowerOperations.addColl(_ETHAmount, _upperHint, _lowerHint);
    }

    function withdrawColl(
        uint256 _amount,
        address _upperHint,
        address _lowerHint
    ) external {
        borrowerOperations.withdrawColl(_amount, _upperHint, _lowerHint);
        wethToken.transfer(msg.sender, _amount);
    }

    function withdrawLUSD(
        uint256 _maxFee,
        uint256 _amount,
        address _upperHint,
        address _lowerHint
    ) external {
        borrowerOperations.withdrawLUSD(_maxFee, _amount, _upperHint, _lowerHint);
        lusdToken.transfer(msg.sender, _amount);
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
        uint256 troveColl = troveManager.getTroveColl(address(this));
        uint256 troveDebt = troveManager.getTroveDebt(address(this));
        uint256 netDebt = troveDebt.sub(LUSD_GAS_COMPENSATION);

        lusdToken.transferFrom(msg.sender, address(this), netDebt);
        lusdToken.approve(coreControllerAddress, netDebt);

        borrowerOperations.closeTrove();

        wethToken.transfer(msg.sender, troveColl);
    }

    function claimCollateral() external {
        uint256 wethBalanceBefore = wethToken.balanceOf(address(this));
        borrowerOperations.claimCollateral();
        uint256 wethBalanceAfter = wethToken.balanceOf(address(this));

        // Transfer back the collateral to user's wallet.
        wethToken.transfer(msg.sender, wethBalanceAfter.sub(wethBalanceBefore));
    }
}
