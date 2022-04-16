// SPDX-License-Identifier: MIT

pragma solidity 0.8.0;

import "../MahaToken.sol";

contract MockMaha is MahaToken {
    function mint(address account, uint256 amount) public override {
        _mint(account, amount);
    }
}
