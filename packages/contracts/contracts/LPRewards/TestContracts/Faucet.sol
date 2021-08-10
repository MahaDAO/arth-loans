// SPDX-License-Identifier: MIT

pragma solidity 0.6.11;

import {ERC20Mock} from "./ERC20Mock.sol";

contract Faucet {
    ERC20Mock[] public tokens;

    constructor(ERC20Mock[] memory tokens_) public {
        tokens = tokens_;
    }

    function faucet() external {
        uint256 noOfTokens = tokens.length;
        for (uint256 i = 0; i < noOfTokens; i++) {
            ERC20Mock token = tokens[i];
            token.mint(msg.sender, 1e6 * (10 ** 18));
        }
    }
}