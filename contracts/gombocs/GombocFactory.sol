// SPDX-License-Identifier: LGPL-3.0

pragma solidity 0.8.17;

import "@openzeppelin/contracts/access/Ownable2Step.sol";
import "@openzeppelin/contracts/proxy/Clones.sol";
import "../interfaces/IPoolGomboc.sol";

contract GombocFactory is Ownable2Step {
    event PoolGombocCreated(address indexed lpAddr, address indexed poolGomboc, uint);

    address public immutable poolGombocImplementation;
    address public immutable ownership;
    address public immutable miner;
    address public immutable permit2;

    // lpToken => poolGomboc
    mapping(address => address) public getPool;
    address[] public allPools;

    constructor(address _poolGombocImplementation, address _minter, address _permit2Address, address _ownership) {
        require(_poolGombocImplementation != address(0), "GombocFactory: invalid poolGomboc address");
        require(_minter != address(0), "GombocFactory: invalid minter address");
        require(_permit2Address != address(0), "GombocFactory: invalid permit2 address");

        poolGombocImplementation = _poolGombocImplementation;
        ownership = _ownership;
        miner = _minter;
        permit2 = _permit2Address;
    }

    function createPool(address _lpAddr) external onlyOwner returns (address pool) {
        bytes32 salt = keccak256(abi.encodePacked(_lpAddr));
        pool = Clones.cloneDeterministic(poolGombocImplementation, salt);
        IPoolGomboc(pool).initialize(_lpAddr, miner, permit2, ownership);
        getPool[_lpAddr] = pool;
        allPools.push(pool);
        emit PoolGombocCreated(_lpAddr, pool, allPools.length);
    }

    function allPoolsLength() external view returns (uint) {
        return allPools.length;
    }
}
