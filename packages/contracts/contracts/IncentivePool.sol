// SPDX-License-Identifier: MIT

pragma solidity 0.8.0;

import "./Dependencies/TransferableOwnable.sol";
import { ITroveManager } from './Interfaces/ITroveManager.sol';
import { IIncentivePool } from './Interfaces/IIncentivePool.sol';
import {ReentrancyGuard} from "./Dependencies/ReentrancyGuard.sol";
import "./Dependencies/IERC20.sol";
import "./Dependencies/SafeMath.sol";
import "./Dependencies/LiquityMath.sol";

// Inheritance
abstract contract RewardsDistributorRecipient {
    address public rewardsDistributor;

    function notifyRewardAmount(uint256 reward) external virtual;

    modifier onlyRewardsDistributor() {
        require(msg.sender == rewardsDistributor, "Caller is not RewardsDistributor");
        _;
    }
}

 contract IncentivePool is TransferableOwnable, RewardsDistributorRecipient, ReentrancyGuard, IIncentivePool {
    using SafeMath for uint256;

    /* ========== STATE VARIABLES ========== */

    bool public skip;
    IERC20 public rewardsToken;
    ITroveManager troveManager;
    uint256 public periodFinish = 0;
    uint256 public rewardRate = 0;
    uint256 public rewardsDuration;
    uint256 public lastUpdateTime;
    uint256 public rewardPerTokenStored;

    mapping(address => uint256) public userRewardPerTokenPaid;
    mapping(address => uint256) public rewards;

    uint256 private _totalSupply;
    mapping(address => uint256) private _balances;

    /* ========== CONSTRUCTOR ========== */

    constructor(
        address _rewardsDistributor,
        address _rewardsToken,
        address _troveManager,
        uint256 _rewardsDuration,
        address _timelock
    ) {
        rewardsToken = IERC20(_rewardsToken);
        troveManager = ITroveManager(_troveManager);
        rewardsDistributor = _rewardsDistributor;
        rewardsDuration = _rewardsDuration;
        skip = false;

        transferOwnership(_timelock);
    }

    /* ========== VIEWS ========== */

    function totalSupply() external view returns (uint256) {
        return _totalSupply;
    }

    function balanceOf(address account) external view returns (uint256) {
        return _balances[account];
    }

    function lastTimeRewardApplicable() public view returns (uint256) {
        return LiquityMath._min(block.timestamp, periodFinish);
    }

    function rewardPerToken() public view returns (uint256) {
        if (_totalSupply == 0) {
            return rewardPerTokenStored;
        }
        return
            rewardPerTokenStored.add(
                lastTimeRewardApplicable().sub(lastUpdateTime).mul(rewardRate).mul(1e18).div(_totalSupply)
            );
    }

    function earned(address account) public view returns (uint256) {
        return _balances[account].mul(rewardPerToken().sub(userRewardPerTokenPaid[account])).div(1e18).add(rewards[account]);
    }


    function getRewardForDuration() external view returns (uint256) {
        return rewardRate.mul(rewardsDuration);
    }

    /* ========== MUTATIVE FUNCTIONS ========== */
    function toggleSkip() public onlyOwner  {
        skip = !skip;
    }

    function updateBalance(address _borrower) external override nonReentrant updateReward(_borrower) {
        if (skip) return;

        uint256 amount = troveManager.getTroveColl(_borrower);

        if (amount == _balances[_borrower]) return; // do nothing
        else if (amount > _balances[_borrower]) {
            // deposit
            _totalSupply = _totalSupply.add(amount);
            _balances[_borrower] = _balances[_borrower].add(amount);
            emit Staked(_borrower, amount);
        } else {
            // withdraw
            uint256 amountToWithdraw = _balances[_borrower].sub(amount);
            _totalSupply = _totalSupply.sub(amountToWithdraw);
            _balances[_borrower] = _balances[_borrower].sub(amountToWithdraw);
            emit Withdrawn(_borrower, amountToWithdraw);
        }
    }

    function getReward() public nonReentrant updateReward(msg.sender) {
        uint256 reward = rewards[msg.sender];
        if (reward > 0) {
            rewards[msg.sender] = 0;
            rewardsToken.transfer(msg.sender, reward);
            emit RewardPaid(msg.sender, reward);
        }
    }

    /* ========== RESTRICTED FUNCTIONS ========== */

    function notifyRewardAmount(uint256 reward) external override onlyRewardsDistributor updateReward(address(0)) {
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
        uint balance = rewardsToken.balanceOf(address(this));
        require(rewardRate <= balance.div(rewardsDuration), "Provided reward too high");

        lastUpdateTime = block.timestamp;
        periodFinish = block.timestamp.add(rewardsDuration);
        emit RewardAdded(reward);
    }

    /* ========== MODIFIERS ========== */

    modifier updateReward(address account) {
        rewardPerTokenStored = rewardPerToken();
        lastUpdateTime = lastTimeRewardApplicable();
        if (account != address(0)) {
            rewards[account] = earned(account);
            userRewardPerTokenPaid[account] = rewardPerTokenStored;
        }
        _;
    }

    /* ========== EVENTS ========== */

    event RewardAdded(uint256 reward);
    event Staked(address indexed user, uint256 amount);
    event Withdrawn(address indexed user, uint256 amount);
    event RewardPaid(address indexed user, uint256 reward);
}
