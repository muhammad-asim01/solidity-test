import { parseEther } from "ethers";
import { ethers, upgrades } from "hardhat";

const adminSigner = new ethers.Wallet(
  process.env.ADMIN_PRIVATE_KEY,
  ethers.provider
);

(async () => {
  try {
    const args = require("../arguments/personaFactoryArguments");
    const Contract = await ethers.getContractFactory("AgentFactoryV2");
    const contract = await upgrades.deployProxy(Contract, args, {
      initialOwner: process.env.CONTRACT_CONTROLLER,
    });
    console.log("AgentFactoryV2 deployed to:", contract.target);

    const t = await contract.setTokenAdmin(process.env.ADMIN);
    await t.wait();
    const t2 = await contract.setTokenSupplyParams(
      process.env.AGENT_TOKEN_SUPPLY,
      process.env.AGENT_TOKEN_LP_SUPPLY,
      process.env.AGENT_TOKEN_VAULT_SUPPLY,
      process.env.AGENT_TOKEN_LIMIT_WALLET,
      process.env.AGENT_TOKEN_LIMIT_TRX,
      process.env.BOT_PROTECTION,
      process.env.MINTER
    );
    await t2.wait();
    const t3 = await contract.setTokenTaxParams(
      process.env.TAX,
      process.env.TAX,
      process.env.SWAP_THRESHOLD,
      process.env.TAX_VAULT
    );
    await t3.wait();
    const t4 = await contract.setUniswapRouter(process.env.UNISWAP_ROUTER);
    await t4.wait();
    const t5 = await contract.grantRole(
      await contract.WITHDRAW_ROLE(),
      process.env.OP
    );
    await t5.wait();

    const nft = await ethers.getContractAt(
      "AgentNftV2",
      process.env.VIRTUAL_NFT,
      adminSigner
    );
    await nft.grantRole(await nft.MINTER_ROLE(), contract.target);
  } catch (e) {
    console.log(e);
  }
})();
