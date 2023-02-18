// SPDX-License-Identifier: LGPL-3.0
pragma solidity 0.8.17;

import "@openzeppelin/contracts-upgradeable/security/PausableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/access/Ownable2StepUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/token/ERC20/ERC20Upgradeable.sol";
import "../interfaces/IMinter.sol";
import {TransferHelper} from "light-lib/contracts/TransferHelper.sol";
import "./AbsConnetVault.sol";

interface IStHope {
    function claimableTokens(address addr) external returns (uint256);
}

contract ConnetVaultOfStHOPE is Ownable2StepUpgradeable, PausableUpgradeable, ERC20Upgradeable, AbsConnetVault {
    address public minter;
    address private ltToken;

    function initialize(
        address _permit2Address,
        address _token,
        address _connnet,
        address _withdrawAdmin,
        address _ownerAddress,
        address _minter,
        address _ltToken
    ) external initializer {
        minter = _minter;
        ltToken = _ltToken;
        _initialize(_permit2Address, _token, _connnet, _withdrawAdmin, _ownerAddress);
    }

    function refreshGombocRewards() external whenNotPaused {
        /// update cliamable LT of stHOPE rewards
        uint256 claimableTokens = IStHope(token).claimableTokens(address(this));
        require(claimableTokens > 0, "No claimable LT Token");
        /// mint LT token for this contract
        IMinter(minter).mint(token);
        /// approve connet and deposit LT Token to connet
        bool success = ERC20Upgradeable(ltToken).approve(connet, claimableTokens);
        require(success, "APPROVE FAILED");
        IConnet(connet).depositRewardToken(claimableTokens);

        emit RewardsDistributed(claimableTokens);
    }
}
