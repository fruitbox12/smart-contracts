/* test/sample-test.js */
const { expect } = require('chai');

describe("Marketplace sales update", () => {
  let ethProvider;
  let owner;
  let provider
  let buyer
  let seller, seller2;
  let ownerFee;
  let providerFee;
  let marketplace;
  let nft, nft1155;
  const tokenUri = 'https://dappify.com/img/{id}.json';
  const baseAmount = 10;
  const tokenId = 1;

  beforeEach(async function () {
    // Accounts
    [owner, provider, buyer, seller, seller2, owner, owner2, beneficiary] = await ethers.getSigners();
    // Royalties
    ownerFee = 5;
    providerFee = 2;
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
    // Provider
    ethProvider = waffle.provider;
  });

  it("Should allow an NFT owner to update price [ERC721]", async function() {
    const price = 1000;
    const newPrice = 2345689;
    const expectedClosed = false;

    // Mint test token to put on marketplace
    await nft.mint(seller.address, seller.address, 0, tokenUri);
    expect(await nft.ownerOf(tokenId)).to.equal(seller.address);

    // Put on marketplace
    const txOffer = await marketplace.connect(seller).placeOffering(nft.address, tokenId, price, owner.address, 1);
    
    // Get offeringId from OfferingPlaced event in transaction
    const transactionCompleted = await txOffer.wait();
    const offeringId = transactionCompleted.events?.filter((item) => {return item.event === "OfferingPlaced"})[0].args.offeringId;
    
    // Get current offering
    const currentOffering = await marketplace.viewOffering(offeringId);
    expect(currentOffering[0]).to.equal(nft.address);
    expect(currentOffering[1]).to.equal(tokenId);
    expect(currentOffering[2]).to.equal(price);
    expect(currentOffering[3]).to.equal(expectedClosed);

    const txUpdate = await marketplace.connect(seller).updateOffering(offeringId, newPrice);
    // Get offeringId from OfferingPlaced event in transaction
    const updateCompleted = await txUpdate.wait();
    const newOffering = updateCompleted.events?.filter((item) => {return item.event === "OfferingUpdated"})[0].args;
    expect(newOffering.offeringId).to.equal(offeringId);
    expect(newOffering.price).to.equal(newPrice);

    // Get current offering
    const updatedOffer = await marketplace.viewOffering(offeringId);
    expect(updatedOffer[0]).to.equal(nft.address);
    expect(updatedOffer[1]).to.equal(tokenId);
    expect(updatedOffer[2]).to.equal(newPrice);
    expect(updatedOffer[3]).to.equal(expectedClosed);
  });

  it("Should allow an NFT owner to update price [ERC1155]", async function() {
    const price = 1000;
    const newPrice = 2345689;
    const expectedClosed = false;

    // Mint test token to put on marketplace
    await nft1155.mint(seller.address, seller.address, 0, tokenUri, baseAmount);
    expect(await nft1155.balanceOf(seller.address, tokenId)).to.equal(baseAmount);

    // Put on marketplace
    const txOffer = await marketplace.connect(seller).placeOffering(nft1155.address, tokenId, price, owner.address, baseAmount);
    
    // Get offeringId from OfferingPlaced event in transaction
    const transactionCompleted = await txOffer.wait();
    const offeringId = transactionCompleted.events?.filter((item) => {return item.event === "OfferingPlaced"})[0].args.offeringId;
    
    // Get current offering
    const currentOffering = await marketplace.viewOffering(offeringId);
    expect(currentOffering[0]).to.equal(nft1155.address);
    expect(currentOffering[1]).to.equal(tokenId);
    expect(currentOffering[2]).to.equal(price);
    expect(currentOffering[3]).to.equal(expectedClosed);

    const txUpdate = await marketplace.connect(seller).updateOffering(offeringId, newPrice);
    // Get offeringId from OfferingPlaced event in transaction
    const updateCompleted = await txUpdate.wait();
    const newOffering = updateCompleted.events?.filter((item) => {return item.event === "OfferingUpdated"})[0].args;
    expect(newOffering.offeringId).to.equal(offeringId);
    expect(newOffering.price).to.equal(newPrice);

    // Get current offering
    const updatedOffer = await marketplace.viewOffering(offeringId);
    expect(updatedOffer[0]).to.equal(nft1155.address);
    expect(updatedOffer[1]).to.equal(tokenId);
    expect(updatedOffer[2]).to.equal(newPrice);
    expect(updatedOffer[3]).to.equal(expectedClosed);
  });

  it("Should not allow anyone else than the owner to edit price for an NFT for sale [ERC721]", async () => {
    const price = ethers.utils.parseEther(JSON.stringify(12345.678));
    const newPrice = ethers.utils.parseEther(JSON.stringify(56789));

    // Mint test token to put on marketplace
    await nft.mint(seller.address, owner.address, 0, tokenUri);
    const txOffer = await marketplace.connect(seller).placeOffering(nft.address, tokenId, price, owner.address, 1);
    const transactionCompleted = await txOffer.wait();
    const offeringId = transactionCompleted.events?.filter((item) => {return item.event === "OfferingPlaced"})[0].args.offeringId;
    
    // Another person different than original owner attemps to change price
    await expect(marketplace.connect(seller2).updateOffering(offeringId, newPrice))
    .to.be.revertedWith('Only the token owner can perform this action');
  });

  it("Should not allow anyone else than the owner to edit price for an NFT for sale [ERC1155]", async () => {
    const price = ethers.utils.parseEther(JSON.stringify(12345.678));
    const newPrice = ethers.utils.parseEther(JSON.stringify(56789));

    // Mint test token to put on marketplace
    await nft1155.mint(seller.address, beneficiary.address, 0, tokenUri, baseAmount);
    const txOffer = await marketplace.connect(seller).placeOffering(nft1155.address, tokenId, price, owner.address, 1);
    const transactionCompleted = await txOffer.wait();
    const offeringId = transactionCompleted.events?.filter((item) => {return item.event === "OfferingPlaced"})[0].args.offeringId;
    
    // Another person different than original owner attemps to change price
    await expect(marketplace.connect(beneficiary).updateOffering(offeringId, newPrice))
    .to.be.revertedWith('Only the token owner can perform this action');
  });

  it("Should not allow edits if token has been transfered outside marketplace [ERC721]", async () => {
    const price = ethers.utils.parseEther(JSON.stringify(1.234));
    const newPrice = ethers.utils.parseEther(JSON.stringify(5.678));

    // Mint test token to put on marketplace
    await nft.mint(seller.address, seller.address, 0, tokenUri);
    const txOffer = await marketplace.connect(seller).placeOffering(nft.address, tokenId, price, owner.address, 1);
    const transactionCompleted = await txOffer.wait();
    const offeringId = transactionCompleted.events?.filter((item) => {return item.event === "OfferingPlaced"})[0].args.offeringId;
    
    // Token ownership changes
    await nft.connect(seller).transferFrom(seller.address, seller2.address, tokenId);

    // Previous owner attemps to change pricing and fails
    await expect(marketplace.connect(seller).updateOffering(offeringId, newPrice))
    .to.be.revertedWith('Only the token owner can perform this action');
  });

  it("Should not allow edits if token has been transfered outside marketplace [ERC1155]", async () => {
    const price = ethers.utils.parseEther(JSON.stringify(1.234));
    const newPrice = ethers.utils.parseEther(JSON.stringify(5.678));

    // Mint test token to put on marketplace
    await nft1155.mint(seller.address, seller.address, 0, tokenUri, baseAmount);
    const txOffer = await marketplace.connect(seller).placeOffering(nft1155.address, tokenId, price, owner.address, baseAmount);
    const transactionCompleted = await txOffer.wait();
    const offeringId = transactionCompleted.events?.filter((item) => {return item.event === "OfferingPlaced"})[0].args.offeringId;
    
    // Token ownership changes
    await nft1155.connect(seller).safeTransferFrom(seller.address, seller2.address, tokenId, baseAmount, []);

    // Previous owner attemps to change pricing and fails
    await expect(marketplace.connect(seller).updateOffering(offeringId, newPrice))
    .to.be.revertedWith('Only the token owner can perform this action');
  });

  it("Should not allow owner to edit price for an NFT offering closed [ERC721]", async function() {
    const price = 10000;
    const newPrice = 20000;

    // Mint test token to put on marketplace
    await nft.mint(seller.address, seller.address, 0, tokenUri);
    const txOffer = await marketplace.connect(seller).placeOffering(nft.address, tokenId, price, owner.address, 1);
    const transactionCompleted = await txOffer.wait();
    const offeringId = transactionCompleted.events?.filter((item) => {return item.event === "OfferingPlaced"})[0].args.offeringId;

    // Allow marketplace to be operator for the transaction
    await nft.connect(seller).approve(marketplace.address, tokenId);
    await nft.getApproved(tokenId);

    // Purchase, status changed to OfferingClosed
    const txBuy = await marketplace.connect(buyer).closeOffering(offeringId, 1, {
        value: price
    });
    await txBuy.wait();

    // Previous owner attemps to change pricing and fails
    await expect(marketplace.connect(seller).updateOffering(offeringId, newPrice))
    .to.be.revertedWith('Offering is closed');
  });

  it("Should not allow owner to edit price for an NFT offering closed [ERC1155]", async function() {
    const price = 100;
    const newPrice = 20000;

    // Mint test token to put on marketplace
    await nft1155.mint(seller.address, seller.address, 0, tokenUri, baseAmount);
    const txOffer = await marketplace.connect(seller).placeOffering(nft1155.address, tokenId, price, owner.address, baseAmount);
    const transactionCompleted = await txOffer.wait();
    const offeringId = transactionCompleted.events?.filter((item) => {return item.event === "OfferingPlaced"})[0].args.offeringId;

    // Allow marketplace to be operator for the transaction
    await nft1155.connect(seller).setApprovalForAll(marketplace.address, true);
    const approved = await nft1155.isApprovedForAll(seller.address, marketplace.address);
    expect(approved).to.equal(true);

    // Purchase, status changed to OfferingClosed
    const txBuy = await marketplace.connect(buyer).closeOffering(offeringId, baseAmount, {
        value: price * baseAmount
    });
    await txBuy.wait();

    // Previous owner attemps to change pricing and fails
    await expect(marketplace.connect(seller).updateOffering(offeringId, newPrice))
    .to.be.revertedWith('Offering is closed');
  });

  it("Should update only price and match up seller cut when updating offering before provider of operator fee change update [ERC721]", async () => {
    const price = 500;
    const newPrice = 1000;

    // Mint test token to put on marketplace
    await nft.mint(seller.address, seller.address, 0, tokenUri);
    expect(await nft.ownerOf(tokenId)).to.equal(seller.address);

    // Put on marketplace
    const txOffer = await marketplace.connect(seller).placeOffering(nft.address, tokenId, price, owner.address, 1);
    
    // Get offeringId from OfferingPlaced event in transaction
    const transactionCompleted = await txOffer.wait();
    const offeringId = transactionCompleted.events?.filter((item) => {return item.event === "OfferingPlaced"})[0].args.offeringId;
    
    // Get current offering, price == seller cut
    const formerOffering = await marketplace.viewOffering(offeringId);
    expect(formerOffering[2]).to.equal(formerOffering[4]);

    const txUpdate = await marketplace.connect(seller).updateOffering(offeringId, newPrice);
    await txUpdate.wait();
    
    const updatedOffering = await marketplace.viewOffering(offeringId);
    expect(updatedOffering[2]).to.equal(updatedOffering[4]);

    // Change provider and operator rates
    await marketplace.connect(owner).setRoyaltyFee(500);
    await marketplace.connect(provider).setRoyaltyFee(500);

    // View existing offering unchanged with respect to the provider and operator fees (0%)
    const latestOffering = await marketplace.viewOffering(offeringId);
    expect(latestOffering[2]).to.equal(latestOffering[4]);
    expect(latestOffering[2]).to.equal(newPrice);
  });

  it("Should update only price and match up seller cut when updating offering before provider of operator fee change update [ERC1155]", async () => {
    const price = 500;
    const newPrice = 1000;

    // Mint test token to put on marketplace
    await nft1155.mint(seller.address, seller.address, 0, tokenUri, baseAmount);
    expect(await nft1155.balanceOf(seller.address, tokenId)).to.equal(baseAmount);

    // Put on marketplace
    const txOffer = await marketplace.connect(seller).placeOffering(nft1155.address, tokenId, price, owner.address, baseAmount);
    
    // Get offeringId from OfferingPlaced event in transaction
    const transactionCompleted = await txOffer.wait();
    const offeringId = transactionCompleted.events?.filter((item) => {return item.event === "OfferingPlaced"})[0].args.offeringId;
    
    // Get current offering, price == seller cut
    const formerOffering = await marketplace.viewOffering(offeringId);
    expect(formerOffering[2]).to.equal(formerOffering[4]);

    const txUpdate = await marketplace.connect(seller).updateOffering(offeringId, newPrice);
    await txUpdate.wait();
    
    const updatedOffering = await marketplace.viewOffering(offeringId);
    expect(updatedOffering[2]).to.equal(updatedOffering[4]);

    // Change provider and operator rates
    await marketplace.connect(owner).setRoyaltyFee(500);
    await marketplace.connect(provider).setRoyaltyFee(500);

    // View existing offering unchanged with respect to the provider and operator fees (0%)
    const latestOffering = await marketplace.viewOffering(offeringId);
    expect(latestOffering[2]).to.equal(latestOffering[4]);
    expect(latestOffering[2]).to.equal(newPrice);
  });

  it("Should update cuts from stakeholders if an update is executed after a provider or operator fee change [ERC721]", async function() {
    const price = 500;
    const newPrice = 1000;

    // Mint test token to put on marketplace
    await nft.mint(seller.address, seller.address, 0, tokenUri);
    expect(await nft.ownerOf(tokenId)).to.equal(seller.address);

    // Put on marketplace
    const txOffer = await marketplace.connect(seller).placeOffering(nft.address, tokenId, price, owner.address, 1);
    
    // Get offeringId from OfferingPlaced event in transaction
    const transactionCompleted = await txOffer.wait();
    const offeringId = transactionCompleted.events?.filter((item) => {return item.event === "OfferingPlaced"})[0].args.offeringId;
    
    // Get current offering, price == seller cut
    const formerOffering = await marketplace.viewOffering(offeringId);
    expect(formerOffering[2]).to.equal(formerOffering[4]);

    // Change provider and operator rates
    await marketplace.connect(owner).setRoyaltyFee(500);
    await marketplace.connect(provider).setRoyaltyFee(500);

    const txUpdate = await marketplace.connect(seller).updateOffering(offeringId, newPrice);
    await txUpdate.wait();

    // Updated offering should include changes to fees before the update
    const providerCut = newPrice * 0.05;
    const operatorCut = (newPrice - providerCut) * 0.05;
    const sellerCut = newPrice - providerCut - operatorCut;
    const latestOffering = await marketplace.viewOffering(offeringId);
    expect(Math.ceil(sellerCut)).to.equal(latestOffering[4]);
    expect(latestOffering[2]).to.equal(newPrice);
  });

  it("Should update cuts from stakeholders if an update is executed after a provider or operator fee change [ERC721]", async function() {
    const price = 500;
    const newPrice = 1000;

    // Mint test token to put on marketplace
    await nft.mint(seller.address, seller.address, 0, tokenUri);
    expect(await nft.ownerOf(tokenId)).to.equal(seller.address);

    // Put on marketplace
    const txOffer = await marketplace.connect(seller).placeOffering(nft.address, tokenId, price, owner.address, 1);
    
    // Get offeringId from OfferingPlaced event in transaction
    const transactionCompleted = await txOffer.wait();
    const offeringId = transactionCompleted.events?.filter((item) => {return item.event === "OfferingPlaced"})[0].args.offeringId;
    
    // Get current offering, price == seller cut
    const formerOffering = await marketplace.viewOffering(offeringId);
    expect(formerOffering[2]).to.equal(formerOffering[4]);

    // Change provider and operator rates
    await marketplace.connect(owner).setRoyaltyFee(500);
    await marketplace.connect(provider).setRoyaltyFee(500);

    const txUpdate = await marketplace.connect(seller).updateOffering(offeringId, newPrice);
    await txUpdate.wait();

    // Updated offering should include changes to fees before the update
    const providerCut = newPrice * 0.05;
    const operatorCut = (newPrice - providerCut) * 0.05;
    const sellerCut = newPrice - providerCut - operatorCut;
    const latestOffering = await marketplace.viewOffering(offeringId);
    expect(Math.ceil(sellerCut)).to.equal(latestOffering[4]);
    expect(latestOffering[2]).to.equal(newPrice);
  });


  it("Should update cuts from stakeholders if an update is executed after a provider or operator fee change [ERC1155]", async function() {
    const price = 500;
    const newPrice = 1000;

    // Mint test token to put on marketplace
    await nft1155.mint(seller.address, seller.address, 0, tokenUri, baseAmount);
    expect(await nft1155.balanceOf(seller.address, tokenId)).to.equal(baseAmount);

    // Put on marketplace
    const txOffer = await marketplace.connect(seller).placeOffering(nft1155.address, tokenId, price, owner.address, baseAmount);
    
    // Get offeringId from OfferingPlaced event in transaction
    const transactionCompleted = await txOffer.wait();
    const offeringId = transactionCompleted.events?.filter((item) => {return item.event === "OfferingPlaced"})[0].args.offeringId;
    
    // Get current offering, price == seller cut
    const formerOffering = await marketplace.viewOffering(offeringId);
    expect(formerOffering[2]).to.equal(formerOffering[4]);

    // Change provider and operator rates
    await marketplace.connect(owner).setRoyaltyFee(500);
    await marketplace.connect(provider).setRoyaltyFee(500);

    const txUpdate = await marketplace.connect(seller).updateOffering(offeringId, newPrice);
    await txUpdate.wait();

    // Updated offering should include changes to fees before the update
    const providerCut = newPrice * 0.05;
    const operatorCut = (newPrice - providerCut) * 0.05;
    const sellerCut = newPrice - providerCut - operatorCut;
    const latestOffering = await marketplace.viewOffering(offeringId);
    expect(Math.ceil(sellerCut)).to.equal(latestOffering[4]);
    expect(latestOffering[2]).to.equal(newPrice);
  });

})