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
    address private _stHopeGomboc;
    address private _minter;
    address private _ltToken;
    address private _gombocAddress;

    /**
     * @dev Indicates that the contract has been initialized.
     */
    bool private _initialized;

    event RewardsDistributed(uint256 claimableTokens);

    function _init(address stHopeGomboc, address minter, address ltToken) internal {
        require(!_initialized, "Initializable: contract is already initialized");
        _initialized = true;
        _stHopeGomboc = stHopeGomboc;
        _minter = minter;
        _ltToken = ltToken;
    }

    function refreshGombocRewards() external {
        require(_gombocAddress != address(0), "please set gombocAddress first");

        uint256 claimableTokens = ILightGomboc(_stHopeGomboc).claimableTokens(address(this));
        require(claimableTokens > 0, "Noting Token to Deposit");

        IMinter(_minter).mint(_stHopeGomboc);

        IERC20(_ltToken).approve(_stHopeGomboc, claimableTokens);
        ILightGomboc(_gombocAddress).depositRewardToken(_ltToken, claimableTokens);

        emit RewardsDistributed(claimableTokens);
    }

    function _setGombocAddress(address gombocAddress) internal {
        _gombocAddress = gombocAddress;
    }
}
