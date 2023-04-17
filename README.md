# Overview

Solidity contracts used in the [Light-DAO](https://app.hope.money) Governance DAO. View the [documentation](https://docs.hope.money/) for a more in-depth explanation of how Light DAO works.

# Testing and Development

## Dependencies

1. **[Node.js](****https://github.com/nodejs/release#release-schedule****)**
2. **[Yarn](****https://github.com/yarnpkg/yarn****)**
3. **Git**

## Setup

To get started, make sure you have installed git, node, yarn and other dependent packages. Next, clone the repo and install the developer dependencies:

```TypeScript
git clone https://github.com/Light-Ecosystem/light-dao.git
cd light-dao
# copy and update .env.ts file
cp .env.example .env
yarn
```

### Running the Tests

To run the entire tests

```TypeScript
yarn hardhat test
```

### Deployment

```TypeScript
 # sepolia, goerli or others
 sh ./scripts/deploy.sh sepolia xxx
```

# Audits and Security

Light DAO contracts have been audited by  SlowMist and Certic. These audit reports are made available on the [Audit](https://github.com/Light-Ecosystem/light-dao/tree/main/audit).

There is also an active [bug bounty](https://static.hope.money/bug-bounty.html) for issues which can lead to substantial loss of money, critical bugs such as a broken live-ness condition, or irreversible loss of funds.

# Resources

You may find the following guides useful:

1. [Light and Light DAO Resources](https://docs.hope.money/)
2. [How to earn and claim LT](https://docs.hope.money/reward-gauges/claiming-rewards)
3. [Voting and vote locking on Light DAO](https://docs.hope.money/lightdao-governance/voting)

# Community

If you have any questions about this project, or wish to engage with us:

- [Websites](https://hope.money/)
- [Medium](https://hope-ecosystem.medium.com/)
- [Twitter](https://twitter.com/hope_ecosystem)
- [Discord](https://discord.com/invite/hope-ecosystem)

# License

This project is licensed under the [AGPL-3.0](LICENSE) license.