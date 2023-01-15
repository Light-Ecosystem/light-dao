# HOPE

Standard ERC20 Token

## Function

```solidity
function mint(address to, uint256 amount) public onlyAgent onlyMinable
```

Provide mint for Agent. If it is not an agent, it is not allowed to mint.

```solidity
function burn(uint256 amount) external onlyAgent onlyBurnable
```

Provide burn for Agent. If it is not an agent, it is not allowed to burn.
