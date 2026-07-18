# ADR-001: Protocol v2 Contract Architecture

Status: Accepted

## Decision

Protocol v2 will use a modular contract architecture rather than extending the current all-in-one token contract.

The approved components are:

1. `TokenLedger`
   - ERC-20 compatible balances, allowances, total supply, and ordinary transfers.
   - No sovereign policy decisions.
   - Privileged balance mutations are available only to explicitly authorized controller contracts.

2. `MintBurnController`
   - Minting and burning only.
   - Uses governed permissioning and scoped idempotency.
   - Cannot freeze accounts, manage escrow, or alter holding policy.

3. `SanctionsController`
   - Maintains freeze state and opaque sanctions case references.
   - Exposes transfer eligibility checks to the ledger.
   - Stores no legal narrative, personal information, or sanctions text on-chain.

4. `EscrowController`
   - Owns escrow case state and escrow totals.
   - Moves funds through the ledger's controller interface.
   - Cannot mint funds or mutate unrelated balances.

5. `HoldingPolicy`
   - Computes holding limits and waterfall behavior.
   - Does not directly own token balances.

6. `EmergencyController`
   - Coordinates emergency pause state across modules.
   - Emergency activation and recovery use governed dual control.

7. `GovernedPermissioning`
   - Source of authoritative role assignments.
   - Requires two distinct active administrators to approve grants and revocations.

## Cross-module rules

- The ledger will call sanctions and holding-policy hooks before transfers.
- Controllers may mutate balances only through narrow, role-gated ledger methods.
- Every controller address is immutable or changed only through governed, time-delayed configuration.
- Deployment rejects zero addresses, duplicate module addresses, and modules that do not implement the expected interface identifier.
- No module may write another module's storage.

## Scoped idempotency

Every privileged operation will compute a digest as:

```solidity
keccak256(
    abi.encode(
        block.chainid,
        address(this),
        operationType,
        actor,
        target,
        amount,
        clientKey
    )
)
```

The digest is stored in the module executing the operation. Reusing the same client key for a different operation, actor, target, amount, chain, or contract does not collide.

## Upgrade and deployment model

- Protocol v2 will be deployed as new versioned contracts.
- Existing v1 contracts will not be modified in place.
- Production deployment uses a staged cutover with a rehearsed rollback procedure.
- No transparent proxy upgrade pattern will be introduced in this version. Contract immutability is preferred over upgradeable storage risk.

## Migration decision

The migration sequence is:

1. Pause v1 privileged operations and ordinary transfers at an announced cutover block.
2. Export balances, allowances, freeze state, active escrow state, role assignments, and total supply at that block.
3. Produce a signed reconciliation manifest with Merkle roots for each state category.
4. Deploy v2 modules and configure governed roles.
5. Import balances and approved state through one-time migration functions restricted to a migration controller.
6. Verify total supply, per-account balances, escrow totals, and role mappings against the manifest.
7. Permanently disable the migration controller.
8. Open v2 only after independent reconciliation succeeds.

Allowances will be migrated only when the owner has explicitly opted in before the snapshot. Otherwise allowances reset to zero.

## Consequences

This design increases deployment complexity but sharply reduces privilege concentration, audit scope, and accidental cross-feature mutation. It also requires API and SDK versioning because v2 escrow and governance events differ from v1.