// SPDX-License-Identifier: LGPL-3.0

pragma solidity >=0.8.0 <0.9.0;

contract MockSwap {
    function getHOPEPrice() public view returns (uint256) {
        return 1;
    }

    function getStHOPEPrice() public view returns (uint256) {
        return 1;
    }

    function getLTPrice() public view returns (uint256) {
        return 2;
    }
}
