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
    bool private _allowMinting = true;

    // MAHA; the governance token used for charging stability fees
    IERC20 private _stabilityFeeToken;

    // Price feed.
    IPriceFeed private _priceFeed;

    uint256 private _maxDebtCeiling = uint256(-1); // infinity
    uint256 private _stabilityFee = 10000000000000000; // 1%

    event MaxDebtCeilingChanged(
        uint256 oldValue, 
        uint256 newValue, 
        uint256 timestamp
    );
    event PriceFeedChanged(
        address oldFeed, 
        address newFeed, 
        uint256 timestamp
    );
    event AllowMintingUpdated(
        bool oldFlag,
        bool newFlag,
        uint256 timestamp
    );
    event StaibilityFeeChanged(
        uint256 oldFee,
        uint256 newFee,
        uint256 timestamp
    );
    event StabilityTokenChanged(
        address oldToken,
        address newToken,
        uint256 timestamp
    );

    function setMaxDebtCeiling(uint256 _value) public onlyOwner {
        uint256 oldValue = _maxDebtCeiling;
        _maxDebtCeiling = _value;
        emit MaxDebtCeilingChanged(oldValue, _value, block.timestamp);
    }

    function setPriceFeed(address _feed) public onlyOwner {
        address oldFeed = address(_priceFeed);
        _priceFeed = IPriceFeed(_feed);
        emit PriceFeedChanged(oldFeed, _feed, block.timestamp);
    }

    function setAllowMinting(bool _value) public onlyOwner {
        bool oldFlag = _allowMinting;
        _allowMinting = _value;
        emit AllowMintingUpdated(oldFlag, _value, block.timestamp);
    }

    function setStabilityFee(uint256 _value) public onlyOwner {
        uint256 oldFee = _stabilityFee;
        _stabilityFee = _value;
        emit StaibilityFeeChanged(oldFee, _value, block.timestamp);
    }

    function setStabilityFeeToken(IERC20 token) public onlyOwner {
        address oldToken = address(_stabilityFeeToken);
        _stabilityFeeToken = token;
        emit StabilityTokenChanged(oldToken, address(token), block.timestamp);
    }

    function getMaxDebtCeiling() external view override returns (uint256) {
        return _maxDebtCeiling;
    }

    function getStabilityFee() external view override returns (uint256) {
        return _stabilityFee;
    }

    function getAllowMinting() external view override returns (bool) {
        return _allowMinting;
    }

    function getStabilityFeeToken() external view override returns (IERC20) {
        return _stabilityFeeToken;
    }

    function getPriceFeed() external view override returns (IPriceFeed) {
        return _priceFeed;
    }
}
