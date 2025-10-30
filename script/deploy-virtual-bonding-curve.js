const { ethers } = require("hardhat");

async function main() {
    const [deployer] = await ethers.getSigners();
    console.log("Deploying Virtual Bonding Curve contracts with the account:", deployer.address);

    // Network configuration
    const network = await ethers.provider.getNetwork();
    console.log("Network:", network.name);

    // Uniswap V2 addresses (mainnet)
    const UNISWAP_V2_FACTORY = "0x5C69bEe701ef814a2B6a3EDD4B1652CB9cc5aA6f";
    const UNISWAP_V2_ROUTER = "0x7a250d5630B4cF539739dF2C5dAcb4c659F2488D";
    const WETH_ADDRESS = "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2";

    // For testnet (Goerli)
    // const UNISWAP_V2_FACTORY = "0x5C69bEe701ef814a2B6a3EDD4B1652CB9cc5aA6f";
    // const UNISWAP_V2_ROUTER = "0x7a250d5630B4cF539739dF2C5dAcb4c659F2488D";
    // const WETH_ADDRESS = "0xB4FBF271143F4FBf7B91A5ded31805e42b2208d6";

    // For local testing, we'll deploy mock Uniswap contracts
    let uniswapFactory, uniswapRouter, assetToken;

    if (network.chainId === 31337) {
        // Local network - deploy mock contracts
        console.log("Deploying mock contracts for local testing...");
        
        const MockUniswapFactory = await ethers.getContractFactory("MockUniswapFactory");
        uniswapFactory = await MockUniswapFactory.deploy();
        await uniswapFactory.waitForDeployment();
        console.log("MockUniswapFactory deployed to:", await uniswapFactory.getAddress());

        const MockUniswapRouter = await ethers.getContractFactory("MockUniswapRouter");
        uniswapRouter = await MockUniswapRouter.deploy(await uniswapFactory.getAddress());
        await uniswapRouter.waitForDeployment();
        console.log("MockUniswapRouter deployed to:", await uniswapRouter.getAddress());

        // Deploy mock WETH for local testing
        const MockWETH = await ethers.getContractFactory("MockWETH");
        assetToken = await MockWETH.deploy();
        await assetToken.waitForDeployment();
        console.log("MockWETH deployed to:", await assetToken.getAddress());
    } else {
        // Use existing Uniswap contracts
        uniswapFactory = UNISWAP_V2_FACTORY;
        uniswapRouter = UNISWAP_V2_ROUTER;
        assetToken = WETH_ADDRESS;
    }

    // Deploy Standard Token (following fun FERC20 logic)
    console.log("\nDeploying Standard Token...");
    const StandardToken = await ethers.getContractFactory("StandardToken");
    const token = await StandardToken.deploy(
        "Virtual Bonding Token",
        "VBT",
        ethers.parseEther("1000000"), // 1M token cap
        deployer.address
    );
    await token.waitForDeployment();
    console.log("StandardToken deployed to:", await token.getAddress());

    // Bonding curve parameters (following fun logic)
    const assetRate = 1000; // Asset rate for price calculation
    const gradThreshold = ethers.parseEther("10000"); // 10k token threshold for Uniswap listing
    const maxTx = ethers.parseEther("1000"); // Max transaction amount
    const buyFeeBps = 250; // 2.5% buy fee
    const sellFeeBps = 250; // 2.5% sell fee

    // Deploy Virtual Bonding Curve
    console.log("\nDeploying Virtual Bonding Curve...");
    const VirtualBondingCurve = await ethers.getContractFactory("VirtualBondingCurve");
    const bondingCurve = await VirtualBondingCurve.deploy(
        await token.getAddress(),
        assetToken,
        uniswapFactory,
        uniswapRouter,
        assetRate,
        gradThreshold,
        maxTx,
        buyFeeBps,
        sellFeeBps,
        deployer.address, // feeTo
        deployer.address  // owner
    );
    await bondingCurve.waitForDeployment();
    console.log("VirtualBondingCurve deployed to:", await bondingCurve.getAddress());

    // Set bonding curve in token contract
    console.log("\nSetting bonding curve in token contract...");
    const setBondingCurveTx = await token.setBondingCurve(await bondingCurve.getAddress());
    await setBondingCurveTx.wait();
    console.log("Bonding curve set in token contract");

    // Add initial liquidity to bonding curve (following fun logic)
    console.log("\nAdding initial liquidity to bonding curve...");
    const initialAssetAmount = ethers.parseEther("10"); // 10 WETH
    const initialTokenAmount = ethers.parseEther("1000"); // 1000 tokens

    // For local testing, mint some WETH to deployer
    if (network.chainId === 31337) {
        await assetToken.mint(deployer.address, initialAssetAmount);
        console.log("Minted", ethers.formatEther(initialAssetAmount), "WETH to deployer");
    }

    // Approve tokens for bonding curve
    const approveTokenTx = await token.approve(await bondingCurve.getAddress(), initialTokenAmount);
    await approveTokenTx.wait();
    
    const approveAssetTx = await assetToken.approve(await bondingCurve.getAddress(), initialAssetAmount);
    await approveAssetTx.wait();

    // Add liquidity
    const addLiquidityTx = await bondingCurve.addInitialLiquidity(initialAssetAmount, initialTokenAmount);
    await addLiquidityTx.wait();
    console.log("Initial liquidity added to bonding curve");

    // Verify deployment
    console.log("\n=== Deployment Summary ===");
    console.log("Token Address:", await token.getAddress());
    console.log("Asset Token (WETH):", assetToken);
    console.log("Bonding Curve Address:", await bondingCurve.getAddress());
    console.log("Uniswap Factory:", uniswapFactory);
    console.log("Uniswap Router:", uniswapRouter);
    console.log("Initial Asset Liquidity:", ethers.formatEther(initialAssetAmount), "WETH");
    console.log("Initial Token Liquidity:", ethers.formatEther(initialTokenAmount), "tokens");
    console.log("Threshold for Uniswap listing:", ethers.formatEther(await bondingCurve.getThreshold()));
    console.log("Current Price:", ethers.formatEther(await bondingCurve.getCurrentPrice()), "WETH per token");
    console.log("Asset Rate:", await bondingCurve.assetRate());
    console.log("Max Transaction:", ethers.formatEther(await bondingCurve.maxTx()));
    console.log("Buy Fee:", await bondingCurve.buyFeeBps(), "basis points");
    console.log("Sell Fee:", await bondingCurve.sellFeeBps(), "basis points");

    // Get pool reserves
    const [reserve0, reserve1] = await bondingCurve.getReserves();
    console.log("Pool Reserves - Token:", ethers.formatEther(reserve0), "Asset:", ethers.formatEther(reserve1));
    console.log("K Last:", ethers.formatEther(await bondingCurve.getKLast()));

    // Save deployment info
    const deploymentInfo = {
        network: network.name,
        chainId: network.chainId,
        deployer: deployer.address,
        token: await token.getAddress(),
        assetToken: assetToken,
        bondingCurve: await bondingCurve.getAddress(),
        uniswapFactory: uniswapFactory,
        uniswapRouter: uniswapRouter,
        initialAssetLiquidity: ethers.formatEther(initialAssetAmount),
        initialTokenLiquidity: ethers.formatEther(initialTokenAmount),
        threshold: ethers.formatEther(await bondingCurve.getThreshold()),
        currentPrice: ethers.formatEther(await bondingCurve.getCurrentPrice()),
        assetRate: await bondingCurve.assetRate(),
        maxTx: ethers.formatEther(await bondingCurve.maxTx()),
        buyFeeBps: await bondingCurve.buyFeeBps(),
        sellFeeBps: await bondingCurve.sellFeeBps(),
        reserve0: ethers.formatEther(reserve0),
        reserve1: ethers.formatEther(reserve1),
        kLast: ethers.formatEther(await bondingCurve.getKLast())
    };

    console.log("\nDeployment info saved to virtual-bonding-deployment-info.json");
    require('fs').writeFileSync(
        'virtual-bonding-deployment-info.json',
        JSON.stringify(deploymentInfo, null, 2)
    );

    // Test basic functionality
    console.log("\n=== Testing Basic Functionality ===");
    
    // Test buy tokens
    const testBuyAmount = ethers.parseEther("1"); // 1 WETH
    if (network.chainId === 31337) {
        await assetToken.mint(deployer.address, testBuyAmount);
    }
    
    await assetToken.approve(await bondingCurve.getAddress(), testBuyAmount);
    const buyTx = await bondingCurve.buyTokens(testBuyAmount, 0);
    await buyTx.wait();
    console.log("Test buy transaction successful");
    
    // Test price calculations
    const currentPrice = await bondingCurve.getCurrentPrice();
    const buyPrice = await bondingCurve.getBuyPrice(ethers.parseEther("100"));
    const sellPrice = await bondingCurve.getSellPrice(ethers.parseEther("50"));
    
    console.log("Current Price:", ethers.formatEther(currentPrice), "WETH per token");
    console.log("Buy Price for 100 tokens:", ethers.formatEther(buyPrice), "WETH");
    console.log("Sell Price for 50 tokens:", ethers.formatEther(sellPrice), "WETH");
    
    // Check threshold
    const thresholdReached = await bondingCurve.checkThreshold();
    console.log("Threshold reached:", thresholdReached);
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    }); 