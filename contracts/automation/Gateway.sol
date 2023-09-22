// SPDX-License-Identifier: LGPL-3.0
pragma solidity 0.8.17;

import {IHOPE} from "../interfaces/IHOPE.sol";
import {IVault} from "../interfaces/IVault.sol";
import {IWBTC} from "../interfaces/IWBTC.sol";
import {IWETH} from "../interfaces/IWETH.sol";
import {IStETH} from "../interfaces/IStETH.sol";
import {IERC20WithPermit} from "../interfaces/IERC20WithPermit.sol";
import {IGateway} from "../interfaces/IGateway.sol";
import {UniversalERC20} from "./UniversalERC20.sol";
import {TransferHelper} from "light-lib/contracts/TransferHelper.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {SafeMath} from "@openzeppelin/contracts/utils/math/SafeMath.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import {Ownable2Step} from "@openzeppelin/contracts/access/Ownable2Step.sol";
import {AccessControl} from "@openzeppelin/contracts/access/AccessControl.sol";
import {Pausable} from "@openzeppelin/contracts/security/Pausable.sol";

contract Gateway is IGateway, Ownable2Step, AccessControl, Pausable, ReentrancyGuard {
    bytes32 public constant VAULT_MANAGER_ROLE = keccak256("VAULT_MANAGER_ROLE");
    bytes32 public constant EMERGENCY_MANAGER_ROLE = keccak256("EMERGENCY_MANAGER_ROLE");
    uint256 public constant K = 10801805;
    uint256 public constant K_FACTOR = 1e12;
    uint256 public constant ETH_TO_BTC_RATIO = 10;
    address public constant ETH_MOCK_ADDRESS = 0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE;

    IHOPE public immutable HOPE;
    IWBTC public immutable WBTC;
    IWETH public immutable WETH;
    IStETH public immutable stETH;

    IVault public immutable VAULT;

    mapping(address => bool) public supportTokens;
    mapping(address => bool) public frozenTokens;

    mapping(address => bool) public isSwapWhiteListed;

    using SafeMath for uint256;
    using UniversalERC20 for IERC20;

    receive() external payable {}

    fallback() external payable {
        require(msg.data.length == 0, "NON_EMPTY_DATA");
    }

    constructor(address _hopeAddress, address _wbtcAddress, address _wethAddress, address _stETHAddress, address _vaultAddress) {
        HOPE = IHOPE(_hopeAddress);
        WBTC = IWBTC(_wbtcAddress);
        WETH = IWETH(_wethAddress);
        stETH = IStETH(_stETHAddress);
        VAULT = IVault(_vaultAddress);
    }

    modifier judgeExpired(uint256 deadLine) {
        require(deadLine >= block.timestamp, "GW011");
        _;
    }

    modifier onlyEmergencyOrVaultManager() {
        require(isEmergencyManager(_msgSender()) || isVaultManager(_msgSender()), "GW016");
        _;
    }

    /// @inheritdoc IGateway
    function combinationDeposit(uint256 _mintAmount, address _ethCorrelatedToken) external payable override whenNotPaused nonReentrant {
        (uint256 wbtcAmount, uint256 ethAmount) = _calculateReserveAmount(_mintAmount);
        _combinationDeposit(_mintAmount, _ethCorrelatedToken, wbtcAmount, ethAmount);
    }

    /// @inheritdoc IGateway
    function combinationDepositWithPermit(
        uint256 _mintAmount,
        address _ethCorrelatedToken,
        uint256 _deadline,
        uint8 _permitV,
        bytes32 _permitR,
        bytes32 _permitS
    ) external override whenNotPaused nonReentrant {
        require(_ethCorrelatedToken == address(stETH), "GW002");
        (uint256 wbtcAmount, uint256 ethAmount) = _calculateReserveAmount(_mintAmount);
        IERC20WithPermit(_ethCorrelatedToken).permit(_msgSender(), address(this), ethAmount, _deadline, _permitV, _permitR, _permitS);
        _combinationDeposit(_mintAmount, _ethCorrelatedToken, wbtcAmount, ethAmount);
    }

    /// @inheritdoc IGateway
    function combinationWithdraw(uint256 _burnAmount) external override whenNotPaused nonReentrant {
        _combinationWithdraw(_burnAmount);
    }

    /// @inheritdoc IGateway
    function combinationWithdrawWithPermit(
        uint256 _burnAmount,
        uint256 _deadline,
        uint8 _permitV,
        bytes32 _permitR,
        bytes32 _permitS
    ) external override whenNotPaused nonReentrant {
        IERC20WithPermit(address(HOPE)).permit(_msgSender(), address(this), _burnAmount, _deadline, _permitV, _permitR, _permitS);
        _combinationWithdraw(_burnAmount);
    }

    /// @inheritdoc IGateway
    function singleDeposit(uint256 _mintAmount, SwapInput[2] calldata _inputs) external payable override whenNotPaused nonReentrant {
        _singleDeposit(_mintAmount, _inputs);
    }

    /// @inheritdoc IGateway
    function singleDepositWithPermit(
        uint256 _mintAmount,
        SwapInput[2] calldata _inputs,
        uint256 _deadline,
        uint8 _permitV,
        bytes32 _permitR,
        bytes32 _permitS
    ) external override whenNotPaused nonReentrant {
        IERC20WithPermit(_inputs[0].fromToken).permit(
            _msgSender(),
            address(this),
            _inputs[0].fromTokenAmount + _inputs[1].fromTokenAmount,
            _deadline,
            _permitV,
            _permitR,
            _permitS
        );
        _singleDeposit(_mintAmount, _inputs);
    }

    /// @inheritdoc IGateway
    function singleWithdraw(uint256 _burnAmount, SwapInput[2] calldata _inputs) external override whenNotPaused nonReentrant {
        _singleWithdraw(_burnAmount, _inputs);
    }

    /// @inheritdoc IGateway
    function singleWithdrawWithPermit(
        uint256 _burnAmount,
        uint256 _deadline,
        uint8 _permitV,
        bytes32 _permitR,
        bytes32 _permitS,
        SwapInput[2] calldata _inputs
    ) external override whenNotPaused nonReentrant {
        IERC20WithPermit(address(HOPE)).permit(_msgSender(), address(this), _burnAmount, _deadline, _permitV, _permitR, _permitS);
        _singleWithdraw(_burnAmount, _inputs);
    }

    /// @inheritdoc IGateway
    function updateSupportToken(address _token, bool _isSupported) public override onlyRole(VAULT_MANAGER_ROLE) {
        supportTokens[_token] = _isSupported;
        emit UpdateSupportedToken(_token, _isSupported);
    }

    /// @inheritdoc IGateway
    function updateSupportTokens(address[] calldata _tokens, bool[] calldata _isSupported) external override onlyRole(VAULT_MANAGER_ROLE) {
        require(_tokens.length == _isSupported.length, "GW009");
        for (uint256 i = 0; i < _tokens.length; i++) {
            updateSupportToken(_tokens[i], _isSupported[i]);
        }
    }

    /// @inheritdoc IGateway
    function updateFrozenToken(address _token, bool _isFrozen) public override onlyEmergencyOrVaultManager {
        frozenTokens[_token] = _isFrozen;
        emit UpdateFrozenToken(_token, _isFrozen);
    }

    /// @inheritdoc IGateway
    function updateFrozenTokens(address[] calldata _tokens, bool[] calldata _isFrozen) external override onlyEmergencyOrVaultManager {
        require(_tokens.length == _isFrozen.length, "GW009");
        for (uint256 i = 0; i < _tokens.length; i++) {
            updateFrozenToken(_tokens[i], _isFrozen[i]);
        }
    }

    /// @inheritdoc IGateway
    function updateSwapWhiteList(address _dex, bool _isWhiteList) public override onlyOwner {
        isSwapWhiteListed[_dex] = _isWhiteList;
        emit UpdateSwapWhiteListed(_dex, _isWhiteList);
    }

    /// @inheritdoc IGateway
    function updateSwapWhiteLists(address[] calldata _dexList, bool[] calldata _isWhiteList) external override onlyOwner {
        require(_dexList.length == _isWhiteList.length, "GW009");
        for (uint256 i = 0; i < _dexList.length; i++) {
            updateSwapWhiteList(_dexList[i], _isWhiteList[i]);
        }
    }

    /// @inheritdoc IGateway
    function isVaultManager(address _manager) public view override returns (bool) {
        return hasRole(VAULT_MANAGER_ROLE, _manager);
    }

    /// @inheritdoc IGateway
    function addVaultManager(address _manager) external override onlyOwner {
        _grantRole(VAULT_MANAGER_ROLE, _manager);
    }

    /// @inheritdoc IGateway
    function removeVaultManager(address _manager) external override onlyOwner {
        _revokeRole(VAULT_MANAGER_ROLE, _manager);
    }

    /// @inheritdoc IGateway
    function isEmergencyManager(address _manager) public view override returns (bool) {
        return hasRole(EMERGENCY_MANAGER_ROLE, _manager);
    }

    /// @inheritdoc IGateway
    function addEmergencyManager(address _manager) external override onlyOwner {
        _grantRole(EMERGENCY_MANAGER_ROLE, _manager);
    }

    /// @inheritdoc IGateway
    function removeEmergencyManager(address _manager) external override onlyOwner {
        _revokeRole(EMERGENCY_MANAGER_ROLE, _manager);
    }

    /// @inheritdoc IGateway
    function rescueTokens(address _token, address _recipient, uint256 _amount) external override onlyRole(VAULT_MANAGER_ROLE) {
        IERC20(_token).universalTransfer(_recipient, _amount);
    }

    /// @inheritdoc IGateway
    function pause() external override onlyEmergencyOrVaultManager {
        _pause();
    }

    /// @inheritdoc IGateway
    function unpause() external override onlyEmergencyOrVaultManager {
        _unpause();
    }

    /**
     * @dev Mint HOPE with Asset Combination
     * @param _mintAmount Amount of HOPE to mint
     * @param _ethCorrelatedToken ETH correlated asset
     * @param _wbtcAmount Amount of WBTC reserve
     * @param _ethAmount Amount of ETH correlated reserve
     */
    function _combinationDeposit(uint256 _mintAmount, address _ethCorrelatedToken, uint256 _wbtcAmount, uint256 _ethAmount) internal {
        require(
            _ethCorrelatedToken == ETH_MOCK_ADDRESS || _ethCorrelatedToken == address(WETH) || _ethCorrelatedToken == address(stETH),
            "GW000"
        );
        require(_wbtcAmount > 0 && _ethAmount > 0, "GW010");

        VAULT.deposit(_msgSender(), _mintAmount);

        _payOrTransfer(address(WBTC), _msgSender(), address(VAULT), _wbtcAmount);

        if (_ethCorrelatedToken == address(stETH)) {
            _payOrTransfer(address(stETH), _msgSender(), address(VAULT), _ethAmount);
        } else {
            if (_ethCorrelatedToken == address(WETH)) {
                _payOrTransfer(address(WETH), _msgSender(), address(this), _ethAmount);
                WETH.withdraw(_ethAmount);
            } else {
                require(msg.value == _ethAmount, "GW010");
            }
            VAULT.stakeETH{value: _ethAmount}();
        }
        emit CombinationDeposit(_msgSender(), _mintAmount, _ethCorrelatedToken, _wbtcAmount, _ethAmount);
    }

    /**
     * @dev Burn HOPE with Asset Combination
     * @notice Only support withdraw WBTC & stETH
     * @param _burnAmount Amount of HOPE to burn
     */
    function _combinationWithdraw(uint256 _burnAmount) internal {
        _payOrTransfer(address(HOPE), _msgSender(), address(VAULT), _burnAmount);
        uint256 burnAmount = VAULT.withdraw(_burnAmount);

        (uint256 wbtcAmount, uint256 stEthAmount) = _calculateReserveAmount(burnAmount);
        require(wbtcAmount > 0 && stEthAmount > 0, "GW010");

        VAULT.safeTransferToken(address(WBTC), _msgSender(), wbtcAmount);
        VAULT.safeTransferToken(address(stETH), _msgSender(), stEthAmount);
        emit CombinationWithdraw(_msgSender(), _burnAmount, wbtcAmount, stEthAmount);
    }

    /**
     * @dev Deposits assets into vault and mints hope tokens.
     * @param _mintAmount Amount of HOPE to mint
     * @param _inputs Array of SwapInput struct instances.
     */
    function _singleDeposit(uint256 _mintAmount, SwapInput[2] calldata _inputs) internal {
        require(_inputs.length == 2, "GW001");
        require(
            _inputs[0].toToken == address(WBTC) &&
                (_inputs[1].toToken == ETH_MOCK_ADDRESS || _inputs[1].toToken == address(WETH) || _inputs[1].toToken == address(stETH)),
            "GW002"
        );
        require(_inputs[0].fromToken == _inputs[1].fromToken, "GW003");
        require(supportTokens[_inputs[0].fromToken], "GW004");
        require(!frozenTokens[_inputs[0].fromToken], "GW005");

        if (_inputs[0].fromToken != ETH_MOCK_ADDRESS) {
            _payOrTransfer(_inputs[0].fromToken, _msgSender(), address(this), _inputs[0].fromTokenAmount + _inputs[1].fromTokenAmount);
        } else {
            require(msg.value == _inputs[0].fromTokenAmount + _inputs[1].fromTokenAmount, "GW010");
        }

        uint256 swappedBTCAmount = _inputs[0].fromToken == _inputs[0].toToken ? _inputs[0].fromTokenAmount : _aggregatorSwap(_inputs[0]);
        uint256 swappedETHAmount = _inputs[1].fromToken == _inputs[1].toToken ? _inputs[1].fromTokenAmount : _aggregatorSwap(_inputs[1]);

        (uint256 needWBTCAmount, uint256 needETHAmount) = _calculateReserveAmount(_mintAmount);
        require(needWBTCAmount > 0 && needETHAmount > 0, "GW010");
        require(swappedBTCAmount >= needWBTCAmount && swappedETHAmount >= needETHAmount, "GW010");

        uint256 refundBTCAmount = swappedBTCAmount.sub(needWBTCAmount);
        uint256 refundETHAmount = swappedETHAmount.sub(needETHAmount);

        VAULT.deposit(_msgSender(), _mintAmount);

        _payOrTransfer(address(WBTC), address(this), address(VAULT), needWBTCAmount);

        if (_inputs[1].toToken == address(stETH)) {
            _payOrTransfer(address(stETH), address(this), address(VAULT), needETHAmount);
        } else {
            if (_inputs[1].toToken == address(WETH)) {
                WETH.withdraw(needETHAmount);
            }
            VAULT.stakeETH{value: needETHAmount}();
        }

        if (refundBTCAmount > 0) {
            _payOrTransfer(address(WBTC), address(this), _msgSender(), refundBTCAmount);
        }
        if (refundETHAmount > 0) {
            _payOrTransfer(_inputs[1].toToken, address(this), _msgSender(), refundETHAmount);
        }
        emit SingleDeposit(_msgSender(), _mintAmount, _inputs[0].fromToken, _inputs[0].fromTokenAmount + _inputs[1].fromTokenAmount);
    }

    /**
     * @dev Withdraws assets from vault and burns hope tokens.
     * @param _burnAmount Amount of Hope to burn.
     * @param _inputs Array of SwapInput struct instances.
     */
    function _singleWithdraw(uint256 _burnAmount, SwapInput[2] calldata _inputs) internal {
        require(_inputs.length == 2, "GW001");
        require(_inputs[0].fromToken == address(WBTC) && _inputs[1].fromToken == address(stETH), "GW002");
        require(_inputs[0].toToken == _inputs[1].toToken, "GW006");
        require(supportTokens[_inputs[0].toToken], "GW007");
        require(!frozenTokens[_inputs[0].toToken], "GW008");

        _payOrTransfer(address(HOPE), _msgSender(), address(VAULT), _burnAmount);

        uint256 burnAmount = VAULT.withdraw(_burnAmount);

        (uint256 wbtcAmount, uint256 stEthAmount) = _calculateReserveAmount(burnAmount);
        require(wbtcAmount > 0 && stEthAmount > 0, "GW010");

        VAULT.safeTransferToken(address(WBTC), address(this), wbtcAmount);
        VAULT.safeTransferToken(address(stETH), address(this), stEthAmount);

        uint256 withdrawAmountBySwapBTC = _inputs[0].fromToken == _inputs[0].toToken
            ? _inputs[0].fromTokenAmount
            : _aggregatorSwap(_inputs[0]);
        uint256 withdrawAmountBySwapETH = _inputs[1].fromToken == _inputs[1].toToken
            ? _inputs[1].fromTokenAmount
            : _aggregatorSwap(_inputs[1]);

        _payOrTransfer(_inputs[0].toToken, address(this), _msgSender(), withdrawAmountBySwapBTC + withdrawAmountBySwapETH);
        emit SingleWithdraw(_msgSender(), _burnAmount, _inputs[0].toToken, withdrawAmountBySwapBTC + withdrawAmountBySwapETH);
    }

    /**
     * @notice Either performs a regular payment or transferFrom on Permit2, depending on the payer address
     * @param _token The token to transfer
     * @param _payer The address to pay for the transfer
     * @param _recipient The recipient of the transfer
     * @param _amount The amount to transfer
     */
    function _payOrTransfer(address _token, address _payer, address _recipient, uint256 _amount) internal {
        if (_payer == address(this)) IERC20(_token).universalTransfer(_recipient, _amount);
        else TransferHelper.doTransferFrom(_token, _payer, _recipient, _amount);
    }

    /**
     * @dev Performs an external swap through an aggregator.
     * @param _input The swap input details.
     * @return returnAmount The amount of toToken received after the swap.
     */
    function _aggregatorSwap(SwapInput calldata _input) internal judgeExpired(_input.deadLine) returns (uint256 returnAmount) {
        require(_input.minReturnAmount > 0, "GW012");

        uint256 toTokenOriginBalance = IERC20(_input.toToken).universalBalanceOf(address(this));
        if (_input.fromToken != ETH_MOCK_ADDRESS) {
            IERC20(_input.fromToken).universalApproveMax(_input.approveTarget, _input.fromTokenAmount);
        }

        require(isSwapWhiteListed[_input.swapTarget], "GW013");
        (bool success, ) = _input.swapTarget.call{value: _input.fromToken == ETH_MOCK_ADDRESS ? _input.fromTokenAmount : 0}(
            _input.callDataConcat
        );

        require(success, "GW014");

        returnAmount = IERC20(_input.toToken).universalBalanceOf(address(this)).sub(toTokenOriginBalance);
        require(returnAmount >= _input.minReturnAmount, "GW015");

        emit AggregatorSwap(_input.fromToken, _input.toToken, _msgSender(), _input.fromTokenAmount, returnAmount);
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
