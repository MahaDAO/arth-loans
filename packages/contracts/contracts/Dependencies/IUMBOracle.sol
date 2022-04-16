// SPDX-License-Identifier: MIT

pragma solidity 0.8.0;
pragma experimental ABIEncoderV2;

interface IUMBOracle {
    struct FirstClassData {
        uint224 value;
        uint32 dataTimestamp;
    }

    function fcds(bytes32 key) external view returns (FirstClassData memory);
}
