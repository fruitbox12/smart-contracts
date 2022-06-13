const { expect } = require('chai');

describe('Token 1155 mint', () => {
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

    it('Should have recipient, beneficiary royalty and amount set during minting', async () => {
        const tx = await contract.mint(builderA.address, beneficiaryA.address, baseRoyalty, tokenUri, baseAmount);
        const transaction = await tx.wait();
        const tokenId = parseInt(transaction.events[0].args['id']);
        const royaltyInfo = await contract.royaltyInfo(tokenId, examplePrice);
        expect(royaltyInfo[0]).to.equal(beneficiaryA.address);
        expect(royaltyInfo[1]).to.equal(baseRoyalty*examplePrice/10000);
    });

    it('Should allow recipient and beneficiary to be the same', async () => {
        const tx = await contract.mint(builderA.address, builderA.address, baseRoyalty, tokenUri, baseAmount);
        const transaction = await tx.wait();
        const tokenId = parseInt(transaction.events[0].args['id']);
        const royaltyInfo = await contract.royaltyInfo(tokenId, examplePrice);
        expect(builderA.address).to.equal(royaltyInfo[0]);
    });

    it('Should allow royalty from 0% to 100%', async () => {
        await expect(contract.mint(builderA.address, beneficiaryA.address, -1, tokenUri, baseAmount))
        .to.be.reverted;
        await expect(contract.mint(builderA.address, beneficiaryA.address, 0, tokenUri, baseAmount))
        .to.not.be.reverted;
        await expect(contract.mint(builderA.address, beneficiaryA.address, 10000, tokenUri, baseAmount))
        .to.not.be.reverted;
        await expect(contract.mint(builderA.address, beneficiaryA.address, 10001, tokenUri, baseAmount))
        .to.be.revertedWith('royalty fee will exceed salePrice');
    });

    it('Should increment token automatically', async () => {
        const txA = await contract.mint(builderA.address, builderA.address, baseRoyalty, tokenUri, baseAmount);
        const transactionA = await txA.wait();
        const tokenIdA = parseInt(transactionA.events[0].args['id']);
        const txB = await contract.mint(builderA.address, builderA.address, baseRoyalty, tokenUri, baseAmount);
        const transactionB = await txB.wait();
        const tokenIdB = parseInt(transactionB.events[0].args['id']);
        const txC = await contract.mint(builderA.address, builderA.address, baseRoyalty, tokenUri, baseAmount);
        const transactionC = await txC.wait();
        const tokenIdC = parseInt(transactionC.events[0].args['id']);
        expect(tokenIdA).to.equal(1);
        expect(tokenIdB).to.equal(2);
        expect(tokenIdC).to.equal(3);
    });
});