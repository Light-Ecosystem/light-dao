#!bin/sh

echo 'begin to deploy all test contract...........\n\n'

_netwrok=$1
echo $_netwrok

echo "deploy all dao contract"
sh scripts/deploy_dao.sh $_netwrok
echo "deploy all dao contract_______________\n"

echo "deploy all hope contract"
sh scripts/deploy_hope.sh $_netwrok
echo "deploy all hope contract_______________\n"

echo "deploy all fee distributor contract"
sh scripts/deploy_feeDistributor.sh $_netwrok
echo "deploy all fee distributor contract_______________\n"

echo 'end to deploy all test contract.............'