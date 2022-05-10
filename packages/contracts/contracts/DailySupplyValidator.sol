// SPDX-License-Identifier: MIT

pragma solidity 0.8.0;

import "./Interfaces/ILiquityLUSDToken.sol";
import "./Dependencies/SafeMath.sol";
import "./Dependencies/CheckContract.sol";
import "./Interfaces/ISupplyValidator.sol";
import "./Dependencies/TransferableOwnable.sol";

contract DailySupplyValidator is ISupplyValidator, CheckContract, TransferableOwnable {
    using SafeMath for uint256;

    uint256 public dailyMintCap;
    uint256 public supplyMintedToday;
    uint256 public currentDayTimestamp;

    address public lusdToken;

    event SupplyMintedTodayReset(uint256 timestamp);
    event DailyMintCapChanged(uint256 oldValue, uint256 newValue, uint256 timestamp);
    event CurrentDayTimestampUpdated(uint256 oldValue, uint256 newValue, uint256 timestamp);

    constructor(uint256 _dailyMintCap, uint256 _supplyMintedToday, address _lusdToken) {
        lusdToken = _lusdToken;
        dailyMintCap = _dailyMintCap;
        supplyMintedToday = _supplyMintedToday;

        _updateCurrentDayTimestamp();
    }

    function setDailyMintCap(uint256 newCap) external onlyOwner override {
        uint256 oldValue = dailyMintCap;
        dailyMintCap = newCap;
        emit DailyMintCapChanged(oldValue, newCap, block.timestamp);
    }

    function validateMintAndUpdate(uint256 amount) external override {
        require(amount > 0, "Amount == 0");
        require(msg.sender == lusdToken, "Unauthorized");
        require(block.timestamp >= currentDayTimestamp, "Invalid time");

        if (block.timestamp.sub(currentDayTimestamp) < 86400) {
            _requireNewDailySupplyBelowCap(amount);
        } else {
            _updateCurrentDayTimestamp();
            _resetSupplyMintedToday();
        }

        supplyMintedToday = supplyMintedToday.add(amount);
    }

    function updateBurntSupply(uint256 amount) external override {
        require(amount > 0, "Amount == 0");
        require(msg.sender == lusdToken, "Unauthorized");
        require(block.timestamp >= currentDayTimestamp, "Invalid time");

        if (block.timestamp.sub(currentDayTimestamp) < 86400) {
            supplyMintedToday = supplyMintedToday.sub(amount);
        } else {
           _updateCurrentDayTimestamp();
           _resetSupplyMintedToday();
        }
    }

    function _requireNewDailySupplyBelowCap(uint256 newAmount) internal view {
        uint256 newSupply = supplyMintedToday.add(newAmount);
        require(
            newSupply < dailyMintCap,
            "Daily mint cap passed"
        );
    }

    function _updateCurrentDayTimestamp() internal {
        uint256 oldValue = currentDayTimestamp;
        currentDayTimestamp = (block.timestamp / 86400) * 86400;
        emit CurrentDayTimestampUpdated(oldValue, currentDayTimestamp, block.timestamp);
    }

    function _resetSupplyMintedToday() internal {
        uint256 oldValue = supplyMintedToday;
        supplyMintedToday = 0;
        emit SupplyMintedTodayReset(block.timestamp);
    }
}
