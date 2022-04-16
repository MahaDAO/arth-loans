// SPDX-License-Identifier: MIT

pragma solidity 0.8.0;

import "../LiquityLUSDToken.sol";

contract LUSDTokenTester is LiquityLUSDToken {
    function unprotectedMint(address _account, uint256 _amount) external {
        // No check on caller here

        _mint(_account, _amount);
    }

    function unprotectedBurn(address _account, uint _amount) external {
        // No check on caller here

        _burn(_account, _amount);
    }
}
