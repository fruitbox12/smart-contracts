const { expect } = require('chai');

describe('Token mint', () => {
    let dappify;
    let beneficiaryA, beneficiaryB, beneficiaryC;
    let builderA, builderB, builderC;
    let contract;
    const baseRoyalty = 500;
    const examplePrice = 1000;
    const tokenUri = 'https://dappify.com/img/{id}.json';

    beforeEach(async () => {
        [dappify, beneficiaryA, beneficiaryB, beneficiaryC, builderA, builderB, builderC] = await ethers.getSigners();
        const Token = await ethers.getContractFactory('ERC721DappifyV1');
        contract = await Token.deploy('Name', 'Symbol');
        await contract.deployed();
    });

    it('Should have recipient, beneficiary and royalty set during minting', async () => {
        const tx = await contract.mint(builderA.address, beneficiaryA.address, baseRoyalty, tokenUri);
        const transaction = await tx.wait();
        const tokenId = transaction.events[0].args['tokenId'];
        expect(await contract.ownerOf(tokenId)).to.equal(builderA.address);
        const royaltyInfo = await contract.royaltyInfo(tokenId, examplePrice);
        expect(royaltyInfo[0]).to.equal(beneficiaryA.address);
        expect(royaltyInfo[1]).to.equal(baseRoyalty*examplePrice/10000);
    });

    it('Should allow recipient and beneficiary to be the same', async () => {
        const tx = await contract.mint(builderA.address, builderA.address, baseRoyalty, tokenUri);
        const transaction = await tx.wait();
        const tokenId = transaction.events[0].args['tokenId'];
        const royaltyInfo = await contract.royaltyInfo(tokenId, examplePrice);
        expect(await contract.ownerOf(tokenId)).to.equal(royaltyInfo[0]);
    });

    it('Should allow royalty from 0% to 100%', async () => {
        await expect(contract.mint(builderA.address, beneficiaryA.address, -1, tokenUri))
        .to.be.reverted;
        await expect(contract.mint(builderA.address, beneficiaryA.address, 0, tokenUri))
        .to.not.be.reverted;
        await expect(contract.mint(builderA.address, beneficiaryA.address, 10000, tokenUri))
        .to.not.be.reverted;
        await expect(contract.mint(builderA.address, beneficiaryA.address, 10001, tokenUri))
        .to.be.revertedWith('royalty fee will exceed salePrice');
    });

    it('Should increment token automatically', async () => {
        const txA = await contract.mint(builderA.address, builderA.address, baseRoyalty, tokenUri);
        const transactionA = await txA.wait();
        const tokenIdA = parseInt(transactionA.events[0].args['tokenId']);
        const txB = await contract.mint(builderA.address, builderA.address, baseRoyalty, tokenUri);
        const transactionB = await txB.wait();
        const tokenIdB = parseInt(transactionB.events[0].args['tokenId']);
        const txC = await contract.mint(builderA.address, builderA.address, baseRoyalty, tokenUri);
        const transactionC = await txC.wait();
        const tokenIdC = parseInt(transactionC.events[0].args['tokenId']);
        expect(tokenIdA).to.equal(1);
        expect(tokenIdB).to.equal(2);
        expect(tokenIdC).to.equal(3);
    });
});