#!bin/sh

echo 'begin to deploy all fee distributor contract...........\n\n'

_netwrok=$1

echo "deploy burner manager"
npx hardhat run scripts/feeDistributor/1.deploy_burner_manager.ts --network $_netwrok
echo "deploy burner manager_______________\n"


echo "deploy feeDistributor_______________"
npx hardhat run scripts/feeDistributor/2.deploy_feeDistributor.ts --network $_netwrok
echo "deploy feeDistributor_______________\n"

echo "deploy gaugeFeeDistributor_______________"
npx hardhat run scripts/feeDistributor/3.deploy_gauge_feeDistributor.ts --network $_netwrok
echo "deploy gaugeFeeDistributor_______________\n"

echo "deploy underlyingBurner_______________"
npx hardhat run scripts/feeDistributor/4.deploy_underlying_burner.ts --network $_netwrok
echo "deploy underlyingBurner_______________\n"

echo "deploy feeToVault"
npx hardhat run scripts/feeDistributor/5.deploy_fee_to_vault.ts --network $_netwrok
echo "deploy feeToVault_______________\n"

echo "deploy HopeSwapBurner_______________"
npx hardhat run scripts/feeDistributor/6.deploy_hope_swap_burner.ts --network $_netwrok
echo "deploy HopeSwapBurner_______________\n"

echo "set hope and lt burner_______________"
npx hardhat run scripts/feeDistributor/7.set_hope_lt_burner.ts --network $_netwrok
echo "set hope and lt burner_______________\n"

echo 'end to deploy all fee distributor contract.............'
