// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Ownable, Ownable2Step} from "@openzeppelin/contracts/access/Ownable2Step.sol";
import {MerkleProof} from "@openzeppelin/contracts/utils/cryptography/MerkleProof.sol";

/// @title ImpactAnchorRegistry
/// @notice Stores one Merkle root per batch of approved evidence manifests and answers
///         questions about them (docs/09-WEB3.md §3). It holds no funds, mints nothing and
///         makes no decision. A root, once anchored, can never be changed or removed.
contract ImpactAnchorRegistry is Ownable2Step {
    struct BatchAnchor {
        bytes32 merkleRoot;
        uint64 anchoredAt;
        uint32 leafCount;
    }

    mapping(uint256 batchId => BatchAnchor) public anchors;
    mapping(address anchorer => bool) public isAnchorer;

    event BatchAnchored(uint256 indexed batchId, bytes32 merkleRoot, uint32 leafCount, uint64 anchoredAt);
    event AnchorerSet(address indexed anchorer, bool authorized);

    error NotAnchorer(address caller);
    error AlreadyAnchored(uint256 batchId);
    error ZeroRoot();
    error ZeroLeafCount();
    error ZeroAddress();

    modifier onlyAnchorer() {
        if (!isAnchorer[msg.sender]) revert NotAnchorer(msg.sender);
        _;
    }

    /// @dev Ownable rejects a zero owner.
    constructor(address initialOwner) Ownable(initialOwner) {}

    /// @notice The owner manages who may anchor. The owner itself is not an anchorer unless set.
    function setAnchorer(address anchorer, bool authorized) external onlyOwner {
        if (anchorer == address(0)) revert ZeroAddress();
        isAnchorer[anchorer] = authorized;
        emit AnchorerSet(anchorer, authorized);
    }

    /// @notice Anchors a batch once. A second attempt on the same id reverts, whatever the root.
    function anchorBatch(uint256 batchId, bytes32 merkleRoot, uint32 leafCount) external onlyAnchorer {
        if (merkleRoot == bytes32(0)) revert ZeroRoot();
        if (leafCount == 0) revert ZeroLeafCount();
        if (anchors[batchId].merkleRoot != bytes32(0)) revert AlreadyAnchored(batchId);

        uint64 anchoredAt = uint64(block.timestamp);
        anchors[batchId] = BatchAnchor({merkleRoot: merkleRoot, anchoredAt: anchoredAt, leafCount: leafCount});
        emit BatchAnchored(batchId, merkleRoot, leafCount, anchoredAt);
    }

    function getAnchor(uint256 batchId) external view returns (BatchAnchor memory) {
        return anchors[batchId];
    }

    /// @notice Whether `leaf` is in the batch's tree. `leaf` is the StandardMerkleTree leaf hash:
    ///         keccak256(bytes.concat(keccak256(abi.encode(submissionId, manifestHash, approvedTimestamp)))).
    ///         Anyone can call it over eth_call with no key. An unanchored batch verifies nothing.
    function verify(uint256 batchId, bytes32[] calldata proof, bytes32 leaf) external view returns (bool) {
        bytes32 root = anchors[batchId].merkleRoot;
        if (root == bytes32(0)) return false;
        return MerkleProof.verifyCalldata(proof, root, leaf);
    }
}
