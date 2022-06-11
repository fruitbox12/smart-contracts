//Contract based on https://docs.openzeppelin.com/contracts/3.x/erc721
// SPDX-License-Identifier: MIT
pragma solidity 0.8.9;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/common/ERC2981.sol";
import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/token/ERC721/extensions/ERC721URIStorage.sol";
import "@openzeppelin/contracts/utils/Counters.sol";

contract ERC721DappifyV1 is ERC2981, ERC721URIStorage, Ownable {

    using Counters for Counters.Counter;
    Counters.Counter private _tokenIds;

    constructor() ERC721("DappifyNFT", "DNFT") {}

    function mint(address _receiver, address _beneficiary, uint96 _feeNumerator, string memory _tokenURI) public {
         _tokenIds.increment();
        uint256 newItemId = _tokenIds.current();
        _safeMint(_receiver, newItemId);
        _setDefaultRoyalty(_beneficiary, _feeNumerator);
        _setTokenURI(newItemId, _tokenURI);
    }

    function _burn(uint256 tokenId) internal override( ERC721URIStorage) {
        super._burn(tokenId);
    }

    function setDefaultRoyalty(address _receiver, uint96 _feeNumerator) public {
        _setDefaultRoyalty(_receiver, _feeNumerator);
    }

    /**
    * @dev See {IERC165-supportsInterface}.
    */
    function supportsInterface(bytes4 interfaceId) public view virtual override(ERC721, ERC2981) returns (bool) {
        return super.supportsInterface(interfaceId);
    }
}