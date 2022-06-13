/* test/sample-test.js */
const { expect } = require('chai');

const runDistributionTestValidation = async ({ 
    price,
    seller,
    buyer,
    creator,
    owner, owner2,
    provider,
    marketplace,
    nft,
    nft1155,
    ethProvider,
    operatorFee,
    providerFee,
    tokenId,
    amount=1
}) => {

    // Allow marketplace to be operator for the transaction
    const target = nft || nft1155;
    await target.connect(seller).setApprovalForAll(marketplace.address, true);
    const approved = await target.isApprovedForAll(seller.address, marketplace.address);
    expect(approved).to.equal(true);

    // Set royalty fee before adding to market
    await marketplace.connect(owner).setRoyaltyFee(operatorFee);
    await marketplace.connect(provider).setRoyaltyFee(providerFee);

    // Put on marketplace
    const txSell = await marketplace.connect(seller).placeOffering(target.address, tokenId, price, owner.address, amount);

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
    const total = price * amount;
    const txBuy = await marketplace.connect(buyer).closeOffering(event.offeringId, amount, {
        value: ethers.utils.parseEther(total.toString())
    });
    const transactionBuyCompleted = await txBuy.wait();
    
    // Onwership transfered check
    if (nft) {
      expect(await target.ownerOf(tokenId)).to.equal(buyer.address);
      expect(await target.ownerOf(tokenId)).not.to.equal(seller.address);
    } else if (nft1155) {
      expect(await target.balanceOf(buyer.address, tokenId)).to.equal(amount);
      // expect(await target.balanceOf(seller.address, tokenId)).to.equal(0);
    }

    const balanceBuyerEnd = await ethProvider.getBalance(buyer.address);
    const totalTxGas = transactionBuyCompleted.cumulativeGasUsed.mul(transactionBuyCompleted.effectiveGasPrice);

    // Zero sum check -> (buyer) start balance - total - gas = buyer end balance
    const balanceBuyerExpected = balanceBuyerEnd.add(totalTxGas).add(ethers.utils.parseUnits(total.toString()));
    expect(balanceBuyerStart).to.equal(balanceBuyerExpected);

    // Zero sum check -> (provider)
    const balanceProviderEnd = await ethProvider.getBalance(provider.address);
    expect(event.providerAmount.mul(amount).add(balanceProviderStart)).to.equal(balanceProviderEnd);

    // Zero sum check -> (operator)
    const balanceOperatorEnd = await ethProvider.getBalance(owner.address);
    expect(event.operatorAmount.mul(amount).add(balanceOperatorStart)).to.equal(balanceOperatorEnd);

    // Zero sum check -> (creator)
    const balanceCreatorEnd = await ethProvider.getBalance(creator.address);
    expect(event.creatorAmount.mul(amount).add(balanceCreatorStart)).to.equal(balanceCreatorEnd);

    // Zero sum check -> (seller)
    const balanceSellerEnd = await ethProvider.getBalance(seller.address);
    expect(event.sellerAmount.mul(amount).add(balanceSellerStart)).to.equal(balanceSellerEnd);
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
  let nft, nft1155;
  let creator;
  const tokenUri = 'https://dappify.com/img/{id}.json';
  const baseAmount = 10;
  const tokenId = 1;

  beforeEach(async function () {
    // Accounts
    [owner, owner2, provider, buyer, buyer2, seller, seller2, creator, creator2] = await ethers.getSigners();
    // Royalties
    ownerFee = 5;
    providerFee = 2;
    // Marketplace
    const Marketplace = await ethers.getContractFactory('NFTMarketplaceV1');
    marketplace = await Marketplace.connect(provider).deploy();
    await marketplace.deployed();
    // Nft
    const Token = await ethers.getContractFactory('ERC721DappifyV1');
    nft = await Token.connect(creator).deploy('Name', 'Symbol');
    await nft.deployed();
    const Token1155 = await ethers.getContractFactory('ERC1155DappifyV1');
    nft1155 = await Token1155.deploy('Name', 'Symbol', 'URI');
    await nft1155.deployed();
    // Provider
    ethProvider = waffle.provider;
  });

  it("Should distribute correctly royalties on purchase to all stakeholders without any fees [ERC721]", async () => {
    // Mint test token to put on marketplace
    await nft.mint(seller.address, seller.address, 0, tokenUri);
    expect(await nft.ownerOf(tokenId)).to.equal(seller.address);

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

  it("Should distribute correctly royalties on purchase to all stakeholders without any fees [ERC1155]", async () => {
    // Mint test token to put on marketplace
    await nft1155.mint(seller.address, seller.address, 0, tokenUri, baseAmount);
    expect(await nft1155.balanceOf(seller.address, tokenId)).to.equal(baseAmount);

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
        nft1155,
        ethProvider,
        tokenId
    });
  });

  it("Should distribute correctly royalties on purchase to all stakeholders with only operator fees fees [ERC721]", async () => {
    // Mint test token to put on marketplace
    await nft.mint(seller.address, seller.address, 0, tokenUri);
    expect(await nft.ownerOf(tokenId)).to.equal(seller.address);

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

  it("Should distribute correctly royalties on purchase to all stakeholders with only operator fees fees [ERC1155]", async () => {
    // Mint test token to put on marketplace
    await nft1155.mint(seller.address, seller.address, 0, tokenUri, baseAmount);
    expect(await nft1155.balanceOf(seller.address, tokenId)).to.equal(baseAmount);

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
        nft1155,
        ethProvider,
        tokenId
    });
  });

  it("Should distribute correctly royalties on purchase to all stakeholders with only provider fees [ERC721]", async () => {
    await nft.mint(seller.address, seller.address, 0, tokenUri);
    expect(await nft.ownerOf(tokenId)).to.equal(seller.address);

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

  it("Should distribute correctly royalties on purchase to all stakeholders with only provider fees [ERC1155]", async () => {
    await nft1155.mint(seller.address, seller.address, 0, tokenUri, baseAmount);
    expect(await nft1155.balanceOf(seller.address, tokenId)).to.equal(baseAmount);

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
        nft1155,
        ethProvider,
        tokenId
    });
  });

  it("Should distribute correctly royalties on purchase to all stakeholders with operator and provider fees [ERC721]", async () => {
    await nft.mint(seller.address, seller.address, 0, tokenUri);
    expect(await nft.ownerOf(tokenId)).to.equal(seller.address);

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


  it("Should distribute correctly royalties on purchase to all stakeholders with operator and provider fees [ERC1155]", async () => {
    await nft1155.mint(seller.address, seller.address, 0, tokenUri, baseAmount);
    expect(await nft1155.balanceOf(seller.address, tokenId)).to.equal(baseAmount);

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
        nft1155,
        ethProvider,
        tokenId
    });
  });

  it("Should distribute correctly royalties on purchase to all stakeholders without any fees including creators [ERC721]", async () => {
    const creatorRoyalties = 0;
    await nft.mint(seller.address, creator.address, creatorRoyalties, tokenUri);
    expect(await nft.ownerOf(tokenId)).to.equal(seller.address);

    await runDistributionTestValidation({
        price: 1000,
        operatorFee: 0,
        providerFee: 0,
        seller,
        buyer: buyer2,
        creator,
        owner,
        provider,
        marketplace,
        nft,
        ethProvider,
        tokenId
    });
  });

  it("Should distribute correctly royalties on purchase to all stakeholders without any fees including creators [ERC1155]", async () => {
    const creatorRoyalties = 0;
    await nft1155.mint(seller.address, seller.address, creatorRoyalties, tokenUri, baseAmount);
    expect(await nft1155.balanceOf(seller.address, tokenId)).to.equal(baseAmount);

    await runDistributionTestValidation({
        price: 1000,
        operatorFee: 0,
        providerFee: 0,
        seller,
        buyer: buyer2,
        creator,
        owner,
        provider,
        marketplace,
        nft1155,
        ethProvider,
        tokenId
    });
  });

  it("Should distribute correctly royalties on purchase to all stakeholders without with only fee creator [ERC721]", async () => {
    const creatorRoyalties = 1000;
    await nft.mint(seller.address, creator.address, creatorRoyalties, tokenUri);
    expect(await nft.ownerOf(tokenId)).to.equal(seller.address);

    await runDistributionTestValidation({
        price: 1000,
        operatorFee: 0,
        providerFee: 0,
        seller,
        buyer: buyer2,
        creator,
        owner,
        provider,
        marketplace,
        nft,
        ethProvider,
        tokenId
    });
  });

  it("Should distribute correctly royalties on purchase to all stakeholders without with only creator and provider fees [ERC721]", async () => {
        const creatorRoyalties = 1000;
        await nft.mint(seller.address, creator.address, creatorRoyalties, tokenUri);
        expect(await nft.ownerOf(tokenId)).to.equal(seller.address);

        await runDistributionTestValidation({
            price: 1000,
            operatorFee: 0,
            providerFee: 700,
            seller,
            buyer: buyer2,
            creator,
            owner,
            provider,
            marketplace,
            nft,
            ethProvider,
            tokenId
        });
    });

    it("Should distribute correctly royalties on purchase to all stakeholders without with only creator and provider fees [ERC1155]", async () => {
        const creatorRoyalties = 1000;
        await nft1155.mint(seller.address, creator.address, creatorRoyalties, tokenUri, baseAmount);
        expect(await nft1155.balanceOf(seller.address, tokenId)).to.equal(baseAmount);

        await runDistributionTestValidation({
            price: 1000,
            operatorFee: 0,
            providerFee: 700,
            seller,
            buyer: buyer2,
            creator,
            owner,
            provider,
            marketplace,
            nft1155,
            ethProvider,
            tokenId
        });
    });

    it("Should distribute correctly royalties on purchase to all stakeholders without with only creator, provider and operator fees [ERC721]", async () => {
        const creatorRoyalties = 1000;
        await nft.mint(seller.address, creator.address, creatorRoyalties, tokenUri);
        expect(await nft.ownerOf(tokenId)).to.equal(seller.address);

        await runDistributionTestValidation({
            price: 1000,
            operatorFee: 850,
            providerFee: 700,
            seller,
            buyer: buyer2,
            creator,
            owner,
            provider,
            marketplace,
            nft,
            ethProvider,
            tokenId
        });
    });

    it("Should distribute correctly royalties on purchase to all stakeholders without with only creator, provider and operator fees [ERC1155]", async () => {
      const creatorRoyalties = 1000;
      await nft1155.mint(seller2.address, creator2.address, creatorRoyalties, tokenUri, baseAmount);
      expect(await nft1155.balanceOf(seller2.address, tokenId)).to.equal(baseAmount);

      await runDistributionTestValidation({
          price: 100,
          operatorFee: 850,
          providerFee: 700,
          seller: seller2,
          buyer: buyer2,
          creator: creator2,
          owner: owner2,
          provider,
          marketplace,
          nft1155,
          ethProvider,
          tokenId,
          amount: baseAmount
      });
    });

});