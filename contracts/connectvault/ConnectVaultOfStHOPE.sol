// SPDX-License-Identifier: LGPL-3.0
pragma solidity 0.8.17;

import "@openzeppelin/contracts-upgradeable/security/PausableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/access/Ownable2StepUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/token/ERC20/ERC20Upgradeable.sol";
import "../interfaces/IMinter.sol";
import {TransferHelper} from "light-lib/contracts/TransferHelper.sol";
import "./AbsConnectVault.sol";

contract ConnectVaultOfStHOPE is Ownable2StepUpgradeable, PausableUpgradeable, ERC20Upgradeable, AbsConnectVault {
    event RewardsDistributed(address distributer, address to, uint256 amount);

    address public minter;
    address private ltToken;

    function initialize(
        address _permit2Address,
        address _token,
        address _connect,
        address _withdrawAdmin,
        address _ownerAddress,
        address _minter,
        address _ltToken
    ) external initializer {
        require(_minter != address(0), "CE000");
        require(_ltToken != address(0), "CE000");
        minter = _minter;
        ltToken = _ltToken;
        _initialize(_permit2Address, _token, _connect, _withdrawAdmin, _ownerAddress);
    }

    function transferLTRewards(address to, uint256 amount) external whenNotPaused returns (bool) {
        require(msg.sender == connect, "forbidden");
        /// mint stHopeGomboc reward for this contract
        IMinter(minter).mint(token);
        /// transfer LT
        bool success = ERC20Upgradeable(ltToken).transfer(to, amount);
        require(success, "Transfer FAILED");

        emit RewardsDistributed(msg.sender, to, amount);

        return true;
    }
}
