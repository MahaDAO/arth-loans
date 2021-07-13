// SPDX-License-Identifier: MIT

pragma solidity 0.6.11;

import {IERC20} from "./IERC20.sol";
import {IAnyswapV4Token} from "./IAnyswapV4Token.sol";

interface IARTH is IERC20, IAnyswapV4Token {
    function poolMint(address who, uint256 amount) external;

    function poolBurnFrom(address who, uint256 amount) external;

    function setArthController(address _controller) external;
}