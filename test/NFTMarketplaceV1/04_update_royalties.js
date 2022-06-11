/* test/sample-test.js */
const { expect } = require('chai');
const { constants } = require('@openzeppelin/test-helpers');

describe("Marketplace update royalties", () => {
  let owner;
  let provider
  let seller;
  let marketplace;
  let nft, nft1155;
  const providerFee = 500;
  const tokenUri = 'https://dappify.com/img/{id}.json';
  const baseAmount = 10;
  const tokenId = 1;

  beforeEach(async () => {
    // Accounts
    [owner, provider, seller] = await ethers.getSigners();
    // Marketplace
    const Marketplace = await ethers.getContractFactory('NFTMarketplaceV1');
    marketplace = await Marketplace.connect(provider).deploy();
    await marketplace.deployed();
    // Set royalty fee provider
    await marketplace.connect(provider).setRoyaltyFee(providerFee);
    // Nft
    const Token = await ethers.getContractFactory('ERC721DappifyV1');
    nft = await Token.deploy();
    await nft.deployed();
    const Token1155 = await ethers.getContractFactory('ERC1155DappifyV1');
    nft1155 = await Token1155.deploy();
    await nft1155.deployed();
  });

  it("Calculates correct royalties for provider, operator and content creator if NFT is compatible with ERC2981 [ERC721]", async () => {
    const price = 100000;
    const contentCreatorFee = 1000;
    const operatorFee = 500;

    const tx = await nft.mint(seller.address, seller.address, contentCreatorFee, tokenUri);
    const transaction = await tx.wait();
    const tokenId = transaction.events[0].args['tokenId'];
    const royaltyInfo = await nft.royaltyInfo(tokenId, price);
    expect(await nft.ownerOf(tokenId)).to.equal(royaltyInfo[0]);

    // Set royalty fee before adding to market
    await marketplace.connect(owner).setRoyaltyFee(operatorFee);
    
    // Put on marketplace
    const sellTx = await marketplace.connect(seller).placeOffering(nft.address, tokenId, price, owner.address);
    
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

  it("Calculates correct royalties for provider, operator and content creator if NFT is compatible with ERC2981 [ERC1155]", async () => {
    const price = 100000;
    const contentCreatorFee = 1000;
    const operatorFee = 500;

    const tx = await nft1155.mint(seller.address, seller.address, contentCreatorFee, tokenUri, baseAmount);
    const transaction = await tx.wait();
    const tokenId = transaction.events[0].args['id'];
    const royaltyInfo = await nft1155.royaltyInfo(tokenId, price);
    expect(seller.address).to.equal(royaltyInfo[0]);

    // Set royalty fee before adding to market
    await marketplace.connect(owner).setRoyaltyFee(operatorFee);
    
    // Put on marketplace
    const sellTx = await marketplace.connect(seller).placeOffering(nft1155.address, tokenId, price, owner.address);
    
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