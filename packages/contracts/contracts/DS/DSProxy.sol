// proxy.sol - execute actions atomically through the proxy's identity

// Copyright (C) 2017  DappHub, LLC

// This program is free software: you can redistribute it and/or modify
// it under the terms of the GNU General Public License as published by
// the Free Software Foundation, either version 3 of the License, or
// (at your option) any later version.

// This program is distributed in the hope that it will be useful,
// but WITHOUT ANY WARRANTY; without even the implied warranty of
// MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
// GNU General Public License for more details.

// You should have received a copy of the GNU General Public License
// along with this program.  If not, see <http://www.gnu.org/licenses/>.

pragma solidity >=0.5.0 <0.6.0;

import "./ILusd.sol";
import "./Ierc20.sol";
import "./DSAuth.sol";
import "./DSNote.sol";

// DSProxy
// Allows code execution using a persistant identity This can be very
// useful to execute a sequence of atomic actions. Since the owner of
// the proxy can be changed, this allows for dynamic ownership models
// i.e. a multisig
contract DSProxy is DSAuth, DSNote {
    DSProxyCache public cache;  // global cache for contracts
    DSProxyFactory public factory;
    ILusd public lusdToken;

    constructor(address _lusdToken, address _factory, address _cacheAddr) public {
        setCache(_cacheAddr);
        lusdToken = ILusd(_lusdToken);
        factory = DSProxyFactory(_factory);
    }

    function() external payable {}

    // // use the proxy to execute calldata _data on contract _code
    // function execute(bytes memory _code, bytes memory _data)
    //     public
    //     payable
    //     returns (address target, bytes memory response)
    // {
    //     target = cache.read(_code);
    //     if (target == address(0)) {
    //         // deploy contract & store its address in cache
    //         target = cache.write(_code);
    //     }

    //     response = execute(target, _data);
    // }

    function execute(
        address _target, 
        bytes memory _data,
        address collateral,
        uint256 leverageCollAmount
    )
        public
        auth
        note
        payable
        returns (bytes memory response)
    {
        require(_target != address(0), "ds-proxy-target-address-required");

        // TODO: from the DEX(1inch probably) we are using find out input amount of LUSD requird 
        // to be swapped to `leverageCollAmount` of collateral.
        uint256 amountARTHRequired = 0;

        // Mint the `amountARTHRequired` so that we get `leverageCollAmount` when ARTH is swapped.
        factory.mint(address(this), amountARTHRequired);

        // TODO: implement a swap from the DEX(1inch probably) we plan to use.
        uint256 collateralSwapped = 0;

        // Transfer the collateral swapped to msg.sender since we are using callDelegate while openTrove and hence
        // the funds while openTrove will be pulled from msg.sender and not the proxy.
        Ierc20(collateral).transfer(msg.sender, collateralSwapped);

        // call contract in current context
        assembly {
            let succeeded := delegatecall(sub(gas, 5000), _target, add(_data, 0x20), mload(_data), 0, 0)
            let size := returndatasize

            response := mload(0x40)
            mstore(0x40, add(response, and(add(add(size, 0x20), 0x1f), not(0x1f))))
            mstore(response, size)
            returndatacopy(add(response, 0x20), 0, size)

            switch iszero(succeeded)
            case 1 {
                // throw if delegatecall failed
                revert(add(response, 0x20), size)
            }
        }

        // Burn the amount of ARTH minted to swap for collateral and take leverage.
        // We should have `amountARTHRequired` in this proxy contract to burn the amount we had
        // artificially minted to simulate the leverage as we have opened a loan.
        lusdToken.burn(amountARTHRequired);
    }

    //set new cache
    function setCache(address _cacheAddr)
        public
        auth
        note
        returns (bool)
    {
        require(_cacheAddr != address(0), "ds-proxy-cache-address-required");
        cache = DSProxyCache(_cacheAddr);  // overwrite cache
        return true;
    }
}

// DSProxyFactory
// This factory deploys new proxy instances through build()
// Deployed proxy addresses are logged
contract DSProxyFactory {
    event Created(address indexed sender, address indexed owner, address proxy, address cache);
    mapping(address=>bool) public isProxy;
    DSProxyCache public cache;
    ILusd public lusdToken;

    modifier onlyProxy() {
        require(isProxy[msg.sender], 'Tx: not a proxy, hence unable to mint');
        _;
    }

    constructor(address _lusdToken) public {
        lusdToken = ILusd(_lusdToken);
        cache = new DSProxyCache();
    }

    function mint(address who, uint256 amount) public onlyProxy {
        lusdToken.poolMint(who, amount);
    }

    // deploys a new proxy instance
    // sets owner of proxy to caller
    function build() public returns (address payable proxy) {
        proxy = build(msg.sender);
    }

    // deploys a new proxy instance
    // sets custom owner of proxy
    function build(address owner) public returns (address payable proxy) {
        proxy = address(new DSProxy(address(lusdToken), address(this), address(cache)));
        emit Created(msg.sender, owner, address(proxy), address(cache));
        DSProxy(proxy).setOwner(owner);
        isProxy[proxy] = true;
    }
}

// DSProxyCache
// This global cache stores addresses of contracts previously deployed
// by a proxy. This saves gas from repeat deployment of the same
// contracts and eliminates blockchain bloat.

// By default, all proxies deployed from the same factory store
// contracts in the same cache. The cache a proxy instance uses can be
// changed.  The cache uses the sha3 hash of a contract's bytecode to
// lookup the address
contract DSProxyCache {
    mapping(bytes32 => address) cache;

    function read(bytes memory _code) public view returns (address) {
        bytes32 hash = keccak256(_code);
        return cache[hash];
    }

    function write(bytes memory _code) public returns (address target) {
        assembly {
            target := create(0, add(_code, 0x20), mload(_code))
            switch iszero(extcodesize(target))
            case 1 {
                // throw if contract failed to deploy
                revert(0, 0)
            }
        }
        bytes32 hash = keccak256(_code);
        cache[hash] = target;
    }
}
