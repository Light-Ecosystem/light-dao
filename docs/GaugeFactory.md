
# GaugeFactory
 GaugeFactory is a factory contract, the main purpose is to deploy PoolGauge contracts through this contract


# Notice

* Make sure the two constants `_MINTER` and `_PERMIT2_ADDRESS` in the [`PoolGauge`](../contracts/gauges/GaugeFactory.sol) contract are 
  correct.
* Enough gas: Deploy the PoolGauge contract through the factory contract more Gas;
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

# Deploy the Gauge factory contract
npx hardhat run scripts/deploy_gauge_factory.ts  --network xxx
 
# Deploy the PoolGauge contract through the factory contract
npx hardhat run scripts/deploy_gauge_by_factory.ts --network xxx
```
