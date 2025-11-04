const { ethers } = require("hardhat");

async function main() {

    const Counter = await ethers.getContractFactory("Counter");
    const counter = await Counter.deploy();
    await counter.waitForDeployment();

    console.log("Counter address:", await counter.getAddress());
}

main();