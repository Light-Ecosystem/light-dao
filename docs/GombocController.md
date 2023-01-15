# GombocController



GombocController maintains a list of gombocs and their types, with the weights of each gomboc and type.

Users can allocate their veLT towards one or more liquidity gombocs. Gombocs receive a fraction of newly minted LT tokens proportional to how much veLT the gomboc is allocated. Each user with a veLT balance can change their preference at any time.

When a user applies a new weight vote, it gets applied at the start of the next epoch week. The weight vote for any one gomboc cannot be changed more often than once in 10 days.

## Implementation Details



In order to implement weight voting, `GombocController` has to include parameters handling linear character of voting power each user has.

`GombocController` records points (bias + slope) per gomboc in `pointsWeight`, and _scheduled_ changes in biases and slopes for those points in `_changes_weight` . New changes are applied at the start of each epoch week.

Per-user, per-gomboc slopes are stored in `voteUserSlopes`, along with the power the user has used and the time their vote-lock ends.

The totals for slopes and biases for vote weight per gomboc, and sums of those per type, are scheduled / recorded for the next week, as well as the points when voting power gets to 0 at lock expiration for some of users.

When a user changes their gomboc weight vote, the change is scheduled for the next epoch week, not immediately. This reduces the number of reads from storage which must to be performed by each user: it is proportional to the number of weeks since the last change rather than the number of interactions from other users.



### RelativeWeight calculation

**Gomboc Type  Weight(Wt)**:  type weight, it is set when addType by owner

**Gomboc Weight(Wg)**:   user call ```function voteForGombocWeights(address gombocAddress, uint256 userWeight) external``` to allocate voting power for changing gomboc weights

**totalWeight** = sumOfAllGombocs(Wt*Wg)

**RelativeWeight** = (Wt*Wg) / totalWeight

**Example**:

Gomboc1 : Wg=1000,Wt=20

Gomboc2 : Wg=2000,Wt=10 

TotalWeight = 1000  * 20 + 2000 * 10  = 40000

Gomboc1 RelativeWeight :  1000 * 20 * 1e18 /  40000 = 0.5 * 1e18 （50%）

Gomboc2 RelativeWeight :  2000 * 10 * 1e18 /  40000 = 0.5 * 1e18 （50%）

Inflation which will be received by this gomboc is calculated as `inflation_rate * RelativeWeight / 1e18`. 




## Querying Gomboc and Type Weights

```solidity
function gombocTypes(address _addr) external view returns (int128)
```

The gomboc type for a given address, as an integer. Reverts if address is not a gomboc.

```solidity
function getGombocWeight(address addr) external view returns (uint256) 100
```

The current gomboc weight for gomboc address.

```solidity
function getTypeWeight(int128 type_id) external view returns (uint256) 10
```

The current type weight for type_id as an integer normalized to 1e18.

```solidity
function getTotalWeight() external view returns (uint256)  100*10
```

The current total (type-weighted) weight for all gombocss.

```solidity
function getWeightsSumPreType(int128 type_id) external view returns (uint256) 
```

The sum of all gomboc weights for type_id.


## Vote-Weighting

Vote weight power is expressed as an integer in bps (units of 0.01%). 10000 is equivalent to a 100% vote weight



```solidity
function voteUserPower(address addr) external view
```

The total vote weight power allocated by user.

```solidity
function lastUserVote(address userAddr,address gombocAddr) external view returns (uint256) 
```


Epoch time of the last vote by user for gomboc.  A gomboc weight vote may only be modified once every 10 days


```solidity
function voteUserSlopes(address userAddr,address gombocAddr) external view returns (VotedSlope) 

struct VotedSlope {
        uint256 slope;
        uint256 power;
        uint256 end;
    }

```

Information about user’s current vote weight for gomboc



```solidity
function voteForGombocWeights(address gombocAddress, uint256 userWeight) external
```

Allocate voting power for changing gomboc weights. 

* gombocAddress : Gomboc which msg.sender votes for
* userWeight:  Weight for a gomboc in bps (units of 0.01%). Minimal is 0%. Max is 100%. example,10%=1000,3%=300,0.01%=1,100%=10000



## Adding New Gombocs and Types

All of the following methods are only be callable by the DAO[ownership admin



```solidity
function addType(string memory _name, uint256 weight) external onlyOwner
```

Add a new gomboc type.

- `_name`: Name of gomboc type
- `weight`: Weight of gomboc type



```solidity
function changeTypeWeight(int128 type_id, uint256 weight) external onlyOwner
```

Change the weight for a given gomboc type.

- `type_id` Gomboc type id
- `weight` New Gomboc weight



```solidity
function addGomboc(address addr, int128 gombocType, uint256 weight) external onlyOwner
```

Add a new Gomboc.

- `addr`: Address of the new gomboc being added
- `gombocType`:  gomboc type
- weight: gomboc initial weight. The initial gomboc weight does not decrease over time

> **NOTE** 
>
> Once a gomboc has been added it cannot be removed. New gombocs should be very carefully verified prior to adding them to the gomboc controller.



```solidity
function changeGombocWeight(address gombocAddress, uint256 weight) external onlyOwner
```

Change weight of gomboc `addr` to `weight`

```solidity
function gombocRelativeWeight(address gombocAddress, uint256 time) external view returns (uint256)
```

Get the relative the weight of a gomboc normalized to 1e18 (e.g. 1.0 == 1e18).

Inflation which will be received by this gomboc is calculated as `inflation_rate * relative_weight / 1e18`. 

*  `gombocAddress`:  Gomboc address 
*  `time`:  Epoch time to return a gomboc weight for. If not given, defaults to the current block time



