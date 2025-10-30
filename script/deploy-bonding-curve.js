const { ethers } = require("hardhat");

async function main() {
    const [deployer] = await ethers.getSigners();
    console.log("Deploying contracts with the account:", deployer.address);

    // Network configuration
    const network = await ethers.provider.getNetwork();
    console.log("Network:", network.name);

    // Uniswap V2 addresses (mainnet)
    const UNISWAP_V2_FACTORY = "0x5C69bEe701ef814a2B6a3EDD4B1652CB9cc5aA6f";
    const UNISWAP_V2_ROUTER = "0x7a250d5630B4cF539739dF2C5dAcb4c659F2488D";

    // For testnet (Goerli)
    // const UNISWAP_V2_FACTORY = "0x5C69bEe701ef814a2B6a3EDD4B1652CB9cc5aA6f";
    // const UNISWAP_V2_ROUTER = "0x7a250d5630B4cF539739dF2C5dAcb4c659F2488D";

    // For local testing, we'll deploy mock Uniswap contracts
    let uniswapFactory, uniswapRouter;

    if (network.chainId === 31337) {
        // Local network - deploy mock Uniswap contracts
        console.log("Deploying mock Uniswap contracts for local testing...");
        
        const MockUniswapFactory = await ethers.getContractFactory("MockUniswapFactory");
        uniswapFactory = await MockUniswapFactory.deploy();
        await uniswapFactory.waitForDeployment();
        console.log("MockUniswapFactory deployed to:", await uniswapFactory.getAddress());

        const MockUniswapRouter = await ethers.getContractFactory("MockUniswapRouter");
        uniswapRouter = await MockUniswapRouter.deploy(await uniswapFactory.getAddress());
        await uniswapRouter.waitForDeployment();
        console.log("MockUniswapRouter deployed to:", await uniswapRouter.getAddress());
    } else {
        // Use existing Uniswap contracts
        uniswapFactory = UNISWAP_V2_FACTORY;
        uniswapRouter = UNISWAP_V2_ROUTER;
    }

    // Deploy Standard Token
    console.log("\nDeploying Standard Token...");
    const StandardToken = await ethers.getContractFactory("StandardToken");
    const token = await StandardToken.deploy(
        "Bonding Curve Token",
        "BCT",
        ethers.parseEther("1000000"), // 1M token cap
        deployer.address
    );
    await token.waitForDeployment();
    console.log("StandardToken deployed to:", await token.getAddress());

    // Deploy Bonding Curve
    console.log("\nDeploying Bonding Curve...");
    const BondingCurve = await ethers.getContractFactory("BondingCurve");
    const bondingCurve = await BondingCurve.deploy(
        await token.getAddress(),
        uniswapFactory,
        uniswapRouter,
        ethers.parseEther("10000"), // 10k token threshold for Uniswap listing
        deployer.address
    );
    await bondingCurve.waitForDeployment();
    console.log("BondingCurve deployed to:", await bondingCurve.getAddress());

    // Set bonding curve in token contract
    console.log("\nSetting bonding curve in token contract...");
    const setBondingCurveTx = await token.setBondingCurve(await bondingCurve.getAddress());
    await setBondingCurveTx.wait();
    console.log("Bonding curve set in token contract");

    // Add initial liquidity to bonding curve
    console.log("\nAdding initial liquidity to bonding curve...");
    const initialEthAmount = ethers.parseEther("10"); // 10 ETH
    const initialTokenAmount = ethers.parseEther("1000"); // 1000 tokens

    // Approve tokens for bonding curve
    const approveTx = await token.approve(await bondingCurve.getAddress(), initialTokenAmount);
    await approveTx.wait();

    // Add liquidity
    const addLiquidityTx = await bondingCurve.addInitialLiquidity({ value: initialEthAmount });
    await addLiquidityTx.wait();
    console.log("Initial liquidity added to bonding curve");

    // Verify deployment
    console.log("\n=== Deployment Summary ===");
    console.log("Token Address:", await token.getAddress());
    console.log("Bonding Curve Address:", await bondingCurve.getAddress());
    console.log("Uniswap Factory:", uniswapFactory);
    console.log("Uniswap Router:", uniswapRouter);
    console.log("Initial ETH Liquidity:", ethers.formatEther(initialEthAmount));
    console.log("Initial Token Liquidity:", ethers.formatEther(initialTokenAmount));
    console.log("Threshold for Uniswap listing:", ethers.formatEther(await bondingCurve.getThreshold()));
    console.log("Current Price:", ethers.formatEther(await bondingCurve.getCurrentPrice()), "ETH per token");

    // Save deployment info
    const deploymentInfo = {
        network: network.name,
        chainId: network.chainId,
        deployer: deployer.address,
        token: await token.getAddress(),
        bondingCurve: await bondingCurve.getAddress(),
        uniswapFactory: uniswapFactory,
        uniswapRouter: uniswapRouter,
        initialEthLiquidity: ethers.formatEther(initialEthAmount),
        initialTokenLiquidity: ethers.formatEther(initialTokenAmount),
        threshold: ethers.formatEther(await bondingCurve.getThreshold()),
        currentPrice: ethers.formatEther(await bondingCurve.getCurrentPrice())
    };

    console.log("\nDeployment info saved to deployment-info.json");
    require('fs').writeFileSync(
        'deployment-info.json',
        JSON.stringify(deploymentInfo, null, 2)
    );
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    }); 