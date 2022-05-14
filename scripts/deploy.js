const hre = require("hardhat");

async function main() {
  const [provider] = await ethers.getSigners();
  const ERC721MarketplaceV1 = await hre.ethers.getContractFactory("ERC721MarketplaceV1");
  const marketplace = await ERC721MarketplaceV1.connect(provider).deploy();
  await marketplace.deployed();
  console.log("ERC721MarketplaceV1 deployed to:", marketplace.address);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });