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
import {IERC20Metadata, IERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {SafeCast} from "@openzeppelin/contracts/utils/math/SafeCast.sol";
import {SafeMath} from "@openzeppelin/contracts/utils/math/SafeMath.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import {Ownable2Step} from "@openzeppelin/contracts/access/Ownable2Step.sol";
import {AccessControl} from "@openzeppelin/contracts/access/AccessControl.sol";
import {Pausable} from "@openzeppelin/contracts/security/Pausable.sol";

contract Gateway is IGateway, Ownable2Step, AccessControl, Pausable, ReentrancyGuard {
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

    mapping(address => bool) supportTokens;
    mapping(address => bool) frozenTokens;

    mapping(address => bool) public isSwapWhiteListed;

    using SafeCast for uint256;
    using SafeCast for int256;
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

    /// @inheritdoc IGateway
    function combinationDeposit(uint256 _amount, address _depositToken) external payable override whenNotPaused nonReentrant {
        require(_depositToken == ETH_MOCK_ADDRESS || _depositToken == address(WETH) || _depositToken == address(stETH), "GW000");

        VAULT.deposit(_msgSender(), _amount);

        (uint256 btcAmount, uint256 ethAmount) = _calculateReserveAmount(_amount);

        _payOrTransfer(address(WBTC), _msgSender(), address(VAULT), btcAmount);

        if (_depositToken == address(stETH)) {
            _payOrTransfer(address(stETH), _msgSender(), address(VAULT), ethAmount);
        } else {
            if (_depositToken == address(WETH)) {
                _payOrTransfer(address(WETH), _msgSender(), address(this), ethAmount);
                WETH.withdraw(ethAmount);
            }
            VAULT.stakeETH{value: ethAmount}();
        }
    }

    /// @inheritdoc IGateway
    function combinationWithdraw(uint256 _amount) external override whenNotPaused nonReentrant {
        _combinationWithdraw(_amount);
    }

    /// @inheritdoc IGateway
    function combinationWithdrawWithPermit(
        uint256 _amount,
        uint256 deadline,
        uint8 permitV,
        bytes32 permitR,
        bytes32 permitS
    ) external override whenNotPaused nonReentrant {
        IERC20WithPermit(address(HOPE)).permit(_msgSender(), address(this), _amount, deadline, permitV, permitR, permitS);
        _combinationWithdraw(_amount);
    }

    /// @inheritdoc IGateway
    function singleDeposit(SwapInput[2] calldata inputs) external payable override whenNotPaused nonReentrant {
        _singleDeposit(inputs);
    }

    /// @inheritdoc IGateway
    function singleDepositWithPermit(
        SwapInput[2] calldata inputs,
        uint256 deadline,
        uint8 permitV,
        bytes32 permitR,
        bytes32 permitS
    ) external override whenNotPaused nonReentrant {
        IERC20WithPermit(inputs[0].fromToken).permit(
            _msgSender(),
            address(this),
            inputs[0].fromTokenAmount + inputs[1].fromTokenAmount,
            deadline,
            permitV,
            permitR,
            permitS
        );
        _singleDeposit(inputs);
    }

    /// @inheritdoc IGateway
    function singleWithdraw(uint256 _amount, SwapInput[2] calldata inputs) external override whenNotPaused nonReentrant {
        _singleWithdraw(_amount, inputs);
    }

    /// @inheritdoc IGateway
    function singleWithdrawWithPermit(
        uint256 _amount,
        uint256 deadline,
        uint8 permitV,
        bytes32 permitR,
        bytes32 permitS,
        SwapInput[2] calldata inputs
    ) external override whenNotPaused nonReentrant {
        IERC20WithPermit(address(HOPE)).permit(_msgSender(), address(this), _amount, deadline, permitV, permitR, permitS);
        _singleWithdraw(_amount, inputs);
    }

    /// @inheritdoc IGateway
    function updateSupportToken(address _token, bool _isSupported) public override onlyOwner {
        supportTokens[_token] = _isSupported;
        emit UpdateSupportedToken(_token, _isSupported);
    }

    /// @inheritdoc IGateway
    function updateSupportTokens(address[] calldata _tokens, bool[] calldata _isSupported) external override onlyOwner {
        require(_tokens.length == _isSupported.length, "GW009");
        for (uint256 i = 0; i < _tokens.length; i++) {
            updateSupportToken(_tokens[i], _isSupported[i]);
        }
    }

    /// @inheritdoc IGateway
    function updateFrozenToken(address _token, bool _isFrozen) public override onlyOwner {
        frozenTokens[_token] = _isFrozen;
        emit UpdateFrozenToken(_token, _isFrozen);
    }

    /// @inheritdoc IGateway
    function updateFrozenTokens(address[] calldata _tokens, bool[] calldata _isFrozen) external override onlyOwner {
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
    function isEmergencyManager(address _manager) external view override returns (bool) {
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

    /**
     * @dev Pauses contract functionality.
     * @notice Only callable by addresses with the emergency manager role.
     */
    function pause() external onlyRole(EMERGENCY_MANAGER_ROLE) {
        _pause();
    }

    /**
     * @dev Unpauses contract functionality.
     * @notice Only callable by addresses with the emergency manager role.
     */
    function unpause() external onlyRole(EMERGENCY_MANAGER_ROLE) {
        _unpause();
    }

    /**
     * @dev Burn HOPE with Asset Combination
     * @notice Only support withdraw WBTC & stETH
     * @param _amount Amount of HOPE to burn
     */
    function _combinationWithdraw(uint256 _amount) internal {
        _payOrTransfer(address(HOPE), _msgSender(), address(VAULT), _amount);
        uint256 burnAmount = VAULT.withdraw(_amount);

        (uint256 wbtcAmount, uint256 stEthAmount) = _calculateReserveAmount(burnAmount);
        VAULT.safeTransferToken(address(WBTC), _msgSender(), wbtcAmount);
        VAULT.safeTransferToken(address(stETH), _msgSender(), stEthAmount);
    }

    /**
     * @dev Deposits assets into vault and mints hope tokens.
     * @param inputs Array of SwapInput struct instances.
     */
    function _singleDeposit(SwapInput[2] calldata inputs) internal {
        require(inputs.length == 2, "GW001");
        require(
            inputs[0].toToken == address(WBTC) &&
                (inputs[1].toToken == ETH_MOCK_ADDRESS || inputs[1].toToken == address(WETH) || inputs[1].toToken == address(stETH)),
            "GW002"
        );
        require(inputs[0].fromToken == inputs[1].fromToken, "GW003");
        require(supportTokens[inputs[0].fromToken], "GW004");
        require(!frozenTokens[inputs[0].fromToken], "GW005");

        if (inputs[0].fromToken != ETH_MOCK_ADDRESS) {
            _payOrTransfer(inputs[0].fromToken, _msgSender(), address(this), inputs[0].fromTokenAmount + inputs[1].fromTokenAmount);
        } else {
            require(msg.value == inputs[0].fromTokenAmount + inputs[1].fromTokenAmount, "GW010");
        }

        uint256 swappedBTCAmount = inputs[0].fromToken == inputs[0].toToken ? inputs[0].fromTokenAmount : _aggregatorSwap(inputs[0]);
        uint256 swappedETHAmount = inputs[1].fromToken == inputs[1].toToken ? inputs[1].fromTokenAmount : _aggregatorSwap(inputs[1]);

        (uint256 needBTCAmount, uint256 needETHAmount, uint256 refundBTCAmount, uint256 refundETHAmount) = _calculateReserveCombination(
            swappedBTCAmount,
            swappedETHAmount
        );
        uint256 hopeAmount = (needETHAmount * K_FACTOR) / (K * ETH_TO_BTC_RATIO);

        VAULT.deposit(_msgSender(), hopeAmount);

        _payOrTransfer(address(WBTC), address(this), address(VAULT), needBTCAmount);

        if (inputs[1].toToken == address(stETH)) {
            _payOrTransfer(address(stETH), address(this), address(VAULT), needETHAmount);
        } else {
            if (inputs[1].toToken == address(WETH)) {
                WETH.withdraw(needETHAmount);
            }
            VAULT.stakeETH{value: needETHAmount}();
        }

        if (refundBTCAmount > 0) {
            _payOrTransfer(address(WBTC), address(this), _msgSender(), refundBTCAmount);
        }
        if (refundETHAmount > 0) {
            _payOrTransfer(inputs[1].toToken, address(this), _msgSender(), refundETHAmount);
        }
    }

    /**
     * @dev Withdraws assets from vault and burns hope tokens.
     * @param _amount Amount of hope tokens to burn.
     * @param inputs Array of SwapInput struct instances.
     */
    function _singleWithdraw(uint256 _amount, SwapInput[2] calldata inputs) internal {
        require(inputs.length == 2, "GW001");
        require(inputs[0].fromToken == address(WBTC) && inputs[1].fromToken == address(stETH), "GW002");
        require(inputs[0].toToken == inputs[1].toToken, "GW006");
        require(supportTokens[inputs[0].toToken], "GW007");
        require(!frozenTokens[inputs[0].toToken], "GW008");

        _payOrTransfer(address(HOPE), _msgSender(), address(VAULT), _amount);

        uint256 burnAmount = VAULT.withdraw(_amount);

        (uint256 wbtcAmount, uint256 stEthAmount) = _calculateReserveAmount(burnAmount);
        VAULT.safeTransferToken(address(WBTC), address(this), wbtcAmount);
        VAULT.safeTransferToken(address(stETH), address(this), stEthAmount);

        uint256 withdrawAmountBySwapBTC = inputs[0].fromToken == inputs[0].toToken ? inputs[0].fromTokenAmount : _aggregatorSwap(inputs[0]);
        uint256 withdrawAmountBySwapETH = inputs[1].fromToken == inputs[1].toToken ? inputs[1].fromTokenAmount : _aggregatorSwap(inputs[1]);

        _payOrTransfer(inputs[0].toToken, address(this), _msgSender(), withdrawAmountBySwapBTC + withdrawAmountBySwapETH);
    }

    /**
     * @notice Either performs a regular payment or transferFrom on Permit2, depending on the payer address
     * @param token The token to transfer
     * @param payer The address to pay for the transfer
     * @param recipient The recipient of the transfer
     * @param amount The amount to transfer
     */
    function _payOrTransfer(address token, address payer, address recipient, uint256 amount) internal {
        if (payer == address(this)) IERC20(token).universalTransfer(recipient, amount);
        else TransferHelper.doTransferFrom(token, payer, recipient, amount);
    }

    /**
     * @dev Performs an external swap through an aggregator.
     * @param input The swap input details.
     * @return returnAmount The amount of toToken received after the swap.
     */
    function _aggregatorSwap(SwapInput calldata input) internal judgeExpired(input.deadLine) returns (uint256 returnAmount) {
        require(input.minReturnAmount > 0, "GW012");

        uint256 toTokenOriginBalance = IERC20(input.toToken).universalBalanceOf(address(this));
        if (input.fromToken != ETH_MOCK_ADDRESS) {
            IERC20(input.fromToken).universalApproveMax(input.approveTarget, input.fromTokenAmount);
        }

        require(isSwapWhiteListed[input.swapTarget], "GW013");
        (bool success, ) = input.swapTarget.call{value: input.fromToken == ETH_MOCK_ADDRESS ? input.fromTokenAmount : 0}(
            input.callDataConcat
        );

        require(success, "GW014");

        returnAmount = IERC20(input.toToken).universalBalanceOf(address(this)).sub(toTokenOriginBalance);
        require(returnAmount >= input.minReturnAmount, "GW015");

        emit AggregatorSwap(input.fromToken, input.toToken, _msgSender(), input.fromTokenAmount, returnAmount);
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

    /**
     * @dev Calculate BTC and ETH amounts required for reserve combination
     * @param _btcAmount BTC amount
     * @param _ethAmount ETH amount
     * @return Required BTC amount
     * @return Required ETH amount
     * @return Returned BTC amount
     * @return Returned ETH amount
     */
    function _calculateReserveCombination(
        uint256 _btcAmount,
        uint256 _ethAmount
    ) internal pure returns (uint256, uint256, uint256, uint256) {
        require(_btcAmount > 0 && _ethAmount > 0, "GW010");

        uint256 wbtcConversionFactor = 1e18 / 1e8;

        uint256 ethNeeded = _btcAmount * ETH_TO_BTC_RATIO * wbtcConversionFactor;

        if (ethNeeded <= _ethAmount) {
            return (_btcAmount, ethNeeded, 0, _ethAmount - ethNeeded);
        } else {
            uint256 btcNeeded = _ethAmount / ETH_TO_BTC_RATIO / wbtcConversionFactor;
            return (btcNeeded, _ethAmount, _btcAmount - btcNeeded, 0);
        }
    }
}
