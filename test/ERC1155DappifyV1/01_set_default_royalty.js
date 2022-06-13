/* test/sample-test.js */
const { expect } = require('chai');

describe('Token setDefaultRoyalty', () => {
    let dappify;
    let beneficiaryA, beneficiaryB, beneficiaryC;
    let builderA, builderB, builderC;
    let contract;
    const baseRoyalty = 500;
    const baseAmount = 10;
    const examplePrice = 1000;
    const tokenUri = 'https://dappify.com/img/{id}.json';

    beforeEach(async () => {
        [dappify, beneficiaryA, beneficiaryB, beneficiaryC, builderA, builderB, builderC] = await ethers.getSigners();
        const Token = await ethers.getContractFactory('ERC1155DappifyV1');
        contract = await Token.deploy('Name', 'Symbol', 'URI');
        await contract.deployed();
    });

    it('Should only allow token owner to change royalty info', async () => {
        const tx = await contract.mint(builderA.address, beneficiaryA.address, baseRoyalty, tokenUri, baseAmount);
        const transaction = await tx.wait();
        const tokenId = transaction.logs[0].topics[3];

        await expect(contract.connect(beneficiaryA).setDefaultRoyalty(beneficiaryB.address, baseRoyalty))
        .to.not.be.reverted;

        await expect(contract.connect(builderA).setDefaultRoyalty(beneficiaryB.address, baseRoyalty))
        .to.not.be.reverted;
    });
});