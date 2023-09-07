// SPDX-License-Identifier: LGPL-3.0
pragma solidity 0.8.17;

import {IHOPE} from "../interfaces/IHOPE.sol";
import {IWBTC} from "../interfaces/IWBTC.sol";
import {IWETH} from "../interfaces/IWETH.sol";
import {IStETH} from "../interfaces/IStETH.sol";
import {IVault} from "../interfaces/IVault.sol";
import {TransferHelper} from "light-lib/contracts/TransferHelper.sol";
import {SafeCast} from "@openzeppelin/contracts/utils/math/SafeCast.sol";
import {SafeMath} from "@openzeppelin/contracts/utils/math/SafeMath.sol";
import {Ownable2Step} from "@openzeppelin/contracts/access/Ownable2Step.sol";
import {AccessControl} from "@openzeppelin/contracts/access/AccessControl.sol";
import {Pausable} from "@openzeppelin/contracts/security/Pausable.sol";

contract Vault is IVault, Ownable2Step, AccessControl, Pausable {
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

    /// @inheritdoc IVault
    function stakeETH() external payable override onlyGateway {
        require(msg.value > 0, "VA001");
        stETH.submit{value: msg.value}(address(0));
    }

    /// @inheritdoc IVault
    function deposit(address _user, uint256 _amount) external override onlyGateway whenNotPaused returns (uint256) {
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

    /// @inheritdoc IVault
    function withdraw(uint256 _amount) external override onlyGateway whenNotPaused returns (uint256) {
        require(_amount > 0, "VA001");
        uint256 fee = burnFeeRate > 0 ? (_amount * burnFeeRate) / FEE_RATE_FACTOR : 0;

        uint256 burnAmount = _amount - fee;
        totalMinted -= burnAmount;
        HOPE.burn(burnAmount);

        return burnAmount;
    }

    /// @inheritdoc IVault
    function claimableStETH() public view override returns (uint256) {
        uint256 totalStETH = stETH.balanceOf(address(this));
        (, uint256 totalETHReserve) = _calculateReserveAmount(totalMinted);
        uint256 claimableAmount = totalStETH - totalETHReserve;
        return claimableAmount;
    }

    /// @inheritdoc IVault
    function claimStETH(address _recipient) external override onlyRole(VAULT_MANAGER_ROLE) {
        uint256 claimableAmount = claimableStETH();
        require(claimableAmount > 0, "VA002");
        TransferHelper.doTransferOut(address(stETH), _recipient, claimableAmount);
    }

    /// @inheritdoc IVault
    function claimableHOPE() public view returns (uint256) {
        return HOPE.balanceOf(address(this));
    }

    /// @inheritdoc IVault
    function claimHOPE(address _recipient) external override onlyRole(VAULT_MANAGER_ROLE) {
        uint256 claimableAmount = claimableHOPE();
        require(claimableAmount > 0, "VA003");
        TransferHelper.doTransferOut(address(HOPE), _recipient, claimableAmount);
    }

    /// @inheritdoc IVault
    function rescueTokens(address _token, address _recipient, uint256 _amount) external override onlyRole(VAULT_MANAGER_ROLE) {
        require(_token != address(WBTC) && _token != address(stETH), "VA005");
        TransferHelper.doTransferOut(_token, _recipient, _amount);
    }

    /// @inheritdoc IVault
    function updateGateway(address _gateway) external override onlyOwner {
        address oldGateway = gateway;
        gateway = _gateway;
        emit UpdateGateway(oldGateway, gateway);
    }

    /// @inheritdoc IVault
    function updateMintFeeRate(uint256 _rate) external override onlyOwner {
        require(_rate >= 0 && _rate < 1e5, "VA004");
        uint256 oldMintFeeRate = mintFeeRate;
        mintFeeRate = _rate;
        emit UpdateMintFeeRate(oldMintFeeRate, mintFeeRate);
    }

    /// @inheritdoc IVault
    function updateBurnFeeRate(uint256 _rate) external override onlyOwner {
        require(_rate >= 0 && _rate < 1e5, "VA004");
        uint256 oldBurnFeeRate = burnFeeRate;
        burnFeeRate = _rate;
        emit UpdateBurnFeeRate(oldBurnFeeRate, burnFeeRate);
    }

    /// @inheritdoc IVault
    function safeTransferToken(address _token, address _to, uint256 _amount) public override onlyGateway {
        TransferHelper.doTransferOut(_token, _to, _amount);
    }

    /// @inheritdoc IVault
    function isVaultManager(address _manager) external view override returns (bool) {
        return hasRole(VAULT_MANAGER_ROLE, _manager);
    }

    /// @inheritdoc IVault
    function addVaultManager(address _manager) external override onlyOwner {
        _grantRole(VAULT_MANAGER_ROLE, _manager);
    }

    /// @inheritdoc IVault
    function removeVaultManager(address _manager) external override onlyOwner {
        _revokeRole(VAULT_MANAGER_ROLE, _manager);
    }

    /// @inheritdoc IVault
    function pause() external override onlyRole(VAULT_MANAGER_ROLE) {
        _pause();
    }

    /// @inheritdoc IVault
    function unpause() external override onlyRole(VAULT_MANAGER_ROLE) {
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
