// SPDX-License-Identifier: LGPL-3.0

pragma solidity 0.8.17;

import "./interfaces/IOwnership.sol";

contract Ownership is IOwnership {
    address private _owner;
    address private _futureOwner;

    event CommitNewOwnership(address indexed futureOwner);
    event AcceptNewOwnership(address indexed owner);

    /**
     * @dev Initializes the contract setting the deployer as the initial owner.
     */
    constructor() {
        _owner = msg.sender;
        emit AcceptNewOwnership(msg.sender);
    }

    /**
     * @dev Returns the address of the current owner.
     */
    function owner() external view override returns (address) {
        return _owner;
    }

    function futureOwner() external view override returns (address) {
        return _futureOwner;
    }

    /**
     * @dev Throws if called by any account other than the owner.
     */
    modifier onlyOwner() {
        require(_owner == msg.sender, "Caller is not allowed to operate");
        _;
    }

    modifier onlyFutureOwner() {
        require(_futureOwner == msg.sender, "Caller is not allowed to operate");
        _;
    }

    /***
     *@notice Transfer ownership of GaugeController to `newOwner`
     *@param newOwner Address to have ownership transferred to
     */
    function commitTransferOwnership(address newOwner) external override onlyOwner {
        _futureOwner = newOwner;
        emit CommitNewOwnership(newOwner);
    }

    /***
     *@notice Accept a transfer of ownership
     */
    function acceptTransferOwnership() external override onlyFutureOwner {
        _owner = msg.sender;
        _futureOwner = address(0);
        emit AcceptNewOwnership(msg.sender);
    }
}
