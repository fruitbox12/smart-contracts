// SPDX-License-Identifier: MIT
pragma solidity 0.8.9;

import "hardhat/console.sol";
import "@openzeppelin/contracts/token/ERC1155/IERC1155.sol";
import "@openzeppelin/contracts/token/ERC721/IERC721.sol";
import "@openzeppelin/contracts/token/common/ERC2981.sol";

contract NFTMarketplaceV1 {

    bytes4 private constant _INTERFACE_ID_ERC2981 = 0x2a55205a;
    // bytes4 private constant _INTERFACE_ID_ERC721 = 0x2a55205a;
    // bytes4 private constant _INTERFACE_ID_ERC1155 = 0x2a55205a;
    bytes4 public constant _INTERFACE_ID_ERC1155 = type(IERC1155).interfaceId;
    bytes4 public constant _INTERFACE_ID_ERC721 = type(IERC721).interfaceId;

    event OfferingPlaced(   bytes32 indexed offeringId, 
                            address indexed hostContract, 
                            uint256 tokenId, 
                            uint256 price, 
                            address provider, 
                            uint256 providerAmount, 
                            address operator, 
                            uint256 operatorAmount, 
                            address creator, 
                            uint256 creatorAmount, 
                            address seller, 
                            uint256 sellerAmount);
    event OfferingClosed(bytes32 indexed offeringId, address indexed buyer);
    event OfferingUpdated(bytes32 indexed offeringId, uint256 price);
    event OfferingWithdrawn(bytes32 indexed offeringId, address indexed seller);

    address provider;

    uint offeringNonce;

    struct royalty {
        address receiver;
        uint256 royaltyFraction;
    }

    struct offering {
        bool closed;
        address offerer;
        address hostContract;
        uint256 tokenId;
        uint256 price;
        royalty providerRoyalty;
        royalty artistRoyalty;
        royalty operatorRoyalty;
        royalty sellerRoyalty;
    }
    
    mapping (bytes32 => offering) offeringRegistry;
    mapping (address => uint16) feeRegistry;

    constructor () {
        provider = msg.sender;
    }

    function getRoyaltyValue(uint256 _basePrice, uint16 _percentage) internal pure returns (uint256){
        uint256 amount = uint256(_basePrice * _percentage / 1e4);
        return amount;
    }

    function calculateRoyalties(bytes32 _offeringId, uint256 _price, address _operatorReceiver) internal returns (uint256, uint256, address, uint256, uint256) {
        // Provider
        (uint256 providerAmount) = getRoyaltyValue(_price, feeRegistry[provider]);
        _price -= providerAmount;
        offeringRegistry[_offeringId].providerRoyalty.receiver =  provider;
        offeringRegistry[_offeringId].providerRoyalty.royaltyFraction =  providerAmount;
        // Operator
        (uint256 operatorAmount) = getRoyaltyValue(_price, feeRegistry[_operatorReceiver]);
        _price -= operatorAmount;
        offeringRegistry[_offeringId].operatorRoyalty.receiver =  _operatorReceiver;
        offeringRegistry[_offeringId].operatorRoyalty.royaltyFraction =  operatorAmount;
        // Creator
        (address artistReceiver, uint256 artistAmount) = ERC2981(offeringRegistry[_offeringId].hostContract).supportsInterface(_INTERFACE_ID_ERC2981) ? (ERC2981(offeringRegistry[_offeringId].hostContract).royaltyInfo(offeringRegistry[_offeringId].tokenId, _price)) : (address(0), 0);
        _price -= artistAmount;
        offeringRegistry[_offeringId].artistRoyalty.receiver =  artistReceiver;
        offeringRegistry[_offeringId].artistRoyalty.royaltyFraction =  artistAmount;
        // Seller
        uint256 sellerAmount = _price;
        offeringRegistry[_offeringId].sellerRoyalty.receiver =  msg.sender;
        offeringRegistry[_offeringId].sellerRoyalty.royaltyFraction =  sellerAmount;
        return (providerAmount, operatorAmount, artistReceiver, artistAmount, sellerAmount);
    }

    function previewPlaceOffering(address _hostContract, uint256 _tokenId, uint256 _price, address _operatorReceiver) external view returns (uint256 sellerCut, address artist) {
        // Provider
        (uint256 providerAmount) = getRoyaltyValue(_price, feeRegistry[provider]);
        _price -= providerAmount;
        // Operator
        (uint256 operatorAmount) = getRoyaltyValue(_price, feeRegistry[_operatorReceiver]);
        _price -= operatorAmount;
        // Creator
        (address artistReceiver, uint256 artistAmount) = ERC2981(_hostContract).supportsInterface(_INTERFACE_ID_ERC2981) ? (ERC2981(_hostContract).royaltyInfo(_tokenId, _price)) : (address(0), 0);
        _price -= artistAmount;
        // Seller
        return (_price, artistReceiver);
    }

    function placeOffering (address _hostContract, uint256 _tokenId, uint256 _price, address _operatorReceiver) external {
        if (IERC165(_hostContract).supportsInterface(_INTERFACE_ID_ERC721)) {
            IERC721 hostContract = IERC721(_hostContract);
            require(hostContract.ownerOf(_tokenId) == msg.sender, "Only token owners can put them for sale");
        } else if (IERC165(_hostContract).supportsInterface(_INTERFACE_ID_ERC1155)) {
            IERC1155 hostContract = IERC1155(_hostContract);
            require(hostContract.balanceOf(msg.sender, _tokenId) >= 1, "Only token owners can put them for sale");
        }

        bytes32 offeringId = keccak256(abi.encodePacked(offeringNonce, _hostContract, _tokenId));

        offeringRegistry[offeringId].offerer = msg.sender;
        offeringRegistry[offeringId].hostContract = _hostContract;
        offeringRegistry[offeringId].tokenId = _tokenId;
        offeringRegistry[offeringId].price = _price;

        (uint256 providerCut,
         uint256 operatorCut,
         address creatorBeneficiary, 
         uint256 creatorCut,
         uint256 sellerCut) = calculateRoyalties(offeringId, _price, _operatorReceiver);

        offeringNonce += 1;
        emit  OfferingPlaced(offeringId, 
                            _hostContract, 
                            _tokenId, 
                            _price, 
                            provider, 
                            providerCut, 
                            _operatorReceiver, 
                            operatorCut, 
                            creatorBeneficiary, 
                            creatorCut, 
                            msg.sender, 
                            sellerCut);
    }

    function updateOffering (bytes32 _offeringId, uint256 _price) external {
        require(offeringRegistry[_offeringId].closed != true, "Offering is closed");
        if (IERC165(offeringRegistry[_offeringId].hostContract).supportsInterface(_INTERFACE_ID_ERC721)) {
            IERC721 hostContract = IERC721(offeringRegistry[_offeringId].hostContract);
            require(hostContract.ownerOf(offeringRegistry[_offeringId].tokenId) == msg.sender, "Only the token owner can perform this action");
        } else if (IERC165(offeringRegistry[_offeringId].hostContract).supportsInterface(_INTERFACE_ID_ERC1155)) {
            IERC1155 hostContract = IERC1155(offeringRegistry[_offeringId].hostContract);
            require(hostContract.balanceOf(offeringRegistry[_offeringId].offerer, offeringRegistry[_offeringId].tokenId) > 0 && offeringRegistry[_offeringId].offerer == msg.sender, "Only the token owner can perform this action");
        }

        offeringRegistry[_offeringId].price = _price;
        calculateRoyalties(_offeringId, _price, offeringRegistry[_offeringId].operatorRoyalty.receiver);
        emit  OfferingUpdated(_offeringId, _price);
    }

    function payoutOffering(bytes32 _offeringId) private {
        require(offeringRegistry[_offeringId].closed != true, "Offering is closed");
        offeringRegistry[_offeringId].closed = true;
        // Payout
        if (offeringRegistry[_offeringId].providerRoyalty.receiver != address(0)) {
            payable(offeringRegistry[_offeringId].providerRoyalty.receiver).transfer(offeringRegistry[_offeringId].providerRoyalty.royaltyFraction);
        }
        if (offeringRegistry[_offeringId].operatorRoyalty.receiver != address(0)) {
            payable(offeringRegistry[_offeringId].operatorRoyalty.receiver).transfer(offeringRegistry[_offeringId].operatorRoyalty.royaltyFraction);
        }
        if (offeringRegistry[_offeringId].artistRoyalty.receiver != address(0)) {
            payable(offeringRegistry[_offeringId].artistRoyalty.receiver).transfer(offeringRegistry[_offeringId].artistRoyalty.royaltyFraction);
        }
        if (offeringRegistry[_offeringId].sellerRoyalty.receiver != address(0)) {
            payable(offeringRegistry[_offeringId].sellerRoyalty.receiver).transfer(offeringRegistry[_offeringId].sellerRoyalty.royaltyFraction);
        }
    }
    
    function closeOffering(bytes32 _offeringId) external payable {
        require(msg.value >= offeringRegistry[_offeringId].price, "Not enough funds to buy");
        if (IERC165(offeringRegistry[_offeringId].hostContract).supportsInterface(_INTERFACE_ID_ERC721)) {
            IERC721 hostContract = IERC721(offeringRegistry[_offeringId].hostContract);
            require(hostContract.ownerOf(offeringRegistry[_offeringId].tokenId) == offeringRegistry[_offeringId].offerer, "Offer is no longer valid, token was transfered outside the marketplace");
            payoutOffering(_offeringId);
            hostContract.safeTransferFrom(offeringRegistry[_offeringId].offerer, msg.sender, offeringRegistry[_offeringId].tokenId);
        } else if (IERC165(offeringRegistry[_offeringId].hostContract).supportsInterface(_INTERFACE_ID_ERC1155)) {
            IERC1155 hostContract = IERC1155(offeringRegistry[_offeringId].hostContract);
            require(hostContract.balanceOf(offeringRegistry[_offeringId].offerer, offeringRegistry[_offeringId].tokenId) > 0, "Offer is no longer valid, token was transfered outside the marketplace");
            payoutOffering(_offeringId);
            bytes memory data;
            hostContract.safeTransferFrom(offeringRegistry[_offeringId].offerer, msg.sender, offeringRegistry[_offeringId].tokenId, 1, data);
        }
        emit OfferingClosed(_offeringId, msg.sender);
    } 

    function withdrawOffering(bytes32 _offeringId) external {
        require(offeringRegistry[_offeringId].offerer == msg.sender, "Only seller can perform this action");
        delete offeringRegistry[_offeringId];
        emit OfferingWithdrawn(_offeringId, msg.sender);
    }

    function setRoyaltyFee(uint16 _newFee) external {
        feeRegistry[msg.sender] = _newFee;       
    }

    function getRoyaltyFee(address _address) external view returns (uint16) {
        return feeRegistry[_address];       
    }

    function viewOffering(bytes32 _offeringId) external view returns (address, uint256, uint256, bool, uint256) {
        return (    offeringRegistry[_offeringId].hostContract, 
                    offeringRegistry[_offeringId].tokenId, 
                    offeringRegistry[_offeringId].price, 
                    offeringRegistry[_offeringId].closed,
                    offeringRegistry[_offeringId].sellerRoyalty.royaltyFraction
        );
    }

    function viewProvider() external view returns (address) {
        return provider;
    }
}