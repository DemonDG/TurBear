const { ethers } = require("hardhat");

async function main() {
  console.log("检查网络连接...\n");
  
  try {
    const provider = ethers.provider;
    const network = await provider.getNetwork();
    console.log("网络信息:", network);
    
    const blockNumber = await provider.getBlockNumber();
    console.log("当前区块高度:", blockNumber);
    
    const [deployer] = await ethers.getSigners();
    console.log("部署账户:", deployer.address);
    
    const balance = await provider.getBalance(deployer.address);
    console.log("账户余额:", ethers.formatEther(balance), "ETH");
    
    if (balance === 0n) {
      console.log("\n⚠️  警告: 账户余额为0，请先充值ETH");
    } else {
      console.log("\n✅ 网络连接正常，可以部署合约");
    }
  } catch (error) {
    console.error("❌ 网络连接失败:", error.message);
    console.log("\n可能的原因:");
    console.log("1. RPC节点响应慢或不可用");
    console.log("2. 网络连接问题");
    console.log("3. 请尝试更换RPC节点");
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

