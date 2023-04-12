#!bin/sh

echo 'begin to deploy all hope contract...........\n\n'

_netwrok=$1

echo "deploy restricted list"
npx hardhat run scripts/hope/1.deploy_restricted_list.ts --network $_netwrok
echo "deploy restricted list_______________\n"

echo "deploy hope token_______________"
npx hardhat run scripts/hope/2.deploy_hope_token.ts --network $_netwrok
echo "deploy hope token_______________\n"

echo "deploy staking hope"
npx hardhat run scripts/hope/4.staking_hope_gauge.ts --network $_netwrok
echo "deploy staking hope_______________\n"

echo "add  staking gauge for gaugeController_______________"
npx hardhat run scripts/hope/add_staking_gauge.ts --network $_netwrok
echo "add  staking gauge for gaugeController_______________\n"

echo 'end to deploy all hope contract.............'