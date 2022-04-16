// SPDX-License-Identifier: MIT

pragma solidity 0.8.0;

import "./Interfaces/IOracle.sol";
import "./Dependencies/TransferableOwnable.sol";

contract GMUOracle is TransferableOwnable, IOracle {
    uint256 public price = 1e6;
    string constant public NAME = "GMU/USD Oracle";

    event PriceChange(uint256 timestamp, uint256 price);

    constructor(uint256 startingPrice) {
        price = startingPrice;
    }

    function getPrice() public view override returns (uint256) {
        return price;
    }

    function getDecimalPercision() public pure override returns (uint256) {
        return 6;
    }

    function setPrice(uint256 _price) public onlyOwner {
        require(_price >= 0, "Oracle: price cannot be < 0");
        price = _price;
        emit PriceChange(block.timestamp, _price);
    }
}
