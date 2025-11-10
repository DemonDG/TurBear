// 将此地址替换为你在 Sepolia 部署的 BLToken 地址
export const CONTRACT_ADDRESS = "0x73E416BE059B83A8d8FFcF024d024284ADbA0b88";

// NFT合约地址
export const NFT_CONTRACT_ADDRESS = "0x836c806A676f8C9BE701eD6358667A01564f0e03";

// Launchpad 相关地址
export const STAKE_TOKEN_ADDRESS = CONTRACT_ADDRESS; // 质押所需 ERC20
export const STAKE_NFT_ADDRESS = NFT_CONTRACT_ADDRESS; // 质押的 NFT（沿用 RarityNFT）
export const EARN_TOKEN_ADDRESS = "0x0Fd8cF7dD90050B433d76Dd9Eb9fAdF708b9Da78"; // Earn Token 合约地址
export const LAUNCHPAD_CONTRACT_ADDRESS = "0xeb487Bf1E0556340e6cDAb9aC2328038e21c9744"; // Launchpad Staking 地址

// Alchemy API 相关配置（需替换为你自己的 API Key）
export const ALCHEMY_API_KEY = "DiCHzKzfDPlCk2nNfi6n1"; // 请在此处填入真实的 Alchemy API Key
export const ALCHEMY_RPC_URL = `https://eth-sepolia.g.alchemy.com/v2/${ALCHEMY_API_KEY}`; // 用于 JSON-RPC 请求
export const ALCHEMY_NFT_API_URL = `https://eth-sepolia.g.alchemy.com/nft/v2/${ALCHEMY_API_KEY}`; // 用于 NFT REST 接口

