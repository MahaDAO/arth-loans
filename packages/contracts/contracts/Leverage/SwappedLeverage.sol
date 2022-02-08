// SPDX-License-Identifier: MIT

pragma solidity 0.6.11;

import "../Dependencies/CheckContract.sol";
import "../Interfaces/IBorrowerOperations.sol";
import "../Dependencies/IUniswapV2Router02.sol";
import "../Dependencies/IUniswapV2Pair.sol";
import "../Dependencies/IERC20.sol";
import "../Dependencies/SafeMath.sol";
import "../Interfaces/ITroveManager.sol";
import "../Interfaces/IPriceFeed.sol";

contract SwappedLeverage is CheckContract {
    using SafeMath for uint256;

    address immutable arth;
    address immutable pair;
    address immutable token0;
    address immutable token1;
    address[] public arthToToken0Path;
    address[] public arthToToken1Path;
    uint256 public MCR = 1100000000000000000; // 110%

    ITroveManager immutable troveManager;
    IUniswapV2Router02 immutable uniswapRouter;
    IBorrowerOperations immutable borrowerOperations;

    constructor(
        address _pair,
        address _arth,
        address[] memory _arthToToken0Path,
        address[] memory _arthToToken1Path,
        IUniswapV2Router02 _uniswapRouter,
        ITroveManager _troveManager,
        IBorrowerOperations _borrowerOperations
    ) public {
        CheckContract(_arth);
        CheckContract(_pair);
        checkContract(address(_troveManager));
        CheckContract(address(_uniswapRouter));
        checkContract(address(_borrowerOperations));

        arth = _arth;
        pair = _pair;
        token0 = IUniswapV2Pair(_pair).token0();
        token1 = IUniswapV2Pair(_pair).token1();
        arthToToken0Path = _arthToToken0Path;
        arthToToken1Path = _arthToToken1Path;
        uniswapRouter = _uniswapRouter;
        troveManager = _troveManager;
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
        // 1. Open trove and figure out how much ARTH you've got.
        uint256 balanaceBefore = IERC20(arth).balanceOf(address(this));
        borrowerOperations.openTrove(
            _maxFee, 
            _LUSDAmount,
            _ETHAmount,
            _upperHint,
            _lowerHint, 
            _frontEndTag
        );
        uint256 balanceAfter = IERC20(arth).balanceOf(address(this));

        // 2. Figure out the amount of ARTH to swap for tokens of the pair.
        uint256 totalARTHToSwap = balanceAfter.sub(balanaceBefore);
        uint256 arthToSwapForToken0 = totalARTHToSwap.div(2);
        uint256 arthToSwapForToken1 = totalARTHToSwap.sub(arthToSwapForToken0);

        // 3. Swap the ARTH for tokens of the pair.
        IERC20(arth).approve(address(uniswapRouter), totalARTHToSwap);
        uint256 token0Out = _swapARTHForToken(arthToToken0Path, arthToSwapForToken0);
        uint256 token1Out = _swapARTHForToken(arthToToken1Path, arthToSwapForToken1);

        // 4. Add liquidity to get the LP token and add that as collateral.
        uint256 liquidityAdded = _addLiquidity(token0Out, token1Out);
        IERC20(pair).approve(address(borrowerOperations), liquidityAdded);
        borrowerOperations.addColl(liquidityAdded, _upperHint, _lowerHint);

        _withdrawAndAddColl(_upperHint, _lowerHint);
        _withdrawAndAddColl(_upperHint, _lowerHint);
    }

    function _withdrawAndAddColl(address _upperHint, address _lowerHint) internal {
        // 1.Check that system is not in recover mode, as in recover mode 
        // only debt increase is not acceptable.
        _requireSystemNotInRecoveryMode();

        // 2. Figure out the amount that is withdrawable.
        uint256 withdrawableARTH = _calcWithdrawableARTH();
        uint256 balanaceBefore = IERC20(arth).balanceOf(address(this));
        borrowerOperations.withdrawColl(withdrawableARTH, _upperHint, _lowerHint);
        uint256 balanceAfter = IERC20(arth).balanceOf(address(this));

        // 3. Figure out the amount of ARTH to swap for tokens of the pair.
        uint256 totalARTHToSwap = balanceAfter.sub(balanaceBefore);
        uint256 arthToSwapForToken0 = totalARTHToSwap.div(2);
        uint256 arthToSwapForToken1 = totalARTHToSwap.sub(arthToSwapForToken0);
        IERC20(arth).approve(address(uniswapRouter), totalARTHToSwap);

        uint256 token0Out = _swapARTHForToken(arthToToken0Path, arthToSwapForToken0);
        uint256 token1Out = _swapARTHForToken(arthToToken1Path, arthToSwapForToken1);

        // 8. Add liquidity to get the LP token and add that as collateral.
        uint256 liquidityAdded = _addLiquidity(token0Out, token1Out);
        IERC20(pair).approve(address(borrowerOperations), liquidityAdded);
        borrowerOperations.addColl(liquidityAdded, _upperHint, _lowerHint);
    }

    function _swapARTHForToken(
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

    function _fetchPrice() internal returns (uint256) {
        IPriceFeed priceFeed = ILiquityBase(address(borrowerOperations)).getPriceFeed();
        return priceFeed.fetchPrice();
    }

    function _calcWithdrawableARTH() internal returns (uint256) {
        uint256 price = _fetchPrice();        
        (uint256 debt, uint256 coll, ,) = troveManager.getEntireDebtAndColl(address(this));

        uint256 acceptableTotalDebt = coll.mul(price).div(MCR);
        require(acceptableTotalDebt > debt, 'Maximum debt already reached');

        return acceptableTotalDebt.sub(debt);
    }

    function _requireSystemNotInRecoveryMode() internal {
        uint256 price = _fetchPrice();
        require(
            !troveManager.checkRecoveryMode(price), 
            "System in recovery mode"
        );
    }
}
