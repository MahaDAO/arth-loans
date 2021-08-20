// SPDX-License-Identifier: MIT

pragma solidity 0.6.11;

import "./DSProxy.sol";

abstract contract DSProxyFactoryInterface {
    function build(address owner) public virtual returns (address payable proxy);
    function build() public virtual returns (address payable proxy);
}
