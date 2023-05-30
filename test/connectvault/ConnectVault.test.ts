import { time, loadFixture } from "@nomicfoundation/hardhat-network-helpers";
import { expect } from "chai";
import { ethers, upgrades } from "hardhat";
import { PermitSigHelper } from "../PermitSigHelper";
const { BigNumber } = require("ethers");

describe("ConnectVault", function () {
  // We define a fixture to reuse the same setup in every test.
  // We use loadFixture to run this setup once, snapshot that state,
  // and reset Hardhat Network to that snapshopt in every test.
  async function deployOneYearLockFixture() {
    // Contracts are deployed using the first signer/account by default
    const [owner, alice, bob] = await ethers.getSigners();

    const Permit2Contract = await ethers.getContractFactory("Permit2");
    const permit2 = await Permit2Contract.deploy();

    const RestrictedList = await ethers.getContractFactory("RestrictedList");
    const restrictedList = await RestrictedList.deploy();

    const HOPEToken = await ethers.getContractFactory("HOPE");
    const hopeToken = await upgrades.deployProxy(HOPEToken, [
      restrictedList.address,
    ]);
    await hopeToken.deployed();

    await hopeToken.approve(permit2.address, ethers.constants.MaxUint256);

    const Admin = await ethers.getContractFactory("Admin");
    const admin = await Admin.deploy(hopeToken.address);
    let MINT_AMOUNT = ethers.utils.parseEther("100000000");
    const effectiveBlock = await ethers.provider.getBlockNumber();
    const expirationBlock = effectiveBlock + 10000;
    await hopeToken.grantAgent(
      admin.address,
      MINT_AMOUNT,
      effectiveBlock,
      expirationBlock,
      true,
      true
    );
    await admin.mint(owner.address, ethers.utils.parseEther("1000"));

    const MockConnet = await ethers.getContractFactory("MockConnect");
    const mockConnet = await MockConnet.deploy();

    const ConnetVault = await ethers.getContractFactory("ConnectVault");
    const connetVault = await upgrades.deployProxy(ConnetVault, [
      permit2.address,
      hopeToken.address,
      mockConnet.address,
      alice.address,
      owner.address,
    ]);
    await connetVault.deployed();

    await mockConnet.setVault(connetVault.address);

    let adminRole = ethers.utils.keccak256(
      ethers.utils.toUtf8Bytes("WITHDRAW_ADMIN_ROLE")
    );

    return {
      owner,
      alice,
      bob,
      connetVault,
      permit2,
      hopeToken,
      mockConnet,
      admin,
      adminRole,
    };
  }

  describe("Initialize check", async function () {
    it("should revert right error when already initialized", async function () {
      const { owner, alice, bob, connetVault, permit2, hopeToken, mockConnet } =
        await loadFixture(deployOneYearLockFixture);

      await expect(
        connetVault.initialize(
          permit2.address,
          hopeToken.address,
          mockConnet.address,
          alice.address,
          owner.address
        )
      ).to.be.revertedWith("Initializable: contract is already initialized");
    });

    it("Initialize check", async function () {
      const { owner, alice, bob, connetVault, adminRole } = await loadFixture(
        deployOneYearLockFixture
      );
      expect(await connetVault.owner()).to.be.equal(owner.address);
      expect(await connetVault.hasRole(adminRole, alice.address)).to.true;
    });
  });

  describe("Owner authority check", async function () {
    it("pause and unpause", async function () {
      const { owner, alice, bob, connetVault, permit2, hopeToken, mockConnet } =
        await loadFixture(deployOneYearLockFixture);

      expect(await connetVault.paused()).to.false;
      await connetVault.pause();
      expect(await connetVault.paused()).to.true;
      await connetVault.unpause();
      expect(await connetVault.paused()).to.false;
    });

    it("should revert right error when caller is not the owner", async function () {
      const { owner, alice, bob, connetVault, permit2, hopeToken, mockConnet } =
        await loadFixture(deployOneYearLockFixture);

      await expect(
        connetVault.connect(alice).changeConnect(permit2.address)
      ).to.be.revertedWith("Ownable: caller is not the owner");
    });

    it("changeConnet", async function () {
      const { owner, alice, bob, connetVault } = await loadFixture(
        deployOneYearLockFixture
      );

      await expect(await connetVault.changeConnect(bob.address))
        .to.emit(connetVault, "ChangeConnect")
        .withArgs(bob.address);
    });

    it("grantRole", async function () {
      const { owner, bob, connetVault, adminRole } = await loadFixture(
        deployOneYearLockFixture
      );

      await connetVault.grantRole(adminRole, bob.address);
      expect(await connetVault.hasRole(adminRole, bob.address)).to.true;
    });

    it("revokeRole", async function () {
      const { owner, alice, bob, connetVault, adminRole } = await loadFixture(
        deployOneYearLockFixture
      );

      expect(await connetVault.hasRole(adminRole, alice.address)).to.true;
      await connetVault.revokeRole(adminRole, alice.address);
      expect(await connetVault.hasRole(adminRole, alice.address)).to.false;
    });

    it("withdrawToken", async function () {
      const { owner, alice, bob, connetVault, adminRole, hopeToken } =
        await loadFixture(deployOneYearLockFixture);
      let amount = ethers.utils.parseEther("10");
      await expect(
        connetVault.withdrawToken(hopeToken.address, alice.address, amount)
      ).to.be.revertedWith("insufficient balance");
    });

    it("withdrawToken success", async function () {
      const { owner, alice, bob, connetVault, adminRole, hopeToken } =
        await loadFixture(deployOneYearLockFixture);
      let amount = ethers.utils.parseEther("10");
      let balance = await hopeToken.balanceOf(connetVault.address);
      await hopeToken.transfer(connetVault.address, amount);
      expect(await hopeToken.balanceOf(connetVault.address)).to.equal(amount);
      await connetVault.withdrawToken(hopeToken.address, alice.address, amount);
      expect(await hopeToken.balanceOf(connetVault.address)).to.equal(balance);
    });
  });

  describe("deposit", async function () {
    it("should revert right error when pause", async function () {
      const { owner, alice, bob, connetVault } = await loadFixture(
        deployOneYearLockFixture
      );

      await connetVault.pause();
      let amount = ethers.utils.parseEther("10");
      await expect(
        connetVault.deposit(
          amount,
          ethers.constants.Zero,
          ethers.constants.Zero,
          ethers.constants.HashZero
        )
      ).to.be.revertedWith("Pausable: paused");
    });

    it("should revert right error when amount zero", async function () {
      const { owner, alice, bob, connetVault } = await loadFixture(
        deployOneYearLockFixture
      );

      let amount = ethers.utils.parseEther("0");
      await expect(
        connetVault.deposit(
          amount,
          ethers.constants.Zero,
          ethers.constants.Zero,
          ethers.constants.HashZero
        )
      ).to.be.revertedWith("INVALID_ZERO_AMOUNT");
    });

    it("deposit with transferFrom", async function () {
      const { owner, alice, bob, connetVault, permit2, hopeToken, mockConnet } =
        await loadFixture(deployOneYearLockFixture);

      let beforeBalance = await hopeToken.balanceOf(owner.address);
      let amount = ethers.utils.parseEther("10");
      await hopeToken.approve(connetVault.address, amount);
      await expect(
        await connetVault.deposit(
          amount,
          ethers.constants.Zero,
          ethers.constants.Zero,
          "0x"
        )
      )
        .to.emit(connetVault, "Deposit")
        .withArgs(hopeToken.address,owner.address, amount);
      expect(await hopeToken.balanceOf(owner.address)).to.be.equal(
        beforeBalance.sub(amount)
      );
      expect(await hopeToken.balanceOf(connetVault.address)).to.be.equal(
        amount
      );
      expect(await connetVault.balanceOf(mockConnet.address)).to.be.equal(
        amount
      );
    });

    it("deposit with permit2", async function () {
      const { owner, alice, bob, connetVault, permit2, hopeToken, mockConnet } =
        await loadFixture(deployOneYearLockFixture);

      let amount = ethers.utils.parseEther("10");
      let NONCE = BigNumber.from(ethers.utils.randomBytes(32));
      const DEADLINE = (await time.latest()) + 60 * 60;
      const sig = await PermitSigHelper.signature(
        owner,
        hopeToken.address,
        permit2.address,
        connetVault.address,
        amount,
        NONCE,
        DEADLINE
      );

      let beforeBalance = await hopeToken.balanceOf(owner.address);
      await expect(await connetVault.deposit(amount, NONCE, DEADLINE, sig))
        .to.emit(connetVault, "Deposit")
        .withArgs(hopeToken.address,owner.address, amount);
      expect(await hopeToken.balanceOf(owner.address)).to.be.equal(
        beforeBalance.sub(amount)
      );
      expect(await hopeToken.balanceOf(connetVault.address)).to.be.equal(
        amount
      );
      expect(await connetVault.balanceOf(mockConnet.address)).to.be.equal(
        amount
      );
    });
  });

  describe("withdraw", async function () {
    it("should revert right error when caller is not withdrawAdmin", async function () {
      const { owner, alice, bob, connetVault } = await loadFixture(
        deployOneYearLockFixture
      );

      let amount = ethers.utils.parseEther("10");
      await expect(
        connetVault.connect(bob).withdraw(bob.address, amount)
      ).to.be.revertedWith(
        "AccessControl: account 0x3c44cdddb6a900fa2b585dd299e03d12fa4293bc is missing role 0xe404653550c5b16b9dab530a93b3fa01b18e98eedc03a56b02c943b9ed3054cf"
      );
    });

    it("should revert right error when  insufficient balance", async function () {
      const { owner, alice, bob, connetVault } = await loadFixture(
        deployOneYearLockFixture
      );

      let amount = ethers.utils.parseEther("10");
      await expect(
        connetVault.connect(alice).withdraw(bob.address, amount)
      ).to.be.revertedWith("insufficient balance");
    });

    it("should revert right error when amount is zero", async function () {
      const { owner, alice, bob, connetVault } = await loadFixture(
        deployOneYearLockFixture
      );

      let amount = ethers.utils.parseEther("0");
      await expect(
        connetVault.connect(alice).withdraw(bob.address, amount)
      ).to.be.revertedWith("INVALID_ZERO_AMOUNT");
    });

    it("withdraw success", async function () {
      const { owner, alice, bob, connetVault, hopeToken, mockConnet } =
        await loadFixture(deployOneYearLockFixture);

      let amount = ethers.utils.parseEther("10");
      await hopeToken.approve(connetVault.address, amount);
      await connetVault.deposit(
        amount,
        ethers.constants.Zero,
        ethers.constants.Zero,
        "0x"
      );
      await mockConnet.transferBToken(alice.address, amount);

      let withdawaAmount = ethers.utils.parseEther("5");
      await expect(await connetVault.connect(alice).withdraw(bob.address, withdawaAmount))
        .to.emit(connetVault, "Withdraw")
        .withArgs(hopeToken.address,bob.address, withdawaAmount);

      expect(await hopeToken.balanceOf(bob.address)).to.be.equal(
        withdawaAmount
      );
      expect(await hopeToken.balanceOf(connetVault.address)).to.be.equal(
        withdawaAmount
      );
    });

    it("withdraw success v2", async function () {
      const {
        owner,
        alice,
        bob,
        connetVault,
        hopeToken,
        mockConnet,
        adminRole,
      } = await loadFixture(deployOneYearLockFixture);

      let amount = ethers.utils.parseEther("10");
      await hopeToken.approve(connetVault.address, amount);
      await connetVault.deposit(
        amount,
        ethers.constants.Zero,
        ethers.constants.Zero,
        "0x"
      );
      await connetVault.grantRole(adminRole, mockConnet.address);

      let withdawaAmount = ethers.utils.parseEther("5");
      await expect(await mockConnet.withdraw(bob.address, withdawaAmount))
        .to.emit(connetVault, "Withdraw")
        .withArgs(hopeToken.address,bob.address, withdawaAmount);

      expect(await hopeToken.balanceOf(bob.address)).to.be.equal(
        withdawaAmount
      );
      expect(await hopeToken.balanceOf(connetVault.address)).to.be.equal(
        withdawaAmount
      );
    });
  });
});
