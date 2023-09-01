// SPDX-License-Identifier: LGPL-3.0
pragma solidity 0.8.17;

import {IHOPE} from "../interfaces/IHOPE.sol";
import {IVault} from "../interfaces/IVault.sol";
import {IWBTC} from "../interfaces/IWBTC.sol";
import {IWETH} from "../interfaces/IWETH.sol";
import {IStETH} from "../interfaces/IStETH.sol";
import {UniversalERC20} from "./UniversalERC20.sol";
import {TransferHelper} from "light-lib/contracts/TransferHelper.sol";
import {IERC20Metadata, IERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {SafeCast} from "@openzeppelin/contracts/utils/math/SafeCast.sol";
import {SafeMath} from "@openzeppelin/contracts/utils/math/SafeMath.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import {Ownable2Step} from "@openzeppelin/contracts/access/Ownable2Step.sol";
import {AccessControl} from "@openzeppelin/contracts/access/AccessControl.sol";
import {Pausable} from "@openzeppelin/contracts/security/Pausable.sol";

contract Gateway is Ownable2Step, AccessControl, Pausable, ReentrancyGuard {
    event UpdateSupportedToken(address indexed _token, bool isSupported);
    event UpdateFrozenToken(address indexed _token, bool isFrozen);
    event AggregatorSwap(address fromToken, address toToken, address user, uint256 fromAmount, uint256 returnAmount);

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

    struct SwapInput {
        address fromToken;
        address toToken;
        address approveTarget;
        address swapTarget;
        uint256 fromTokenAmount;
        uint256 minReturnAmount;
        bytes callDataConcat;
        uint256 deadLine;
    }

    receive() external payable {}

    fallback() external payable {
        require(msg.data.length == 0, "NON_EMPTY_DATA");
    }

    constructor(address _HOPE, address _WBTC, address _WETH, address _stETH, address _VAULT) {
        HOPE = IHOPE(_HOPE);
        WBTC = IWBTC(_WBTC);
        WETH = IWETH(_WETH);
        stETH = IStETH(_stETH);
        VAULT = IVault(_VAULT);
    }

    modifier judgeExpired(uint256 deadLine) {
        require(deadLine >= block.timestamp, "GW011");
        _;
    }

    /**
     * @dev Mint HOPE with Asset Combination
     * @param _amount Amount of HOPE to mint
     * @param _depositToken Reserve asset
     */
    function combinationDeposit(uint256 _amount, address _depositToken) external payable whenNotPaused nonReentrant {
        require(_depositToken == ETH_MOCK_ADDRESS || _depositToken == address(WETH) || _depositToken == address(stETH), "GW000");

        VAULT.deposit(_msgSender(), _amount);

        (uint256 btcAmount, uint256 ethAmount) = _calculateReserveAmount(_amount);

        TransferHelper.doTransferFrom(address(WBTC), _msgSender(), address(VAULT), btcAmount);

        if (_depositToken == address(stETH)) {
            TransferHelper.doTransferFrom(address(stETH), _msgSender(), address(VAULT), ethAmount);
        } else {
            if (_depositToken == address(WETH)) {
                TransferHelper.doTransferFrom(address(WETH), _msgSender(), address(this), ethAmount);
                WETH.withdraw(ethAmount);
            }
            VAULT.stakeETH{value: ethAmount}();
        }
    }

    /**
     * @dev Burn HOPE with Asset Combination
     * @notice Only support withdraw WBTC & stETH
     * @param _amount Amount of HOPE to burn
     */
    function combinationWithdraw(uint256 _amount) external whenNotPaused nonReentrant {
        TransferHelper.doTransferFrom(address(HOPE), _msgSender(), address(VAULT), _amount);

        uint256 burnAmount = VAULT.withdraw(_amount);

        (uint256 wbtcAmount, uint256 stEthAmount) = _calculateReserveAmount(burnAmount);
        VAULT.safeTransferToken(address(WBTC), _msgSender(), wbtcAmount);
        VAULT.safeTransferToken(address(stETH), _msgSender(), stEthAmount);
    }

    /**
     * @dev Deposits assets into vault and mints hope tokens.
     * @param inputs Array of SwapInput struct instances.
     */
    function singleDeposit(SwapInput[] calldata inputs) external payable whenNotPaused nonReentrant {
        require(inputs.length == 2, "GW001");
        require(
            inputs[0].toToken == address(WBTC) &&
                (inputs[1].toToken == ETH_MOCK_ADDRESS || inputs[1].toToken == address(WETH) || inputs[1].toToken == address(stETH)),
            "GW002"
        );
        require(inputs[0].fromToken == inputs[1].fromToken, "GW003");
        require(supportTokens[inputs[0].fromToken], "GW004");
        require(frozenTokens[inputs[0].fromToken], "GW005");

        if (inputs[0].fromToken != ETH_MOCK_ADDRESS) {
            TransferHelper.doTransferFrom(
                inputs[0].fromToken,
                _msgSender(),
                address(this),
                inputs[0].fromTokenAmount + inputs[1].fromTokenAmount
            );
        } else {
            require(msg.value == inputs[0].fromTokenAmount + inputs[1].fromTokenAmount, "GW010");
        }

        uint256 swappedBTCAmount = inputs[0].fromToken == address(WBTC) ? inputs[0].fromTokenAmount : _aggregatorSwap(inputs[0]);
        uint256 swappedETHAmount = inputs[1].fromToken == ETH_MOCK_ADDRESS ||
            inputs[1].fromToken == address(WETH) ||
            inputs[1].fromToken == address(stETH)
            ? inputs[1].fromTokenAmount
            : _aggregatorSwap(inputs[1]);

        (uint256 needBTCAmount, uint256 needETHAmount, uint256 refundBTCAmount, uint256 refundETHAmount) = _calculateReserveCombination(
            swappedBTCAmount,
            swappedETHAmount
        );
        uint256 hopeAmount = (needETHAmount * K_FACTOR) / (K * ETH_TO_BTC_RATIO);

        VAULT.deposit(_msgSender(), hopeAmount);

        TransferHelper.doTransferOut(address(WBTC), address(VAULT), needBTCAmount);

        if (inputs[1].toToken == address(stETH)) {
            TransferHelper.doTransferOut(address(stETH), address(VAULT), needETHAmount);
        } else {
            if (inputs[1].toToken == address(WETH)) {
                TransferHelper.doTransferOut(address(WETH), address(this), needETHAmount);
                WETH.withdraw(needETHAmount);
            }
            VAULT.stakeETH{value: needETHAmount}();
        }

        if (refundBTCAmount > 0) {
            TransferHelper.doTransferOut(address(WBTC), _msgSender(), refundBTCAmount);
        }
        if (refundETHAmount > 0) {
            IERC20(inputs[1].toToken).universalTransfer(_msgSender(), refundETHAmount);
        }
    }

    /**
     * @dev Withdraws assets from vault and burns hope tokens.
     * @param _amount Amount of hope tokens to burn.
     * @param inputs Array of SwapInput struct instances.
     */
    function singleWithdraw(uint256 _amount, SwapInput[] calldata inputs) external whenNotPaused nonReentrant {
        require(inputs.length == 2, "GW001");
        require(inputs[0].fromToken == address(WBTC) && inputs[1].fromToken == address(stETH), "GW002");
        require(inputs[0].toToken == inputs[1].toToken, "GW006");
        require(supportTokens[inputs[0].toToken], "GW007");
        require(frozenTokens[inputs[0].toToken], "GW008");

        TransferHelper.doTransferFrom(address(HOPE), _msgSender(), address(VAULT), _amount);

        uint256 burnAmount = VAULT.withdraw(_amount);

        (uint256 wbtcAmount, uint256 stEthAmount) = _calculateReserveAmount(burnAmount);
        VAULT.safeTransferToken(address(WBTC), address(this), wbtcAmount);
        VAULT.safeTransferToken(address(stETH), address(this), stEthAmount);

        uint256 withdrawAmountBySwapBTC = inputs[0].toToken == address(WBTC) ? inputs[0].fromTokenAmount : _aggregatorSwap(inputs[0]);
        uint256 withdrawAmountBySwapETH = inputs[1].toToken == address(stETH) ? inputs[1].fromTokenAmount : _aggregatorSwap(inputs[1]);

        IERC20(inputs[0].toToken).universalTransfer(_msgSender(), withdrawAmountBySwapBTC + withdrawAmountBySwapETH);
    }

    /**
     * @dev Updates the support status of a specific token.
     * @param _token Address of the token.
     * @param _isSupported New support status.
     */
    function updateSupportToken(address _token, bool _isSupported) public onlyOwner {
        supportTokens[_token] = _isSupported;
        emit UpdateSupportedToken(_token, _isSupported);
    }

    /**
     * @dev Updates the support status of multiple tokens in bulk.
     * @param _tokens Array of token addresses.
     * @param _isSupported Array of new support statuses.
     */
    function updateSupportTokens(address[] calldata _tokens, bool[] calldata _isSupported) external onlyOwner {
        require(_tokens.length == _isSupported.length, "GW009");
        for (uint256 i = 0; i < _tokens.length; i++) {
            updateSupportToken(_tokens[i], _isSupported[i]);
        }
    }

    /**
     * @dev Updates the frozen status of a specific token.
     * @param _token Address of the token.
     * @param _isFrozen New frozen status.
     */
    function updateFrozenToken(address _token, bool _isFrozen) public onlyOwner {
        frozenTokens[_token] = _isFrozen;
        emit UpdateFrozenToken(_token, _isFrozen);
    }

    /**
     * @dev Updates the frozen status of multiple tokens in bulk.
     * @param _tokens Array of token addresses.
     * @param _isFrozen Array of new frozen statuses.
     */
    function updateFrozenTokens(address[] calldata _tokens, bool[] calldata _isFrozen) external onlyOwner {
        require(_tokens.length == _isFrozen.length, "GW009");
        for (uint256 i = 0; i < _tokens.length; i++) {
            updateFrozenToken(_tokens[i], _isFrozen[i]);
        }
    }

    /**
     * @dev Checks if an address has the emergency manager role.
     * @param _manager Address to check.
     * @return bool indicating if the address has the emergency manager role.
     */
    function isEmergencyManager(address _manager) external view returns (bool) {
        return hasRole(EMERGENCY_MANAGER_ROLE, _manager);
    }

    /**
     * @dev Adds an address to the emergency manager role.
     * @param _manager Address to add as an emergency manager.
     */
    function addEmergencyManager(address _manager) external onlyOwner {
        _grantRole(EMERGENCY_MANAGER_ROLE, _manager);
    }

    /**
     * @dev Removes an address from the emergency manager role.
     * @param _manager Address to remove from the emergency manager role.
     */
    function removeEmergencyManager(address _manager) external onlyOwner {
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
