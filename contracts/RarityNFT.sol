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
     * @dev 内部铸造工具函数：生成一个新的 tokenId 并返回
     */
    function _mintSingle(address to) internal returns (uint256 tokenId) {
        tokenId = _tokenIdCounter;
        _tokenIdCounter++;

        _safeMint(to, tokenId);
        _setTokenURI(tokenId, defaultImageURI);

        emit NFTMinted(to, tokenId);
    }

    /**
     * @dev 铸造单个 NFT
     */
    function mint(address to) public returns (uint256) {
        return _mintSingle(to);
    }

    /**
     * @dev 批量铸造 NFT，数量限制 1-5
     */
    function mintBatch(address to, uint256 amount) public returns (uint256[] memory tokenIds) {
        require(amount > 0 && amount <= 5, "amount must be between 1 and 5");

        tokenIds = new uint256[](amount);
        for (uint256 i = 0; i < amount; i++) {
            tokenIds[i] = _mintSingle(to);
        }
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
