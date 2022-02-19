// SPDX-License-Identifier: MIT

pragma solidity 0.6.11;

import { ERC20, IERC20 } from "./Dependencies/ERC20.sol";
import { IMasterChef } from "./Dependencies/IMasterChef.sol";
import { IStakingToken } from "./Interfaces/IStakingToken.sol";

contract StakingToken is ERC20, IStakingToken {
    uint256 public poolId;
    string public CONTRACT_NAME;

    IERC20 public token;
    IERC20 public reward;
    IMasterChef public pool;

    constructor(
        uint256 poolId_,
        string memory name_, 
        string memory symbol_,
        string memory CONTRACT_NAME_,
        IERC20 token_,
        IERC20 reward_,
        IMasterChef pool_
    )
        ERC20(name_, symbol_) 
        public 
    {
        poolId = poolId_;
        CONTRACT_NAME = CONTRACT_NAME_;

        pool = pool_;
        token = token_;
        reward = reward_;
        
    }

    function deposit(uint256 _amount) external override {
        require(_amount > 0, "Staking: amount is 0");

        token.transferFrom(msg.sender, address(this), _amount);
        token.approve(address(pool), _amount);

        uint256 balanceBefore = reward.balanceOf(address(this));
        if (poolId == 0) {
            pool.enterStaking(_amount);
        } else {
            pool.deposit(poolId, _amount);
        }
        uint256 balanceAfter = reward.balanceOf(address(this));
        uint256 rewardAmount = balanceAfter.sub(balanceBefore);

        if (rewardAmount > 0) reward.transfer(msg.sender, rewardAmount);
        _mint(msg.sender, _amount);
    }

    function withdraw(uint256 _amount) external override {
        require(_amount <= balanceOf(msg.sender), "Staking: amount > balance");

        uint256 balanceBefore = reward.balanceOf(address(this));
        if (poolId == 0) {
            pool.leaveStaking(_amount);
        } else {
            pool.withdraw(poolId, _amount);
        }
        uint256 balanceAfter = reward.balanceOf(address(this));
        uint256 rewardAmount = balanceAfter.sub(balanceBefore);

        token.transfer(msg.sender, _amount);
        if (rewardAmount > 0) reward.transfer(msg.sender, rewardAmount);
        _burn(msg.sender, _amount);
    }
}