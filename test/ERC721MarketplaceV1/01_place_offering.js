/* test/sample-test.js */
const { expect } = require('chai');
const { BigNumber } = require('ethers');

describe("Marketplace sales", () => {
  let ethProvider;
  let owner;
  let provider
  let buyer
  let seller, seller2;
  let marketplace;
  let nft;
  let creator;

  beforeEach(async function () {
    // Accounts
    [owner, provider, buyer, seller, seller2, creator] = await ethers.getSigners();
    // Royalties
    ownerFee = 5;
    providerFee = 2;
    // Marketplace
    const Marketplace = await ethers.getContractFactory('ERC721MarketplaceV1');
    marketplace = await Marketplace.connect(provider).deploy();
    await marketplace.deployed();
    // Nft
    const Token = await ethers.getContractFactory('ERC721TokenV1');
    nft = await Token.connect(creator).deploy();
    await nft.deployed();
    // Provider
    ethProvider = waffle.provider;
  });

  it("Should allow an NFT owner to publish for sale", async function() {
    const tokenId = 0;
    const price = 1000;
    const expectedClosed = false;

    // Mint test token to put on marketplace
    await nft.safeMint(seller.address, tokenId);
    expect(await nft.ownerOf(0)).to.equal(seller.address);

    // Put on marketplace
    const tx = await marketplace.connect(seller).placeOffering(nft.address, tokenId, price, owner.address);
    
    // Get offeringId from OfferingPlaced event in transaction
    const transactionCompleted = await tx.wait();
    const offeringId = transactionCompleted.events?.filter((item) => {return item.event === "OfferingPlaced"})[0].args.offeringId;

    // Get current offering
    const currentOffering = await marketplace.viewOffering(offeringId);
    expect(currentOffering[0]).to.equal(nft.address);
    expect(currentOffering[1]).to.equal(tokenId);
    expect(currentOffering[2]).to.equal(price);
    expect(currentOffering[3]).to.equal(expectedClosed);
  });

  it("Should not allow anyone else than the owner to publish an NFT for sale", async function() {
    const tokenId = 0;
    const price = ethers.utils.parseEther(JSON.stringify(1234.567));

    // Mint test token to put on marketplace
    await nft.safeMint(seller.address, tokenId);
    expect(await nft.ownerOf(0)).to.equal(seller.address);

    // Put on marketplace
    await expect(marketplace.connect(seller2).placeOffering(nft.address, tokenId, price, owner.address))
    .to.be.revertedWith('Only token owners can put them for sale');
  });

  it("Should allow a buyer to acquire an NFT for the given price", async function() {
    const tokenId = 0;
    const price = 1000;

    // Mint test token to put on marketplace
    await nft.safeMint(seller.address, tokenId);
    expect(await nft.ownerOf(0)).to.equal(seller.address);

    // Allow marketplace to be operator for the transaction
    await nft.connect(seller).approve(marketplace.address, tokenId);
    const approved = await nft.getApproved(tokenId);
    expect(approved).to.equal(marketplace.address);

    // Put on marketplace
    const txSell = await marketplace.connect(seller).placeOffering(nft.address, tokenId, price, owner.address);

    // Balance snapshot
    const balanceBuyerStart = await ethProvider.getBalance(buyer.address);
    const balanceSellerStart = await ethProvider.getBalance(seller.address);
    const balanceProviderStart = await ethProvider.getBalance(provider.address);
    const balanceOperatorStart = await ethProvider.getBalance(owner.address);
    const balanceCreatorStart = await ethProvider.getBalance(creator.address);

    // Get offeringId from OfferingPlaced event in transaction
    const transactionSellCompleted = await txSell.wait();
    const event = transactionSellCompleted.events?.filter((item) => {return item.event === "OfferingPlaced"})[0].args;
  
    // Purchase
    const txBuy = await marketplace.connect(buyer).closeOffering(event.offeringId, {
        value: ethers.utils.parseEther(price.toString())
    });
    const transactionBuyCompleted = await txBuy.wait();
    
    // Onwership transfered check
    expect(await nft.ownerOf(0)).to.equal(buyer.address);
    expect(await nft.ownerOf(0)).not.to.equal(seller.address);

    const balanceBuyerEnd = await ethProvider.getBalance(buyer.address);
    const totalTxGas = transactionBuyCompleted.cumulativeGasUsed.mul(transactionBuyCompleted.effectiveGasPrice);

    // Zero sum check -> (buyer) start balance - price - gas = buyer end balance
    const balanceBuyerExpected = balanceBuyerEnd.add(totalTxGas).add(ethers.utils.parseUnits(price.toString()));
    expect(balanceBuyerStart).to.equal(balanceBuyerExpected);

    // Zero sum check -> (provider)
    const balanceProviderEnd = await ethProvider.getBalance(provider.address);
    expect(event.providerAmount.add(balanceProviderStart)).to.equal(balanceProviderEnd);

    // Zero sum check -> (operator)
    const balanceOperatorEnd = await ethProvider.getBalance(owner.address);
    expect(event.operatorAmount.add(balanceOperatorStart)).to.equal(balanceOperatorEnd);

    // Zero sum check -> (creator)
    const balanceCreatorEnd = await ethProvider.getBalance(creator.address);
    expect(event.creatorAmount.add(balanceCreatorStart)).to.equal(balanceCreatorEnd);

    // Zero sum check -> (seller)
    const balanceSellerEnd = await ethProvider.getBalance(seller.address);
    expect(event.sellerAmount.add(balanceSellerStart)).to.equal(balanceSellerEnd);
  });

  it("Should not allow purchase if token has been transfered outside marketplace", async function() {
    const tokenId = 0;
    const price = 1000;

    // Mint test token to put on marketplace
    await nft.safeMint(seller.address, tokenId);

    const txOffer = await marketplace.connect(seller).placeOffering(nft.address, tokenId, price, owner.address);
    const transactionCompleted = await txOffer.wait();
    const offeringId = transactionCompleted.events?.filter((item) => {return item.event === "OfferingPlaced"})[0].args.offeringId;

    // Token ownership changes
    await nft.connect(seller).transferFrom(seller.address, seller2.address, tokenId);
  
    // Someone tries purchase and fails
    await expect(marketplace.connect(buyer).closeOffering(offeringId, { value: price }))
    .to.be.revertedWith('Offer is no longer valid, token was transfered outside the marketplace');
  });
});