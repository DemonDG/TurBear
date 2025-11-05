// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

contract BLToken is ERC20, Ownable {
  constructor(address recipient, uint256 initialSupply) ERC20("BL Token", "BL") Ownable(msg.sender) {
    _mint(recipient, initialSupply);
  }

  function mint100() external {
    _mint(msg.sender, 100 * 10 ** decimals());
  }
}