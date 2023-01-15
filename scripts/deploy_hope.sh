#!bin/sh

echo 'begin to deploy all hope contract...........\n\n'

_netwrok=$1

echo "deploy restricted list"
npx hardhat run scripts/hope/1.deploy_restricted_list.ts --network $_netwrok
echo "deploy restricted list_______________\n"

echo "deploy hope token_______________"
npx hardhat run scripts/hope/2.deploy_hope_token.ts --network $_netwrok
echo "deploy hope token_______________\n"

echo "deploy token sale_______________"
npx hardhat run scripts/hope/3.deploy_hope_sales_agent.ts --network $_netwrok
echo "deploy token sale_______________\n"

echo "add currency for token sale_______________"
npx hardhat run scripts/hope/add_currency_for_token_sale.ts --network $_netwrok
echo "add currency for token sale_______________\n"

echo "grant agent to sale_______________"
npx hardhat run scripts/hope/grant_sale_contract_agent.ts --network $_netwrok
echo "grant agent to sale_______________\n"

echo "deploy staking hope"
npx hardhat run scripts/hope/4.staking_hope_gomboc.ts --network $_netwrok
echo "deploy staking hope_______________\n"

echo "add  staking gomboc for gombocController_______________"
npx hardhat run scripts/hope/add_staking_gomboc.ts --network $_netwrok
echo "add  staking gomboc for gombocController_______________\n"

echo 'end to deploy all hope contract.............'