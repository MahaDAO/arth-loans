// SPDX-License-Identifier: MIT

pragma solidity 0.6.11;

import "../Dependencies/CheckContract.sol";
import "../Interfaces/IBorrowerOperations.sol";
import "../Dependencies/IUniswapV2Router02.sol";
import "../Dependencies/IUniswapV2Pair.sol";
import "../Dependencies/IERC20.sol";
import "../Dependencies/SafeMath.sol";

contract SwappedLeverage is CheckContract {
    using SafeMath for uint256;

    address immutable arth;
    address immutable pair;
    address immutable token0;
    address immutable token1;
    address[] public arthToToken0Path;
    address[] public arthToToken1Path;

    IUniswapV2Router02 immutable uniswapRouter;
    IBorrowerOperations immutable borrowerOperations;

    constructor(
        address _pair,
        address _arth,
        address[] memory _arthToToken0Path,
        address[] memory _arthToToken1Path,
        IUniswapV2Router02 _uniswapRouter,
        IBorrowerOperations _borrowerOperations
    ) public {
        CheckContract(_arth);
        CheckContract(_pair);
        CheckContract(address(_uniswapRouter));
        checkContract(address(_borrowerOperations));

        arth = _arth;
        pair = _pair;
        token0 = IUniswapV2Pair(_pair).token0();
        token1 = IUniswapV2Pair(_pair).token1();
        arthToToken0Path = _arthToToken0Path;
        arthToToken1Path = _arthToToken1Path;
        uniswapRouter = _uniswapRouter;
        borrowerOperations = _borrowerOperations;
    }

    function openTrove(
        uint256 _maxFee,
        uint256 _LUSDAmount,
        uint256 _ETHAmount,
        address _upperHint,
        address _lowerHint,
        address _frontEndTag
    ) external payable {
        uint256 balanaceBefore = IERC20(arth).balanceOf(address(this));
        borrowerOperations.openTrove(_maxFee, _LUSDAmount, _ETHAmount, _upperHint, _lowerHint, _frontEndTag);
        uint256 balanceAfter = IERC20(arth).balanceOf(address(this));

        uint256 totalARTHToSwap = balanceAfter.sub(balanaceBefore);
        uint256 arthToSwapForToken0 = totalARTHToSwap.div(2);
        uint256 arthToSwapForToken1 = totalARTHToSwap.sub(arthToSwapForToken0);

        uint256 token0Out = _swapARTHForToken(token0, arthToToken0Path, arthToSwapForToken0);
        uint256 token1Out = _swapARTHForToken(token1, arthToToken1Path, arthToSwapForToken1);

        uint256 liquidityAdded = _addLiquidity(token0Out, token1Out);
        IERC20(pair).approve(address(borrowerOperations), liquidityAdded);
        borrowerOperations.addColl(liquidityAdded, _upperHint, _lowerHint);
    }

    function _swapARTHForToken(
        address _token,
        address[] memory path,
        uint256 _arthAmount
    ) internal returns (uint256) {
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

    function _addLiquidity(
        uint256 _token0Amount,
        uint256 _token1Amount
    ) internal returns (uint256) {
        IERC20(token0).approve(address(uniswapRouter), _token0Amount);
        IERC20(token1).approve(address(uniswapRouter), _token1Amount);

        (,, uint256 liquidity) = uniswapRouter.addLiquidity(
            token0,
            token1,
            _token0Amount,
            _token1Amount,
            _token0Amount,
            _token1Amount,
            address(this),
            block.timestamp
        );

        return liquidity;
    }
}
