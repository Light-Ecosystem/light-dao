// SPDX-License-Identifier: LGPL-3.0
pragma solidity 0.8.17;

import "./AbsConnectVault.sol";

contract ConnectVault is AbsConnectVault {
    function initialize(
        address _permit2Address,
        address _token,
        address _connect,
        address _withdrawAdmin,
        address _ownerAddress
    ) external initializer {
        _initialize(_permit2Address, _token, _connect, _withdrawAdmin, _ownerAddress);
    }
}
