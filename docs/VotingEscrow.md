

# LT DAO: Vote-Escrowed LT


Participating in LT DAO governance requires that an account have a balance of vote-escrowed LT (veLT). veLT is a non-standard ERC20 implementation, used within the Aragon DAO to determine each account’s voting power.

veLT is represented by the `VotingEscrow` contract, deployed to the Ethereum mainnet at:

> xxxxxxxxx

veLT cannot be transferred. The only way to obtain veLT is by locking LT. The maximum lock time is four years. Ten thousand LT  locked for four years provides an initial balance of one veLT.

A user’s veLT balance decays linearly as the remaining time until the LT unlock decreases. For example, a balance of 40000 LT locked for one year provides the same amount of veLT as 20000 LT locked for two years, or 10000 LT locked for four years.



## Implementation Details

User voting power  ```Wi```   is linearly decreasing since the moment of lock. So does the total voting power W. In order to avoid periodic check-ins, every time the user deposits, or withdraws, or changes the locktime, we record user’s slope and bias for the linear function  ```Wi(t)```  in the public mapping `userPointHistory`. We also change slope and bias for the total voting power W(t) and record it in `supplyPointHistory`. In addition, when a user’s lock is scheduled to end, we schedule change of slopes of W(t) in the future in `slopeChanges`. Every change involves increasing the `epoch` by 1.



This way we don’t have to iterate over all users to figure out, how much should W(t) change by, neither we require users to check in periodically. However, we limit the end of user locks to times rounded off by whole weeks.



Slopes and biases change both when a user deposits and locks governance tokens, and when the locktime expires. All the possible expiration times are rounded to whole weeks to make number of reads from blockchain proportional to number of missed weeks at most, not number of users (which is potentially large).



```
// point struct
struct Point {
    int256 bias;
    int256 slope;
    uint256 ts;
    uint256 blk;
}

// baba lock amount struct
struct LockedBalance {
    int256 amount;
    uint256 end;
}

uint256 public constant MAXTIME = 4 * 365 * 86400; // 4 years
slope =  lock.amount / int256(MAXTIME)
bias = slope * int256(lock.end - block.timestamp)
ts = block.timestamp
blk = block.number


veLT balanceOf calculation:
_lastPoint.bias -= _lastPoint.slope * int256(block.timestamp - _lastPoint.ts);
veBalance = min(_lastPoint.bias,0);
       

```



## Querying Balances, Locks and Supply

```solidity
function balanceOf(address _addr) external view returns (uint256)
```

Get the current voting power for an address.



```solidity
function balanceOfAt(address _addr, uint256 _block) external view returns (uint256)
```

Measure the voting power of an address at a historic block height.

- `_addr`: User wallet address
- `_block`: Block to calculate the voting power at



```solidity
function balanceOfAtTime(address _addr, uint256 _t) external view returns (uint256)
```

Measure the voting power of an address at a historic  timestamp.

- `_addr`: User wallet address

- `_t:` timestamp to calculate the voting power at

  

```solidity
function totalSupply() external view returns (uint256)
```

Calculate the current total voting power.



```solidity
function totalSupplyAt(uint256 _block) external view returns (uint256)
```

Calculate the total voting power at a historic block height



```solidity
function totalSupplyAtTime(uint256 _t) external view returns (uint256)
```

Calculate the total voting power at a historic timestamp



```
locked(address _addr) external view returns(LockedBalance)

    struct LockedBalance {
        int256 amount;
        uint256 end;
    }
```

Get information about the current LT lock for an address.



## Working with Vote-Locks

```solidity
 function createLock(uint256 _value, uint256 _unlockTime, uint256 nonce, uint256 deadline, bytes memory signature) external
```

Deposit LT into the contract and create a new lock.  A new lock cannot be created when an existing lock already exists.

- `_value`: The amount of LT to deposit.
- `_unlock_time` Epoch time when tokens unlock. This value is rounded down to the nearest whole week. The maximum duration for a lock is four years.
- nonce: Permit2 require
- deadline: Permit2 require
- signature: Permit2 require



```solidity
function increaseAmount(uint256 _value, uint256 nonce, uint256 deadline, bytes memory signature) external
```

Deposit additional LT into an existing lock.



```solidity
function increaseUnlockTime(uint256 _unlockTime) external
```

Extend the unlock time on a lock that already exists.

* `_unlock_time` New epoch time for unlocking. This value is rounded down to the nearest whole week. The maximum duration for a lock is four years.

  

```
function withdraw() external
```

Withdraw deposited LT tokens once a lock has expired.