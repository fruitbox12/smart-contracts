/* test/sample-test.js */
const { expect } = require('chai');

describe("Marketplace balance withdrawal", () => {
  let owner;
  let provider
  let seller;
  let marketplace;

  beforeEach(async () => {
    // Accounts
    [owner, provider, seller] = await ethers.getSigners();
    // Marketplace
    const Marketplace = await ethers.getContractFactory("Marketplace");
    marketplace = await Marketplace.deploy(owner.address, 0, provider.address, 0);
    await marketplace.deployed();
  });

  it("Should not allow to withdraw if there are no balances", async function() {
    await expect(marketplace.connect(seller).withdrawBalance())
    .to.be.revertedWith('You don\'t have any balance to withdraw');
  });

});