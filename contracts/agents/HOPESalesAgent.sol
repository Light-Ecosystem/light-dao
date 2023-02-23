// SPDX-License-Identifier: LGPL-3.0

pragma solidity 0.8.17;

import "@openzeppelin/contracts/security/Pausable.sol";
import "@openzeppelin/contracts/access/Ownable2Step.sol";
import "../interfaces/IHOPESalesAgent.sol";
import "../interfaces/IHOPE.sol";
import {TransferHelper} from "light-lib/contracts/TransferHelper.sol";
import {StringUtils} from "light-lib/contracts/StringUtils.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol";

/**
 * @title LT Dao's HOPESalesAgent Contract
 * @notice HOPE Sales Agent
 * @author LT
 */
contract HOPESalesAgent is IHOPESalesAgent, Ownable2Step, Pausable {
    /**
     * @dev Currency info
     */
    struct Currency {
        address token;
        string symbol;
        uint256 rate;
    }

    // Currency rate denominator rate/rateDenominator,if TokenA:TokenB=1:1, set rate = 1000*10^(Adecimal-Bdecimal)
    uint256 public immutable rateDenominator;

    // HOPE token contract
    address public immutable hopeToken;

    // Permit2 contract
    address public permit2;

    // Map of currencies available for purchase  currencySymbol => Currency
    mapping(string => Currency) public currencys;

    constructor(address _hopeToken, address _permit2) {
        hopeToken = _hopeToken;
        permit2 = _permit2;
        rateDenominator = 1000;
    }

    /**
     * @dev Buy HOPE token
     * @notice If the user has no allowance, needs approve to Permit2
     * @param fromCurrency Payment ERC20 symbol
     * @param fromValue Payment amount
     * @param nonce Signature nonce
     * @param deadline Signature deadline
     * @param signature EIP712 signature
     */
    function buy(
        string memory fromCurrency,
        uint256 fromValue,
        uint256 nonce,
        uint256 deadline,
        bytes memory signature
    ) external whenNotPaused {
        Currency storage cy = currencys[fromCurrency];
        require(cy.token != address(0), "HS000");

        uint256 toValue = _getToValue(fromValue, cy.rate);
        require(toValue > 0, "HS001");
        require(toValue <= this.remainingCredit(), "AG004");

        address buyer = _msgSender();
        TransferHelper.doTransferIn(permit2, cy.token, fromValue, buyer, nonce, deadline, signature);
        IHOPE(hopeToken).mint(buyer, toValue);

        emit Buy(fromCurrency, buyer, fromValue, toValue, block.timestamp);
    }

    /**
     * @dev Return agent remaining credit
     */
    function remainingCredit() external view returns (uint256) {
        return IHOPE(hopeToken).getRemainingCredit(address(this));
    }

    /**
     * @dev Return erc20 balance from sales contract
     */
    function balanceOf(string memory symbol) external view returns (uint256) {
        Currency storage cy = currencys[symbol];
        if (cy.token == address(0)) {
            return 0;
        }

        return IERC20(cy.token).balanceOf(address(this));
    }

    /**
     * @dev Redeem erc20 balance, onlyOwner
     * @param symbol Redeem erc20 symbol
     * @param to Redeem to address
     * @param amount Redeem amount
     */
    function redeem(string memory symbol, address to, uint256 amount) external onlyOwner whenNotPaused returns (bool) {
        Currency storage cy = currencys[symbol];
        require(cy.token != address(0), "CE001");

        uint256 balance = this.balanceOf(symbol);
        require(balance >= amount, "CE002");

        TransferHelper.doTransferOut(cy.token, to, amount);

        emit Redeem(symbol, to, amount);
        return true;
    }

    /**
     * @dev Add currency that can buy HOPE token, onlyOwner
     * @param symbol ERC20 symbol
     * @param token ERC20 address
     * @param rate Currency rate
     */
    function addCurrency(string memory symbol, address token, uint256 rate) external onlyOwner {
        Currency storage cy = currencys[symbol];
        require(cy.token == address(0), "HS002");
        require(rate > 0, "HS003");
        require(token != address(0), "CE000");

        IERC20Metadata erc20 = IERC20Metadata(token);
        string memory erc20Symbol = erc20.symbol();
        require(StringUtils.hashCompareWithLengthCheck(symbol, erc20Symbol), "HS004");
        cy.symbol = symbol;
        cy.token = token;
        cy.rate = rate;

        emit AddCurrency(symbol, token, rate);
    }

    /**
     * @dev Change currency exhange rate, onlyOwner
     * @param symbol ERC20 symbol
     * @param rate Currency rate
     */
    function changeCurrencyRate(string memory symbol, uint256 rate) external onlyOwner {
        Currency storage cy = currencys[symbol];
        require(cy.token != address(0), "CE001");
        require(rate > 0, "HS003");
        uint256 oldRate = cy.rate;
        cy.rate = rate;

        emit ChangeCurrencyRate(symbol, rate, oldRate);
    }

    /**
     * @dev Delete currency, onlyOwner
     * @notice Cannot delete currency if balanceOf(address(this)) > 0。 admin can redeem balance and delete currency
     * @param symbol ERC20 symbol
     */
    function deleteCurrency(string memory symbol) external onlyOwner {
        Currency storage cy = currencys[symbol];
        require(cy.token != address(0), "CE001");
        require(this.balanceOf(symbol) == 0, "HS005");

        delete currencys[symbol];

        emit DeleteCurrency(symbol);
    }

    /**
     * @dev Set permit2 address, onlyOwner
     * @param newAddress New permit2 address
     */
    function setPermit2Address(address newAddress) external onlyOwner {
        require(newAddress != address(0), "CE000");
        address oldAddress = permit2;
        permit2 = newAddress;
        emit SetPermit2Address(oldAddress, newAddress);
    }

    function _getToValue(uint256 fromValue, uint256 rate) internal view returns (uint256) {
        return (fromValue * rate) / rateDenominator;
    }

    function pause() public onlyOwner {
        _pause();
    }

    function unpause() public onlyOwner {
        _unpause();
    }
}
