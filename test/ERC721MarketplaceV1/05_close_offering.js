/* test/sample-test.js */
const { expect } = require('chai');

const runDistributionTestValidation = async ({ 
    price,
    seller,
    buyer,
    creator,
    owner,
    provider,
    marketplace,
    nft,
    ethProvider,
    operatorFee,
    providerFee,
    tokenId
}) => {

    // Allow marketplace to be operator for the transaction
    await nft.connect(seller).approve(marketplace.address, tokenId);
    const approved = await nft.getApproved(tokenId);
    expect(approved).to.equal(marketplace.address);

    // Set royalty fee before adding to market
    await marketplace.connect(owner).setRoyaltyFee(operatorFee);
    await marketplace.connect(provider).setRoyaltyFee(providerFee);

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
}

describe("Marketplace purchase and sales close", () => {
  let ethProvider;
  let owner;
  let provider
  let buyer
  let seller, seller2;
  let ownerFee;
  let providerFee;
  let marketplace;
  let nft, nftRoyalties;
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
    // Nft with Royalties
    const TokenRoyalties = await ethers.getContractFactory('ERC2981TokenV1');
    nftRoyalties = await TokenRoyalties.deploy();
    await nftRoyalties.deployed();
    // Provider
    ethProvider = waffle.provider;
  });

  it("Should distribute correctly royalties on purchase to all stakeholders without any fees", async () => {
    const tokenId = 0;
    // Mint test token to put on marketplace
    await nft.safeMint(seller.address, tokenId);
    expect(await nft.ownerOf(0)).to.equal(seller.address);

    await runDistributionTestValidation({
        price: 1000,
        operatorFee: 0,
        providerFee: 0,
        seller,
        buyer,
        creator,
        owner,
        provider,
        marketplace,
        nft,
        ethProvider,
        tokenId
    });
  });

  it("Should distribute correctly royalties on purchase to all stakeholders with only operator fees fees", async () => {
    const tokenId = 0;
    // Mint test token to put on marketplace
    await nft.safeMint(seller.address, tokenId);
    expect(await nft.ownerOf(0)).to.equal(seller.address);

    await runDistributionTestValidation({
        price: 1000,
        operatorFee: 255,
        providerFee: 0,
        seller,
        buyer,
        creator,
        owner,
        provider,
        marketplace,
        nft,
        ethProvider,
        tokenId
    });
  });

  it("Should distribute correctly royalties on purchase to all stakeholders with only provider fees", async () => {
    const tokenId = 0;
    // Mint test token to put on marketplace
    await nft.safeMint(seller.address, tokenId);
    expect(await nft.ownerOf(0)).to.equal(seller.address);

    await runDistributionTestValidation({
        price: 1000,
        operatorFee: 0,
        providerFee: 500,
        seller,
        buyer,
        creator,
        owner,
        provider,
        marketplace,
        nft,
        ethProvider,
        tokenId
    });
  });

  it("Should distribute correctly royalties on purchase to all stakeholders with operator and provider fees", async () => {
    const tokenId = 0;
    // Mint test token to put on marketplace
    await nft.safeMint(seller.address, tokenId);
    expect(await nft.ownerOf(0)).to.equal(seller.address);

    await runDistributionTestValidation({
        price: 1000,
        operatorFee: 350,
        providerFee: 500,
        seller,
        buyer,
        creator,
        owner,
        provider,
        marketplace,
        nft,
        ethProvider,
        tokenId
    });
  });

  it("Should distribute correctly royalties on purchase to all stakeholders without any fees including creators", async () => {
    const creatorRoyalties = 0;
    const tx = await nftRoyalties.mint(seller.address, creator.address, creatorRoyalties);
    const transaction = await tx.wait();
    const tokenId = transaction.logs[0].topics[3];

    await runDistributionTestValidation({
        price: 1000,
        operatorFee: 0,
        providerFee: 0,
        seller,
        buyer,
        creator,
        owner,
        provider,
        marketplace,
        nft: nftRoyalties,
        ethProvider,
        tokenId
    });
  });

  it("Should distribute correctly royalties on purchase to all stakeholders without with only fee creator", async () => {
    const creatorRoyalties = 1000;
    const tx = await nftRoyalties.mint(seller.address, creator.address, creatorRoyalties);
    const transaction = await tx.wait();
    const tokenId = transaction.logs[0].topics[3];

    await runDistributionTestValidation({
        price: 1000,
        operatorFee: 0,
        providerFee: 0,
        seller,
        buyer,
        creator,
        owner,
        provider,
        marketplace,
        nft: nftRoyalties,
        ethProvider,
        tokenId
    });
  });

  it("Should distribute correctly royalties on purchase to all stakeholders without with only creator and provider fees", async () => {
        const creatorRoyalties = 1000;
        const tx = await nftRoyalties.mint(seller.address, creator.address, creatorRoyalties);
        const transaction = await tx.wait();
        const tokenId = transaction.logs[0].topics[3];

        await runDistributionTestValidation({
            price: 1000,
            operatorFee: 0,
            providerFee: 700,
            seller,
            buyer,
            creator,
            owner,
            provider,
            marketplace,
            nft: nftRoyalties,
            ethProvider,
            tokenId
        });
    });

    it("Should distribute correctly royalties on purchase to all stakeholders without with only creator, provider and operator fees", async () => {
        const creatorRoyalties = 1000;
        const tx = await nftRoyalties.mint(seller.address, creator.address, creatorRoyalties);
        const transaction = await tx.wait();
        const tokenId = transaction.logs[0].topics[3];

        await runDistributionTestValidation({
            price: 1000,
            operatorFee: 850,
            providerFee: 700,
            seller,
            buyer,
            creator,
            owner,
            provider,
            marketplace,
            nft: nftRoyalties,
            ethProvider,
            tokenId
        });
    });

});