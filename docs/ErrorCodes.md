# Error codes

## Common Error related

`CE000` : `Invalid Address.`
`CE001` : `Invalid Symbol.`
`CE002` : `Insufficient balance.`

## Gauge Controller related

`GC000` : `Gauge not added.`
`GC001` : `Invalid Gauge Type.`
`GC002` : `Cannot add the same gauge twice.`
`GC003` : `Your LT vote-lock is expiring soon.`
`GC004` : `You used all your voting power.`
`GC005` : `You are on voting cool-down. (You have to wait 10 days between 2 votes).`
`GC006` : `Not sufficient voting power.`
`GC007` : `Invalid Param.`

## VotingEscrow related

`VE000` : `Lock amount can’t be zero.`
`VE001` : `Please withdraw before locking new tokens.`
`VE002` : `Unlock time needs to be in the future.`
`VE003` : `The max. lock time is 4 years.`
`VE004` : `No existing lock found.`
`VE005` : `Cannot add to expired lock. Withdraw first.`
`VE006` : `Lock expired.`
`VE007` : `No existing lock found.`
`VE008` : `You can only increase lock duration.`
`VE009` : `The max. lock time is 4 years.`
`VE010` : `The lock didn't expire.`
`VE011` : `Can’t go exceed the latest block.`

## LT Token related

`BA000` : `updateMiningParameters not updated yet.`
`BA001` : `The start time has to be earlier than the end time.`
`BA002` : `too far in future.`
`BA003` : `can set the minter only once.`
`BA004` : `Accessible to the minter only.`
`BA005` : `exceeds max. allowable mint amount.`

## Agent related

`AG000` : `The address is not authorized as an agent.`
`AG001` : `The address is already authorized as an agent.`
`AG002` : `The address cannot mint.`
`AG003` : `The address cannot burn.`
`AG004` : `Insufficient credit.`
`AG005` : `Credit must be greater than zero.`
`AG006` : `Expiration block height must be greater than or equal to the current one.`
`AG007` : `The increase in credit must be greater than zero.`
`AG008` : `The decrease in credit must be greater than zero.`
`AG009` : `The decrease in credit must be less than or equal to the remaining credit.`
`AG010` : `The modified status is the same as the current one.`
`AG011` : `The address authorization has expired.`
`AG012` : `Invalid effective block height.`
`AG013` : `Invalid expiration block height.`
`AG014` : `The latest block height has not reach the effective authorization block height of the address.`
`AG015` : `The effective block height must be smaller than the expiration block height.`

## RetrictedList related

`FA000` : `The address has been forbidden.`

## HOPE Token related

`HO000` : `Can only be called by the CA.`

## HOPE Sales related

`HS000` : `Unsupport currency.`
`HS001` : `The minimum purchase quota not met.`
`HS002` : `The currency already exists.`
`HS003` : `Rate must greater than zero.`
`HS004` : `Invalid param, it is different from contract symbol.`
`HS005` : `Please redeem the balance before removing the currency.`

## FeeDistributor related

`FD001` : `can not perform checkpoint now.`

## Staking Hope

`SH` : `Unsupport currency.`

# Gauge Pool

`GP000` : `Unauthorized.`
`GP001` : `Kick not allowed.`
`GP002` : `Initiation forbidden.`
`GP003` : `Negative after decreasing.`
`GP004` : `Reward Threshold exceeded.`
`GP005` : `Repeated setting.`
`GP006` : `Must be the currentDistributor or owner.`
`GP007` : `CurrentDistributor the zero address.`
`GP008` : `Distributor the zero address.`
`GP009` : `No permission to execute.`
`GP010` : `Transfer failed.`
`GP011` : `Cannot redirect when claiming for another user.`

# Gauge Factroy

`GF000` : `No permission to create pool.`

# HOPE Automation Mint & Burn Vault

`VA000` : `Only callable by addresses with gateway.`
`VA001` : `Invalid amount.`
`VA002` : `No stETH to claim.`
`VA003` : `No HOPE to claim.`
`VA004` : `Rate must be greater than 0 and less than 1e5.`
`VA005` : `The reserve asset cannot be rescued.`

# HOPE Automation Mint & Burn Gateway

`GW000` : `Invalid token combination.`
`GW001` : `Invalid input array length.`
`GW002` : `Invalid token addresses.`
`GW003` : `Tokens for deposit must match.`
`GW004` : `The deposit token is not supported.`
`GW005` : `The deposit token is frozen.`
`GW006` : `Destination tokens must match.`
`GW007` : `The withdraw token is not supported.`
`GW008` : `The withdraw token is frozen.`
`GW009` : `Array lengths must match.`
`GW010` : `Invalid amount.`
`GW011` : `SwapAggregator: EXPIRED.`
`GW012` : `SwapAggregator: RETURN_AMOUNT_ZERO.`
`GW013` : `SwapAggregator: Not Whitelist Contract.`
`GW014` : `SwapAggregator: External Swap execution Failed.`
`GW015` : `SwapAggregator: Return amount is not enough.`
`GW016` : `Only callable by addresses with the emergency or vault manager.`
