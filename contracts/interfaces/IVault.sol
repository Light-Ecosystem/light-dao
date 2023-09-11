// SPDX-License-Identifier: LGPL-3.0
pragma solidity 0.8.17;

interface IVault {
    event UpdateGateway(address oldGateway, address newGateway);
    event UpdateMintFeeRate(uint256 oldMintFeeRate, uint256 newMintFeeRate);
    event UpdateBurnFeeRate(uint256 oldBurnFeeRate, uint256 newBurnFeeRate);

    /**
     * @dev Stake ETH into the Vault contract.
     * @notice Lido Liquid staked Ether 2.0. https://etherscan.io/address/0xae7ab96520DE3A18E5e111B5EaAb095312D7fE84
     * @notice Only callable by addresses with the gateway.
     */
    function stakeETH() external payable;

    /**
     * @dev Deposit assets into the Vault contract.
     * @notice Only callable by addresses with the gateway.
     * @param _user The address to receive the minted HOPE tokens.
     * @param _amount The amount of assets to deposit.
     * @return The minted HOPE amount after deducting fees.
     */
    function deposit(address _user, uint256 _amount) external returns (uint256);

    /**
     * @dev Withdraw assets from the Vault contract.
     * @notice Only callable by addresses with the gateway.
     * @param _amount The amount of HOPE tokens to burn.
     * @return The burned HOPE amount after deducting fees.
     */
    function withdraw(uint256 _amount) external returns (uint256);

    /**
     * @dev Calculate the claimable amount of stETH tokens.
     * @return The claimable amount of stETH tokens.
     */
    function claimableStETH() external view returns (uint256);

    /**
     * @dev Claim stETH tokens and transfer to a specified address.
     * @notice Only callable by addresses with the vault manager role.
     * @param _recipient The address to receive the claimed stETH tokens.
     */
    function claimStETH(address _recipient) external;

    /**
     * @dev Calculate the claimable amount of HOPE tokens.
     * @return The claimable amount of HOPE tokens.
     */
    function claimableHOPE() external view returns (uint256);

    /**
     * @dev Claim HOPE tokens and transfer to a specified address.
     * @notice Only callable by addresses with the vault manager role.
     * @param _recipient The address to receive the claimed HOPE tokens.
     */
    function claimHOPE(address _recipient) external;

    /**
     * @dev Update the gateway address that can call certain functions.
     * @notice Only callable by addresses with the owner.
     * @param _gateway The new gateway address.
     */
    function updateGateway(address _gateway) external;

    /**
     * @dev Update the mint fee rate.
     * @notice Only callable by addresses with the owner.
     * @param _rate The new mint fee rate.
     */
    function updateMintFeeRate(uint256 _rate) external;

    /**
     * @dev Update the burn fee rate.
     * @notice Only callable by addresses with the owner.
     * @param _rate The new burn fee rate.
     */
    function updateBurnFeeRate(uint256 _rate) external;

    /**
     * @dev Safe transfer tokens from the contract.
     * @notice Only callable by addresses with the gateway.
     * @param _token The address of the token to transfer.
     * @param _to The address to receive the tokens.
     * @param _amount The amount of tokens to transfer.
     */
    function safeTransferToken(address _token, address _to, uint256 _amount) external;

    /**
     * @dev Check if an address has the Vault Manager role.
     * @param _manager The address to check.
     * @return Whether the address has the Vault Manager role.
     */
    function isVaultManager(address _manager) external view returns (bool);

    /**
     * @dev Add an address as a Vault Manager.
     * @notice Only callable by addresses with the owner.
     * @param _manager The address to grant the Vault Manager role.
     */
    function addVaultManager(address _manager) external;

    /**
     * @dev Remove an address from the Vault Manager role.
     * @notice Only callable by addresses with the owner.
     * @param _manager The address to revoke the Vault Manager role from.
     */
    function removeVaultManager(address _manager) external;

    /**
     * @dev Pauses contract functionality.
     * @notice Only callable by addresses with the vault manager role.
     */
    function pause() external;

    /**
     * @dev Unpauses contract functionality.
     * @notice Only callable by addresses with the vault manager role.
     */
    function unpause() external;
}
