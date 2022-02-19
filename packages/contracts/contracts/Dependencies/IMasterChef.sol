// SPDX-License-Identifier: MIT

pragma solidity 0.6.11;

interface IMasterChef {
    function enterStaking(uint256 _amount) external;
    function leaveStaking(uint256 _amount) external;
    function deposit(uint256 _pid, uint256 _amount) external;
    function withdraw(uint256 _pid, uint256 _amount) external;
    function pendingCake(uint256 _pid, address _user) external view returns (uint256);
}
