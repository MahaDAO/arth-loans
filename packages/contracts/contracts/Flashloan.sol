// SPDX-License-Identifier: MIT

pragma solidity 0.6.11;

import "./Dependencies/SafeMath.sol";
import "./Dependencies/IERC20.sol";
import "./Dependencies/CheckContract.sol";
import "./Interfaces/ILiquityLUSDToken.sol";
import { IFlashLoanReceiver } from "./Interfaces/IFlashLoanReceiver.sol";

contract Flashloan is CheckContract {
    using SafeMath for uint256;

    ILiquityLUSDToken public arth;

    uint256 _flashLoanPremiumTotal = 9;

    event FlashLoan(
        address indexed target,
        address indexed initiator,
        uint256 amount,
        uint256 premium
    );

    struct FlashLoanLocalVars {
        IFlashLoanReceiver receiver;
        uint256 i;
        uint256 currentAmount;
        uint256 currentPremium;
        uint256 currentAmountPlusPremium;
    }

    constructor(address _arth) public {
        checkContract(_arth);

        arth = ILiquityLUSDToken(_arth);
    }

    function flashLoan(
        address receiverAddress,
        uint256 amount,
        bytes calldata params
    ) external {
        FlashLoanLocalVars memory vars;

        vars.receiver = IFlashLoanReceiver(receiverAddress);
        uint256 premium  = amount.mul(_flashLoanPremiumTotal).div(10000);

        arth.mint(receiverAddress, amount);

        require(
            vars.receiver.executeOperation(amount, premium, msg.sender, params),
            "Flashloan: INVALID_FLASH_LOAN_EXECUTOR_RETURN"
        );

        vars.currentAmount = amount;
        vars.currentPremium = premium;
        vars.currentAmountPlusPremium = vars.currentAmount.add(vars.currentPremium);

        arth.transferFrom(
            receiverAddress,
            address(this),
            vars.currentAmountPlusPremium
        );
        
        emit FlashLoan(
            receiverAddress,
            msg.sender,
            vars.currentAmount,
            vars.currentPremium
        );
    }
}