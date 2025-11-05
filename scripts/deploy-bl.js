const { ethers } = require("hardhat");

async function main() {
  const [deployer] = await ethers.getSigners();
  const recipient = process.env.RECIPIENT || (await deployer.getAddress());
  const initialSupply = ethers.parseEther("10000"); // 10,000 BL (18 decimals)

  const BLToken = await ethers.getContractFactory("BLToken");
  const token = await BLToken.deploy(recipient, initialSupply);
  await token.waitForDeployment();

  const tokenAddress = await token.getAddress();
  console.log("BLToken deployed:", tokenAddress);
  console.log("Recipient:", recipient);

  const erc20 = BLToken.attach(tokenAddress);
  const balance = await erc20.balanceOf(recipient);
  console.log("Recipient balance:", ethers.formatEther(balance), "BL");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});


