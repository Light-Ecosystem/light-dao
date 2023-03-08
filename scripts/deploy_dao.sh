#!bin/sh

echo 'begin to deploy all lt dao contract...........\n\n'

_netwrok=$1

echo "deploy permit2_______________"
npx hardhat run scripts/dao/1.deploy_permit2.ts --network $_netwrok
echo "deploy permit2_______________\n"

echo "deploy LT token_______________"
npx hardhat run scripts/dao/2.deploy_LT_token.ts --network $_netwrok
echo "deploy LT token_______________\n"

echo "deploy veLT token_______________"
npx hardhat run scripts/dao/3.deploy_veLT_token.ts --network $_netwrok
echo "deploy veLT token_______________\n"

echo "deploy gauge controller_______________"
npx hardhat run scripts/dao/4.deploy_gauge_controller.ts --network $_netwrok
echo "deploy gauge controller_______________\n"

echo "deploy lt minter_______________"
npx hardhat run scripts/dao/5.deploy_LT_minter.ts --network $_netwrok
echo "deploy lt minter_______________\n"

echo "set lt minter_______________"
npx hardhat run scripts/dao/6.LT_set_minter.ts --network $_netwrok
echo "set lt minter_______________\n"


echo "deploy pool gauge _______________"
npx hardhat run scripts/dao/7.deploy_pool_gauge.ts --network $_netwrok
echo "deploy pool gauge _______________\n"

echo "deploy pool gauge factory_______________"
npx hardhat run scripts/dao/8.deploy_gauge_factory.ts --network $_netwrok
echo "deploy pool gauge factory_______________\n"

echo "deploy SmartWalletWhitelist contract"
npx hardhat run scripts/dao/9.deploy_smartWalletWhitelist.ts --network $_netwrok
echo "deploy SmartWalletWhitelist contract_______________\n"

echo 'end to deploy all lt dao contract.............'