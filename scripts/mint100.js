const { ethers } = require("hardhat");

async function main() {
  // 请替换为部署在 Sepolia 上的真实 BLToken 合约地址
  const rawAddr = "0xCF4bD2e2852885Fd8F70e2593D72d303eB389134";

  // 规范化地址并做基础校验
  const tokenAddr = ethers.getAddress(rawAddr);
  const code = await ethers.provider.getCode(tokenAddr);
  if (code === "0x") {
    throw new Error(`地址上没有合约：${tokenAddr}（请使用 Sepolia 部署输出的合约地址）`);
  }

  const [signer] = await ethers.getSigners();
  const signerAddr = await signer.getAddress();
  const token = await ethers.getContractAt("BLToken", tokenAddr, signer);

  console.log(await token.name());   // 应为 "BL Token"
  console.log(await token.symbol());
  console.log(await token.owner());
  // 合约类型与权限检查
  const [name, symbol, owner] = await Promise.all([
    token.name(),
    token.symbol(),
    token.owner(),
  ]);

  console.log("token:", tokenAddr, name, symbol);
  console.log("signer:", signerAddr);
  console.log("owner:", owner);

  if (owner.toLowerCase() !== signerAddr.toLowerCase()) {
    throw new Error("onlyOwner 校验失败：当前签名者不是合约 owner。请改用部署者私钥或先 transferOwnership。");
  }

  // 执行增发 100 BL
  const tx = await token.mint100();
  console.log("tx:", tx.hash);
  await tx.wait();
  const balance = await token.balanceOf(signerAddr);
  console.log("balance:", ethers.formatEther(balance), "BL");
}

main().catch((e) => { console.error(e); process.exit(1); });