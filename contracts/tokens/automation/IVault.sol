// SPDX-License-Identifier: LGPL-3.0
pragma solidity 0.8.17;

interface IVault {
    function stakeETH() external payable;

    function deposit(address _user, uint256 _amount) external returns (uint256);

    function withdraw(uint256 _amount) external returns (uint256);

    function safeTransferToken(address _token, address _to, uint256 _amount) external;
}
