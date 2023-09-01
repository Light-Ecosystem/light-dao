// SPDX-License-Identifier: LGPL-3.0
pragma solidity 0.8.17;

interface IStETH {
    function submit(address _referral) external payable returns (uint256);

    function balanceOf(address _account) external view returns (uint256);
}
