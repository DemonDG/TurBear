// scripts/unstake-old-nfts.js
// 使用Hardhat signer从旧版Launchpad合约一次性赎回所有已质押的NFT
const hre = require("hardhat");

async function main() {
  const OLD_LAUNCHPAD_ADDRESS = "0x4637Bc858633bf2a72D6bEb328Ac6f34f087e38C";

  const [signer] = await hre.ethers.getSigners();
  console.log(`使用账户: ${signer.address}`);

  const abi = [
    "function stakedNFTs(address account) view returns (uint256[] memory)",
    "function userInfo(address account) view returns (uint256,uint256,uint256,uint256,uint256)",
    "function unstakeNFT(uint256 tokenId)",
    "function unstakeTokens(uint256 amount)"
  ];

  const staking = new hre.ethers.Contract(OLD_LAUNCHPAD_ADDRESS, abi, signer);

  const user = await staking.userInfo(signer.address);
  const stakedTokenAmount = user[0];
  const stakedIds = await staking.stakedNFTs(signer.address);

  if (stakedTokenAmount > 0n) {
    console.log(`检测到质押的代币数量: ${stakedTokenAmount.toString()}`);
    console.log("开始赎回代币...");
    const tx = await staking.unstakeTokens(stakedTokenAmount);
    console.log(`已发送代币赎回交易，hash=${tx.hash}`);
    await tx.wait();
    console.log("代币赎回完成。");
  } else {
    console.log("旧合约中没有待赎回的代币。");
  }

  if (stakedIds.length === 0) {
    console.log("旧合约中没有待赎回的NFT。");
  } else {
    const tokenIdList = stakedIds.map((id) => id.toString());
    console.log(`检测到旧合约中质押的NFT: [${tokenIdList.join(", ")}]`);

    for (const tokenId of stakedIds) {
      const idStr = tokenId.toString();
      console.log(`开始赎回 tokenId=${idStr} ...`);
      const tx = await staking.unstakeNFT(tokenId);
      console.log(`已发送交易，hash=${tx.hash}`);
      await tx.wait();
      console.log(`tokenId ${idStr} 赎回完成。`);
    }
  }
  console.log("旧合约资产赎回流程完成。");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});

