// SPDX-License-Identifier: MIT

pragma solidity 0.6.11;

import "../Dependencies/IERC20.sol";

interface IMintableERC20 is IERC20 {
    function mint(address account, uint256 amount) external;
}

contract Faucet {
    IMintableERC20[] public tokens;

    constructor(IMintableERC20[] memory tokens_) public {
        tokens = tokens_;
    }

    function faucet() external {
       for (uint256 i = 0; i < tokens.length; i++) {
           uint256 decimals = tokens[i].decimals();
           tokens[i].mint(msg.sender, 10000 * (10 ** decimals));
       }
    }
}