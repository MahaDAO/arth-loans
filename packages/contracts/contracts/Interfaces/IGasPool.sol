// SPDX-License-Identifier: MIT

pragma solidity 0.6.11;

import "./IPool.sol";

interface IGasPool {
    // --- Events ---
   event ARTHAddressChanged(address _arthAddress);
   event TroveManagerAddressChanged(address _troveManagerAddress);
    
    // --- Functions ---
    function setAddresses(address _troveManagerAddress, address _arthTokenAddress) external;
    function returnFromPool(address _account, uint256 amount) external;
}
