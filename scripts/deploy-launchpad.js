const { ethers } = require('hardhat');

// 质押所需的 ERC20 代币地址（用户提供）
const STAKE_TOKEN_ADDRESS = '0x73E416BE059B83A8d8FFcF024d024284ADbA0b88';
// 质押用的 NFT 地址（沿用已部署的 RarityNFT）
const STAKE_NFT_ADDRESS = '0x836c806A676f8C9BE701eD6358667A01564f0e03';

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log('部署账户:', deployer.address);
  console.log('账户余额:', ethers.formatEther(await deployer.provider.getBalance(deployer.address)), 'ETH');
  console.log('---');

  console.log('开始部署 EarnToken...');
  const EarnToken = await ethers.getContractFactory('EarnToken');
  const earnToken = await EarnToken.deploy();
  await earnToken.waitForDeployment();
  const earnTokenAddress = await earnToken.getAddress();
  console.log('EarnToken 已部署:', earnTokenAddress);

  console.log('开始部署 LaunchpadStaking...');
  const LaunchpadStaking = await ethers.getContractFactory('LaunchpadStaking');
  const launchpad = await LaunchpadStaking.deploy(
    deployer.address,
    STAKE_TOKEN_ADDRESS,
    STAKE_NFT_ADDRESS,
    earnTokenAddress
  );
  await launchpad.waitForDeployment();
  const launchpadAddress = await launchpad.getAddress();
  console.log('LaunchpadStaking 已部署:', launchpadAddress);

  console.log('设置 Launchpad 为 EarnToken 的 minter...');
  const tx = await earnToken.setMinter(launchpadAddress, true);
  console.log('setMinter 交易哈希:', tx.hash);
  await tx.wait();
  console.log('Launchpad 已获得增发权限。');

  console.log('--- 部署完成 ---');
  console.log('EarnToken 地址:', earnTokenAddress);
  console.log('LaunchpadStaking 地址:', launchpadAddress);
  console.log('请将以上地址写入 frontend/src/config.js');
}

main().catch((error) => {
  console.error('部署失败:', error);
  process.exitCode = 1;
});
