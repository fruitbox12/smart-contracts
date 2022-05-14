/* test/sample-test.js */
const { expect } = require('chai');
const { constants } = require('@openzeppelin/test-helpers');

describe("Marketplace update royalties", () => {
  let owner;
  let provider
  let seller;
  let marketplace;
  const providerFee = 500;

  beforeEach(async () => {
    // Accounts
    [owner, provider, seller] = await ethers.getSigners();
    // Marketplace
    const Marketplace = await ethers.getContractFactory('ERC721MarketplaceV1');
    marketplace = await Marketplace.connect(provider).deploy();
    await marketplace.deployed();
    // Set royalty fee provider
    await marketplace.connect(provider).setRoyaltyFee(providerFee);
    // Nft
    const Token = await ethers.getContractFactory('ERC721TokenV1');
    nft = await Token.deploy();
    await nft.deployed();
  });

  it("Calculates correct royalties for provider, operator and content creator if NFT not compatible with ERC2981", async function() {
    const tokenId = 0;
    const price = 100000;
    const expectedClosed = false;
    const operatorFee = 500;

    // Mint test token to put on marketplace
    await nft.safeMint(seller.address, tokenId);
    expect(await nft.ownerOf(0)).to.equal(seller.address);

    // Set royalty fee before adding to market
    const feeTx = await marketplace.connect(owner).setRoyaltyFee(operatorFee);
    await feeTx.wait();

    // Put on marketplace
    const tx = await marketplace.connect(seller).placeOffering(nft.address, tokenId, price, owner.address);
    
    // Get Updated Royalties event in transaction
    const transactionCompleted = await tx.wait();
    const event = transactionCompleted.events?.filter((item) => {return item.event === "OfferingPlaced"})[0];
    const expectedProviderRevenue = price*0.05;
    const expectedOperatorRevenue = (price-expectedProviderRevenue)*0.05;

    expect(event.args.price).to.equal(price);
    expect(event.args.provider).to.equal(provider.address);
    expect(event.args.providerAmount).to.equal(expectedProviderRevenue);
    expect(event.args.operator).to.equal(owner.address);
    expect(event.args.operatorAmount).to.equal(expectedOperatorRevenue);
    expect(event.args.creator).to.equal(constants.ZERO_ADDRESS);
    expect(event.args.creatorAmount).to.equal(0);
  });

  it("Calculates correct royalties for provider, operator and content creator if NFT is compatible with ERC2981", async function() {
    const price = 100000;
    const contentCreatorFee = 1000;
    const operatorFee = 500;

    // Mint test token to put on marketplace
    const Token = await ethers.getContractFactory('ERC2981TokenV1');
    const nftERC2981 = await Token.deploy();
    await nftERC2981.deployed();
    const tx = await nftERC2981.mint(seller.address, seller.address, contentCreatorFee);
    const transaction = await tx.wait();
    const tokenId = transaction.logs[0].topics[3];
    const royaltyInfo = await nftERC2981.royaltyInfo(tokenId, price);
    expect(await nftERC2981.ownerOf(tokenId)).to.equal(royaltyInfo[0]);

    // Set royalty fee before adding to market
    await marketplace.connect(owner).setRoyaltyFee(operatorFee);
    
    // Put on marketplace
    const sellTx = await marketplace.connect(seller).placeOffering(nftERC2981.address, tokenId, price, owner.address);
    
    // Get Updated Royalties event in transaction
    const transactionCompleted = await sellTx.wait();
    const event = transactionCompleted.events?.filter((item) => {return item.event === "OfferingPlaced"})[0].args;
    const expectedProviderRevenue = price*operatorFee/10000;
    const expectedOperatorRevenue = (price-expectedProviderRevenue)*operatorFee/10000;
    const expectedCreatorRevenue = (price-expectedProviderRevenue-expectedOperatorRevenue)*contentCreatorFee/10000;

    expect(event.price).to.equal(price);
    expect(event.provider).to.equal(provider.address);
    expect(event.providerAmount).to.equal(expectedProviderRevenue);
    expect(event.operator).to.equal(owner.address);
    expect(event.operatorAmount).to.equal(expectedOperatorRevenue);
    expect(event.creator).to.equal(seller.address);
    expect(event.creatorAmount).to.equal(expectedCreatorRevenue);
  });

});