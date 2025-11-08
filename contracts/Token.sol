// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

contract BLToken is ERC20 {
  constructor(address recipient, uint256 initialSupply) ERC20("BL Token", "BL") {
    _mint(recipient, initialSupply);
  }

  function mint100() external {
    _mint(msg.sender, 100 * 10 ** decimals());
  }
}