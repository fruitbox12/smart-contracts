const hre = require("hardhat");

async function main() {
  const [provider] = await ethers.getSigners();

  const ERC721DappifyV1 = await hre.ethers.getContractFactory("ERC721DappifyV1");
  const token721 = await ERC721DappifyV1.connect(provider).deploy();
  await token721.deployed();
  console.log("ERC721DappifyV1 deployed to:", token721.address);

  const ERC1155DappifyV1 = await hre.ethers.getContractFactory("ERC1155DappifyV1");
  const token1155 = await ERC1155DappifyV1.connect(provider).deploy();
  await token1155.deployed();
  console.log("ERC1155DappifyV1 deployed to:", token1155.address);

  const Marketplace = await hre.ethers.getContractFactory("NFTMarketplaceV1");
  const marketplace = await Marketplace.connect(provider).deploy();
  await marketplace.deployed();
  console.log("Marketplace deployed to:", marketplace.address);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });