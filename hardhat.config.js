/* hardhat.config.js */
require("@nomiclabs/hardhat-waffle");
require("hardhat-gas-reporter");
require('dotenv').config({path:__dirname+'/.env'});

module.exports = {
  defaultNetwork: "hardhat",
  networks: {
    hardhat: {
      chainId: 1337
    }
  },
  solidity: {
    version: "0.8.9",
    settings: {
      optimizer: {
        enabled: true,
        runs: 200
      }
    }
  },
  gasReporter: {
    coinmarketcap: process.env.PRICING_API_KEY,
    currency: 'USD'
  }
}