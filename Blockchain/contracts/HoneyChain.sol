// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/access/AccessControl.sol";

contract HoneyChain is AccessControl {
    bytes32 public constant BEEKEEPER_ROLE = keccak256("BEEKEEPER_ROLE");
    bytes32 public constant LAB_ROLE = keccak256("LAB_ROLE");
    bytes32 public constant PROCESSOR_ROLE = keccak256("PROCESSOR_ROLE");
    bytes32 public constant DISTRIBUTOR_ROLE = keccak256("DISTRIBUTOR_ROLE");
    bytes32 public constant RETAILER_ROLE = keccak256("RETAILER_ROLE");

    enum BatchState { Harvested, Tested, Processed, Packaged, InTransit, RetailReady }

    struct QualityRecord {
        uint256 moistureBps;
        uint256 sugarBrixBps;
        uint256 purityScore;
        bool adulterationDetected;
        bool approved;
        string certificateCID;
        uint256 timestamp;
        address labAddress;
    }

    struct Batch {
        string batchId;
        string originCluster;
        uint256 quantityGrams;
        uint256 harvestTimestamp;
        address currentCustodian;
        BatchState state;
        bool qualityApproved;
        string certificateCID;
        bool exists;
    }

    mapping(string => Batch) private batches;
    mapping(string => QualityRecord) private qualityRecords;

    error BatchAlreadyExists(string batchId);
    error BatchNotFound(string batchId);
    error UnauthorizedCustodian(address caller, address custodian);

    event BatchCreated(string indexed batchId, string originCluster, address indexed beekeeper, uint256 quantityGrams);
    event QualityTestAdded(string indexed batchId, address indexed lab, bool approved, string certificateCID);
    event ProcessingRecorded(string indexed batchId, address indexed processor, string processingNotes);
    event PackagingRecorded(string indexed batchId, address indexed processor, string packagingSpec);
    event BatchTransferred(string indexed batchId, address indexed from, address indexed to, BatchState newState);

    constructor(address rootAdmin) {
        _grantRole(DEFAULT_ADMIN_ROLE, rootAdmin);
        _grantRole(BEEKEEPER_ROLE, rootAdmin);
        _grantRole(LAB_ROLE, rootAdmin);
        _grantRole(PROCESSOR_ROLE, rootAdmin);
        _grantRole(DISTRIBUTOR_ROLE, rootAdmin);
        _grantRole(RETAILER_ROLE, rootAdmin);
    }

    function createBatch(
        string calldata batchId,
        string calldata originCluster,
        uint256 quantityGrams,
        uint256 harvestTimestamp
    ) external onlyRole(BEEKEEPER_ROLE) {
        if (batches[batchId].exists) revert BatchAlreadyExists(batchId);
        batches[batchId] = Batch(batchId, originCluster, quantityGrams, harvestTimestamp, msg.sender, BatchState.Harvested, false, "", true);
        emit BatchCreated(batchId, originCluster, msg.sender, quantityGrams);
    }

    function addQualityTest(
        string calldata batchId,
        uint256 moistureBps,
        uint256 sugarBrixBps,
        uint256 purityScore,
        bool adulterationDetected,
        bool approved,
        string calldata certificateCID
    ) external onlyRole(LAB_ROLE) {
        Batch storage b = batches[batchId];
        if (!b.exists) revert BatchNotFound(batchId);
        qualityRecords[batchId] = QualityRecord(moistureBps, sugarBrixBps, purityScore, adulterationDetected, approved, certificateCID, block.timestamp, msg.sender);
        b.qualityApproved = approved;
        b.certificateCID = certificateCID;
        b.state = BatchState.Tested;
        emit QualityTestAdded(batchId, msg.sender, approved, certificateCID);
    }

    function recordProcessing(string calldata batchId, string calldata processingNotes) external onlyRole(PROCESSOR_ROLE) {
        Batch storage b = batches[batchId];
        if (!b.exists) revert BatchNotFound(batchId);
        if (b.currentCustodian != msg.sender) revert UnauthorizedCustodian(msg.sender, b.currentCustodian);
        b.state = BatchState.Processed;
        emit ProcessingRecorded(batchId, msg.sender, processingNotes);
    }

    function recordPackaging(string calldata batchId, string calldata packagingSpec) external onlyRole(PROCESSOR_ROLE) {
        Batch storage b = batches[batchId];
        if (!b.exists) revert BatchNotFound(batchId);
        if (b.currentCustodian != msg.sender) revert UnauthorizedCustodian(msg.sender, b.currentCustodian);
        b.state = BatchState.Packaged;
        emit PackagingRecorded(batchId, msg.sender, packagingSpec);
    }

    function transferBatch(string calldata batchId, address nextCustodian, BatchState targetState) external {
        Batch storage b = batches[batchId];
        if (!b.exists) revert BatchNotFound(batchId);
        if (b.currentCustodian != msg.sender) revert UnauthorizedCustodian(msg.sender, b.currentCustodian);
        b.currentCustodian = nextCustodian;
        b.state = targetState;
        emit BatchTransferred(batchId, msg.sender, nextCustodian, targetState);
    }

    function getBatch(string calldata batchId) external view returns (Batch memory) {
        if (!batches[batchId].exists) revert BatchNotFound(batchId);
        return batches[batchId];
    }

    function verifyBatch(string calldata batchId) external view returns (
        bool exists,
        string memory originCluster,
        uint256 quantityGrams,
        uint256 harvestTimestamp,
        address currentCustodian,
        BatchState state,
        bool qualityApproved,
        string memory certificateCID
    ) {
        Batch memory b = batches[batchId];
        return (b.exists, b.originCluster, b.quantityGrams, b.harvestTimestamp, b.currentCustodian, b.state, b.qualityApproved, b.certificateCID);
    }
}
