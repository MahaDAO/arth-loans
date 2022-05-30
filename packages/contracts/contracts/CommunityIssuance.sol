// SPDX-License-Identifier: MIT

pragma solidity 0.8.0;

import "./Dependencies/IERC20.sol";
import "./Interfaces/ICommunityIssuance.sol";
import "./Dependencies/BaseMath.sol";
import "./Dependencies/LiquityMath.sol";
import "./Dependencies/Ownable.sol";
import "./Dependencies/CheckContract.sol";
import "./Dependencies/SafeMath.sol";


contract CommunityIssuance is ICommunityIssuance, Ownable, CheckContract, BaseMath {
    using SafeMath for uint;

    // --- Data ---

    string constant public NAME = "CommunityIssuance";

    uint256 public periodFinish = 0;
    uint256 public rewardRate = 0;
    uint256 public rewardsDuration;
    uint256 public lastUpdateTime;

    IERC20 public mahaToken;

    address public stabilityPoolAddress;

    uint256 public totalMAHAIssued;

    // --- Functions ---

    function setAddresses
    (
        address _mahaTokenAddress,
        address _stabilityPoolAddress,
        uint256 _rewardsDuration
    )
        external
        onlyOwner
        override
    {
        checkContract(_mahaTokenAddress);
        checkContract(_stabilityPoolAddress);

        mahaToken = IERC20(_mahaTokenAddress);
        stabilityPoolAddress = _stabilityPoolAddress;

        lastUpdateTime = block.timestamp;
        rewardsDuration = _rewardsDuration;
        periodFinish = block.timestamp.add(rewardsDuration);
        rewardRate = mahaToken.balanceOf(address(this)).div(rewardsDuration);

        emit MAHATokenAddressSet(_mahaTokenAddress);
        emit StabilityPoolAddressSet(_stabilityPoolAddress);
    }

    function lastTimeRewardApplicable() public view override returns (uint256) {
        return LiquityMath._min(block.timestamp, periodFinish);
    }

    function issueMAHA() external override returns (uint) {
        _requireCallerIsStabilityPool();
        
        uint issuance  = _getCumulativeIssuance();
        emit IssueMAHA(issuance);

        totalMAHAIssued += issuance;
        emit TotalMAHAIssuedUpdated(totalMAHAIssued);

        lastUpdateTime = block.timestamp;

        return issuance;
    }
    
    function notifyRewardAmount(uint256 reward)
        external
        override
        onlyOwner
    {
        if (block.timestamp >= periodFinish) {
            rewardRate = reward.div(rewardsDuration);
        } else {
            uint256 remaining = periodFinish.sub(block.timestamp);
            uint256 leftover = remaining.mul(rewardRate);
            rewardRate = reward.add(leftover).div(rewardsDuration);
        }

        // Ensure the provided reward amount is not more than the balance in the contract.
        // This keeps the reward rate in the right range, preventing overflows due to
        // very high values of rewardRate in the earned and rewardsPerToken functions;
        // Reward + leftover must be less than 2^256 / 10^18 to avoid overflow.
        uint256 balance = mahaToken.balanceOf(address(this));
        require(
            rewardRate <= balance.div(rewardsDuration),
            'Provided reward too high'
        );

        lastUpdateTime = block.timestamp;
        periodFinish = block.timestamp.add(rewardsDuration);
        emit RewardAdded(reward);
    }

    function _getCumulativeIssuance() internal view returns (uint) {
        uint256 rewards = rewardRate.mul(lastTimeRewardApplicable().sub(lastUpdateTime));

        return LiquityMath._min(rewards, mahaToken.balanceOf(address(this)));
    }

    function sendMAHA(address _account, uint _MAHAamount) external override {
        _requireCallerIsStabilityPool();
        mahaToken.transfer(_account, _MAHAamount);
    }

    // --- 'require' functions ---

    function _requireCallerIsStabilityPool() internal view {
        require(msg.sender == stabilityPoolAddress, "CommunityIssuance: caller is not SP");
    }
}
