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
function getEffectiveTime(address account) public view override returns (uint256)
```

Return agent effective time.

```solidity
function getExpirationTime(address account) public view override returns (uint256)
```

Return agent expiration time.

```solidity
function hasAgent(address account) public view override returns (bool)
```

Return whether the address is an agent.

## Write

```solidity
function grantAgent(
        address account,
        uint256 credit,
        uint256 effectiveTime,
        uint256 expirationTime,
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
function changeEffectiveTime(address account, uint256 effectiveTime) public override onlyOwner
```

Change the effective time of the address agent.

```solidity
function changeExpirationTime(address account, uint256 expirationTime) public override onlyOwner
```

Change the expiration time of the address agent.

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
