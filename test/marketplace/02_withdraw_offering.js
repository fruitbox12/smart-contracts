/* test/sample-test.js */
const { expect } = require('chai');

describe("Marketplace offer withdrawal", () => {
  let owner;
  let provider
  let seller;
  let marketplace;
  let nft;
  let offeringId;

  beforeEach(async function () {
    // Accounts
    [owner, provider, seller] = await ethers.getSigners();
    // Marketplace
    const Marketplace = await ethers.getContractFactory("Marketplace");
    marketplace = await Marketplace.deploy(owner.address, 0, provider.address, 0);
    await marketplace.deployed();
    // Nft
    const Token = await ethers.getContractFactory("Token");
    nft = await Token.deploy();
    await nft.deployed();
    // Mint test token to put on marketplace
    await nft.safeMint(seller.address, 0);
    expect(await nft.ownerOf(0)).to.equal(seller.address);
    // Put on marketplace
    const tx = await marketplace.connect(seller).placeOffering(nft.address, 0, 2);
    // Get offeringId from OfferingPlaced event in transaction
    const transactionCompleted = await tx.wait();
    offeringId = transactionCompleted.events?.filter((item) => {return item.event === "OfferingPlaced"})[0].args.offeringId;
  });

  it("Should not allow anyone except seller to withdraw item from sale", async () => {
    // Get current offering
    const currentOffering = await marketplace.viewOffering(offeringId);
    expect(currentOffering[0]).to.equal(nft.address);
    expect(currentOffering[1]).to.equal(0);
    expect(currentOffering[2]).to.equal(2);
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