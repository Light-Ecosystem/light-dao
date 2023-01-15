# Error codes

## Common Error related

`CE000` : `Invalid Address`
`CE001` : `Invalid Symbol`
`CE002` : `Insufficient balance`

## Gomboc Controller related

`GC000` : `Gomnoc not added`
`GC001` : `Invalid Gomboc Type`
`GC002` : `Cannot add the same gomboc twice`
`GC003` : `Your token lock expires too soon`
`GC004` : `You used all your voting power`
`GC005` : `Cannot vote so often`
`GC006` : `Used too much power`

## VotingEscrow related

`VE000` : `Can't lock zero value`
`VE001` : `Withdraw old tokens first`
`VE002` : `Can only lock until time in the future`
`VE003` : `Voting lock can be 4 years max`
`VE004` : `No existing lock found`
`VE005` : `Cannot add to expired lock. Withdraw first`
`VE006` : `Lock expired`
`VE007` : `Nothing is locked`
`VE008` : `Can only increase lock duration`
`VE009` : `Voting lock can be 4 years max`
`VE010` : `The lock didn't expire`
`VE011` : `Can't exceed lasted block`

## LT Token related

`BA000` : `updateMiningParameters too soon`
`BA001` : `start must greater end`
`BA002` : `too far in future`
`BA003` : `can set the minter only once`
`BA004` : `minter only`
`BA005` : `exceeds allowable mint amount`

## Agent related

`AG000` : `The address is not agent`
`AG001` : `The address is already agent`
`AG002` : `The address cannot mint`
`AG003` : `The address cannot burn`
`AG004` : `Insufficient credit`
`AG005` : `Credit must greater than zero`
`AG006` : `Expiration time must be greater than or equal to the now`
`AG007` : `Increase credit must greater than zero`
`AG008` : `Decrease credit must greater than zero`
`AG009` : `Decrease credit must less than or equal remaining credit`
`AG010` : `The modification status is the same as the current one`
`AG011` : `The address authorization has expired`
`AG012` : `Invalid effective time`
`AG013` : `Invalid expiration time`
`AG014` : `The address has not reached authorization effective time`
`AG015` : `The effective time must be less than expiration time`

## RetrictedList related

`FA000` : `The address has been forbade`

## HOPE Token related

`HO000` : `Only the CA can be called`

## HOPE Sales related

`HS000` : `Unsupport currency`
`HS001` : `The minimum purchase quota cannot be reached`
`HS002` : `The currency is already exist`
`HS003` : `Rate must greater than zero`
`HS004` : `Invalid param, it is different from contract symbol`
`HS005` : `Please redeem balance before delete the currency`
