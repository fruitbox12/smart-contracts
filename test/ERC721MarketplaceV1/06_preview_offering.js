/* test/sample-test.js */
const { expect } = require('chai');
const { ethers } = require('hardhat');

const runTestPreview = async ({
    marketplace,
    royaltyTokenContract,
    provider,
    owner,
    seller,
    creatorFee,
    operatorFee,
    providerFee,
    price
}) => {
    const tx = await royaltyTokenContract.mint(seller.address, seller.address, creatorFee);
    const transaction = await tx.wait();
    const tokenId = transaction.logs[0].topics[3];

    // Set royalty fee before preview
    await marketplace.connect(owner).setRoyaltyFee(operatorFee);
    await marketplace.connect(provider).setRoyaltyFee(providerFee);

    const providerCut = price * providerFee / 10000;
    const operatorCut = (price - providerCut) * operatorFee / 10000;
    const creatorCut = (price - providerCut - operatorCut) * creatorFee / 10000;
    const expectedSellerCut = price - providerCut - operatorCut - creatorCut; 

    const preview = await marketplace.connect(seller).previewPlaceOffering(royaltyTokenContract.address, tokenId, price, owner.address);
    // expect(preview.sellerCut).to.equal(Math.ceil(expectedSellerCut));
};

describe("Marketplace preview offering", () => {
  let owner;
  let provider
  let seller;
  let marketplace;
  let nft;
  let royaltyTokenContract;
  let offeringId;
  const price = 200000;

  beforeEach(async function () {
    // Accounts
    [owner, provider, seller] = await ethers.getSigners();
    // Marketplace
    const Marketplace = await ethers.getContractFactory('ERC721MarketplaceV1');
    marketplace = await Marketplace.connect(provider).deploy();
    await marketplace.deployed();
    // Nft
    const Token = await ethers.getContractFactory('ERC721TokenV1');
    nft = await Token.deploy();
    await nft.deployed();
    // Mint test token to put on marketplace
    await nft.safeMint(seller.address, 0);
    expect(await nft.ownerOf(0)).to.equal(seller.address);
    // Put on marketplace
    const tx = await marketplace.connect(seller).placeOffering(nft.address, 0, price, owner.address);
    // Get offeringId from OfferingPlaced event in transaction
    const transactionCompleted = await tx.wait();
    offeringId = transactionCompleted.events?.filter((item) => {return item.event === "OfferingPlaced"})[0].args.offeringId;
    // Royalty contract
    const RoyaltyToken = await ethers.getContractFactory('ERC2981TokenV1');
    royaltyTokenContract = await RoyaltyToken.deploy();
    await royaltyTokenContract.deployed();
  });

  it("Should calculate seller cut if stakeholder fees are not set", async () => {
    const preview = await marketplace.connect(seller).previewPlaceOffering(nft.address, 0, price, owner.address);
    expect(preview.sellerCut).to.equal(price);
  });

  it("Should calculate seller cut if stakeholder fees are set", async () => {
    await runTestPreview({
        marketplace,
        royaltyTokenContract,
        provider,
        owner,
        seller,
        creatorFee: 500,
        operatorFee : 500,
        providerFee : 350,
        price: 10000
    });
  });

  it("Should calculate seller cut if provider fee not set", async () => {
    await runTestPreview({
        marketplace,
        royaltyTokenContract,
        provider,
        owner,
        seller,
        creatorFee: 500,
        operatorFee : 500,
        providerFee : 0,
        price: 123456789
    });
  });

  it("Should calculate seller cut if operator fee not set", async () => {
    await runTestPreview({
        marketplace,
        royaltyTokenContract,
        provider,
        owner,
        seller,
        creatorFee: 321,
        operatorFee : 0,
        providerFee : 123,
        price: 123456789
    });
  });

  it("Should calculate seller cut if creator fee not set", async () => {
    await runTestPreview({
        marketplace,
        royaltyTokenContract,
        provider,
        owner,
        seller,
        creatorFee: 0,
        operatorFee : 222,
        providerFee : 123,
        price: 1000000000000000
    });
  });

});