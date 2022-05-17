// SPDX-License-Identifier: MIT

pragma solidity 0.8.0;

import "../Interfaces/IARTHValuecoin.sol";

contract LUSDTokenCaller {
    IARTHValuecoin LUSD;

    function setLUSD(IARTHValuecoin _LUSD) external {
        LUSD = _LUSD;
    }

    function lusdMint(address _account, uint256 _amount) external {
        LUSD.mint(_account, _amount);
    }

    function lusdBurn(address _account, uint256 _amount) external {
        LUSD.burn(_account, _amount);(_account, _amount);
    }

    function lusdSendToPool(
        address _sender,
        address _poolAddress,
        uint256 _amount
    ) external {
        LUSD.sendToPool(_sender, _poolAddress, _amount);
    }

    function lusdReturnFromPool(address _poolAddress, address _receiver, uint256 _amount ) external {
        LUSD.returnFromPool(_poolAddress, _receiver, _amount);
    }
}
