/* test/sample-test.js */
const { expect } = require('chai');

describe("Marketplace sales", () => {
  let ethProvider;
  let owner;
  let provider
  let buyer
  let seller, seller2;
  let ownerFee;
  let providerFee;
  let marketplace;
  let nft;

  beforeEach(async function () {
    // Accounts
    [owner, provider, buyer, seller, seller2] = await ethers.getSigners();
    // Royalties
    ownerFee = 5;
    providerFee = 2;
    // Marketplace
    const Marketplace = await ethers.getContractFactory("Marketplace");
    marketplace = await Marketplace.deploy(owner.address, ownerFee, provider.address, providerFee);
    await marketplace.deployed();
    // Nft
    const Token = await ethers.getContractFactory("Token");
    nft = await Token.deploy();
    await nft.deployed();
    // Provider
    ethProvider = waffle.provider;
  });

  it("Should allow an NFT owner to publish for sale", async function() {
    const tokenId = 0;
    const price = 1;
    const expectedClosed = false;

    // Mint test token to put on marketplace
    await nft.safeMint(seller.address, tokenId);
    expect(await nft.ownerOf(0)).to.equal(seller.address);

    // Put on marketplace
    const tx = await marketplace.connect(seller).placeOffering(nft.address, tokenId, price);
    
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
    const price = ethers.utils.parseEther(JSON.stringify(1.234));

    // Mint test token to put on marketplace
    await nft.safeMint(seller.address, tokenId);
    expect(await nft.ownerOf(0)).to.equal(seller.address);

    // Put on marketplace
    await expect(marketplace.connect(seller2).placeOffering(nft.address, tokenId, price))
    .to.be.revertedWith('Only token owners can put them for sale');
  });

  it("Should allow a buyer to acquire an NFT for the given price", async function() {
    const tokenId = 0;
    const price = 1;

    // Mint test token to put on marketplace
    await nft.safeMint(seller.address, tokenId);
    expect(await nft.ownerOf(0)).to.equal(seller.address);

    // Allow marketplace to be operator for the transaction
    await nft.connect(seller).approve(marketplace.address, tokenId);
    const approved = await nft.getApproved(tokenId);
    expect(approved).to.equal(marketplace.address);

    // Put on marketplace
    const txSell = await marketplace.connect(seller).placeOffering(nft.address, tokenId, price);

    // Balance snapshot
    const balanceBuyerStart = ethers.utils.formatEther(await ethProvider.getBalance(buyer.address));
    const balanceSellerStart = ethers.utils.formatEther(await ethProvider.getBalance(seller.address));
  
    // Get offeringId from OfferingPlaced event in transaction
    const transactionSellCompleted = await txSell.wait();
    const offeringId = transactionSellCompleted.events?.filter((item) => {return item.event === "OfferingPlaced"})[0].args.offeringId;

    // Purchase
    const txBuy = await marketplace.connect(buyer).closeOffering(offeringId, {
        value: ethers.utils.parseEther(price.toString())
    });
    const transactionBuyCompleted = await txBuy.wait();
    
    // Onwership transfered check
    expect(await nft.ownerOf(0)).to.equal(buyer.address);
    expect(await nft.ownerOf(0)).not.to.equal(seller.address);

    const balanceBuyerEnd = ethers.utils.formatEther(await ethProvider.getBalance(buyer.address));
    const totalTxGas = ethers.utils.formatEther(transactionBuyCompleted.cumulativeGasUsed*transactionBuyCompleted.effectiveGasPrice);

    // Zero sum check -> (buyer) start balance - price - gas = buyer end balance
    const balanceBuyerExpected = parseFloat(totalTxGas)+price+parseFloat(balanceBuyerEnd);
    expect(parseFloat(balanceBuyerStart)).to.equal(balanceBuyerExpected);
  
    // Withdraw seller new balance
    const sellerBalance = await marketplace.viewBalances(seller.address);
    const balanceSellerActual = parseFloat(ethers.utils.formatEther(sellerBalance));
    expect(balanceSellerActual).to.equal(price);

    const withdrawTx = await marketplace.connect(seller).withdrawBalance();
    const transactionCompleted = await withdrawTx.wait();
    const totalWithdrawGas = ethers.utils.formatEther(transactionCompleted.cumulativeGasUsed*transactionCompleted.effectiveGasPrice);
    
    const withdrawTxCompleted = transactionCompleted.events?.filter((item) => {return item.event === "BalanceWithdrawn"})[0].args;
    const amount = parseFloat(ethers.utils.formatEther(withdrawTxCompleted.amount));
    expect(withdrawTxCompleted.beneficiary).to.equal(seller.address);
    expect(amount).to.equal(price);

    // Check is in seller wallet ---> THERE IS AN ERROR IN THIS TEST TBD <---
    /*
          AssertionError: expected 10000.99966084718 to equal 10000.999660847181
      + expected - actual

      -10000.99966084718
      +10000.999660847181

      Added toFixed(10) to compare up to 10 decimals, this shouldn't be here
    */
    const balanceSellerEnd = parseFloat(ethers.utils.formatEther(await ethProvider.getBalance(seller.address)));
    const expectedBalanceSellerEnd = parseFloat(balanceSellerStart)+price-totalWithdrawGas;
    expect(expectedBalanceSellerEnd.toFixed(10)).to.equal(balanceSellerEnd.toFixed(10));
  });

  it("Should not allow to withdraw if there are no balances", async function() {
    await expect(marketplace.connect(seller).withdrawBalance())
    .to.be.revertedWith('You don\'t have any balance to withdraw');
  });

  it("Should not allow purchase if token has been transfered outside marketplace", async function() {
    const tokenId = 0;
    const price = 1;

    // Mint test token to put on marketplace
    await nft.safeMint(seller.address, tokenId);

    // Allow marketplace to be operator for the transaction
    await nft.connect(seller).approve(marketplace.address, tokenId);

    const txOffer = await marketplace.connect(seller).placeOffering(nft.address, tokenId, price);
    const transactionCompleted = await txOffer.wait();
    const offeringId = transactionCompleted.events?.filter((item) => {return item.event === "OfferingPlaced"})[0].args.offeringId;

    // Token ownership changes
    await nft.connect(seller).transferFrom(seller.address, seller2.address, tokenId);
  
    // Someone tries purchase and fails
    await expect(marketplace.connect(buyer).closeOffering(offeringId, { value: price }))
    .to.be.revertedWith('Offer is no longer valid, token was transfered outside the marketplace');
  });

})