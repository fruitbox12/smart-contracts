// SPDX-License-Identifier: MIT
pragma solidity 0.8.9;

import "hardhat/console.sol";
import "@openzeppelin/contracts/token/ERC721/ERC721.sol";

contract Marketplace {

    event OfferingPlaced(bytes32 indexed offeringId, address indexed hostContract, address indexed offerer,  uint tokenId, uint price, string uri);
    event OfferingClosed(bytes32 indexed offeringId, address indexed buyer);
    event OfferingUpdated(bytes32 indexed offeringId, uint price);
    event OfferingWithdrawn(bytes32 indexed offeringId, address indexed seller);
    event BalanceWithdrawn (address indexed beneficiary, uint amount);
    event OperatorChanged (address previousOperator, address newOperator);
    event ProviderChanged (address previousProvider, address newProvider);
    event ProviderFeeChanged (uint previousProviderFee, uint newProviderFee);
    event OperatorFeeChanged (uint previousOperatorFee, uint newOperatorFee);

    address operator;
    uint operatorFee;

    address provider;
    uint providerFee;

    uint offeringNonce;

    struct offering {
        address offerer;
        address hostContract;
        uint tokenId;
        uint price;
        bool closed; 
    }
    
    mapping (bytes32 => offering) offeringRegistry;
    mapping (address => uint) balances;

    modifier onlyOperator {
        require(msg.sender == operator, "Only the operator can perform this action");
        _;
    }

    modifier onlyProvider {
        require(msg.sender == provider, "Only the provider can perform this action");
        _;
    }

    constructor (address _operator, uint _operatorFee, address _provider, uint _providerFee) {
        validateProviderFee(_providerFee);
        operator = _operator;
        operatorFee = _operatorFee;
        provider = _provider;
        providerFee = _providerFee;
    }

    function validateProviderFee(uint _providerFee) internal pure {
        require(_providerFee <= 500, "Provider fee cannot exceed 5%");
    }

    function placeOffering (address _hostContract, uint _tokenId, uint _price) external {
        ERC721 hostContract = ERC721(_hostContract);
        require(hostContract.ownerOf(_tokenId) == msg.sender, "Only token owners can put them for sale");
        bytes32 offeringId = keccak256(abi.encodePacked(offeringNonce, _hostContract, _tokenId));
        offeringRegistry[offeringId].offerer = msg.sender;
        offeringRegistry[offeringId].hostContract = _hostContract;
        offeringRegistry[offeringId].tokenId = _tokenId;
        offeringRegistry[offeringId].price = _price;
        offeringNonce += 1;
        string memory uri = hostContract.tokenURI(_tokenId);
        emit  OfferingPlaced(offeringId, _hostContract, msg.sender, _tokenId, _price, uri);
    }

    function updateOffering (bytes32 _offeringId, uint _price) external {
        require(offeringRegistry[_offeringId].closed != true, "Offering is closed");
        ERC721 hostContract = ERC721(offeringRegistry[_offeringId].hostContract);
        require(hostContract.ownerOf(offeringRegistry[_offeringId].tokenId) == msg.sender, "Only the token owner can perform this action");
        offeringRegistry[_offeringId].price = _price;
        emit  OfferingUpdated(_offeringId, _price);
    }
    
    function closeOffering(bytes32 _offeringId) external payable {
        require(msg.value >= offeringRegistry[_offeringId].price, "Not enough funds to buy");
        require(offeringRegistry[_offeringId].closed != true, "Offering is closed");
        ERC721 hostContract = ERC721(offeringRegistry[_offeringId].hostContract);
        require(hostContract.ownerOf(offeringRegistry[_offeringId].tokenId) == offeringRegistry[_offeringId].offerer, "Offer is no longer valid, token was transfered outside the marketplace");
        offeringRegistry[_offeringId].closed = true;
        balances[offeringRegistry[_offeringId].offerer] += msg.value;
        hostContract.safeTransferFrom(offeringRegistry[_offeringId].offerer, msg.sender, offeringRegistry[_offeringId].tokenId);
        emit OfferingClosed(_offeringId, msg.sender);
    } 

    function withdrawOffering(bytes32 _offeringId) external {
        require(offeringRegistry[_offeringId].offerer == msg.sender, "Only seller can perform this action");
        delete offeringRegistry[_offeringId];
        emit OfferingWithdrawn(_offeringId, msg.sender);
    }

    function withdrawBalance() external {
        require(balances[msg.sender] > 0, "You don't have any balance to withdraw");
        uint amount = balances[msg.sender];
        balances[msg.sender] = 0;
        payable(msg.sender).transfer(amount);
        emit BalanceWithdrawn(msg.sender, amount);
    }

    function changeOperator(address _newOperator) external onlyOperator {
        address previousOperator = operator;
        operator = _newOperator;
        emit OperatorChanged(previousOperator, operator);
    }

    function changeOperatorFee(uint _newOperatorFee) external onlyOperator {
        uint previousOperatorFee = operatorFee;
        operatorFee = _newOperatorFee;
        emit OperatorFeeChanged(previousOperatorFee, operatorFee);        
    }

    function changeProvider(address _newProvider) external onlyProvider {
        address previousProvider = provider;
        provider = _newProvider;
        emit ProviderChanged(previousProvider, provider);
    }

    function changeProviderFee(uint _providerFee) external onlyProvider {
        validateProviderFee(_providerFee);
        uint previousProviderFee = providerFee;
        providerFee = _providerFee;
        emit ProviderFeeChanged(previousProviderFee, providerFee);        
    }

    function viewOffering(bytes32 _offeringId) external view returns (address, uint, uint, bool){
        return (offeringRegistry[_offeringId].hostContract, offeringRegistry[_offeringId].tokenId, offeringRegistry[_offeringId].price, offeringRegistry[_offeringId].closed);
    }

    function viewBalances(address _address) external view returns (uint) {
        return (balances[_address]);
    }

    function viewOperator() external view returns (address) {
        return operator;
    }

    function viewProvider() external view returns (address) {
        return provider;
    }

    function viewOperatorFee() external view returns (uint) {
        return operatorFee;
    }
    
    function viewProviderFee() external view returns (uint) {
        return providerFee;
    }

}