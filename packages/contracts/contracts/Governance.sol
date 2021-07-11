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
    bool private allowMinting = true;

    // MAHA; the governance token used for charging stability fees
    IERC20 private stabilityFeeToken;

    // price feed
    IPriceFeed private priceFeed;

    uint256 private maxDebtCeiling = uint256(-1); // infinity
    uint256 private stabilityFee = 10000000000000000; // 1%

    function setMaxDebtCeiling(uint256 _value) public onlyOwner {
        maxDebtCeiling = _value;
        // TODO: add events
    }

    function setPriceFeed(address _feed) public onlyOwner {
        priceFeed = IPriceFeed(_feed);
        // TODO: add events
    }

    function setAllowMinting(bool _value) public onlyOwner {
        allowMinting = _value;
        // TODO: add events
    }

    function setStabilityFee(uint256 _value) public onlyOwner {
        stabilityFee = _value;
        // TODO: add events
    }

    function setStabilityFeeToken(uint256 _value) public onlyOwner {
        stabilityFee = _value;
        // TODO: add events
    }

    function getMaxDebtCeiling() external view override returns (uint256) {
        return maxDebtCeiling;
    }

    function getStabilityFee() external view override returns (uint256) {
        return stabilityFee;
    }

    function getAllowMinting() external view override returns (bool) {
        return allowMinting;
    }

    function getStabilityFeeToken() external view override returns (IERC20) {
        return stabilityFeeToken;
    }

    function getPriceFeed() external view override returns (IPriceFeed) {
        return priceFeed;
    }
}
