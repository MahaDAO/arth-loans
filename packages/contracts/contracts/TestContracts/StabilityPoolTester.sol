// SPDX-License-Identifier: MIT

pragma solidity 0.8.0;

import "../StabilityPool.sol";

contract StabilityPoolTester is StabilityPool {
        using SafeMath for uint256;

    function unprotectedPayable() external payable {
        ETH = ETH.add(msg.value);
    }
}
