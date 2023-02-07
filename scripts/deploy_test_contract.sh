#!bin/sh

echo 'begin to deploy all test contract...........\n\n'

_netwrok=$1
echo $_netwrok

echo "deploy mock usdt and usdc_______________"
npx hardhat run scripts/mock/deploy_mock_usdt_usdc.ts --network $_netwrok
echo "deploy mock usdt and usdc_______________\n"

echo "deploy all dao contract"
sh scripts/deploy_dao.sh $_netwrok
echo "deploy all dao contract_______________\n"

echo "deploy all hope contract"
sh scripts/deploy_hope.sh $_netwrok
echo "deploy all hope contract_______________\n"

echo "deploy all fee distributor contract"
sh scripts/deploy_feeDistributor.sh $_netwrok
echo "deploy all fee distributor contract_______________\n"

echo "deploy mock admin_______________"
npx hardhat run scripts/mock/mock_admin.ts --network $_netwrok
echo "deploy mock admin_______________\n"

echo "set mock lp token for pool_gomboc_______________"
npx hardhat run scripts/mock/mock_lp_token.ts --network $_netwrok
echo "set mock lp token for pool_gomboc_______________\n"

#echo "set pool gomboc_______________"
#npx hardhat run scripts/mock/deploy_gomboc_by_factory.ts --network $_netwrok
#echo "set pool gmoboc_______________\n"

#echo "add  mock gomboc for gombocController_______________"
#npx hardhat run scripts/mock/mock_add_gomboc.ts --network $_netwrok
#echo "add  mock gomboc for gombocController_______________\n"

echo "daploy swap_______________"
npx hardhat run scripts/mock/deploy_mock_swap.ts --network $_netwrok
echo "deploy swap_______________\n"

echo "set usdt/usdc/dai burner_______________"
npx hardhat run scripts/mock/mock_set_usdt_burner.ts --network $_netwrok
echo "set usdt/usdc/dai burner_______________\n"

echo 'end to deploy all test contract.............'