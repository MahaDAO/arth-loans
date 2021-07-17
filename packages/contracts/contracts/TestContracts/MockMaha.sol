// SPDX-License-Identifier: MIT

pragma solidity 0.6.11;

import "../MahaToken.sol";

contract MockMaha is MahaToken {
    function mint(address account, uint256 amount) external {
        _mint(account, amount);
    }
}