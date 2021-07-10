// SPDX-License-Identifier: MIT

pragma solidity 0.6.11;

import "./Interfaces/IGovernance.sol";
import "./Dependencies/Ownable.sol";

/*
 * The Default Pool holds the ETH and LUSD debt (but not LUSD tokens) from liquidations that have been redistributed
 * to active troves but not yet "applied", i.e. not yet recorded on a recipient active trove's struct.
 *
 * When a trove makes an operation that applies its pending ETH and LUSD debt, its pending ETH and LUSD debt is moved
 * from the Default Pool to the Active Pool.
 */
contract Governance is Ownable, IGovernance {
    string public constant NAME = "Governance";

    // Maximum amount of debt that this deployment can have (used to limit exposure to volatile assets)
    // set this according to how much ever debt we'd like to accumulate; default is infinity
    uint256 private maxDebtCeiling = uint256(-1);
    bool private allowMinting = true;
    IPriceFeed private priceFeed;

    function setMaxDebtCeiling(uint256 _value) public onlyOwner {
        maxDebtCeiling = _value;
    }

    function setPriceFeed(address _feed) public onlyOwner {
        priceFeed = IPriceFeed(_feed);
    }

    function setAllowMinting(bool _value) public onlyOwner {
        allowMinting = _value;
    }

    function getMaxDebtCeiling() external view override returns (uint256) {
        return maxDebtCeiling;
    }

    function getAllowMinting() external view override returns (bool) {
        return allowMinting;
    }

    function getPriceFeed() external view override returns (IPriceFeed) {
        return priceFeed;
    }
}
