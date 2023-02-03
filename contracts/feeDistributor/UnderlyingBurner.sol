// SPDX-License-Identifier: LGPL-3.0
pragma solidity >=0.8.0 <0.9.0;

import "@openzeppelin/contracts-upgradeable/access/Ownable2StepUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/security/PausableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/token/ERC20/IERC20Upgradeable.sol";
import {TransferHelper} from "light-lib/contracts/TransferHelper.sol";

interface IFeeDistributor {
    function burn(uint256 amount) external returns (bool);
}

contract UnderlyingBurner is Ownable2StepUpgradeable, PausableUpgradeable {
    event ToFeeDistributor(address indexed feeDistributor, uint256 amount);

    event RecoverBalance(address indexed token, address indexed emergencyReturn, uint256 amount);

    address public feeDistributor;
    address public gombocFeeDistributor;
    address public emergencyReturn;
    address public hopeToken;

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    /**
     * @notice Contract constructor
     * @param _hopeToken HOPE token address
     * @param _feeDistributor total feeDistributor address
     * @param _gombocFeeDistributor gomboc feeDistributor address
     * @param _emergencyReturn Address to transfer `_token` balance to if this contract is killed
     */
    function initialize(
        address _hopeToken,
        address _feeDistributor,
        address _gombocFeeDistributor,
        address _emergencyReturn
    ) external initializer {
        __Ownable2Step_init();

        hopeToken = _hopeToken;
        feeDistributor = _feeDistributor;
        gombocFeeDistributor = _gombocFeeDistributor;
        emergencyReturn = _emergencyReturn;

        IERC20Upgradeable(hopeToken).approve(feeDistributor, 2 ** 256 - 1);
        IERC20Upgradeable(hopeToken).approve(gombocFeeDistributor, 2 ** 256 - 1);
    }

    /**
     * @notice  transfer HOPE to the fee distributor and  gomboc fee distributor 50% each
     */
    function transferHopeToFeeDistributor() external whenNotPaused returns (uint256) {
        uint256 balance = IERC20Upgradeable(hopeToken).balanceOf(address(this));
        require(balance > 0, "insufficient balance");

        uint256 amount = balance / 2;

        IFeeDistributor(feeDistributor).burn(amount);
        IFeeDistributor(gombocFeeDistributor).burn(amount);

        emit ToFeeDistributor(feeDistributor, amount);
        emit ToFeeDistributor(gombocFeeDistributor, amount);
        return amount * 2;
    }

    /**
     * @notice Recover ERC20 tokens from this contract
     * @dev Tokens are sent to the emergency return address.
     * @return bool success
     */
    function recoverBalance(address token) external onlyOwner returns (bool) {
        uint256 amount = IERC20Upgradeable(token).balanceOf(address(this));
        TransferHelper.doTransferOut(token, emergencyReturn, amount);
        emit RecoverBalance(token, emergencyReturn, amount);
        return true;
    }

    /**
     * @notice Set the token emergency return address
     * @param _addr emergencyReturn address
     */
    function setEmergencyReturn(address _addr) external onlyOwner {
        emergencyReturn = _addr;
    }

    function pause() public onlyOwner {
        _pause();
    }

    function unpause() public onlyOwner {
        _unpause();
    }
}
