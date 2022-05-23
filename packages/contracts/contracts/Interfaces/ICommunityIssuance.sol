// SPDX-License-Identifier: MIT

pragma solidity 0.8.0;

interface ICommunityIssuance {
    // --- Events ---

    event MAHATokenAddressSet(address _mahaTokenAddress);
    event StabilityPoolAddressSet(address _stabilityPoolAddress);
    event TotalMAHAIssuedUpdated(uint256 _totalMAHAIssued);

    // --- Functions ---

    function setAddresses(address _mahaTokenAddress, address _stabilityPoolAddress) external;

    function issueMAHA() external returns (uint256);

    function sendMAHA(address _account, uint256 _MAHAamount) external;
}
