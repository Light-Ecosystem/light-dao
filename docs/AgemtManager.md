# Agent Manager

Agent management, which can grant or revoke the authorization of the address, specify the credit, expiration, whether it can be mint, burn, etc.

## Read

```solidity
function getMaxCredit(address account) public view override returns (uint256)
```

Return agent max credit.

```solidity
function getRemainingCredit(address account) public view override returns (uint256)
```

Return agent remaining credit.

```solidity
function isMinable(address account) public view override returns (bool)
```

Return agent minable status.

```solidity
function isBurnable(address account) public view override returns (bool)
```

Return agent burnable status.

```solidity
function getEffectiveBlock(address account) public view override returns (uint256)
```

Return agent effective block number.

```solidity
function getExpirationBlock(address account) public view override returns (uint256)
```

Return agent expiration block number.

```solidity
function hasAgent(address account) public view override returns (bool)
```

Return whether the address is an agent.

## Write

```solidity
function grantAgent(
        address account,
        uint256 credit,
        uint256 effectiveBlock,
        uint256 expirationBlock,
        bool minable,
        bool burnable
    ) public override onlyOwner
```

Grant the address as agent.

```solidity
function revokeAgent(address account) public override onlyOwner
```

Revoke the agent at the address.

```solidity
function changeEffectiveBlock(address account, uint256 effectiveBlock) public override onlyOwner
```

Change the effective block number of the address agent.

```solidity
function changeExpirationBlock(address account, uint256 expirationBlock) public override onlyOwner
```

Change the expiration block number of the address agent.

```solidity
function switchMinable(address account, bool minable) public override onlyOwner
```

Change the minable status of the address agent.

```solidity
function switchBurnable(address account, bool burnable) public override onlyOwner
```

Change the burnable status of the address agent.

```solidity
function increaseCredit(address account, uint256 credit) public override onlyOwner
```

Increase credit of the address agent.

```solidity
function decreaseCredit(address account, uint256 credit) public override onlyOwner
```

Decrease credit of the address agent.
