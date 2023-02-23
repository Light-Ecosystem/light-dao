// SPDX-License-Identifier: LGPL-3.0

pragma solidity 0.8.17;

interface IHOPESalesAgent {
    /**
     * @dev Emitted when buy token
     */
    event Buy(string fromCurrency, address indexed buyer, uint256 fromValue, uint256 toValue, uint256 blockTimestamp);

    /**
     * @dev Emitted when add new currency that can buy HOPE token
     */
    event AddCurrency(string symbol, address token, uint256 rate);

    /**
     * @dev Emitted when currency rate change
     */
    event ChangeCurrencyRate(string symbol, uint256 newRate, uint256 oldRate);

    /**
     * @dev Emitted when delete currency.
     */
    event DeleteCurrency(string symbol);

    /**
     * @dev Emitted when redeem token.
     */
    event Redeem(string symbol, address indexed to, uint256 amount);

    /**
     * @dev Emitted when set permit2 address.
     */
    event SetPermit2Address(address oldAddress, address newAddress);

    /**
     * @dev Buy HOPE token
     * @notice user need to call fromCurrencyToken.approve(address(this),fromValue) before buy HOPE token;
     */
    function buy(string memory fromCurrency, uint256 fromValue, uint256 nonce, uint256 deadline, bytes memory signature) external;

    /**
     * @dev Return erc20 balance from sales contract
     */
    function balanceOf(string memory symbol) external view returns (uint256);

    /**
     * @dev Redeem erc20 balance, onlyOwner
     */
    function redeem(string memory symbol, address to, uint256 amount) external returns (bool);

    /**
     * @dev Add currency that can buy HOPE token , onlyOwner
     */
    function addCurrency(string memory symbol, address token, uint256 rate) external;

    /**
     * @dev Change currency exhange rate, onlyOwner
     */
    function changeCurrencyRate(string memory symbol, uint256 rate) external;

    /**
     * @dev Delete currency, onlyOwner
     * @notice Cannot delete currency if balanceOf(address(this)) > 0。 admin can redeem balance and delete currency
     */
    function deleteCurrency(string memory symbol) external;
}
