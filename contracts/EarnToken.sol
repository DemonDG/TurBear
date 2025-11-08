// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

contract EarnToken is ERC20, Ownable {
    uint256 public constant MAX_SUPPLY = 1_000_000_000 * 1e18; // 最大发行量 10 亿枚

    mapping(address => bool) public minters; // 记录被授权可增发的地址

    event MinterUpdated(address indexed minter, bool allowed);

    constructor() ERC20("Earn Token", "EARN") Ownable(msg.sender) {}

    modifier onlyMinter() {
        require(minters[msg.sender], "EarnToken: caller is not minter");
        _;
    }

    function setMinter(address minter, bool allowed) external onlyOwner {
        minters[minter] = allowed;
        emit MinterUpdated(minter, allowed);
    }

    function mint(address to, uint256 amount) external onlyMinter {
        require(totalSupply() + amount <= MAX_SUPPLY, "EarnToken: exceeds max supply");
        _mint(to, amount);
    }
}
