/**
 * Contract ABIs and on-chain enum mirrors.
 *
 * These fragments are the gateway's only view of the deployed contracts, so
 * every declaration here must match `contracts/src` exactly. Drift is silent
 * and dangerous: a wrong tuple order decodes to plausible-looking garbage, and
 * a wrong enum ordinal maps one wallet class onto another.
 *
 * `test/abi-parity.test.ts` parses the Solidity sources and fails the build on
 * any divergence. Update the contract and this file together, never one alone.
 */

export const WalletRegistryABI = [
  'function registerWallet(address wallet, uint8 walletType, address linkedBankAccount, bytes32 kycHash) external',
  'function deactivateWallet(address wallet, string reason) external',
  'function reactivateWallet(address wallet) external',
  'function setCustomLimit(address wallet, uint256 limit) external',
  'function updateLinkedBankAccount(address wallet, address newBank) external',
  // IWalletRegistry.WalletInfo — field order is load-bearing.
  'function getWalletInfo(address wallet) external view returns (tuple(uint8 walletType, address linkedBankAccount, uint256 customLimit, uint256 registrationTime, bool isActive, bytes32 kycHash))',
  'function getHoldingLimit(address wallet) external view returns (uint256)',
  'function getDefaultHoldingLimit(uint8 walletType) external view returns (uint256)',
  'function isRegistered(address wallet) external view returns (bool)',
  'function isActive(address wallet) external view returns (bool)',
  'function canHold(address wallet, uint256 amount) external view returns (bool)',
  'function getExcessAmount(address wallet, uint256 currentBalance, uint256 incoming) external view returns (uint256)',
  'event WalletRegistered(address indexed wallet, uint8 indexed walletType, address linkedBankAccount, bytes32 kycHash)',
  'event WalletDeactivated(address indexed wallet, string reason)',
  'event WalletReactivated(address indexed wallet)',
  'event LinkedBankAccountUpdated(address indexed wallet, address oldBank, address newBank)',
  'event CustomLimitSet(address indexed wallet, uint256 limit)',
] as const;

export const TokenizedEuroABI = [
  'function name() external view returns (string)',
  'function symbol() external view returns (string)',
  'function totalSupply() external view returns (uint256)',
  'function balanceOf(address account) external view returns (uint256)',
  'function transfer(address to, uint256 amount) external returns (bool)',
  'function allowance(address owner, address spender) external view returns (uint256)',
  'function approve(address spender, uint256 amount) external returns (bool)',
  'function transferFrom(address from, address to, uint256 amount) external returns (bool)',
  'function mint(address to, uint256 amount, bytes32 idempotencyKey) external',
  'function burn(address from, uint256 amount, bytes32 idempotencyKey) external',
  'function pause() external',
  'function unpause() external',
  'function paused() external view returns (bool)',
  'function freezeAccount(address account, string reason) external',
  'function unfreezeAccount(address account) external',
  'function escrowFunds(address account, uint256 amount, string legalBasis, uint256 expiry) external',
  'function releaseEscrowedFunds(address account, address to) external',
  'function burnEscrowedFunds(address account) external',
  'function executeWaterfall(address wallet) external',
  'function executeReverseWaterfall(address wallet, uint256 amount, bytes32 idempotencyKey) external',
  'function frozenAccounts(address account) external view returns (bool)',
  // EscrowRecord { uint256 amount; string legalBasis; uint256 expiry; }
  // Solidity's auto-generated getter for a struct mapping returns the members
  // as separate values, not a tuple.
  'function escrowedBalances(address account) external view returns (uint256 amount, string legalBasis, uint256 expiry)',
  'function escrowTotals(address account) external view returns (uint256)',
  'function wouldExceedLimit(address to, uint256 amount) external view returns (bool)',
  'function getWaterfallAmount(address to, uint256 amount) external view returns (uint256)',
  'function isIdempotencyKeyUsed(bytes32 key) external view returns (bool)',
  'event Transfer(address indexed from, address indexed to, uint256 value)',
  'event Approval(address indexed owner, address indexed spender, uint256 value)',
  'event Mint(address indexed to, uint256 value, bytes32 indexed idempotencyKey)',
  'event Burn(address indexed from, uint256 value, bytes32 indexed idempotencyKey)',
  'event Paused(address indexed by)',
  'event Unpaused(address indexed by)',
  'event WaterfallExecuted(address indexed wallet, address indexed bankAccount, uint256 amount)',
  'event ReverseWaterfallExecuted(address indexed wallet, address indexed bankAccount, uint256 amount)',
  'event AccountFrozen(address indexed account, address indexed by, string reason)',
  'event AccountUnfrozen(address indexed account, address indexed by)',
  'event FundsEscrowed(address indexed account, uint256 amount, string legalBasis, uint256 expiry)',
  'event FundsReleased(address indexed account, uint256 amount, address indexed to)',
  'event FundsBurnedFromEscrow(address indexed account, uint256 amount)',
] as const;

export const ConditionalPaymentsABI = [
  'function createConditionalPayment(address payee, uint256 amount, uint8 conditionType, bytes32 conditionData, uint256 expiresAt, address arbiter, bytes32 idempotencyKey) external returns (bytes32)',
  'function confirmDelivery(bytes32 paymentId, bytes32 proof) external',
  'function confirmMilestone(bytes32 paymentId, uint256 milestoneIndex) external',
  'function releasePayment(bytes32 paymentId, bytes32 proof) external',
  'function refundPayment(bytes32 paymentId, string reason) external',
  'function disputePayment(bytes32 paymentId, string reason) external',
  'function resolveDispute(bytes32 paymentId, bool releaseToPayee) external',
  'function claimExpiredPayment(bytes32 paymentId) external',
  // IConditionalPayments.ConditionalPayment — field order is load-bearing.
  'function getPayment(bytes32 paymentId) external view returns (tuple(bytes32 paymentId, address payer, address payee, uint256 amount, uint8 conditionType, bytes32 conditionData, uint256 createdAt, uint256 expiresAt, uint8 status, address arbiter))',
  'function getPaymentsByPayer(address payer) external view returns (bytes32[])',
  'function getPaymentsByPayee(address payee) external view returns (bytes32[])',
  'function isConditionMet(bytes32 paymentId) external view returns (bool)',
  'function isMilestoneComplete(bytes32 paymentId, uint256 milestoneIndex) external view returns (bool)',
  'event ConditionalPaymentCreated(bytes32 indexed paymentId, address indexed payer, address indexed payee, uint256 amount, uint8 conditionType, uint256 expiresAt)',
  'event PaymentReleased(bytes32 indexed paymentId, address indexed payee, uint256 amount, bytes32 proofOfCondition)',
  'event PaymentRefunded(bytes32 indexed paymentId, address indexed payer, uint256 amount, string reason)',
  'event PaymentDisputed(bytes32 indexed paymentId, address indexed disputedBy, string reason)',
  'event DisputeResolved(bytes32 indexed paymentId, address indexed resolvedBy, bool releasedToPayee)',
  'event DeliveryConfirmed(bytes32 indexed paymentId, address indexed confirmedBy, bytes32 deliveryProof)',
  'event MilestoneCompleted(bytes32 indexed paymentId, uint256 milestoneIndex, address indexed confirmedBy)',
] as const;

export const PermissioningABI = [
  'function grantRole(bytes32 role, address account) external',
  'function revokeRole(bytes32 role, address account) external',
  'function hasRole(bytes32 role, address account) external view returns (bool)',
  'function isAdmin(address account) external view returns (bool)',
  'function isMinter(address account) external view returns (bool)',
  'function isBurner(address account) external view returns (bool)',
  'function isEmergencyController(address account) external view returns (bool)',
  'function isRegistrar(address account) external view returns (bool)',
  'function isWaterfallOperator(address account) external view returns (bool)',
  'function isECB(address account) external view returns (bool)',
  'function isStateBank(address account) external view returns (bool)',
  'function isLocalBank(address account) external view returns (bool)',
  'function isPSP(address account) external view returns (bool)',
  'function isMerchant(address account) external view returns (bool)',
  'function isWalletHolder(address account) external view returns (bool)',
] as const;

/**
 * Mirrors IWalletRegistry.WalletType. UNREGISTERED occupies ordinal 0, so every
 * subsequent member is one higher than a naive 0-based listing would suggest.
 */
export enum WalletType {
  UNREGISTERED = 0,
  INDIVIDUAL = 1,
  MERCHANT = 2,
  PSP = 3,
  NCB = 4,
  BANK = 5,
}

/** Mirrors IConditionalPayments.ConditionType. NONE occupies ordinal 0. */
export enum ConditionType {
  NONE = 0,
  DELIVERY = 1,
  MILESTONE = 2,
  TIME_LOCK = 3,
  MULTI_SIG = 4,
  ORACLE = 5,
}

/** Mirrors IConditionalPayments.PaymentStatus. */
export enum PaymentStatus {
  PENDING = 0,
  RELEASED = 1,
  REFUNDED = 2,
  EXPIRED = 3,
  DISPUTED = 4,
}
