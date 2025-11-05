// hardhat.config.js
require("@nomicfoundation/hardhat-toolbox");

// 直接在此处填写测试用的 RPC 与私钥（仅限测试！）
const SEPOLIA_RPC_URL = "https://eth-sepolia.g.alchemy.com/v2/DiCHzKzfDPlCk2nNfi6n1";
const PRIVATE_KEY = "0x83ad3635832a35f101adb835ca116608f3b5f15bddbd7f55fd1b24349278b4ce"; // 确保带 0x 前缀

/** @type import('hardhat/config').HardhatUserConfig */
const config = {
  solidity: "0.8.28",
  networks: {
    sepolia: {
      url: SEPOLIA_RPC_URL,
      accounts: PRIVATE_KEY ? [PRIVATE_KEY] : [],
      chainId: 11155111,
    },
  },
};

module.exports = config;