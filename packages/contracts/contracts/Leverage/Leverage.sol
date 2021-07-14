// SPDX-License-Identifier: MIT

pragma solidity 0.6.11;
pragma experimental ABIEncoderV2;

import "./FlashLoanReceiverBase.sol";
import "../Interfaces/ITroveManager.sol";
import "../Interfaces/IBorrowerOperations.sol";
import "../Dependencies/IUniswapV2Router02.sol";
import "../Dependencies/ILendingPool.sol";
import "../Dependencies/SafeMath.sol";
import "../Dependencies/IERC20.sol";

contract Leverage is FlashLoanReceiverBase {
    using SafeMath for uint256;
    
    IUniswapV2Router02 public router;
    IBorrowerOperations public borrowerOperations;
    ITroveManager public troveManager;

    address[] public lusdToCollateralSwapPath;

    struct LeverageAndTroveDetails {
        uint256 collateralAmount;
        uint256 maxFee;
        address upperHint;
        address lowerHint;
        uint256 lusdAmount;
    }

    constructor(
        IUniswapV2Router02 _router,
        ILendingPoolAddressesProvider lendingPoolAddressProvider,
        address[] memory _lusdToCollateralSwapPath
    ) 
        FlashLoanReceiverBase(lendingPoolAddressProvider) 
        public 
    {   
        lusdToCollateralSwapPath = _lusdToCollateralSwapPath;
        router = _router;
    }

    function executeOperation(
        address _reserve,
        uint256 _amount,
        uint256 _fee,
        bytes calldata _params
    )
        external 
        override 
    {
        // 1. Check the contract has the specified balance.
        require(
            _amount <= getBalanceInternal(address(this), _reserve),
            "Leverage: Invalid balance for the contract"
        );

        // 2. Decode the data passed as input to flashloan.
        LeverageAndTroveDetails memory troveDetails = abi.decode(_params, (LeverageAndTroveDetails));

        // 3. Open a trove.
        uint256 lusdMinted = _openTrove(_reserve, troveDetails, _fee, _amount, tx.origin);

        // 4. Swap LUSD for Collateral.
        uint256 swappedAmount = _swapLUSDForCollateral(lusdMinted);

        // 5-A. Check that the swapped amount is atleast equal to that required to complete flashloan.
        require(swappedAmount >= _amount.add(_fee));  // Not sure if required.

        // 6. Transfer the funds back to aave with fee.
        transferFundsBackToPoolInternal(_reserve, _amount.add(_fee));

        // 7-A. If there is some eth left (0x fee), return it to user
        if (_reserve == EthAddressLib.ethAddress() && address(this).balance > 0) {
            tx.origin.transfer(address(this).balance);
        }

        // 7-B. If there is some collateral left (0x fee), return it to user
        if (_reserve != EthAddressLib.ethAddress() && IERC20(_reserve).balanceOf(address(this)) > 0) {
            IERC20(_reserve).transfer(tx.origin, IERC20(_reserve).balanceOf(address(this)));
        }

        _moveTrove(tx.origin);
    }

    function _swapLUSDForCollateral(uint256 _LUSDAmount) internal returns (uint256) {
        uint256[] memory expectedAmountsOut = router.getAmountsOut(_LUSDAmount, lusdToCollateralSwapPath);

        uint256 expectedAmountOutMin =  expectedAmountsOut[expectedAmountsOut.length - 1];
        uint256[] memory amountsOut = router.swapExactTokensForTokens(
            _LUSDAmount,
            expectedAmountOutMin,
            lusdToCollateralSwapPath,
            address(this),
            block.timestamp
        );

        uint256 amountOut = amountsOut[amountsOut.length - 1];
        require(amountOut >= expectedAmountOutMin, "Leverage: Slippage while swap");

        return amountOut;
    }

    function _openTrove(
        address _reserve,
        LeverageAndTroveDetails memory troveDetails,
        uint256 _fee,
        uint256 _loanedAmount,
        address _collateralOwner
    ) internal returns (uint256) {
        // 1. Transfer the collateral fund from `tx.origin` to this address.
        IERC20(_reserve).transferFrom(_collateralOwner, address(this), troveDetails.collateralAmount);

        // 2. Note the balance of LUSD before opening a trove.
        uint256 lusdBalanceBefore = IERC20(lusdToCollateralSwapPath[0]).balanceOf(address(this));

        // 3. Open the trove.
        IBorrowerOperations(borrowerOperations).openTrove(
            troveDetails.maxFee, 
            troveDetails.lusdAmount.add(_fee), 
            troveDetails.collateralAmount.add(_loanedAmount), 
            troveDetails.upperHint, 
            troveDetails.lowerHint
        );

        // 4. Note the balance of LUSD after opening the trove.
        uint256 lusdBalanceAfter = IERC20(lusdToCollateralSwapPath[0]).balanceOf(address(this));

       // 5. Return the amount of LUSD minted.
       return lusdBalanceAfter.sub(lusdBalanceBefore);
    }

    function _moveTrove(
        address newOwner
    ) internal {
        troveManager.moveTrove(newOwner);
    }
}