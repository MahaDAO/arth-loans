// SPDX-License-Identifier: MIT

pragma solidity 0.8.0;

interface ISupplyValidator {
    function setDailyMintCap(uint256 newCap) external;
    
    function validateMintAndUpdate(uint256 amount) external;

    function updateBurntSupply(uint256 amount) external;
}
