/* test/sample-test.js */
const { expect } = require('chai');

describe("Marketplace Initialization Settings", () => {
  let marketplace;
  let owner;
  let provider;

  beforeEach(async () => {
    // // Accounts
    [owner, provider] = await ethers.getSigners();
    // Marketplace
    const Marketplace = await ethers.getContractFactory('NFTMarketplaceV1');
    marketplace = await Marketplace.connect(provider).deploy();
    await marketplace.deployed();
  });

  describe("Constructor", () => {

    it("Should set correctly operator, provider, operatorFree and providerFee", async () => {
      expect(await marketplace.viewProvider()).to.equal(provider.address);
    });
  
  });

});