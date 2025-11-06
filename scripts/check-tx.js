const { ethers } = require("hardhat");

async function main() {
  // 从环境变量或命令行参数获取交易哈希
  const txHash = process.env.TX_HASH || "0x2db0398c498af1b7fc0c19ac99453fc5fb162bd21c9f796d095f32c9dece479a";
  
  if (!txHash || txHash === "") {
    console.error("请提供交易哈希");
    console.log("使用方法: TX_HASH=0x... npx hardhat run scripts/check-tx.js --network sepolia");
    console.log("或者直接修改脚本中的默认交易哈希");
    process.exit(1);
  }
  
  console.log("=".repeat(60));
  console.log("  检查交易状态");
  console.log("=".repeat(60));
  console.log(`交易哈希: ${txHash}`);
  console.log(`Etherscan链接: https://sepolia.etherscan.io/tx/${txHash}\n`);
  
  try {
    const provider = ethers.provider;
    
    // 检查交易是否在mempool中
    console.log("正在检查交易状态...\n");
    
    // 尝试获取交易收据
    const receipt = await provider.getTransactionReceipt(txHash);
    
    if (receipt) {
      console.log("✅ 交易已确认");
      console.log(`区块号: ${receipt.blockNumber}`);
      console.log(`确认数: ${receipt.confirmations}`);
      console.log(`状态: ${receipt.status === 1 ? "成功" : "失败"}`);
      console.log(`Gas使用量: ${receipt.gasUsed.toString()}`);
      
      if (receipt.contractAddress) {
        console.log(`\n✅ 合约已部署！`);
        console.log(`合约地址: ${receipt.contractAddress}`);
        console.log(`Etherscan合约链接: https://sepolia.etherscan.io/address/${receipt.contractAddress}`);
      }
    } else {
      // 交易可能还在pending
      const tx = await provider.getTransaction(txHash);
      
      if (tx) {
        console.log("⏳ 交易仍在Pending状态");
        console.log(`Nonce: ${tx.nonce}`);
        console.log(`From: ${tx.from}`);
        console.log(`To: ${tx.to || "合约部署"}`);
        console.log(`Gas Limit: ${tx.gasLimit.toString()}`);
        console.log(`Gas Price: ${ethers.formatUnits(tx.gasPrice || 0n, "gwei")} Gwei`);
        console.log(`Value: ${ethers.formatEther(tx.value)} ETH`);
        
        // 检查当前区块
        const currentBlock = await provider.getBlockNumber();
        console.log(`\n当前区块高度: ${currentBlock}`);
        console.log("\n建议:");
        console.log("1. 等待交易被确认（通常需要几分钟）");
        console.log("2. 如果长时间pending，可能是gas价格过低");
        console.log("3. 可以尝试发送一个更高gas价格的交易来替换它");
      } else {
        console.log("❌ 交易未找到");
        console.log("\n可能的原因:");
        console.log("1. 交易哈希错误");
        console.log("2. 交易被网络丢弃（gas价格过低）");
        console.log("3. 交易在另一个网络上");
        console.log("\n建议:");
        console.log("1. 检查交易哈希是否正确");
        console.log("2. 如果gas价格过低，交易可能被丢弃，需要重新部署");
        console.log("3. 检查是否在正确的网络（Sepolia）上");
      }
    }
    
    // 检查pending交易
    console.log("\n" + "=".repeat(60));
    console.log("  检查账户Pending交易");
    console.log("=".repeat(60));
    
    if (receipt || (await provider.getTransaction(txHash))) {
      const tx = await provider.getTransaction(txHash);
      if (tx) {
        const fromAddress = tx.from;
        const pendingCount = await provider.getTransactionCount(fromAddress, "pending");
        const latestCount = await provider.getTransactionCount(fromAddress, "latest");
        
        console.log(`账户: ${fromAddress}`);
        console.log(`最新Nonce: ${latestCount}`);
        console.log(`Pending Nonce: ${pendingCount}`);
        console.log(`交易Nonce: ${tx.nonce}`);
        
        if (pendingCount > latestCount) {
          console.log(`\n⚠️  检测到 ${pendingCount - latestCount} 个pending交易`);
          console.log("这可能会影响新交易的确认");
        }
      }
    }
    
  } catch (error) {
    console.error("\n❌ 检查交易时出错:");
    console.error(error.message);
    
    if (error.message.includes("not found")) {
      console.log("\n交易可能:");
      console.log("1. 还在pending状态");
      console.log("2. 已被网络丢弃（gas价格过低）");
      console.log("3. 交易哈希错误");
    }
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

