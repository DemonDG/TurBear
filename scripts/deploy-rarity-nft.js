const { ethers } = require("hardhat");

// 日志工具函数
function logSection(title) {
  console.log("\n" + "=".repeat(60));
  console.log(`  ${title}`);
  console.log("=".repeat(60));
}

function logInfo(label, value) {
  console.log(`  ${label}: ${value}`);
}

function logError(message) {
  console.error(`\n❌ 错误: ${message}`);
}

function logSuccess(message) {
  console.log(`\n✅ ${message}`);
}

function logWarning(message) {
  console.log(`\n⚠️  ${message}`);
}

async function main() {
  try {
    logSection("开始部署 RarityNFT 合约");
    
    // 获取部署账户
    const [deployer] = await ethers.getSigners();
    logInfo("部署账户", deployer.address);
    
    // 获取网络信息
    const network = await ethers.provider.getNetwork();
    logInfo("网络名称", network.name);
    logInfo("链ID", network.chainId.toString());
    
    // 获取RPC URL（从hardhat配置中）
    const hardhatConfig = require("../hardhat.config.js");
    const rpcUrl = hardhatConfig.networks?.sepolia?.url || "未知";
    logInfo("RPC节点", rpcUrl);
    
    // 检查账户余额
    logSection("账户信息");
    const balance = await ethers.provider.getBalance(deployer.address);
    const balanceEth = ethers.formatEther(balance);
    logInfo("账户余额", `${balanceEth} ETH`);
    
    if (balance === 0n) {
      logError("账户余额不足，请先充值ETH");
      process.exit(1);
    }
    
    // 获取当前区块信息
    const blockNumber = await ethers.provider.getBlockNumber();
    logInfo("当前区块高度", blockNumber.toString());
    
    // 获取Gas价格
    logSection("Gas 信息");
    const feeData = await ethers.provider.getFeeData();
    if (feeData.gasPrice) {
      logInfo("当前Gas价格", `${ethers.formatUnits(feeData.gasPrice, "gwei")} Gwei`);
    }
    
    // 检查pending交易
    logSection("检查Pending交易");
    const pendingCount = await ethers.provider.getTransactionCount(deployer.address, "pending");
    const latestCount = await ethers.provider.getTransactionCount(deployer.address, "latest");
    logInfo("最新Nonce", latestCount.toString());
    logInfo("Pending Nonce", pendingCount.toString());
    
    if (pendingCount > latestCount) {
      logWarning(`检测到 ${pendingCount - latestCount} 个pending交易`);
      console.log("  建议等待pending交易确认后再部署，或使用更高的gas价格");
      console.log("  继续部署将使用更高的gas价格...\n");
    }
    
    // 编译合约
    logSection("编译合约");
    console.log("  正在编译 RarityNFT.sol...");
    const RarityNFT = await ethers.getContractFactory("RarityNFT");
    logSuccess("合约编译成功");
    
    // 估算Gas
    logSection("估算部署Gas");
    try {
      const deployData = RarityNFT.bytecode;
      const estimatedGas = await ethers.provider.estimateGas({
        data: deployData,
        from: deployer.address,
      });
      logInfo("预估Gas", estimatedGas.toString());
      
      if (feeData.gasPrice) {
        const estimatedCost = estimatedGas * feeData.gasPrice;
        logInfo("预估费用", `${ethers.formatEther(estimatedCost)} ETH`);
      }
    } catch (error) {
      logWarning(`Gas估算失败: ${error.message}`);
    }
    
    // 部署合约
    logSection("部署合约");
    console.log("  正在发送部署交易到 Sepolia 网络...");
    console.log("  这可能需要一些时间，请耐心等待...\n");
    
    // 获取当前nonce
    const nonce = await ethers.provider.getTransactionCount(deployer.address, "pending");
    logInfo("使用Nonce", nonce.toString());
    
    // 计算更高的gas价格（增加20%以确保交易被接受）
    let gasPrice = feeData.gasPrice;
    const minGasPrice = ethers.parseUnits("1", "gwei"); // 最小1 Gwei
    
    if (gasPrice && gasPrice > 0n) {
      // 如果gas价格太低，使用最小值
      if (gasPrice < minGasPrice) {
        const originalPrice = ethers.formatUnits(gasPrice, "gwei");
        gasPrice = minGasPrice;
        logWarning(`Gas价格过低(${originalPrice} Gwei)，已调整为最小值 1 Gwei`);
      } else {
        // 增加30%以确保交易被接受（特别是当有pending交易时）
        const increasePercent = pendingCount > latestCount ? 130n : 120n;
        gasPrice = (gasPrice * increasePercent) / 100n;
        logInfo("调整后Gas价格", `${ethers.formatUnits(gasPrice, "gwei")} Gwei (增加${increasePercent === 130n ? "30" : "20"}%)`);
      }
    } else {
      // 如果没有gas价格，使用默认值
      gasPrice = ethers.parseUnits("2", "gwei");
      logWarning(`无法获取Gas价格，使用默认值 2 Gwei`);
    }
    
    // 确保gas价格至少为1 Gwei
    if (gasPrice < minGasPrice) {
      gasPrice = minGasPrice;
      logWarning(`强制设置Gas价格为最小值 1 Gwei`);
    }
    
    try {
      const deployTx = await RarityNFT.deploy({
        gasLimit: 3000000,
        gasPrice: gasPrice,
        nonce: nonce,
      });
    
      const txHash = deployTx.deploymentTransaction()?.hash;
      if (txHash) {
        logInfo("交易哈希", txHash);
        logInfo("Etherscan链接", `https://sepolia.etherscan.io/tx/${txHash}`);
      }
      
      // 等待交易确认
      logSection("等待交易确认");
      console.log("  正在等待区块确认...");
      
      let confirmations = 0;
      const checkInterval = setInterval(async () => {
        try {
          const receipt = await ethers.provider.getTransactionReceipt(txHash);
          if (receipt) {
            confirmations = receipt.confirmations;
            process.stdout.write(`\r  已确认区块数: ${confirmations} / 1`);
          }
        } catch (error) {
          // 忽略错误，继续等待
        }
      }, 2000);
      
      // 等待部署完成
      const nft = await Promise.race([
        deployTx.waitForDeployment(),
        new Promise((_, reject) => 
          setTimeout(() => {
            clearInterval(checkInterval);
            reject(new Error("部署超时（5分钟），请检查网络连接或交易状态"));
          }, 300000)
        )
      ]);
      
      clearInterval(checkInterval);
    
      // 获取部署信息
      const nftAddress = await nft.getAddress();
      const deploymentTx = deployTx.deploymentTransaction();
    
      logSection("部署成功");
      logSuccess("RarityNFT 合约已成功部署！");
      logInfo("合约地址", nftAddress);
      logInfo("Etherscan合约链接", `https://sepolia.etherscan.io/address/${nftAddress}`);
      
      if (deploymentTx) {
        const receipt = await deploymentTx.wait();
        logInfo("交易哈希", receipt.hash);
        logInfo("区块号", receipt.blockNumber.toString());
        logInfo("Gas使用量", receipt.gasUsed.toString());
        
        if (receipt.gasUsed && gasPrice) {
          const actualCost = receipt.gasUsed * gasPrice;
          logInfo("实际费用", `${ethers.formatEther(actualCost)} ETH`);
        }
      }
      
      // 验证合约信息
      logSection("合约信息");
      try {
        const defaultURI = await nft.defaultImageURI();
        logInfo("默认图片URI", defaultURI);
        
        const totalSupply = await nft.totalSupply();
        logInfo("当前总供应量", totalSupply.toString());
        
        const owner = await nft.owner();
        logInfo("合约所有者", owner);
      } catch (error) {
        logWarning(`获取合约信息失败: ${error.message}`);
      }
      
      logSection("部署完成");
      logWarning("请记得更新合约中的图片URI地址为实际的图片托管地址！");
      console.log("  可以使用 setDefaultImageURI() 函数更新图片URI");
      console.log("\n");
      
    } catch (deployError) {
      // 如果是replacement transaction underpriced错误，提供解决方案
      if (deployError.message && deployError.message.includes("replacement transaction underpriced")) {
        logError("交易被拒绝：Gas价格过低");
        console.log("\n解决方案：");
        console.log("1. 等待之前的pending交易确认后重试");
        console.log("2. 或者在Etherscan上取消pending交易");
        console.log("3. 或者增加gas价格后重试");
        throw deployError;
      }
      throw deployError;
    }
    
  } catch (error) {
    logSection("部署失败");
    logError(error.message);
    
    if (error.transaction) {
      logInfo("失败交易哈希", error.transaction.hash);
      logInfo("查看交易", `https://sepolia.etherscan.io/tx/${error.transaction.hash}`);
    }
    
    if (error.reason) {
      logInfo("失败原因", error.reason);
    }
    
    console.error("\n详细错误信息:");
    console.error(error);
    
    process.exit(1);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
