const { ethers } = require("hardhat");

function parseArgs() {
  const args = process.argv.slice(2);
  let amount = null;
  let to = [];
  for (const part of args) {
    if (part.startsWith("--amount")) {
      const [, val] = part.split("=");
      amount = val;
    } else if (part.startsWith("--to")) {
      const [, val] = part.split("=");
      to = val ? val.split(",").map((s) => s.trim()).filter(Boolean) : [];
    }
  }
  if (!amount || to.length === 0) {
    throw new Error("Usage: npx hardhat run scripts/send-eth.js --network sepolia --amount=0.01 --to=0xabc,0xdef");
  }
  return { amount, to };
}

async function main() {
  const { amount, to } = parseArgs();
  const signer = (await ethers.getSigners())[0];

  console.log("Sender:", await signer.getAddress());
  console.log("Amount (ETH):", amount);
  console.log("Recipients:", to);

  const value = ethers.parseEther(amount);

  for (const recipient of to) {
    const tx = await signer.sendTransaction({ to: recipient, value });
    console.log(`Sending to ${recipient} -> tx: ${tx.hash}`);
    await tx.wait();
  }

  console.log("Done.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});


