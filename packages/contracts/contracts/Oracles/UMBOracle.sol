// SPDX-License-Identifier: MIT

pragma solidity 0.6.11;

import "../Dependencies/SafeMath.sol";

interface IUMBRegistry {
    function getAddressByString(string memory _name) external view returns (address);

    function getAddress(bytes32 _bytes) external view returns (address);
}

interface IUMBChain {
    function getCurrentValue(bytes32 _key) external view returns (uint256 value, uint256 timestamp);
}

contract UMBOracle {
    using SafeMath for uint256;

    string public NAME;
    IUMBRegistry public registry;
    bytes32 public key;

    // --- Contract setters ---
    constructor(
        string memory _name,
        address _umbRegistry,
        bytes32 _key
    ) public {
        NAME = _name;
        registry = IUMBRegistry(_umbRegistry);
        key = _key;
    }

    function getPrice() public view returns (uint256) {
        IUMBChain chain = IUMBChain(registry.getAddressByString("Chain"));
        (uint256 value, ) = chain.getCurrentValue(key);
        return value;
    }
}
