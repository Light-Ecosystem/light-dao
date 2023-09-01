// SPDX-License-Identifier: LGPL-3.0
pragma solidity 0.8.17;

import {IHOPE} from "../interfaces/IHOPE.sol";
import {IWBTC} from "../interfaces/IWBTC.sol";
import {IWETH} from "../interfaces/IWETH.sol";
import {IStETH} from "../interfaces/IStETH.sol";
import {TransferHelper} from "light-lib/contracts/TransferHelper.sol";
import {IERC20Metadata} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {SafeCast} from "@openzeppelin/contracts/utils/math/SafeCast.sol";
import {SafeMath} from "@openzeppelin/contracts/utils/math/SafeMath.sol";
import {Ownable2Step} from "@openzeppelin/contracts/access/Ownable2Step.sol";
import {AccessControl} from "@openzeppelin/contracts/access/AccessControl.sol";
import {Pausable} from "@openzeppelin/contracts/security/Pausable.sol";

contract Vault is Ownable2Step, AccessControl, Pausable {
    event UpdateGateway(address oldGateway, address newGateway);
    event UpdateStETHRatio(uint256 oldRatio, uint256 newRatio);
    event UpdateMintFeeRate(uint256 oldMintFeeRate, uint256 newMintFeeRate);
    event UpdateBurnFeeRate(uint256 oldBurnFeeRate, uint256 newBurnFeeRate);

    bytes32 public constant VAULT_MANAGER_ROLE = keccak256("VAULT_MANAGER_ROLE");
    uint256 public constant K = 10801805;
    uint256 public constant K_FACTOR = 1e12;
    uint256 public constant ETH_TO_BTC_RATIO = 10;
    uint256 public constant FEE_RATE_FACTOR = 1e6;

    IHOPE public immutable HOPE;
    IWBTC public immutable WBTC;
    IStETH public immutable stETH;

    uint256 public totalMinted;

    uint256 public mintFeeRate;
    uint256 public burnFeeRate;

    address public gateway;

    using SafeCast for uint256;
    using SafeCast for int256;
    using SafeMath for uint256;

    constructor(address _HOPE, address _WBTC, address _stETH) {
        HOPE = IHOPE(_HOPE);
        WBTC = IWBTC(_WBTC);
        stETH = IStETH(_stETH);
    }

    modifier onlyGateway() {
        require(msg.sender == gateway, "VA000");
        _;
    }

    /**
     * @dev Stake ETH into the Vault contract.
     * @notice Lido Liquid staked Ether 2.0. https://etherscan.io/address/0xae7ab96520DE3A18E5e111B5EaAb095312D7fE84
     */
    function stakeETH() public payable onlyGateway {
        require(msg.value > 0, "VA001");
        stETH.submit{value: msg.value}(address(0));
    }

    /**
     * @dev Deposit assets into the Vault contract.
     * @param _user The address to receive the minted HOPE tokens.
     * @param _amount The amount of assets to deposit.
     * @return The minted HOPE amount after deducting fees.
     */
    function deposit(address _user, uint256 _amount) external onlyGateway whenNotPaused returns (uint256) {
        require(_amount > 0, "VA001");
        totalMinted += _amount;

        uint256 fee;
        if (mintFeeRate > 0) {
            fee = (_amount * mintFeeRate) / FEE_RATE_FACTOR;
            HOPE.mint(address(this), fee);
        }

        uint256 mintAmount = _amount - fee;
        HOPE.mint(_user, mintAmount);

        return mintAmount;
    }

    /**
     * @dev Withdraw assets from the Vault contract.
     * @param _amount The amount of HOPE tokens to burn.
     * @return The burned HOPE amount after deducting fees.
     */
    function withdraw(uint256 _amount) external onlyGateway whenNotPaused returns (uint256) {
        require(_amount > 0, "VA001");
        uint256 fee = burnFeeRate > 0 ? (_amount * burnFeeRate) / FEE_RATE_FACTOR : 0;

        uint256 burnAmount = _amount - fee;
        totalMinted -= burnAmount;
        HOPE.burn(burnAmount);

        return burnAmount;
    }

    /**
     * @dev Calculate the claimable amount of stETH tokens.
     * @return The claimable amount of stETH tokens.
     */
    function claimableStETH() public view returns (uint256) {
        uint256 totalStETH = stETH.balanceOf(address(this));
        (, uint256 totalETHReserve) = _calculateReserveAmount(totalMinted);
        uint256 claimableAmount = totalStETH - totalETHReserve;
        return claimableAmount;
    }

    /**
     * @dev Claim stETH tokens and transfer to a specified address.
     * @param _address The address to receive the claimed stETH tokens.
     */
    function claimStETH(address _address) external onlyRole(VAULT_MANAGER_ROLE) {
        uint256 claimableAmount = claimableStETH();
        require(claimableAmount > 0, "VA002");
        TransferHelper.doTransferOut(address(stETH), _address, claimableAmount);
    }

    /**
     * @dev Calculate the claimable amount of HOPE tokens.
     * @return The claimable amount of HOPE tokens.
     */
    function claimableHOPE() public view returns (uint256) {
        return HOPE.balanceOf(address(this));
    }

    /**
     * @dev Claim HOPE tokens and transfer to a specified address.
     * @param _address The address to receive the claimed HOPE tokens.
     */
    function claimHOPE(address _address) external onlyRole(VAULT_MANAGER_ROLE) {
        uint256 claimableAmount = claimableHOPE();
        require(claimableAmount > 0, "VA003");
        TransferHelper.doTransferOut(address(HOPE), _address, claimableAmount);
    }

    /**
     * @dev Update the gateway address that can call certain functions.
     * @param _gateway The new gateway address.
     */
    function updateGateway(address _gateway) external onlyOwner {
        address oldGateway = gateway;
        gateway = _gateway;
        emit UpdateGateway(oldGateway, gateway);
    }

    /**
     * @dev Update the mint fee rate.
     * @param _rate The new mint fee rate.
     */
    function updateMintFeeRate(uint256 _rate) external onlyOwner {
        require(_rate >= 0 && _rate < 1e5, "VA004");
        uint256 oldMintFeeRate = mintFeeRate;
        mintFeeRate = _rate;
        emit UpdateMintFeeRate(oldMintFeeRate, mintFeeRate);
    }

    /**
     * @dev Update the burn fee rate.
     * @param _rate The new burn fee rate.
     */
    function updateBurnFeeRate(uint256 _rate) external onlyOwner {
        require(_rate >= 0 && _rate < 1e5, "VA004");
        uint256 oldBurnFeeRate = burnFeeRate;
        burnFeeRate = _rate;
        emit UpdateBurnFeeRate(oldBurnFeeRate, burnFeeRate);
    }

    /**
     * @dev Safe transfer tokens from the contract.
     * @param _token The address of the token to transfer.
     * @param _to The address to receive the tokens.
     * @param _amount The amount of tokens to transfer.
     */
    function safeTransferToken(address _token, address _to, uint256 _amount) public onlyGateway {
        TransferHelper.doTransferOut(_token, _to, _amount);
    }

    /**
     * @dev Check if an address has the Vault Manager role.
     * @param _manager The address to check.
     * @return Whether the address has the Vault Manager role.
     */
    function isVaultManager(address _manager) external view returns (bool) {
        return hasRole(VAULT_MANAGER_ROLE, _manager);
    }

    /**
     * @dev Add an address as a Vault Manager.
     * @param _manager The address to grant the Vault Manager role.
     */
    function addVaultManager(address _manager) external onlyOwner {
        _grantRole(VAULT_MANAGER_ROLE, _manager);
    }

    /**
     * @dev Remove an address from the Vault Manager role.
     * @param _manager The address to revoke the Vault Manager role from.
     */
    function removeVaultManager(address _manager) external onlyOwner {
        _revokeRole(VAULT_MANAGER_ROLE, _manager);
    }

    /**
     * @dev Pauses contract functionality.
     * @notice Only callable by addresses with the emergency manager role.
     */
    function pause() external onlyRole(VAULT_MANAGER_ROLE) {
        _pause();
    }

    /**
     * @dev Unpauses contract functionality.
     * @notice Only callable by addresses with the emergency manager role.
     */
    function unpause() external onlyRole(VAULT_MANAGER_ROLE) {
        _unpause();
    }

    /**
     * @dev Calculate the BTC and ETH reserve amounts based on HOPE amount
     * @param _hopeAmount HOPE amount
     * @return wbtcAmount BTC reserve amount
     * @return ethAmount ETH reserve amount
     */
    function _calculateReserveAmount(uint256 _hopeAmount) internal pure returns (uint256 wbtcAmount, uint256 ethAmount) {
        uint256 wbtcConversionFactor = 1e18 / 1e8;

        wbtcAmount = _hopeAmount.mul(K).div(K_FACTOR).div(wbtcConversionFactor);
        ethAmount = wbtcAmount.mul(wbtcConversionFactor).mul(ETH_TO_BTC_RATIO);
    }
}
