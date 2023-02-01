// SPDX-License-Identifier: LGPL-3.0

pragma solidity 0.8.17;

import "./PoolGomboc.sol";

contract GombocFactory {
    event Deploy(address addr);

    address immutable miner;
    address immutable permit2;

    constructor(address _minter, address _permit2Address) {
        miner = _minter;
        permit2 = _permit2Address;
    }

    /***
     * @notice Returns the address of the newly deployed contract
     *         This syntax is a newer way to invoke create2 without assembly, you just need to pass salt
     *         https://docs.soliditylang.org/en/latest/control-structures.html#salted-contract-creations-create2
     *
     * @param
     * @return
     */
    function deploy(address _lpAddr, bytes32 _salt) public payable returns (address) {
        PoolGomboc poolGomboc = new PoolGomboc{salt: _salt}(_lpAddr, miner, permit2);
        address poolGombocAddress = address(poolGomboc);
        require(poolGombocAddress == getAddress(_lpAddr, _salt), "not equal");
        return poolGombocAddress;
    }

    function getAddress(address _lpAddr, bytes32 _salt) public view returns (address) {
        address poolGombocAddress = address(
            uint160(
                uint256(
                    keccak256(
                        abi.encodePacked(
                            bytes1(0xff),
                            address(this),
                            _salt,
                            keccak256(abi.encodePacked(type(PoolGomboc).creationCode, abi.encode(_lpAddr, miner, permit2)))
                        )
                    )
                )
            )
        );
        return poolGombocAddress;
    }

    /***
     * @notice Get bytecode of contract to be deployed
     *        _lpAddr is arguments of the PoolGomboc's constructor
     *
     * @param
     * @return
     */
    function getBytecode(address _lpAddr) public view returns (bytes memory) {
        bytes memory bytecode = type(PoolGomboc).creationCode;
        return abi.encodePacked(bytecode, abi.encode(_lpAddr, miner, permit2));
    }
}
