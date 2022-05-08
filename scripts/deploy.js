const hre = require("hardhat");
const fs = require('fs');

async function main() {
  const [owner, provider] = await ethers.getSigners();
  const NFTMarketplace = await hre.ethers.getContractFactory("Marketplace");
  const nftMarketplace = await NFTMarketplace.deploy(owner.address, 0, provider.address, 0);
  await nftMarketplace.deployed();
  console.log("nftMarketplace deployed to:", nftMarketplace.address);

  // fs.writeFileSync('./config.js', `
  //   export const marketplaceAddress = "${nftMarketplace.address}"
  // `)
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });