//Contract based on https://docs.openzeppelin.com/contracts/3.x/erc721
// SPDX-License-Identifier: MIT
pragma solidity 0.8.9;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/common/ERC2981.sol";
import "@openzeppelin/contracts/utils/Counters.sol";
import "@openzeppelin/contracts/token/ERC1155/ERC1155.sol";
import "@openzeppelin/contracts/token/ERC1155/extensions/ERC1155URIStorage.sol";

contract ERC1155DappifyV1 is ERC2981, ERC1155URIStorage, Ownable {

    mapping (uint256 => string) private _tokenURIs;

    using Counters for Counters.Counter;
    Counters.Counter private _tokenIds;

    constructor() ERC1155("DappifyNFT") {}   

    function mint(address _receiver, address _beneficiary, uint96 _feeNumerator, string memory _tokenURI, uint256 amount) public {
        bytes memory data;
         _tokenIds.increment();
        uint256 newItemId = _tokenIds.current();
        _mint(_receiver, newItemId, amount, data);
        _setDefaultRoyalty(_beneficiary, _feeNumerator);
        _setTokenURI(newItemId, _tokenURI);
    }

    function uri(uint256 tokenId) override public view returns (string memory) { 
        return(_tokenURIs[tokenId]); 
    }

    function _setTokenURI(uint256 tokenId, string memory tokenURI) private {
         _tokenURIs[tokenId] = tokenURI; 
    }

    function setDefaultRoyalty(address _receiver, uint96 _feeNumerator) public {
        _setDefaultRoyalty(_receiver, _feeNumerator);
    }

    /**
    * @dev See {IERC165-supportsInterface}.
    */
    function supportsInterface(bytes4 interfaceId) public view virtual override(ERC1155, ERC2981) returns (bool) {
        return super.supportsInterface(interfaceId);
    }
}