// SPDX-License-Identifier: LGPL-3.0

pragma solidity 0.8.17;

interface IGateway {
    event UpdateSupportedToken(address indexed token, bool isSupported);
    event UpdateFrozenToken(address indexed token, bool isFrozen);
    event UpdateSwapWhiteListed(address indexed dex, bool isWhiteListed);
    event AggregatorSwap(address fromToken, address toToken, address user, uint256 fromAmount, uint256 returnAmount);
    event CombinationDeposit(address indexed user, uint256 mintAmount, address ethCorrelatedToken, uint256 wbtcAmount, uint256 ethAmount);
    event CombinationWithdraw(address indexed user, uint256 burnAmount, uint256 wbtcAmount, uint256 stETHAmount);
    event SingleDeposit(address indexed user, uint256 mintAmount, address depositToken, uint256 depositAmount);
    event SingleWithdraw(address indexed user, uint256 burnAmount, address withdrawToken, uint256 withdrawAmount);

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

    /**
     * @dev Mint HOPE with Asset Combination
     * @param _mintAmount Amount of HOPE to mint
     * @param _ethCorrelatedToken ETH correlated asset
     */
    function combinationDeposit(uint256 _mintAmount, address _ethCorrelatedToken) external payable;

    /**
     * @dev Mint HOPE with Asset Combination
     * @param _mintAmount Amount of HOPE to mint
     * @param _ethCorrelatedToken ETH correlated asset
     * @param _deadline The deadline timestamp that the permit is valid
     * @param _permitV The V parameter of ERC712 permit sig
     * @param _permitR The R parameter of ERC712 permit sig
     * @param _permitS The S parameter of ERC712 permit sig
     */
    function combinationDepositWithPermit(
        uint256 _mintAmount,
        address _ethCorrelatedToken,
        uint256 _deadline,
        uint8 _permitV,
        bytes32 _permitR,
        bytes32 _permitS
    ) external;

    /**
     * @dev Burn HOPE with Asset Combination
     * @notice Only support withdraw WBTC & stETH
     * @param _burnAmount Amount of HOPE to burn
     */
    function combinationWithdraw(uint256 _burnAmount) external;

    /**
     * @dev Burn HOPE with Asset Combination
     * @notice Only support withdraw WBTC & stETH
     * @param _burnAmount Amount of HOPE to burn
     * @param _deadline The deadline timestamp that the permit is valid
     * @param _permitV The V parameter of ERC712 permit sig
     * @param _permitR The R parameter of ERC712 permit sig
     * @param _permitS The S parameter of ERC712 permit sig
     */
    function combinationWithdrawWithPermit(
        uint256 _burnAmount,
        uint256 _deadline,
        uint8 _permitV,
        bytes32 _permitR,
        bytes32 _permitS
    ) external;

    /**
     * @dev Deposits assets into vault and mints hope tokens.
     * @param _mintAmount Amount of HOPE to mint
     * @param _inputs Array of SwapInput struct instances.
     */
    function singleDeposit(uint256 _mintAmount, SwapInput[2] calldata _inputs) external payable;

    /**
     * @dev Deposits assets into vault and mints hope tokens.
     * @param _mintAmount Amount of HOPE to mint
     * @param _inputs Array of SwapInput struct instances.
     * @param _deadline The deadline timestamp that the permit is valid
     * @param _permitV The V parameter of ERC712 permit sig
     * @param _permitR The R parameter of ERC712 permit sig
     * @param _permitS The S parameter of ERC712 permit sig
     */
    function singleDepositWithPermit(
        uint256 _mintAmount,
        SwapInput[2] calldata _inputs,
        uint256 _deadline,
        uint8 _permitV,
        bytes32 _permitR,
        bytes32 _permitS
    ) external;

    /**
     * @dev Withdraws assets from vault and burns hope tokens.
     * @param _burnAmount Amount of hope tokens to burn.
     * @param _inputs Array of SwapInput struct instances.
     */
    function singleWithdraw(uint256 _burnAmount, SwapInput[2] calldata _inputs) external;

    /**
     * @dev Withdraws assets from vault and burns hope tokens.
     * @param _burnAmount Amount of hope tokens to burn.
     * @param _deadline The deadline timestamp that the permit is valid
     * @param _permitV The V parameter of ERC712 permit sig
     * @param _permitR The R parameter of ERC712 permit sig
     * @param _permitS The S parameter of ERC712 permit sig
     * @param _inputs Array of SwapInput struct instances.
     */
    function singleWithdrawWithPermit(
        uint256 _burnAmount,
        uint256 _deadline,
        uint8 _permitV,
        bytes32 _permitR,
        bytes32 _permitS,
        SwapInput[2] calldata _inputs
    ) external;

    /**
     * @dev Updates the support status of a specific token.
     * @notice Only callable by addresses with the vault manager role.
     * @param _token Address of the token.
     * @param _isSupported New support status.
     */
    function updateSupportToken(address _token, bool _isSupported) external;

    /**
     * @dev Updates the support status of multiple tokens in bulk.
     * @notice Only callable by addresses with the vault manager role.
     * @param _tokens Array of token addresses.
     * @param _isSupported Array of new support statuses.
     */
    function updateSupportTokens(address[] calldata _tokens, bool[] calldata _isSupported) external;

    /**
     * @dev Updates the frozen status of a specific token.
     * @notice Only callable by addresses with the emergency or vault manager role.
     * @param _token Address of the token.
     * @param _isFrozen New frozen status.
     */
    function updateFrozenToken(address _token, bool _isFrozen) external;

    /**
     * @dev Updates the frozen status of multiple tokens in bulk.
     * @notice Only callable by addresses with the emergency or vault manager role.
     * @param _tokens Array of token addresses.
     * @param _isFrozen Array of new frozen statuses.
     */
    function updateFrozenTokens(address[] calldata _tokens, bool[] calldata _isFrozen) external;

    /**
     * @dev Updates the white listed status of a specific dex.
     * @notice Only callable by addresses with the owner.
     * @param _dex Address of the dex.
     * @param _isWhiteList White listed status.
     */
    function updateSwapWhiteList(address _dex, bool _isWhiteList) external;

    /**
     * @dev Updates the white listed status of multiple dex in bulk.
     * @notice Only callable by addresses with the owner.
     * @param _dexList Array of dex addresses.
     * @param _isWhiteList Array of white listed statuses.
     */
    function updateSwapWhiteLists(address[] calldata _dexList, bool[] calldata _isWhiteList) external;

    /**
     * @dev Checks if an address has the vault manager role.
     * @param _manager Address to check.
     * @return bool indicating if the address has the vault manager role.
     */
    function isVaultManager(address _manager) external view returns (bool);

    /**
     * @dev Adds an address to the vault manager role.
     * @notice Only callable by addresses with the owner.
     * @param _manager Address to add as an vault manager.
     */
    function addVaultManager(address _manager) external;

    /**
     * @dev Removes an address from the vault manager role.
     * @notice Only callable by addresses with the owner.
     * @param _manager Address to remove from the vault manager role.
     */
    function removeVaultManager(address _manager) external;

    /**
     * @dev Checks if an address has the emergency manager role.
     * @param _manager Address to check.
     * @return bool indicating if the address has the emergency manager role.
     */
    function isEmergencyManager(address _manager) external view returns (bool);

    /**
     * @dev Adds an address to the emergency manager role.
     * @notice Only callable by addresses with the owner.
     * @param _manager Address to add as an emergency manager.
     */
    function addEmergencyManager(address _manager) external;

    /**
     * @dev Removes an address from the emergency manager role.
     * @notice Only callable by addresses with the owner.
     * @param _manager Address to remove from the emergency manager role.
     */
    function removeEmergencyManager(address _manager) external;

    /**
     * @notice Rescue and transfer tokens locked in this contract
     * @notice Only callable by addresses with the vault manager role.
     * @param _token The address of the token
     * @param _recipient The address of the recipient
     * @param _amount The amount of token to transfer
     */
    function rescueTokens(address _token, address _recipient, uint256 _amount) external;

    /**
     * @dev Pauses contract functionality.
     * @notice Only callable by addresses with the emergency or vault manager role.
     */
    function pause() external;

    /**
     * @dev Unpauses contract functionality.
     * @notice Only callable by addresses with the emergency or vault manager role.
     */
    function unpause() external;
}
