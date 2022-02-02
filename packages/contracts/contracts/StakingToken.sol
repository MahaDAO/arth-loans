// SPDX-License-Identifier: MIT

pragma solidity 0.6.11;

import { ERC20 } from "./Dependencies/ERC20.sol";
import { IStakingToken } from "./Interfaces/IStakingToken.sol";
import { TransferableOwnable } from "./Dependencies/TransferableOwnable.sol";

contract StakingToken is ERC20, TransferableOwnable, IStakingToken {
    address public underlyingStakingToken;

    constructor(
        string memory name_, 
        string memory symbol_, 
        address _underlyingStakingToken
    ) 
        ERC20(name_, symbol_) 
        public 
    {
        underlyingStakingToken = _underlyingStakingToken;
    }

    function mintOnStake(address recipient_, uint256 amount_)
        public
        onlyOwner
        override
        returns (bool)
    {
        uint256 balanceBefore = balanceOf(recipient_);
        _mint(recipient_, amount_);
        uint256 balanceAfter = balanceOf(recipient_);

        return balanceAfter > balanceBefore;
    }

    function burnOnWithdraw(address recipient_, uint256 amount_)
        public 
        onlyOwner
        override 
        returns (bool) 
    {
        uint256 balanceBefore = balanceOf(recipient_);
        _burn(recipient_, amount_);
        uint256 balanceAfter = balanceOf(recipient_);

        return balanceAfter < balanceBefore;
    }
}