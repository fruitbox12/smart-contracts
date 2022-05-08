/* test/sample-test.js */
const { expect } = require('chai');

describe('Token setDefaultRoyalty', () => {
    let dappify;
    let beneficiaryA, beneficiaryB, beneficiaryC;
    let builderA, builderB, builderC;
    let contract;
    const baseRoyalty = 500;
    const examplePrice = 1000;

    beforeEach(async () => {
        [dappify, beneficiaryA, beneficiaryB, beneficiaryC, builderA, builderB, builderC] = await ethers.getSigners();
        const Token = await ethers.getContractFactory('TokenERC2981');
        contract = await Token.deploy();
        await contract.deployed();
    });

    it('Should only allow token owner to change royalty info', async () => {
        const tx = await contract.mint(builderA.address, beneficiaryA.address, baseRoyalty);
        const transaction = await tx.wait();
        const tokenId = transaction.logs[0].topics[3];

        await expect(contract.connect(beneficiaryA).setDefaultRoyalty(beneficiaryB.address, baseRoyalty))
        .to.not.be.reverted;

        await expect(contract.connect(builderA).setDefaultRoyalty(beneficiaryB.address, baseRoyalty))
        .to.not.be.reverted;
    });

    // it('Should allow royalty from 0% to 100%', async () => {
    //     await expect(contract.mint(builderA.address, beneficiaryA.address, -1))
    //     .to.be.reverted;
    //     await expect(contract.mint(builderA.address, beneficiaryA.address, 0))
    //     .to.not.be.reverted;
    //     await expect(contract.mint(builderA.address, beneficiaryA.address, 10000))
    //     .to.not.be.reverted;
    //     await expect(contract.mint(builderA.address, beneficiaryA.address, 10001))
    //     .to.be.revertedWith('royalty fee will exceed salePrice');
    // });
});