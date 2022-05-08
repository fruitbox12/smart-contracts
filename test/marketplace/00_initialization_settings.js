/* test/sample-test.js */
const { expect } = require('chai');

describe("Marketplace Initialization Settings", () => {
  let marketplace;
  let owner;
  let ownerFee;
  let provider;
  let providerFee;

  beforeEach(async () => {
    // // Accounts
    [owner, provider] = await ethers.getSigners();
    // // Royalties
    ownerFee = 500;     // 5%
    providerFee = 250;  // 2.5%
    // Marketplace
    const Marketplace = await ethers.getContractFactory("Marketplace");
    marketplace = await Marketplace.deploy(owner.address, ownerFee, provider.address, providerFee);
    await marketplace.deployed();
  });

  describe("Constructor", () => {

    it("Should set correctly operator, provider, operatorFree and providerFee", async () => {
      expect(await marketplace.viewOperator()).to.equal(owner.address);
      expect(await marketplace.viewProvider()).to.equal(provider.address);
      expect(await marketplace.viewOperatorFee()).to.equal(ownerFee);
      expect(await marketplace.viewProviderFee()).to.equal(providerFee);
    });

    it("Should not allow to set providerFee beyond 5%", async () => {
      const exceededFee = 501; 
      const Marketplace = await ethers.getContractFactory("Marketplace");
      await expect(Marketplace.deploy(owner.address, ownerFee, provider.address, exceededFee))
      .to.be.revertedWith('Provider fee cannot exceed 5%');
    });
  
  });

  describe("Marketplace royalty settings", () => {
  
    it("Should allow only owner to change current owner", async function() {
      await expect(marketplace.connect(provider).changeOperator(provider.address))
      .to.be.revertedWith('Only the operator can perform this action');
      await expect(marketplace.connect(owner).changeOperator(provider.address))
      .not.to.be.reverted;
    });
  
    it("Should allow only provider to change current provider", async function() {
      await expect(marketplace.connect(owner).changeProvider(owner.address))
      .to.be.revertedWith('Only the provider can perform this action');
      await expect(marketplace.connect(provider).changeProvider(owner.address))
      .not.to.be.reverted;
    });
  
    it("Should allow only owner to change current owner fee", async function() {
      await expect(marketplace.connect(provider).changeOperatorFee(10))
      .to.be.revertedWith('Only the operator can perform this action');
      await expect(marketplace.connect(owner).changeOperatorFee(10))
      .not.to.be.reverted;
      const opFee = await marketplace.viewOperatorFee();
      await expect(opFee).to.equal(10);
    });
  
    it("Should allow only provider to change current provider fee", async function() {
      await expect(marketplace.connect(owner).changeProviderFee(1))
      .to.be.revertedWith('Only the provider can perform this action');
      await expect(marketplace.connect(provider).changeProviderFee(1))
      .not.to.be.reverted;
      const providerFee = await marketplace.viewProviderFee();
      await expect(providerFee).to.equal(1);
    });
  
    it("Should not allow provider fee above 5%", async function() {
      await expect(marketplace.connect(provider).changeProviderFee(500))
      .not.to.be.reverted;
      await expect(marketplace.connect(provider).changeProviderFee(501))
      .to.be.revertedWith('Provider fee cannot exceed 5%');
    });
  });

});