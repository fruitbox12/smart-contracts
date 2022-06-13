/* test/sample-test.js */
const { expect } = require('chai');

describe("Marketplace offer withdrawal", () => {
  let owner;
  let provider
  let seller;
  let marketplace;
  let nft, nft1155;
  let offeringId;
  const price = 200000;
  const tokenUri = 'https://dappify.com/img/{id}.json';
  const baseAmount = 10;

  beforeEach(async function () {
    // Accounts
    [owner, provider, seller] = await ethers.getSigners();
    // Marketplace
    const Marketplace = await ethers.getContractFactory('NFTMarketplaceV1');
    marketplace = await Marketplace.connect(provider).deploy();
    await marketplace.deployed();
    // Nft
    const Token = await ethers.getContractFactory('ERC721DappifyV1');
    nft = await Token.deploy('Name', 'Symbol');
    await nft.deployed();
    const Token1155 = await ethers.getContractFactory('ERC1155DappifyV1');
    nft1155 = await Token1155.deploy('Name', 'Symbol', 'URI');
    await nft1155.deployed();
  });

  it("Should not allow anyone except seller to withdraw item from sale [ERC721]", async () => {
    // Mint test token to put on marketplace
    const txMint = await nft.mint(seller.address, seller.address, 0, tokenUri);
    const transactionMint = await txMint.wait();
    const tokenId = transactionMint.events[0].args['tokenId'];
    // Put on marketplace
    const tx = await marketplace.connect(seller).placeOffering(nft.address, tokenId, price, owner.address, 1);
    // Get offeringId from OfferingPlaced event in transaction
    const transactionCompleted = await tx.wait();
    offeringId = transactionCompleted.events?.filter((item) => {return item.event === "OfferingPlaced"})[0].args.offeringId;
    // Get current offering
    const currentOffering = await marketplace.viewOffering(offeringId);
    expect(currentOffering[0]).to.equal(nft.address);
    expect(currentOffering[1]).to.equal(1);
    expect(currentOffering[2]).to.equal(price);
    expect(currentOffering[3]).to.equal(false);
    await expect(marketplace.connect(provider).withdrawOffering(offeringId))
    .to.be.revertedWith('Only seller can perform this action');
    await expect(marketplace.connect(seller).withdrawOffering(offeringId))
    .not.to.be.reverted;
    // Get current offering
    const currentOfferingUpdated = await marketplace.viewOffering(offeringId);
    expect(currentOfferingUpdated[0]).to.equal('0x0000000000000000000000000000000000000000');
  });

  it("Should not allow anyone except seller to withdraw item from sale [ERC1155]", async () => {
    // Mint test token to put on marketplace
    const txMint = await nft1155.mint(seller.address, seller.address, 0, tokenUri, baseAmount);
    const transactionMint = await txMint.wait();
    const tokenId = transactionMint.events[0].args['id'];
    // Put on marketplace
    const tx = await marketplace.connect(seller).placeOffering(nft1155.address, tokenId, price, owner.address, baseAmount);
    // Get offeringId from OfferingPlaced event in transaction
    const transactionCompleted = await tx.wait();
    offeringId = transactionCompleted.events?.filter((item) => {return item.event === "OfferingPlaced"})[0].args.offeringId;
    // Get current offering
    const currentOffering = await marketplace.viewOffering(offeringId);
    expect(currentOffering[0]).to.equal(nft1155.address);
    expect(currentOffering[1]).to.equal(1);
    expect(currentOffering[2]).to.equal(price);
    expect(currentOffering[3]).to.equal(false);
    await expect(marketplace.connect(provider).withdrawOffering(offeringId))
    .to.be.revertedWith('Only seller can perform this action');
    await expect(marketplace.connect(seller).withdrawOffering(offeringId))
    .not.to.be.reverted;
    // Get current offering
    const currentOfferingUpdated = await marketplace.viewOffering(offeringId);
    expect(currentOfferingUpdated[0]).to.equal('0x0000000000000000000000000000000000000000');
  });

})