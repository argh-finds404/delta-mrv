// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {ImpactAnchorRegistry} from "../src/ImpactAnchorRegistry.sol";

/// The test matrix of docs/09-WEB3.md §3. The Merkle cases read the committed known-answer
/// vectors (test/fixtures/crypto/vectors.json) that the TypeScript contract test also reads,
/// so Solidity, Node and the browser are held to the same bytes.
contract ImpactAnchorRegistryTest is Test {
    ImpactAnchorRegistry registry;
    address owner = makeAddr("owner");
    address anchorer = makeAddr("anchorer");
    address stranger = makeAddr("stranger");

    bytes32 leafA;
    bytes32 leafB;
    bytes32 oneLeafRoot;
    bytes32 twoLeafRoot;

    event BatchAnchored(uint256 indexed batchId, bytes32 merkleRoot, uint32 leafCount, uint64 anchoredAt);
    event AnchorerSet(address indexed anchorer, bool authorized);

    function setUp() public {
        registry = new ImpactAnchorRegistry(owner);
        vm.prank(owner);
        registry.setAnchorer(anchorer, true);

        string memory json = vm.readFile("../test/fixtures/crypto/vectors.json");
        leafA = _leafHash(json, ".merkle.leaves[0]");
        leafB = _leafHash(json, ".merkle.leaves[1]");
        oneLeafRoot = _hex32(json, ".merkle.oneLeafRoot");
        twoLeafRoot = _hex32(json, ".merkle.twoLeafRoot");
    }

    /// A hash from the vectors, which hold 64 hex characters without the 0x prefix.
    function _hex32(string memory json, string memory at) internal pure returns (bytes32) {
        return vm.parseBytes32(string.concat("0x", vm.parseJsonString(json, at)));
    }

    /// The StandardMerkleTree leaf: double keccak of abi.encode(bytes32, bytes32, uint256).
    function _leafHash(string memory json, string memory at) internal pure returns (bytes32) {
        bytes32 submissionId = _hex32(json, string.concat(at, ".bytes32"));
        bytes32 manifestHash = _hex32(json, string.concat(at, ".manifestHash"));
        uint256 approvedTimestamp = vm.parseUint(vm.parseJsonString(json, string.concat(at, ".timestamp")));
        return keccak256(bytes.concat(keccak256(abi.encode(submissionId, manifestHash, approvedTimestamp))));
    }

    function _proof(bytes32 sibling) internal pure returns (bytes32[] memory proof) {
        proof = new bytes32[](1);
        proof[0] = sibling;
    }

    // --- who may anchor -----------------------------------------------------------------------

    function test_UnauthorisedAnchorReverts() public {
        vm.prank(stranger);
        vm.expectRevert(abi.encodeWithSelector(ImpactAnchorRegistry.NotAnchorer.selector, stranger));
        registry.anchorBatch(1, twoLeafRoot, 2);
    }

    function test_OwnerIsNotAnAnchorerUnlessSet() public {
        vm.prank(owner);
        vm.expectRevert(abi.encodeWithSelector(ImpactAnchorRegistry.NotAnchorer.selector, owner));
        registry.anchorBatch(1, twoLeafRoot, 2);
    }

    function test_OnlyOwnerSetsAnchorers() public {
        vm.prank(stranger);
        vm.expectRevert(abi.encodeWithSelector(Ownable.OwnableUnauthorizedAccount.selector, stranger));
        registry.setAnchorer(stranger, true);
    }

    function test_RevokedAnchorerCanNoLongerAnchor() public {
        vm.expectEmit(true, false, false, true);
        emit AnchorerSet(anchorer, false);
        vm.prank(owner);
        registry.setAnchorer(anchorer, false);

        vm.prank(anchorer);
        vm.expectRevert(abi.encodeWithSelector(ImpactAnchorRegistry.NotAnchorer.selector, anchorer));
        registry.anchorBatch(1, twoLeafRoot, 2);
    }

    // --- what may be anchored -----------------------------------------------------------------

    function test_DuplicateBatchIdReverts() public {
        vm.startPrank(anchorer);
        registry.anchorBatch(7, twoLeafRoot, 2);
        vm.expectRevert(abi.encodeWithSelector(ImpactAnchorRegistry.AlreadyAnchored.selector, 7));
        registry.anchorBatch(7, twoLeafRoot, 2);
        // not with another root either: an anchor is never overwritten
        vm.expectRevert(abi.encodeWithSelector(ImpactAnchorRegistry.AlreadyAnchored.selector, 7));
        registry.anchorBatch(7, oneLeafRoot, 1);
        vm.stopPrank();
        assertEq(registry.getAnchor(7).merkleRoot, twoLeafRoot);
    }

    function test_ZeroRootReverts() public {
        vm.prank(anchorer);
        vm.expectRevert(ImpactAnchorRegistry.ZeroRoot.selector);
        registry.anchorBatch(1, bytes32(0), 2);
    }

    function test_ZeroLeafCountReverts() public {
        vm.prank(anchorer);
        vm.expectRevert(ImpactAnchorRegistry.ZeroLeafCount.selector);
        registry.anchorBatch(1, twoLeafRoot, 0);
    }

    function test_ZeroAddressReverts() public {
        vm.prank(owner);
        vm.expectRevert(ImpactAnchorRegistry.ZeroAddress.selector);
        registry.setAnchorer(address(0), true);

        vm.expectRevert(abi.encodeWithSelector(Ownable.OwnableInvalidOwner.selector, address(0)));
        new ImpactAnchorRegistry(address(0));
    }

    // --- ownership ----------------------------------------------------------------------------

    function test_OwnershipTransferTakesTwoSteps() public {
        address next = makeAddr("next");
        vm.prank(owner);
        registry.transferOwnership(next);
        // nothing has changed hands yet
        assertEq(registry.owner(), owner);
        assertEq(registry.pendingOwner(), next);
        vm.prank(next);
        vm.expectRevert(abi.encodeWithSelector(Ownable.OwnableUnauthorizedAccount.selector, next));
        registry.setAnchorer(next, true);

        // only the pending owner can accept
        vm.prank(stranger);
        vm.expectRevert(abi.encodeWithSelector(Ownable.OwnableUnauthorizedAccount.selector, stranger));
        registry.acceptOwnership();

        vm.prank(next);
        registry.acceptOwnership();
        assertEq(registry.owner(), next);
        assertEq(registry.pendingOwner(), address(0));
        vm.prank(owner);
        vm.expectRevert(abi.encodeWithSelector(Ownable.OwnableUnauthorizedAccount.selector, owner));
        registry.setAnchorer(owner, true);
    }

    // --- events and storage -------------------------------------------------------------------

    function test_AnchorStoresAndEmits() public {
        vm.warp(1_794_303_600);
        vm.expectEmit(true, false, false, true);
        emit BatchAnchored(42, twoLeafRoot, 2, 1_794_303_600);
        vm.prank(anchorer);
        registry.anchorBatch(42, twoLeafRoot, 2);

        ImpactAnchorRegistry.BatchAnchor memory a = registry.getAnchor(42);
        assertEq(a.merkleRoot, twoLeafRoot);
        assertEq(a.anchoredAt, 1_794_303_600);
        assertEq(a.leafCount, 2);
        (bytes32 root, uint64 at, uint32 count) = registry.anchors(42);
        assertEq(root, twoLeafRoot);
        assertEq(at, 1_794_303_600);
        assertEq(count, 2);
    }

    // --- proofs, against the committed vectors ------------------------------------------------

    function test_OneLeafTreeRootIsTheLeaf() public view {
        assertEq(leafA, oneLeafRoot);
    }

    function test_ValidProofVerifies() public {
        vm.startPrank(anchorer);
        registry.anchorBatch(1, oneLeafRoot, 1);
        registry.anchorBatch(2, twoLeafRoot, 2);
        vm.stopPrank();

        assertTrue(registry.verify(1, new bytes32[](0), leafA));
        assertTrue(registry.verify(2, _proof(leafB), leafA));
        assertTrue(registry.verify(2, _proof(leafA), leafB));
    }

    function test_WrongLeafWrongBatchAndTamperedProofFail() public {
        vm.startPrank(anchorer);
        registry.anchorBatch(1, oneLeafRoot, 1);
        registry.anchorBatch(2, twoLeafRoot, 2);
        vm.stopPrank();

        bytes32 tamperedLeaf = leafA ^ bytes32(uint256(1));
        assertFalse(registry.verify(2, _proof(leafB), tamperedLeaf)); // wrong leaf
        assertFalse(registry.verify(1, _proof(leafB), leafA)); // right leaf and proof, wrong batch
        assertFalse(registry.verify(2, _proof(leafB ^ bytes32(uint256(1))), leafA)); // tampered proof
        assertFalse(registry.verify(2, new bytes32[](0), leafA)); // proof left out
        assertFalse(registry.verify(3, _proof(leafB), leafA)); // nothing anchored under this id
        assertFalse(registry.verify(3, new bytes32[](0), bytes32(0))); // an empty slot verifies nothing
    }

    // --- fuzz ---------------------------------------------------------------------------------

    function testFuzz_AnchorsNeverCollideOrOverwrite(uint256 idA, uint256 idB, bytes32 rootA, bytes32 rootB, uint32 countA, uint32 countB) public {
        vm.assume(idA != idB);
        vm.assume(rootA != bytes32(0) && rootB != bytes32(0));
        vm.assume(countA != 0 && countB != 0);

        vm.startPrank(anchorer);
        registry.anchorBatch(idA, rootA, countA);
        registry.anchorBatch(idB, rootB, countB);
        vm.expectRevert(abi.encodeWithSelector(ImpactAnchorRegistry.AlreadyAnchored.selector, idA));
        registry.anchorBatch(idA, rootB, countB);
        vm.stopPrank();

        assertEq(registry.getAnchor(idA).merkleRoot, rootA);
        assertEq(registry.getAnchor(idA).leafCount, countA);
        assertEq(registry.getAnchor(idB).merkleRoot, rootB);
        assertEq(registry.getAnchor(idB).leafCount, countB);
    }

    function testFuzz_OnlyAnchorersAnchor(address caller, uint256 batchId, bytes32 root) public {
        vm.assume(caller != anchorer);
        vm.assume(root != bytes32(0));
        vm.prank(caller);
        vm.expectRevert(abi.encodeWithSelector(ImpactAnchorRegistry.NotAnchorer.selector, caller));
        registry.anchorBatch(batchId, root, 1);
        assertEq(registry.getAnchor(batchId).merkleRoot, bytes32(0));
    }

    function testFuzz_ASingleLeafVerifiesOnlyItself(bytes32 leaf, bytes32 other) public {
        vm.assume(leaf != bytes32(0) && leaf != other);
        vm.prank(anchorer);
        registry.anchorBatch(1, leaf, 1);
        assertTrue(registry.verify(1, new bytes32[](0), leaf));
        assertFalse(registry.verify(1, new bytes32[](0), other));
    }
}
