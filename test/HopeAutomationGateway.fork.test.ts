import { ethers, upgrades } from "hardhat";
import { expect } from "chai";
import { time, loadFixture } from "@nomicfoundation/hardhat-network-helpers";
import {
  ETH_MOCK_ADDRESS,
  MAX_UINT_AMOUNT,
  ONE_ADDRESS,
  ZERO_ADDRESS,
} from "../helpers/constants";
import { BytesLike, parseUnits } from "ethers/lib/utils";
import { BigNumber, BigNumberish, Contract, Signer } from "ethers";
import { waitForTx } from "../helpers/tx";
import Router02_ABI from "../extendedArtifacts/UniswapV2Router02.json";
import ERC20_ABI from "../extendedArtifacts/ERC20.json";
import WETH_ABI from "../extendedArtifacts/WETH.json";
import stETH_ABI from "../extendedArtifacts/stETH.json";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";

describe("On-chain HOPE Automation Mint & Burn", () => {
  const CREDIT = parseUnits("4000000", 18);
  let agentBlock: number;

  const K: number = 10801805;
  const K_FACTOR: number = 1e12;
  const ETH_TO_BTC_RATIO: number = 10;

  const SAFE_OWNER = "0xC2D0108307Ff76eBb0ea05B78567b5eAF5AC7830";

  const HOPE_ADDRESS = "0xc353Bf07405304AeaB75F4C2Fac7E88D6A68f98e";
  const ETH_ADDRESS = "0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE";
  const ST_ETH_ADDRESS = "0xae7ab96520DE3A18E5e111B5EaAb095312D7fE84";
  const WBTC_ADDRESS = "0x2260FAC5E5542a773Aa44fBCfeDf7C193bc2C599";
  const WETH_ADDRESS = "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2";
  const USDT_ADDRESS = "0xdAC17F958D2ee523a2206206994597C13D831ec7";
  const UNISWAP_ROUTER_ADDRESS = "0x7a250d5630B4cF539739dF2C5dAcb4c659F2488D";

  function calculateReserveAmount(
    _hopeAmount: BigNumber
  ): [BigNumber, BigNumber] {
    const wbtcConversionFactor: BigNumber = parseUnits("1", 18).div(
      parseUnits("1", 8)
    );
    const wbtcAmount: BigNumber = _hopeAmount
      .mul(K)
      .div(K_FACTOR)
      .div(wbtcConversionFactor);
    const ethAmount: BigNumber = wbtcAmount
      .mul(wbtcConversionFactor)
      .mul(ETH_TO_BTC_RATIO);

    return [wbtcAmount, ethAmount];
  }

  async function initAsset(
    receiver: SignerWithAddress,
    wbtc: Contract,
    weth: Contract,
    stETH: Contract,
    usdt: Contract,
    router: Contract
  ) {
    const deadline = (await time.latest()) + 3600;
    const minReturnAmount = "1";
    const swapsToken = [wbtc, usdt];

    for (let i = 0; i < swapsToken.length; i++) {
      await waitForTx(
        await router
          .connect(receiver)
          .swapExactETHForTokens(
            minReturnAmount,
            [
              "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2",
              swapsToken[i].address,
            ],
            receiver.address,
            deadline,
            { value: parseUnits("20", 18) }
          )
      );

      console.log(
        `[INFO] Receiver: ${receiver.address} swapped ${
          swapsToken[i].address
        } ${await swapsToken[i].balanceOf(receiver.address)}`
      );
    }

    await waitForTx(
      await weth.connect(receiver).deposit({ value: parseUnits("20", 18) })
    );
    console.log(
      `[INFO] Receiver: ${receiver.address} deposit ${
        weth.address
      } ${await weth.balanceOf(receiver.address)}`
    );

    await waitForTx(
      await stETH
        .connect(receiver)
        .submit(ZERO_ADDRESS, { value: parseUnits("20", 18) })
    );
    console.log(
      `[INFO] Receiver: ${receiver.address} stake ${
        stETH.address
      } ${await stETH.balanceOf(receiver.address)}`
    );
    console.log(
      `[INFO] Receiver: ${
        receiver.address
      } ETH balance: ${await receiver.getBalance()}`
    );
  }

  async function deployGatewayFixture() {
    const [owner, alice, bob, addr3, ...addrs] = await ethers.getSigners();

    const safeOwner = await ethers.getImpersonatedSigner(SAFE_OWNER);

    const hope = await ethers.getContractAt("HOPE", HOPE_ADDRESS);
    const wbtc = await ethers.getContractAt(ERC20_ABI, WBTC_ADDRESS);
    const weth = await ethers.getContractAt(WETH_ABI, WETH_ADDRESS);
    const stETH = await ethers.getContractAt(stETH_ABI, ST_ETH_ADDRESS);
    const usdt = await ethers.getContractAt(ERC20_ABI, USDT_ADDRESS);

    const router = await ethers.getContractAt(
      Router02_ABI,
      UNISWAP_ROUTER_ADDRESS
    );

    const Vault = await ethers.getContractFactory("Vault");
    const vault = await Vault.deploy(hope.address, wbtc.address, stETH.address);

    const Gateway = await ethers.getContractFactory("Gateway");
    const gateway = await Gateway.deploy(
      hope.address,
      wbtc.address,
      weth.address,
      stETH.address,
      vault.address
    );

    agentBlock = await ethers.provider.getBlockNumber();

    await waitForTx(await vault.updateGateway(gateway.address));
    await waitForTx(
      await owner.sendTransaction({
        to: safeOwner.address,
        value: parseUnits("1", 18),
      })
    );
    await waitForTx(
      await hope
        .connect(safeOwner)
        .grantAgent(
          vault.address,
          CREDIT,
          agentBlock,
          agentBlock + 10000,
          true,
          true
        )
    );
    // Init asset
    await initAsset(alice, wbtc, weth, stETH, usdt, router);
    return {
      owner,
      alice,
      bob,
      addr3,
      hope,
      wbtc,
      weth,
      stETH,
      usdt,
      vault,
      gateway,
    };
  }

  describe("HOPE automation mint & burn", () => {
    describe("Deposit", () => {
      it("combination deposit", async () => {
        const { alice, gateway, wbtc, weth, hope } = await loadFixture(
          deployGatewayFixture
        );
        const mintAmount = parseUnits("7503.15", 18);

        await waitForTx(
          await wbtc.connect(alice).approve(gateway.address, MAX_UINT_AMOUNT)
        );
        await waitForTx(
          await weth.connect(alice).approve(gateway.address, MAX_UINT_AMOUNT)
        );

        const [wbtcAmount, ethAmount] = calculateReserveAmount(mintAmount);

        await waitForTx(
          await gateway
            .connect(alice)
            .combinationDeposit(mintAmount, ETH_MOCK_ADDRESS, {
              value: ethAmount,
            })
        );

        expect(await hope.balanceOf(alice.address)).to.be.equal(mintAmount);
      });
      it("single deposit of USDT", async () => {
        const { owner, alice, gateway, vault, wbtc, weth, usdt, hope, stETH } =
          await loadFixture(deployGatewayFixture);

        await gateway.addVaultManager(owner.address);
        await gateway.updateSupportToken(USDT_ADDRESS, true);
        await gateway.updateSwapWhiteLists([UNISWAP_ROUTER_ADDRESS], [true]);

        await usdt.connect(alice).approve(gateway.address, MAX_UINT_AMOUNT);

        const mintAmount = parseUnits("3000", 18);

        const deadline = (await time.latest()) + 3600;

        const wbtcSwapInputValues = [
          parseUnits("10000", 6),
          "1",
          [USDT_ADDRESS, WETH_ADDRESS, WBTC_ADDRESS],
          gateway.address,
          deadline,
        ];

        const ethSwapInputValues = [
          parseUnits("1000", 6),
          "1",
          [USDT_ADDRESS, WETH_ADDRESS],
          gateway.address,
          deadline,
        ];

        const wbtcInputData = ethers.utils.defaultAbiCoder.encode(
          ["uint256", "uint256", "address[]", "address", "uint256"],
          wbtcSwapInputValues
        );

        const ethInputData = ethers.utils.defaultAbiCoder.encode(
          ["uint256", "uint256", "address[]", "address", "uint256"],
          ethSwapInputValues
        );

        const functionSignature =
          "swapExactTokensForTokens(uint256,uint256,address[],address,uint256)";
        const iface = new ethers.utils.Interface([
          `function ${functionSignature}`,
        ]);

        const functionSelector = iface.getSighash(functionSignature);

        const wbtcEncodeData = ethers.utils.hexConcat([
          functionSelector,
          wbtcInputData,
        ]);
        const ethEncodeData = ethers.utils.hexConcat([
          functionSelector,
          ethInputData,
        ]);

        const wbtcSwapInput: {
          fromToken: string;
          toToken: string;
          approveTarget: string;
          swapTarget: string;
          fromTokenAmount: BigNumberish;
          minReturnAmount: BigNumberish;
          callDataConcat: BytesLike;
          deadLine: BigNumberish;
        } = {
          fromToken: USDT_ADDRESS,
          toToken: WBTC_ADDRESS,
          approveTarget: UNISWAP_ROUTER_ADDRESS,
          swapTarget: UNISWAP_ROUTER_ADDRESS,
          fromTokenAmount: parseUnits("10000", 6),
          minReturnAmount: "1",
          callDataConcat: wbtcEncodeData,
          deadLine: deadline,
        };
        const ethSwapInput: {
          fromToken: string;
          toToken: string;
          approveTarget: string;
          swapTarget: string;
          fromTokenAmount: BigNumberish;
          minReturnAmount: BigNumberish;
          callDataConcat: BytesLike;
          deadLine: BigNumberish;
        } = {
          fromToken: USDT_ADDRESS,
          toToken: WETH_ADDRESS,
          approveTarget: UNISWAP_ROUTER_ADDRESS,
          swapTarget: UNISWAP_ROUTER_ADDRESS,
          fromTokenAmount: parseUnits("1000", 6),
          minReturnAmount: "1",
          callDataConcat: ethEncodeData,
          deadLine: deadline,
        };

        await gateway
          .connect(alice)
          .singleDeposit(mintAmount, [wbtcSwapInput, ethSwapInput]);

        expect(await wbtc.balanceOf(vault.address)).gt(0);
        expect(await stETH.balanceOf(vault.address)).gt(0);
      });

      it("single deposit of WETH", async () => {
        const { owner, alice, gateway, vault, wbtc, weth, hope, stETH } =
          await loadFixture(deployGatewayFixture);
        await gateway.addVaultManager(owner.address);
        await gateway.updateSupportToken(WETH_ADDRESS, true);
        await gateway.updateSwapWhiteLists([UNISWAP_ROUTER_ADDRESS], [true]);

        await weth.connect(alice).approve(gateway.address, MAX_UINT_AMOUNT);

        const mintAmount = parseUnits("3000", 18);

        const deadline = (await time.latest()) + 3600;

        const wbtcSwapInputValues = [
          parseUnits("1", 18),
          "1",
          [WETH_ADDRESS, WBTC_ADDRESS],
          gateway.address,
          deadline,
        ];

        const wbtcInputData = ethers.utils.defaultAbiCoder.encode(
          ["uint256", "uint256", "address[]", "address", "uint256"],
          wbtcSwapInputValues
        );

        const functionSignature =
          "swapExactTokensForTokens(uint256,uint256,address[],address,uint256)";
        const iface = new ethers.utils.Interface([
          `function ${functionSignature}`,
        ]);

        const functionSelector = iface.getSighash(functionSignature);

        const wbtcEncodeData = ethers.utils.hexConcat([
          functionSelector,
          wbtcInputData,
        ]);

        const wbtcSwapInput: {
          fromToken: string;
          toToken: string;
          approveTarget: string;
          swapTarget: string;
          fromTokenAmount: BigNumberish;
          minReturnAmount: BigNumberish;
          callDataConcat: BytesLike;
          deadLine: BigNumberish;
        } = {
          fromToken: WETH_ADDRESS,
          toToken: WBTC_ADDRESS,
          approveTarget: UNISWAP_ROUTER_ADDRESS,
          swapTarget: UNISWAP_ROUTER_ADDRESS,
          fromTokenAmount: parseUnits("1", 18),
          minReturnAmount: "1",
          callDataConcat: wbtcEncodeData,
          deadLine: deadline,
        };
        const ethSwapInput: {
          fromToken: string;
          toToken: string;
          approveTarget: string;
          swapTarget: string;
          fromTokenAmount: BigNumberish;
          minReturnAmount: BigNumberish;
          callDataConcat: BytesLike;
          deadLine: BigNumberish;
        } = {
          fromToken: WETH_ADDRESS,
          toToken: WETH_ADDRESS,
          approveTarget: UNISWAP_ROUTER_ADDRESS,
          swapTarget: UNISWAP_ROUTER_ADDRESS,
          fromTokenAmount: parseUnits("1", 18),
          minReturnAmount: "1",
          callDataConcat: "0x",
          deadLine: deadline,
        };

        await gateway
          .connect(alice)
          .singleDeposit(mintAmount, [wbtcSwapInput, ethSwapInput]);

        expect(await wbtc.balanceOf(vault.address)).gt(0);
        expect(await stETH.balanceOf(vault.address)).gt(0);
      });

      it("single deposit of ETH", async () => {
        const { owner, alice, gateway, vault, wbtc, weth, usdt, hope, stETH } =
          await loadFixture(deployGatewayFixture);

        await gateway.addVaultManager(owner.address);
        await gateway.updateSupportToken(ETH_MOCK_ADDRESS, true);
        await gateway.updateSwapWhiteLists([UNISWAP_ROUTER_ADDRESS], [true]);

        const mintAmount = parseUnits("3000", 18);

        const deadline = (await time.latest()) + 3600;

        const wbtcSwapInputValues = [
          "1",
          [WETH_ADDRESS, WBTC_ADDRESS],
          gateway.address,
          deadline,
        ];

        const wbtcInputData = ethers.utils.defaultAbiCoder.encode(
          ["uint256", "address[]", "address", "uint256"],
          wbtcSwapInputValues
        );

        const functionSignature =
          "swapExactETHForTokens(uint256,address[],address,uint256)";
        const iface = new ethers.utils.Interface([
          `function ${functionSignature}`,
        ]);

        const functionSelector = iface.getSighash(functionSignature);

        const wbtcEncodeData = ethers.utils.hexConcat([
          functionSelector,
          wbtcInputData,
        ]);

        const wbtcSwapInput: {
          fromToken: string;
          toToken: string;
          approveTarget: string;
          swapTarget: string;
          fromTokenAmount: BigNumberish;
          minReturnAmount: BigNumberish;
          callDataConcat: BytesLike;
          deadLine: BigNumberish;
        } = {
          fromToken: ETH_MOCK_ADDRESS,
          toToken: WBTC_ADDRESS,
          approveTarget: UNISWAP_ROUTER_ADDRESS,
          swapTarget: UNISWAP_ROUTER_ADDRESS,
          fromTokenAmount: parseUnits("1", 18),
          minReturnAmount: "1",
          callDataConcat: wbtcEncodeData,
          deadLine: deadline,
        };
        const ethSwapInput: {
          fromToken: string;
          toToken: string;
          approveTarget: string;
          swapTarget: string;
          fromTokenAmount: BigNumberish;
          minReturnAmount: BigNumberish;
          callDataConcat: BytesLike;
          deadLine: BigNumberish;
        } = {
          fromToken: ETH_MOCK_ADDRESS,
          toToken: ETH_MOCK_ADDRESS,
          approveTarget: UNISWAP_ROUTER_ADDRESS,
          swapTarget: UNISWAP_ROUTER_ADDRESS,
          fromTokenAmount: parseUnits("1", 18),
          minReturnAmount: "1",
          callDataConcat: "0x",
          deadLine: deadline,
        };

        await gateway
          .connect(alice)
          .singleDeposit(mintAmount, [wbtcSwapInput, ethSwapInput], {
            value: parseUnits("2", 18),
          });

        expect(await wbtc.balanceOf(vault.address)).gt(0);
        expect(await stETH.balanceOf(vault.address)).gt(0);
      });
    });
    describe("Withdraw", () => {
      it("single withdraw of USDT", async () => {
        const { owner, alice, gateway, vault, wbtc, weth, usdt, hope, stETH } =
          await loadFixture(deployGatewayFixture);

        const mintAmount = parseUnits("7503.15", 18);

        await waitForTx(
          await wbtc.connect(alice).approve(gateway.address, MAX_UINT_AMOUNT)
        );
        const [wbtcAmount, ethAmount] = calculateReserveAmount(mintAmount);

        await waitForTx(
          await gateway
            .connect(alice)
            .combinationDeposit(mintAmount, ETH_MOCK_ADDRESS, {
              value: ethAmount,
            })
        );

        await gateway.addVaultManager(owner.address);
        await waitForTx(await gateway.updateSupportToken(USDT_ADDRESS, true));
        await waitForTx(
          await gateway.updateSwapWhiteLists([UNISWAP_ROUTER_ADDRESS], [true])
        );

        expect(await hope.balanceOf(alice.address)).to.be.equal(mintAmount);

        await waitForTx(
          await hope.connect(alice).approve(gateway.address, MAX_UINT_AMOUNT)
        );

        const deadline = (await time.latest()) + 3600;

        // StETH is share token.
        const sharesOf = await stETH.getSharesByPooledEth(ethAmount);
        const actualStETHBalanceOf = await stETH.getPooledEthByShares(sharesOf);

        const wbtcSwapInputValues = [
          wbtcAmount,
          "1",
          [WBTC_ADDRESS, WETH_ADDRESS, USDT_ADDRESS],
          gateway.address,
          deadline,
        ];

        const ethSwapInputValues = [
          actualStETHBalanceOf,
          "1",
          [ST_ETH_ADDRESS, WETH_ADDRESS, USDT_ADDRESS],
          gateway.address,
          deadline,
        ];

        const wbtcInputData = ethers.utils.defaultAbiCoder.encode(
          ["uint256", "uint256", "address[]", "address", "uint256"],
          wbtcSwapInputValues
        );

        const ethInputData = ethers.utils.defaultAbiCoder.encode(
          ["uint256", "uint256", "address[]", "address", "uint256"],
          ethSwapInputValues
        );

        const functionSignature =
          "swapExactTokensForTokensSupportingFeeOnTransferTokens(uint256,uint256,address[],address,uint256)";
        const iface = new ethers.utils.Interface([
          `function ${functionSignature}`,
        ]);

        const functionSelector = iface.getSighash(functionSignature);

        const wbtcEncodeData = ethers.utils.hexConcat([
          functionSelector,
          wbtcInputData,
        ]);
        const ethEncodeData = ethers.utils.hexConcat([
          functionSelector,
          ethInputData,
        ]);

        const wbtcSwapInput: {
          fromToken: string;
          toToken: string;
          approveTarget: string;
          swapTarget: string;
          fromTokenAmount: BigNumberish;
          minReturnAmount: BigNumberish;
          callDataConcat: BytesLike;
          deadLine: BigNumberish;
        } = {
          fromToken: WBTC_ADDRESS,
          toToken: USDT_ADDRESS,
          approveTarget: UNISWAP_ROUTER_ADDRESS,
          swapTarget: UNISWAP_ROUTER_ADDRESS,
          fromTokenAmount: wbtcAmount,
          minReturnAmount: "1",
          callDataConcat: wbtcEncodeData,
          deadLine: deadline,
        };
        const ethSwapInput: {
          fromToken: string;
          toToken: string;
          approveTarget: string;
          swapTarget: string;
          fromTokenAmount: BigNumberish;
          minReturnAmount: BigNumberish;
          callDataConcat: BytesLike;
          deadLine: BigNumberish;
        } = {
          fromToken: ST_ETH_ADDRESS,
          toToken: USDT_ADDRESS,
          approveTarget: UNISWAP_ROUTER_ADDRESS,
          swapTarget: UNISWAP_ROUTER_ADDRESS,
          fromTokenAmount: ethAmount,
          minReturnAmount: "1",
          callDataConcat: ethEncodeData,
          deadLine: deadline,
        };

        const usdtBalanceBefore = await usdt.balanceOf(alice.address);

        await gateway
          .connect(alice)
          .singleWithdraw(mintAmount, [wbtcSwapInput, ethSwapInput]);

        expect(await usdt.balanceOf(alice.address)).gt(usdtBalanceBefore);
        expect(await wbtc.balanceOf(vault.address)).to.be.equal(0);
        expect(await stETH.balanceOf(vault.address)).to.be.equal(0);
      });

      it("single withdraw of WBTC", async () => {
        const { owner, alice, gateway, vault, wbtc, weth, usdt, hope, stETH } =
          await loadFixture(deployGatewayFixture);

        const mintAmount = parseUnits("7503.15", 18);

        await waitForTx(
          await wbtc.connect(alice).approve(gateway.address, MAX_UINT_AMOUNT)
        );
        const [wbtcAmount, ethAmount] = calculateReserveAmount(mintAmount);
        await waitForTx(
          await gateway
            .connect(alice)
            .combinationDeposit(mintAmount, ETH_MOCK_ADDRESS, {
              value: ethAmount,
            })
        );

        await gateway.addVaultManager(owner.address);
        await waitForTx(await gateway.updateSupportToken(WBTC_ADDRESS, true));
        await waitForTx(
          await gateway.updateSwapWhiteLists([UNISWAP_ROUTER_ADDRESS], [true])
        );

        expect(await hope.balanceOf(alice.address)).to.be.equal(mintAmount);

        await waitForTx(
          await hope.connect(alice).approve(gateway.address, MAX_UINT_AMOUNT)
        );

        const deadline = (await time.latest()) + 3600;

        // StETH is share token.
        const sharesOf = await stETH.getSharesByPooledEth(ethAmount);
        const actualStETHBalanceOf = await stETH.getPooledEthByShares(sharesOf);

        const ethSwapInputValues = [
          actualStETHBalanceOf,
          "1",
          [ST_ETH_ADDRESS, WETH_ADDRESS, WBTC_ADDRESS],
          gateway.address,
          deadline,
        ];

        const ethInputData = ethers.utils.defaultAbiCoder.encode(
          ["uint256", "uint256", "address[]", "address", "uint256"],
          ethSwapInputValues
        );

        const functionSignature =
          "swapExactTokensForTokensSupportingFeeOnTransferTokens(uint256,uint256,address[],address,uint256)";
        const iface = new ethers.utils.Interface([
          `function ${functionSignature}`,
        ]);

        const functionSelector = iface.getSighash(functionSignature);

        const ethEncodeData = ethers.utils.hexConcat([
          functionSelector,
          ethInputData,
        ]);

        const wbtcSwapInput: {
          fromToken: string;
          toToken: string;
          approveTarget: string;
          swapTarget: string;
          fromTokenAmount: BigNumberish;
          minReturnAmount: BigNumberish;
          callDataConcat: BytesLike;
          deadLine: BigNumberish;
        } = {
          fromToken: WBTC_ADDRESS,
          toToken: WBTC_ADDRESS,
          approveTarget: UNISWAP_ROUTER_ADDRESS,
          swapTarget: UNISWAP_ROUTER_ADDRESS,
          fromTokenAmount: wbtcAmount,
          minReturnAmount: "1",
          callDataConcat: "0x",
          deadLine: deadline,
        };
        const ethSwapInput: {
          fromToken: string;
          toToken: string;
          approveTarget: string;
          swapTarget: string;
          fromTokenAmount: BigNumberish;
          minReturnAmount: BigNumberish;
          callDataConcat: BytesLike;
          deadLine: BigNumberish;
        } = {
          fromToken: ST_ETH_ADDRESS,
          toToken: WBTC_ADDRESS,
          approveTarget: UNISWAP_ROUTER_ADDRESS,
          swapTarget: UNISWAP_ROUTER_ADDRESS,
          fromTokenAmount: ethAmount,
          minReturnAmount: "1",
          callDataConcat: ethEncodeData,
          deadLine: deadline,
        };

        const wbtcBalanceBefore = await wbtc.balanceOf(alice.address);

        await gateway
          .connect(alice)
          .singleWithdraw(mintAmount, [wbtcSwapInput, ethSwapInput]);

        expect(await wbtc.balanceOf(alice.address)).gt(wbtcBalanceBefore);
        expect(await wbtc.balanceOf(vault.address)).to.be.equal(0);
        expect(await stETH.balanceOf(vault.address)).to.be.equal(0);
      });
    });
  });
});
