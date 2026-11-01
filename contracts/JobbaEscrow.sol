// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {Ownable2Step} from "@openzeppelin/contracts/access/Ownable2Step.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

/// @title Jobba Freelance fixed-price marketplace and USDC escrow
/// @notice Stores marketplace content onchain; all text is public, permanent, and measured in bytes.
/// @dev Intended for Arc Testnet USDC (six decimals), supplied to the constructor, not hardcoded.
///      Built for the project's Solidity 0.8.28 / Cancun configuration. No fees or fund rescue powers.
///      The token must be standard, non-rebasing USDC: a failed transfer must not move funds.
contract JobbaEscrow is Ownable2Step, ReentrancyGuard {
    using SafeERC20 for IERC20;

    enum JobStatus { Open, Funded, Delivered, Released, Refunded, Disputed, Resolved, Cancelled }
    enum PostKind { Chat, Deliverable, Evidence, Revision }

    struct Job {
        uint256 id;
        address client;
        address freelancer;
        uint256 budget;
        uint256 escrowAmount;
        uint64 createdAt;
        uint64 deadline;
        uint64 deliveredAt;
        uint64 disputedAt;
        uint32 durationDays;
        uint8 revisions;
        JobStatus status;
        string title;
        string category;
        string description;
    }

    struct Proposal {
        address freelancer;
        uint256 amount;
        uint32 durationDays;
        uint64 createdAt;
        bool withdrawn;
        string coverLetter;
    }

    struct Post {
        address author;
        uint64 timestamp;
        PostKind kind;
        string body;
    }

    uint256 public constant REVIEW_PERIOD = 7 days;
    /// @notice Time before either party may settle a dispute according to its pre-dispute delivery status.
    uint256 public constant ARBITER_TIMEOUT = 30 days;
    uint8 public constant MAX_REVISIONS = 3;

    IERC20 public immutable usdc;
    uint256 public jobCount;
    mapping(address => bool) public isArbiter;
    mapping(address => uint256) public claimable;

    mapping(uint256 => Job) private _jobs;
    mapping(uint256 => Proposal[]) private _proposals;
    mapping(uint256 => Post[]) private _posts;
    // Index plus one; zero denotes no active proposal.
    mapping(uint256 => mapping(address => uint256)) private _activeProposal;
    mapping(address => uint256[]) private _proposedJobs;
    mapping(uint256 => mapping(address => bool)) private _hasProposed;
    mapping(uint256 => bool) private _disputedAfterDelivery;

    error ZeroAddress();
    error JobNotFound();
    error Unauthorized();
    error InvalidStatus();
    error InvalidTextLength();
    error InvalidAmount();
    error InvalidDuration();
    error ActiveProposalExists();
    error ProposalNotFound();
    error ProposalAlreadyWithdrawn();
    error ProposalTermsChanged();
    error IncorrectReceivedAmount();
    error RevisionLimitReached();
    error ReviewWindowExpired();
    error ReviewWindowNotExpired();
    error DeadlineNotPassed();
    error DeadlinePassed();
    error ArbiterTimeoutNotReached();
    error ConflictedArbiter();
    error NothingToWithdraw();

    event JobPosted(uint256 indexed id, address indexed client, uint256 budget);
    event JobCancelled(uint256 indexed id);
    event ProposalSubmitted(uint256 indexed jobId, uint256 index, address indexed freelancer, uint256 amount, uint32 durationDays);
    event ProposalWithdrawn(uint256 indexed jobId, uint256 index);
    event ProposalAccepted(uint256 indexed jobId, uint256 index, address indexed freelancer, uint256 amount, uint64 deadline);
    event DeliverySubmitted(uint256 indexed jobId);
    event RevisionRequested(uint256 indexed jobId, uint8 revisions);
    event Released(uint256 indexed jobId, address indexed freelancer, uint256 amount);
    event Refunded(uint256 indexed jobId, address indexed client, uint256 amount);
    event DisputeOpened(uint256 indexed jobId, address indexed openedBy);
    event DisputeResolved(uint256 indexed jobId, uint256 freelancerAmount, uint256 clientAmount, address resolver);
    event PostAdded(uint256 indexed jobId, address indexed author, PostKind kind);
    event PayoutDeferred(address indexed to, uint256 amount);
    event Withdrawn(address indexed to, uint256 amount);
    event ArbiterSet(address indexed arbiter, bool allowed);

    /// @param usdc_ USDC ERC-20 address; amounts throughout are raw six-decimal units.
    /// @param admin_ Initial two-step owner and initial arbiter.
    constructor(address usdc_, address admin_) Ownable(admin_) {
        if (usdc_ == address(0) || admin_ == address(0)) revert ZeroAddress();
        usdc = IERC20(usdc_);
        isArbiter[admin_] = true;
        emit ArbiterSet(admin_, true);
    }

    /// @notice Authorize or revoke an arbiter; ownership itself grants no escrow withdrawal power.
    function setArbiter(address arbiter, bool allowed) external onlyOwner {
        if (arbiter == address(0)) revert ZeroAddress();
        isArbiter[arbiter] = allowed;
        emit ArbiterSet(arbiter, allowed);
    }

    /// @notice Publish a project without transferring tokens. IDs start at one.
    function postJob(string calldata title, string calldata category, string calldata description, uint256 budget)
        external returns (uint256 id)
    {
        _validateText(title, 120);
        _validateText(category, 40);
        _validateText(description, 4000);
        if (budget == 0) revert InvalidAmount();
        id = ++jobCount;
        Job storage job = _jobs[id];
        job.id = id;
        job.client = msg.sender;
        job.budget = budget;
        job.createdAt = uint64(block.timestamp);
        job.status = JobStatus.Open;
        job.title = title;
        job.category = category;
        job.description = description;
        emit JobPosted(id, msg.sender, budget);
    }

    /// @notice Cancel an unfunded project; historical proposals remain readable.
    function cancelJob(uint256 jobId) external {
        Job storage job = _job(jobId);
        _onlyClient(job);
        _requireStatus(job, JobStatus.Open);
        job.status = JobStatus.Cancelled;
        emit JobCancelled(jobId);
    }

    /// @notice Append an immutable offer; withdraw first to submit a replacement.
    function submitProposal(uint256 jobId, uint256 amount, uint32 durationDays, string calldata coverLetter) external {
        Job storage job = _job(jobId);
        _requireStatus(job, JobStatus.Open);
        if (msg.sender == job.client) revert Unauthorized();
        if (amount == 0 || amount > job.budget) revert InvalidAmount();
        if (durationDays == 0 || durationDays > 365) revert InvalidDuration();
        _validateText(coverLetter, 2000);
        if (_activeProposal[jobId][msg.sender] != 0) revert ActiveProposalExists();
        uint256 index = _proposals[jobId].length;
        _proposals[jobId].push(Proposal({
            freelancer: msg.sender,
            amount: amount,
            durationDays: durationDays,
            createdAt: uint64(block.timestamp),
            withdrawn: false,
            coverLetter: coverLetter
        }));
        _activeProposal[jobId][msg.sender] = index + 1;
        if (!_hasProposed[jobId][msg.sender]) {
            _hasProposed[jobId][msg.sender] = true;
            _proposedJobs[msg.sender].push(jobId);
        }
        emit ProposalSubmitted(jobId, index, msg.sender, amount, durationDays);
    }

    /// @notice Withdraw one's own offer while the job remains open.
    function withdrawProposal(uint256 jobId, uint256 index) external {
        Job storage job = _job(jobId);
        _requireStatus(job, JobStatus.Open);
        Proposal storage proposal = _proposal(jobId, index);
        if (proposal.freelancer != msg.sender) revert Unauthorized();
        if (proposal.withdrawn) revert ProposalAlreadyWithdrawn();
        proposal.withdrawn = true;
        delete _activeProposal[jobId][msg.sender];
        emit ProposalWithdrawn(jobId, index);
    }

    /// @notice Accept exact offer terms and escrow the entire agreed price using prior USDC approval.
    function acceptProposal(uint256 jobId, uint256 index, uint256 expectedAmount, uint32 expectedDurationDays)
        external nonReentrant
    {
        Job storage job = _job(jobId);
        _onlyClient(job);
        _requireStatus(job, JobStatus.Open);
        Proposal storage proposal = _proposal(jobId, index);
        if (proposal.withdrawn) revert ProposalAlreadyWithdrawn();
        if (proposal.amount != expectedAmount || proposal.durationDays != expectedDurationDays) {
            revert ProposalTermsChanged();
        }
        job.freelancer = proposal.freelancer;
        job.escrowAmount = proposal.amount;
        job.durationDays = proposal.durationDays;
        job.deadline = uint64(block.timestamp + uint256(proposal.durationDays) * 1 days);
        job.status = JobStatus.Funded;
        uint256 beforeBalance = usdc.balanceOf(address(this));
        usdc.safeTransferFrom(msg.sender, address(this), proposal.amount);
        uint256 afterBalance = usdc.balanceOf(address(this));
        if (afterBalance < beforeBalance || afterBalance - beforeBalance != proposal.amount) {
            revert IncorrectReceivedAmount();
        }
        emit ProposalAccepted(jobId, index, proposal.freelancer, proposal.amount, job.deadline);
    }

    /// @notice Record delivery and start a fresh seven-day review window.
    function submitDelivery(uint256 jobId, string calldata note) external {
        Job storage job = _job(jobId);
        _onlyFreelancer(job);
        _requireStatus(job, JobStatus.Funded);
        if (block.timestamp > job.deadline) revert DeadlinePassed();
        _validateText(note, 2000);
        job.deliveredAt = uint64(block.timestamp);
        job.status = JobStatus.Delivered;
        _addPost(jobId, PostKind.Deliverable, note);
        emit DeliverySubmitted(jobId);
    }

    /// @notice Request up to three revisions strictly before the review window expires.
    function requestRevision(uint256 jobId, string calldata reason) external {
        Job storage job = _job(jobId);
        _onlyClient(job);
        _requireStatus(job, JobStatus.Delivered);
        if (job.revisions >= MAX_REVISIONS) revert RevisionLimitReached();
        if (block.timestamp >= uint256(job.deliveredAt) + REVIEW_PERIOD) revert ReviewWindowExpired();
        _validateText(reason, 2000);
        ++job.revisions;
        job.status = JobStatus.Funded;
        uint64 extendedDeadline = uint64(block.timestamp + 3 days);
        if (job.deadline < extendedDeadline) job.deadline = extendedDeadline;
        _addPost(jobId, PostKind.Revision, reason);
        emit RevisionRequested(jobId, job.revisions);
    }

    /// @notice Approve delivered work and release or credit its full price to the freelancer.
    function approveAndRelease(uint256 jobId) external nonReentrant {
        Job storage job = _job(jobId);
        _onlyClient(job);
        _requireStatus(job, JobStatus.Delivered);
        _release(job);
    }

    /// @notice Claim delivered work's price once the client has had seven days to review it.
    function claimAfterReviewWindow(uint256 jobId) external nonReentrant {
        Job storage job = _job(jobId);
        _onlyFreelancer(job);
        _requireStatus(job, JobStatus.Delivered);
        if (block.timestamp < uint256(job.deliveredAt) + REVIEW_PERIOD) revert ReviewWindowNotExpired();
        _release(job);
    }

    /// @notice Refund an undelivered job strictly after its current deadline.
    function reclaimAfterDeadline(uint256 jobId) external nonReentrant {
        Job storage job = _job(jobId);
        _onlyClient(job);
        _requireStatus(job, JobStatus.Funded);
        if (block.timestamp <= job.deadline) revert DeadlineNotPassed();
        job.status = JobStatus.Refunded;
        emit Refunded(jobId, job.client, job.escrowAmount);
        _payout(job.client, job.escrowAmount);
    }

    /// @notice Freeze escrow for arbitration and store the opening reason as public evidence.
    function openDispute(uint256 jobId, string calldata reason) external {
        Job storage job = _job(jobId);
        _onlyParty(job);
        if (job.status != JobStatus.Funded && job.status != JobStatus.Delivered) revert InvalidStatus();
        if (msg.sender == job.client && job.status == JobStatus.Delivered
            && block.timestamp >= uint256(job.deliveredAt) + REVIEW_PERIOD) revert ReviewWindowExpired();
        if (msg.sender == job.freelancer && job.status == JobStatus.Funded
            && block.timestamp > job.deadline) revert DeadlinePassed();
        _validateText(reason, 2000);
        _disputedAfterDelivery[jobId] = job.status == JobStatus.Delivered;
        job.status = JobStatus.Disputed;
        job.disputedAt = uint64(block.timestamp);
        _addPost(jobId, PostKind.Evidence, reason);
        emit DisputeOpened(jobId, msg.sender);
    }

    /// @notice Append evidence while arbitration is pending.
    function submitEvidence(uint256 jobId, string calldata body) external {
        Job storage job = _job(jobId);
        _onlyParty(job);
        _requireStatus(job, JobStatus.Disputed);
        _validateText(body, 2000);
        _addPost(jobId, PostKind.Evidence, body);
    }

    /// @notice An authorized, non-party arbiter allocates escrow between the two parties only.
    function resolveDispute(uint256 jobId, uint256 freelancerAmount) external nonReentrant {
        Job storage job = _job(jobId);
        if (!isArbiter[msg.sender]) revert Unauthorized();
        if (msg.sender == job.client || msg.sender == job.freelancer) revert ConflictedArbiter();
        _requireStatus(job, JobStatus.Disputed);
        if (freelancerAmount > job.escrowAmount) revert InvalidAmount();
        _resolve(job, freelancerAmount);
    }

    /// @notice After ARBITER_TIMEOUT either party may settle according to the pre-dispute delivery status.
    /// @dev Full escrow goes to the freelancer if disputed after delivery; otherwise it is refunded to the client.
    function resolveStaleDispute(uint256 jobId) external nonReentrant {
        Job storage job = _job(jobId);
        _onlyParty(job);
        _requireStatus(job, JobStatus.Disputed);
        if (block.timestamp < uint256(job.disputedAt) + ARBITER_TIMEOUT) revert ArbiterTimeoutNotReached();
        _resolve(job, _disputedAfterDelivery[jobId] ? job.escrowAmount : 0);
    }

    /// @notice Parties can chat after funding, including after settlement; arbiters can chat during disputes.
    function postMessage(uint256 jobId, string calldata body) external {
        Job storage job = _job(jobId);
        if (job.freelancer == address(0)) revert InvalidStatus();
        if (job.status == JobStatus.Open || job.status == JobStatus.Cancelled) revert InvalidStatus();
        bool party = msg.sender == job.client || msg.sender == job.freelancer;
        if (!party && !(isArbiter[msg.sender] && job.status == JobStatus.Disputed)) revert Unauthorized();
        _validateText(body, 2000);
        _addPost(jobId, PostKind.Chat, body);
    }

    /// @notice Retry all deferred payments. A failed safe transfer reverts and restores the credit.
    function withdraw() external nonReentrant {
        uint256 amount = claimable[msg.sender];
        if (amount == 0) revert NothingToWithdraw();
        claimable[msg.sender] = 0;
        usdc.safeTransfer(msg.sender, amount);
        emit Withdrawn(msg.sender, amount);
    }

    /// @notice Return one job, reverting with JobNotFound for zero or unknown IDs.
    function getJob(uint256 jobId) external view returns (Job memory) {
        return _job(jobId);
    }

    /// @notice Read ascending jobs, clamping a zero fromId to one and limit to the available range.
    function getJobs(uint256 fromId, uint256 limit) external view returns (Job[] memory result) {
        if (fromId == 0) fromId = 1;
        if (fromId > jobCount || limit == 0) return new Job[](0);
        uint256 available = jobCount - fromId + 1;
        uint256 count = limit < available ? limit : available;
        result = new Job[](count);
        for (uint256 i; i < count; ++i) result[i] = _jobs[fromId + i];
    }

    /// @notice Count all historical proposals, including withdrawn proposals.
    function proposalCount(uint256 jobId) external view returns (uint256) {
        _job(jobId);
        return _proposals[jobId].length;
    }

    /// @notice Return all historical proposals for a valid job.
    function getProposals(uint256 jobId) external view returns (Proposal[] memory) {
        _job(jobId);
        return _proposals[jobId];
    }

    /// @notice Count all posts for a valid job.
    function postCount(uint256 jobId) external view returns (uint256) {
        _job(jobId);
        return _posts[jobId].length;
    }

    /// @notice Read a bounded page of posts using a zero-based offset; out-of-range pages are empty.
    function getPosts(uint256 jobId, uint256 offset, uint256 limit) external view returns (Post[] memory result) {
        _job(jobId);
        uint256 length = _posts[jobId].length;
        if (offset >= length || limit == 0) return new Post[](0);
        uint256 available = length - offset;
        uint256 count = limit < available ? limit : available;
        result = new Post[](count);
        for (uint256 i; i < count; ++i) result[i] = _posts[jobId][offset + i];
    }

    /// @notice Return distinct job IDs ever proposed to, including subsequently withdrawn offers.
    function jobsProposedBy(address freelancer) external view returns (uint256[] memory) {
        return _proposedJobs[freelancer];
    }

    function _job(uint256 jobId) internal view returns (Job storage job) {
        if (jobId == 0 || jobId > jobCount) revert JobNotFound();
        return _jobs[jobId];
    }

    function _proposal(uint256 jobId, uint256 index) internal view returns (Proposal storage proposal) {
        if (index >= _proposals[jobId].length) revert ProposalNotFound();
        return _proposals[jobId][index];
    }

    function _onlyClient(Job storage job) internal view {
        if (msg.sender != job.client) revert Unauthorized();
    }

    function _onlyFreelancer(Job storage job) internal view {
        if (msg.sender != job.freelancer) revert Unauthorized();
    }

    function _onlyParty(Job storage job) internal view {
        if (msg.sender != job.client && msg.sender != job.freelancer) revert Unauthorized();
    }

    function _requireStatus(Job storage job, JobStatus expected) internal view {
        if (job.status != expected) revert InvalidStatus();
    }

    function _validateText(string calldata text, uint256 maximum) internal pure {
        uint256 length = bytes(text).length;
        if (length == 0 || length > maximum) revert InvalidTextLength();
    }

    function _addPost(uint256 jobId, PostKind kind, string calldata body) internal {
        _posts[jobId].push(Post({author: msg.sender, timestamp: uint64(block.timestamp), kind: kind, body: body}));
        emit PostAdded(jobId, msg.sender, kind);
    }

    function _release(Job storage job) internal {
        job.status = JobStatus.Released;
        emit Released(job.id, job.freelancer, job.escrowAmount);
        _payout(job.freelancer, job.escrowAmount);
    }

    function _resolve(Job storage job, uint256 freelancerAmount) internal {
        uint256 clientAmount = job.escrowAmount - freelancerAmount;
        job.status = JobStatus.Resolved;
        emit DisputeResolved(job.id, freelancerAmount, clientAmount, msg.sender);
        _payout(job.freelancer, freelancerAmount);
        _payout(job.client, clientAmount);
    }

    /// @dev Settlement-only transfer wrapper. Final status is set before calling; escrowAmount stays historical.
    ///      Accepts empty returns or a first return word equal to true, without decoding malformed booleans.
    ///      Reverts, false returns, and malformed returns become credits instead of blocking the other party.
    ///      All callers are protected by nonReentrant. Zero payouts are skipped.
    function _payout(address to, uint256 amount) internal {
        if (amount == 0) return;
        (bool success, bytes memory data) = address(usdc).call(abi.encodeCall(IERC20.transfer, (to, amount)));
        uint256 returned;
        if (data.length >= 32) {
            assembly ("memory-safe") {
                returned := mload(add(data, 32))
            }
        }
        bool paid = success && address(usdc).code.length != 0
            && (data.length == 0 || (data.length >= 32 && returned == 1));
        if (!paid) {
            claimable[to] += amount;
            emit PayoutDeferred(to, amount);
        }
    }
}
