// SPDX-License-Identifier: MIT

pragma solidity 0.6.11;
pragma experimental ABIEncoderV2;

interface IUMBRegistry {
    function getAddress(bytes32 name) external view returns (address);

    function getAddressByString(string memory name) external view returns (address);
}
