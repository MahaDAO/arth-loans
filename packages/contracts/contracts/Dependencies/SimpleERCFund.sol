// SPDX-License-Identifier: MIT

pragma solidity 0.6.11;

import {IERC20} from "./IERC20.sol";
import {ERC20} from "./ERC20.sol";
import {SafeERC20} from "./SafeERC20.sol";
import {Operator} from "./Operator.sol";
import {ISimpleERCFund} from "./ISimpleERCFund.sol";

contract SimpleERCFund is ISimpleERCFund, Operator {
    using SafeERC20 for ERC20;

    function deposit(
        address token,
        uint256 amount,
        string memory reason
    ) public override {
        // NOTE: this was IERC20 but due to compilation issues has been converted TO ERC20.
        ERC20(token).safeTransferFrom(_msgSender(), address(this), amount);
        emit Deposit(_msgSender(), block.timestamp, reason);
    }

    function withdraw(
        address token,
        uint256 amount,
        address to,
        string memory reason
    ) public override onlyOperator {
        // NOTE: this was IERC20 but due to compilation issues has been converted TO ERC20.
        ERC20(token).safeTransfer(to, amount);
        emit Withdrawal(_msgSender(), to, block.timestamp, reason);
    }

    event Deposit(address indexed from, uint256 indexed at, string reason);
    event Withdrawal(
        address indexed from,
        address indexed to,
        uint256 indexed at,
        string reason
    );
}