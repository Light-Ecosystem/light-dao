
# GombocFactory
 GombocFactory is a factory contract, the main purpose is to deploy PoolGomboc contracts through this contract


# Notice

* Make sure the two constants `_MINTER` and `_PERMIT2_ADDRESS` in the [`PoolGomboc`](../contracts/gombocs/GombocFactory.sol) contract are 
  correct.
* Enough gas: Deploy the PoolGomboc contract through the factory contract more Gas;
eg:
```
    ganache: {
      gas: 4100000,
    }
```




# test script
```
# Deploy other dependent contracts
sh scripts/deploy_light_dao.sh

# Deploy the Gomboc factory contract
npx hardhat run scripts/deploy_gomboc_factory.ts  --network xxx
 
# Deploy the PoolGomboc contract through the factory contract
npx hardhat run scripts/deploy_gomboc_by_gomboc_factory.ts --network xxx
```
