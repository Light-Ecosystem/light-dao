// SPDX-License-Identifier: LGPL-3.0
pragma solidity 0.8.17;

import "./AbsConnetVault.sol";

contract ConnetVault is AbsConnetVault {
    function initialize(
        address _permit2Address,
        address _token,
        address _connnet,
        address _withdrawAdmin,
        address _ownerAddress
    ) external initializer {
        _initialize(_permit2Address, _token, _connnet, _withdrawAdmin, _ownerAddress);
    }
}
