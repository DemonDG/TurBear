// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/token/ERC721/extensions/ERC721URIStorage.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

contract RarityNFT is ERC721URIStorage, Ownable {
    uint256 private _tokenIdCounter;
    
    // 默认图片URI（1.jpg）
    string public defaultImageURI;
    
    // 事件
    event NFTMinted(address indexed to, uint256 indexed tokenId);
    
    constructor() ERC721("Rarity NFT", "RNFT") Ownable(msg.sender) {
        // 设置默认图片URI（需要根据实际情况修改为实际的图片地址）
        defaultImageURI = "http://localhost:5173/img/1.jpg";
    }
    
    /**
     * @dev 铸造NFT，使用默认图片1.jpg
     */
    function mint(address to) public returns (uint256) {
        uint256 tokenId = _tokenIdCounter;
        _tokenIdCounter++;
        
        // 铸造NFT
        _safeMint(to, tokenId);
        
        // 设置token URI为默认图片
        _setTokenURI(tokenId, defaultImageURI);
        
        emit NFTMinted(to, tokenId);
        
        return tokenId;
    }
    
    /**
     * @dev 更新默认图片URI（仅所有者）
     */
    function setDefaultImageURI(string memory uri) public onlyOwner {
        defaultImageURI = uri;
    }
    
    /**
     * @dev 获取当前总供应量
     */
    function totalSupply() public view returns (uint256) {
        return _tokenIdCounter;
    }
    
    /**
     * @dev 重写tokenURI，确保返回正确的URI
     */
    function tokenURI(uint256 tokenId) public view override returns (string memory) {
        require(_ownerOf(tokenId) != address(0), "ERC721URIStorage: URI query for nonexistent token");
        return super.tokenURI(tokenId);
    }
}
