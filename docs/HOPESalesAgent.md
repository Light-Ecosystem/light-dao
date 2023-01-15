# HOPE Sales Agent

Hope sales contract. ERC20 added to Sales can be used to purchase HOPE according to the corresponding proportion

## Currency

```solidity
function addCurrency(string memory symbol, address token, uint256 rate) external onlyOwner
```

Add currency to sales contract.

```solidity
function changeCurrencyRate(string memory symbol, uint256 rate) external onlyOwner
```

Modify sales contract currency data.

```solidity
function deleteCurrency(string memory symbol) external onlyOwner
```

Delete sales contract currency.

## Buy

```solidity
function buy(
        string memory fromCurrency,
        uint256 fromValue,
        uint256 nonce,
        uint256 deadline,
        bytes memory signature
) external whenNotPaused
```

Use the ERC20 added to purchase HOPE.

- fromCurrency Payment ERC20 symbol
- fromValue Payment amount
- nonce Signature nonce
- deadline Signature deadline
- Signature EIP712 signature

## Redeem

```solidity
function redeem(
        string memory symbol,
        address to,
        uint256 amount
) external onlyOwner whenNotPaused returns (bool)
```

Redeem ERC20 balance to special address.

## Transction

```solidity
function transactionCount() public view returns (uint256)
```

Return the quantity of all transactions.

```solidity
function getTransacitonList(address account) external view returns (Transaction[] memory)
```

Return the list of all transactions at the specified address.
