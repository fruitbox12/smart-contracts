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
  let nft, nft1155;
  let creator;
  const tokenUri = 'https://dappify.com/img/{id}.json';
  const baseAmount = 10;
  const tokenId = 1;

  beforeEach(async function () {
    // Accounts
    [owner, provider, buyer, buyer2, seller, seller2, creator] = await ethers.getSigners();
    // Royalties
    ownerFee = 5;
    providerFee = 2;
    // Marketplace
    const Marketplace = await ethers.getContractFactory('NFTMarketplaceV1');
    marketplace = await Marketplace.connect(provider).deploy();
    await marketplace.deployed();
    // Nft 721
    const Token721 = await ethers.getContractFactory('ERC721DappifyV1');
    nft = await Token721.connect(creator).deploy('Name', 'Symbol');
    await nft.deployed();
    // Nft 1155
    const Token1155 = await ethers.getContractFactory('ERC1155DappifyV1');
    nft1155 = await Token1155.connect(creator).deploy('Name', 'Symbol', 'URI');
    await nft1155.deployed();
    // Provider
    ethProvider = waffle.provider;
  });

  it("Should allow an NFT owner to publish for sale [ERC721]", async function() {
    const price = 1000;
    const expectedClosed = false;

    // Mint test token to put on marketplace
    await nft.mint(seller.address, seller.address, 0, tokenUri)
    expect(await nft.ownerOf(tokenId)).to.equal(seller.address);

    // Put on marketplace
    const tx = await marketplace.connect(seller).placeOffering(nft.address, tokenId, price, owner.address, 1);
    
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

  it("Should allow an NFT owner to publish for sale [ERC1155]", async function() {
    const price = 1000;
    const expectedClosed = false;

    // Mint test token to put on marketplace
    await nft1155.mint(seller.address, seller.address, 0, tokenUri, baseAmount);
    expect(await nft1155.balanceOf(seller.address, tokenId)).to.equal(baseAmount);

    // Put on marketplace
    const tx = await marketplace.connect(seller).placeOffering(nft1155.address, tokenId, price, owner.address, 1);
    
    // Get offeringId from OfferingPlaced event in transaction
    const transactionCompleted = await tx.wait();
    const offeringId = transactionCompleted.events?.filter((item) => {return item.event === "OfferingPlaced"})[0].args.offeringId;

    // Get current offering
    const currentOffering = await marketplace.viewOffering(offeringId);
    expect(currentOffering[0]).to.equal(nft1155.address);
    expect(currentOffering[1]).to.equal(tokenId);
    expect(currentOffering[2]).to.equal(price);
    expect(currentOffering[3]).to.equal(expectedClosed);
  });

  it("Should not allow anyone else than the owner to publish an NFT for sale [ERC721]", async function() {
    const price = ethers.utils.parseEther(JSON.stringify(1234.567));

    // Mint test token to put on marketplace
    await nft.mint(seller.address, seller.address, tokenId, tokenUri);
    expect(await nft.ownerOf(tokenId)).to.equal(seller.address);

    // Put on marketplace
    await expect(marketplace.connect(seller2).placeOffering(nft.address, tokenId, price, owner.address, 1))
    .to.be.revertedWith('Only token owners can put them for sale');
  });

  it("Should not allow anyone else than the owner to publish an NFT for sale [ERC1155]", async function() {
    const price = ethers.utils.parseEther(JSON.stringify(1234.567));

    // Mint test token to put on marketplace
    await nft1155.mint(seller.address, seller.address, 0, tokenUri, baseAmount);
    expect(await nft1155.balanceOf(seller.address, tokenId)).to.equal(baseAmount);

    // Put on marketplace
    await expect(marketplace.connect(seller2).placeOffering(nft1155.address, tokenId, price, owner.address, 1))
    .to.be.revertedWith('Only token owners can put them for sale');
  });

  it("Should allow a buyer to acquire an NFT for the given price [ERC721]", async function() {
    const price = 1000;

    // Mint test token to put on marketplace
    await nft.mint(seller.address, seller.address, tokenId, tokenUri);
    expect(await nft.ownerOf(tokenId)).to.equal(seller.address);

    // Allow marketplace to be operator for the transaction
    await nft.connect(seller).approve(marketplace.address, tokenId);
    const approved = await nft.getApproved(tokenId);
    expect(approved).to.equal(marketplace.address);

    // Put on marketplace
    const txSell = await marketplace.connect(seller).placeOffering(nft.address, tokenId, price, owner.address, 1);

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
    const txBuy = await marketplace.connect(buyer).closeOffering(event.offeringId, 1, {
        value: ethers.utils.parseEther(price.toString())
    });
    const transactionBuyCompleted = await txBuy.wait();
    
    // Onwership transfered check
    expect(await nft.ownerOf(tokenId)).to.equal(buyer.address);
    expect(await nft.ownerOf(tokenId)).not.to.equal(seller.address);

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


  it("Should allow a buyer to acquire an NFT for the given price [ERC1155]", async function() {
    const price = 1000;

    // Mint test token to put on marketplace
    await nft1155.mint(seller.address, seller.address, 0, tokenUri, baseAmount);
    expect(await nft1155.balanceOf(seller.address, tokenId)).to.equal(baseAmount);

    // Allow marketplace to be operator for the transaction
    await nft1155.connect(seller).setApprovalForAll(marketplace.address, true);
    const approved = await nft1155.isApprovedForAll(seller.address, marketplace.address);
    expect(approved).to.equal(true);

    // Put on marketplace
    const txSell = await marketplace.connect(seller).placeOffering(nft1155.address, tokenId, price, owner.address, 1);

    // Balance snapshot
    const balanceBuyerStart = await ethProvider.getBalance(buyer2.address);
    const balanceSellerStart = await ethProvider.getBalance(seller.address);
    const balanceProviderStart = await ethProvider.getBalance(provider.address);
    const balanceOperatorStart = await ethProvider.getBalance(owner.address);
    const balanceCreatorStart = await ethProvider.getBalance(creator.address);

    // Get offeringId from OfferingPlaced event in transaction
    const transactionSellCompleted = await txSell.wait();
    const event = transactionSellCompleted.events?.filter((item) => {return item.event === "OfferingPlaced"})[0].args;
  
    // Purchase
    const txBuy = await marketplace.connect(buyer2).closeOffering(event.offeringId, 1, {
        value: ethers.utils.parseEther(price.toString())
    });
    const transactionBuyCompleted = await txBuy.wait();
    
    // Onwership transfered check
    expect(await nft1155.balanceOf(buyer2.address, tokenId)).to.equal(1);
    expect(await nft1155.balanceOf(seller.address, tokenId)).to.equal(baseAmount-1);

    const balanceBuyerEnd = await ethProvider.getBalance(buyer2.address);
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

  it("Should not allow purchase if token has been transfered outside marketplace [ERC721]", async function() {
    const price = 1000;

    // Mint test token to put on marketplace
    await nft.mint(seller.address, seller.address, 0, tokenUri);

    const txOffer = await marketplace.connect(seller).placeOffering(nft.address, tokenId, price, owner.address, 1);
    const transactionCompleted = await txOffer.wait();
    const offeringId = transactionCompleted.events?.filter((item) => {return item.event === "OfferingPlaced"})[0].args.offeringId;

    // Token ownership changes
    await nft.connect(seller).transferFrom(seller.address, seller2.address, tokenId);
  
    // Someone tries purchase and fails
    await expect(marketplace.connect(buyer).closeOffering(offeringId, 1, { value: price }))
    .to.be.revertedWith('Offer is no longer valid, token was transfered outside the marketplace');
  });

  it("Should not allow purchase if token has been transfered outside marketplace [ERC1155]", async function() {
    const price = 1000;
    const mintedAmount = 1;

    // Mint test token to put on marketplace
    await nft1155.mint(seller.address, seller.address, 0, tokenUri, mintedAmount);

    const txOffer = await marketplace.connect(seller).placeOffering(nft1155.address, tokenId, price, owner.address, 1);
    const transactionCompleted = await txOffer.wait();
    const offeringId = transactionCompleted.events?.filter((item) => {return item.event === "OfferingPlaced"})[0].args.offeringId;

    // Token ownership changes
    await nft1155.connect(seller).safeTransferFrom(seller.address, seller2.address, tokenId, mintedAmount, []);
  
    // Someone tries purchase and fails
    await expect(marketplace.connect(buyer).closeOffering(offeringId, 1, { value: price }))
    .to.be.revertedWith('Offer is no longer valid, token was transfered outside the marketplace');
  });

  it("Should not allow offering more than 1 instance of a token [ERC721]", async function() {
    const price = 1000;

    // Mint test token to put on marketplace
    await nft.mint(seller.address, seller.address, 0, tokenUri);

    // Someone tries purchase and fails
    await expect(marketplace.connect(seller).placeOffering(nft.address, tokenId, price, owner.address, 2))
    .to.be.revertedWith('ERC721 can transact only one at a time');
  });

  it("Should allow offering more than 1 instance of a token [ERC1155]", async () => {
    const price = 1000;

    // Mint test token to put on marketplace
    await nft1155.mint(seller.address, seller.address, 0, tokenUri, 10);

    // Someone tries purchase and fails
    const txOffer = await marketplace.connect(seller).placeOffering(nft1155.address, tokenId, price, owner.address, 10);
    const transactionCompleted = await txOffer.wait();
    const offeringId = transactionCompleted.events?.filter((item) => {return item.event === "OfferingPlaced"})[0].args.offeringId;
    expect(offeringId).to.not.be.empty;
  });

  it("Should not allow offering more than x instances of a token if not in possession [ERC1155]", async () => {
    const price = 1000;

    // Mint test token to put on marketplace
    await nft1155.mint(seller.address, seller.address, 0, tokenUri, 10);

    // Someone tries purchase and fails
    await expect(marketplace.connect(seller2).placeOffering(nft1155.address, tokenId, price, owner.address, 11))
    .to.be.revertedWith('Only token owners can put them for sale');
  });

});