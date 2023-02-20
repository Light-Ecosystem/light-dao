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

    function transferLTRewards(address to, uint256 amount) external whenNotPaused {
        require(msg.sender != connet, "forbidden");
        /// mint stHopeGomboc reward for this contract
        IMinter(minter).mint(token);
        /// transfer LT
        bool success = ERC20Upgradeable(ltToken).transfer(to, amount);
        require(success, "Transfer FAILED");

        emit RewardsDistributed(amount);
    }
}
