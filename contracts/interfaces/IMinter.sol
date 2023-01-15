// SPDX-License-Identifier: LGPL-3.0
pragma solidity >=0.8.0 <0.9.0;

interface IMinter {
    function token() external view returns (address);

    function controller() external view returns (address);

    function minted(address user, address gauge) external view returns (uint256);

    function mint(address gombocAddress) external;
}
