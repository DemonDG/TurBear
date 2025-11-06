const { ethers } = require("hardhat");

async function main() {
  console.log("=".repeat(60));
  console.log("  使用高Gas价格快速部署");
  console.log("=".repeat(60));
  
  const [deployer] = await ethers.getSigners();
  console.log(`部署账户: ${deployer.address}\n`);
  
  // 设置较高的gas价格（3 Gwei，确保快速确认）
  const gasPrice = ethers.parseUnits("3", "gwei");
  console.log(`使用Gas价格: ${ethers.formatUnits(gasPrice, "gwei")} Gwei\n`);
  
  // 获取当前nonce（使用pending，这样会跳过pending的交易）
  const nonce = await ethers.provider.getTransactionCount(deployer.address, "pending");
  console.log(`使用Nonce: ${nonce} (将跳过pending交易)\n`);
  
  console.log("正在部署合约...\n");
  
  const RarityNFT = await ethers.getContractFactory("RarityNFT");
  const deployTx = await RarityNFT.deploy({
    gasLimit: 3000000,
    gasPrice: gasPrice,
    nonce: nonce,
  });
  
  const txHash = deployTx.deploymentTransaction()?.hash;
  console.log(`✅ 交易已发送！`);
  console.log(`交易哈希: ${txHash}`);
  console.log(`Etherscan: https://sepolia.etherscan.io/tx/${txHash}\n`);
  
  console.log("等待确认...");
  const nft = await deployTx.waitForDeployment();
  const address = await nft.getAddress();
  
  console.log(`\n✅ 部署成功！`);
  console.log(`合约地址: ${address}`);
  console.log(`Etherscan: https://sepolia.etherscan.io/address/${address}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

