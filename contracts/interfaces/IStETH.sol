// SPDX-License-Identifier: LGPL-3.0
pragma solidity 0.8.17;

interface IStETH {
    function submit(address _referral) external payable returns (uint256);

    function balanceOf(address _account) external view returns (uint256);

    function getSharesByPooledEth(uint256 _ethAmount) external view returns (uint256);

    function getPooledEthByShares(uint256 _sharesAmount) external view returns (uint256);

    function getTotalShares() external view returns (uint256);

    function getTotalPooledEther() external view returns (uint256);
}
