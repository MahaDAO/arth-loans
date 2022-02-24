// SPDX-License-Identifier: MIT

pragma solidity 0.6.11;

import "../Dependencies/CheckContract.sol";
import "../Interfaces/IBorrowerOperations.sol";
import "../Dependencies/IUniswapV2Router02.sol";
import "../Dependencies/IUniswapV2Pair.sol";
import "../Dependencies/IERC20.sol";
import "../Dependencies/SafeMath.sol";
import "../Interfaces/IFlashLoan.sol";

contract FlashLoanLeverage is CheckContract {
    using SafeMath for uint256;

    address immutable arth;
    address immutable collateral;
    address[] public arthToCollateralPath;

    IFlashLoan public flashLoan;
    IUniswapV2Router02 public uniswapRouter;
    IBorrowerOperations public borrowerOperations;

    constructor(
        address _arth,
        address _collateral,
        address[] memory _arthToCollateralPath,
        IFlashLoan _flashLoan,
        IUniswapV2Router02 _uniswapRouter,
        IBorrowerOperations _borrowerOperations
    ) public {
        checkContract(_arth);
        checkContract(address(_uniswapRouter));
        checkContract(address(_flashLoan));
        checkContract(address(_borrowerOperations));

        arth = _arth;
        collateral = _collateral;
        arthToCollateralPath = _arthToCollateralPath;
        flashLoan = _flashLoan;
        uniswapRouter = _uniswapRouter;
        borrowerOperations = _borrowerOperations;
    }

    function onFlashLoan(
        address initiator,
        uint256 amount,
        uint256 fee,
        bytes calldata data
    ) external returns(bytes32) {
        require(msg.sender == address(flashLoan), "Untrusted lender");
    
        uint256 paybackAmount = amount.add(fee);

        (
            uint256 _maxFee,
            uint256 _LUSDAmount,
            uint256 _ETHAmount,
            address _upperHint,
            address _lowerHint,
            address _frontEndTag
        ) = abi.decode(
            data, 
            (uint256,uint256,uint256,address,address,address)
        );
        
        uint256 collateralOut = _swapARTHForToken(arthToCollateralPath, amount);

        IERC20(collateral).transferFrom(initiator, address(this), _ETHAmount.sub(collateralOut));
        IERC20(collateral).approve(address(borrowerOperations), _ETHAmount);

        // 3. Borrow ARTH.
        borrowerOperations.openTrove(
            _maxFee, 
            _LUSDAmount, 
            _ETHAmount, 
            _upperHint, 
            _lowerHint, 
            _frontEndTag
        );
        require(
            IERC20(arth).balanceOf(address(this)) >= paybackAmount,
            "Wrong payback amount"
        );
        IERC20(arth).approve(address(flashLoan), paybackAmount);

        return keccak256("FlashMinter.onFlashLoan");
    }

    function _swapARTHForToken(
        address[] memory path,
        uint256 _arthAmount
    ) internal returns (uint256) {
        IERC20(arth).approve(address(uniswapRouter), _arthAmount);

        uint256[] memory expectedAmountsOut = uniswapRouter.getAmountsOut(
            _arthAmount,
            path
        );

        uint256[] memory amountsOut = uniswapRouter.swapExactTokensForTokens(
            _arthAmount,
            expectedAmountsOut[expectedAmountsOut.length - 1],
            path,
            address(this),
            block.timestamp
        );

        return amountsOut[amountsOut.length - 1];
    }
}
