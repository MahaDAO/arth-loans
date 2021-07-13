// SPDX-License-Identifier: MIT

pragma solidity 0.6.11;

import "./IPool.sol";

interface IGasPool {
    // --- Events ---
    event ARTHAddressChanged(address _arthAddress);
    event TroveManagerAddressChanged(address _troveManagerAddress);
    event ReturnToLiquidator(address indexed to, uint256 amount, uint256 timestamp);

    // --- Functions ---
    function setAddresses(address _troveManagerAddress, address _arthTokenAddress) external;
    function returnToLiquidator(address _account, uint256 amount) external;
    function burnARTH(uint256 _amount) external;
}
