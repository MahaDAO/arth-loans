// SPDX-License-Identifier: MIT

pragma solidity 0.6.11;

import "./Dependencies/Ownable.sol";
import "./Dependencies/CheckContract.sol";
import "./Interfaces/IGasPool.sol";
import "./Interfaces/IBurnableERC20.sol";

/**
 * The purpose of this contract is to hold LUSD tokens for gas compensation:
 * https://github.com/liquity/dev#gas-compensation
 * When a borrower opens a trove, an additional 50 LUSD debt is issued,
 * and 50 LUSD is minted and sent to this contract.
 * When a borrower closes their active trove, this gas compensation is refunded:
 * 50 LUSD is burned from the this contract's balance, and the corresponding
 * 50 LUSD debt on the trove is cancelled.
 * See this issue for more context: https://github.com/liquity/dev/issues/186
 */
contract GasPool is Ownable, CheckContract, IGasPool {
    string public constant NAME = "Gas pool";

    IBurnableERC20 public arthToken;

    address public troveManager;
    address public borrowerOperationsAddress;

    event ARTHAddressChanged(address _arthAddress);
    event TroveManagerAddressChanged(address _troveManagerAddress);
    event BorrowerOperationsAddressChanged(address _borrowerOperationsAddress);
    event ReturnToLiquidator(address indexed to, uint256 amount, uint256 timestamp);
    event ARTHBurnt(uint256 amount, uint256 timestamp);

    function setAddresses(
        address _troveManagerAddress,
        address _arthTokenAddress,
        address _borrowerOperationsAddress
    )
        external
        override
        onlyOwner
    {
        checkContract(_arthTokenAddress);
        checkContract(_troveManagerAddress);
        checkContract(_borrowerOperationsAddress);

        arthToken = IBurnableERC20(_arthTokenAddress);
        troveManager = _troveManagerAddress;
        borrowerOperationsAddress = _borrowerOperationsAddress;

        emit BorrowerOperationsAddressChanged(_borrowerOperationsAddress);
        emit ARTHAddressChanged(_arthTokenAddress);
        emit TroveManagerAddressChanged(_troveManagerAddress);

        _renounceOwnership();
    }

    function burnARTH(uint256 _amount) external override {
        _requireCallerIsTroveMOrBO();
        emit ARTHBurnt(_amount, block.timestamp);
        arthToken.burn(_amount);
    }

    function returnToLiquidator(address _account, uint256 amount) external override {
        _requireCallerIsTroveM();
        emit ReturnToLiquidator(_account, amount, block.timestamp);
        arthToken.transfer(_account, amount);
    }

    function _requireCallerIsTroveM() internal view {
        require(
            msg.sender == troveManager,
            "GasPool: Caller is not trove manager");
    }

    function _requireCallerIsTroveMOrBO() internal view {
        require(
            msg.sender == troveManager || msg.sender == borrowerOperationsAddress,
            "GasPool: Caller is not trove manager nor borrower operations");
    }
}
