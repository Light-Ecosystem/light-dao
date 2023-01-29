// SPDX-License-Identifier: LGPL-3.0
pragma solidity 0.8.17;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "../interfaces/IMinter.sol";

interface ILightGomboc {
    function depositRewardToken(address rewardToken, uint256 amount) external;

    function claimableTokens(address addr) external returns (uint256);
}

/**
 *  the contract which escrow stHOPE should inherit `AbsExternalLTReward`
 */
abstract contract AbsExternalLTRewardDistributor {
    address private constant _STHOPE_GOMBOC = address(0);
    address private constant _MINTER = address(0);
    address private constant _LTToken = address(0);

    address private gombocAddress;

    event RewardsDistributed(uint256 claimableTokens);

    function refreshGombocRewards() external {
        require(gombocAddress != address(0), "please set gombocAddress first");

        uint256 claimableTokens = ILightGomboc(_STHOPE_GOMBOC).claimableTokens(address(this));
        require(claimableTokens > 0, "Noting Token to Deposit");

        IMinter(_MINTER).mint(_STHOPE_GOMBOC);

        IERC20(_LTToken).approve(_STHOPE_GOMBOC, claimableTokens);
        ILightGomboc(gombocAddress).depositRewardToken(_LTToken, claimableTokens);

        emit RewardsDistributed(claimableTokens);
    }

    function _setGombocAddress(address _gombocAddress) internal {
        gombocAddress = _gombocAddress;
    }
}
