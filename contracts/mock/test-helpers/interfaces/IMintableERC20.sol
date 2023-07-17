// SPDX-License-Identifier: LGPL-3.0
pragma solidity 0.8.17;

interface IMintableERC20 {
    function mint(address account, uint256 value) external;
}
