// SPDX-License-Identifier: LGPL-3.0
pragma solidity 0.8.17;

interface IOwnership {
    function owner() external view returns (address);

    function futureOwner() external view returns (address);

    function commitTransferOwnership(address newOwner) external;

    function acceptTransferOwnership() external;
}
