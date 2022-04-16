// SPDX-License-Identifier: MIT

pragma solidity 0.8.0;

import {IERC20} from "../Dependencies/IERC20.sol";
import {IAnyswapV4Token} from "../Dependencies/IAnyswapV4Token.sol";

interface ILUSDToken is IERC20, IAnyswapV4Token {
    // --- Events ---

    event TroveManagerAddressChanged(address _troveManagerAddress);
    event StabilityPoolAddressChanged(address _newStabilityPoolAddress);
    event BorrowerOperationsAddressChanged(address _newBorrowerOperationsAddress);

    event LUSDTokenBalanceUpdated(address _user, uint _amount);

    // --- Functions ---

    function mint(address _account, uint256 _amount) external;

    function burn(address _account, uint256 _amount) external;

    function sendToPool(address _sender,  address poolAddress, uint256 _amount) external;

    function returnFromPool(address poolAddress, address user, uint256 _amount ) external;
}
