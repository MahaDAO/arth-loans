// SPDX-License-Identifier: MIT
pragma solidity 0.8.0;

import {UpgradableProxy} from "./UpgradableProxy.sol";

contract PriceFeedProxy is UpgradableProxy {
    constructor(address _proxyTo) UpgradableProxy(_proxyTo) {}
}
