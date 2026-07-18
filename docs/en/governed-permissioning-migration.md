# Governed Permissioning Migration

`GovernedPermissioning` is the versioned replacement for the original single-administrator `Permissioning` contract.

## Security model

- The contract starts with two distinct administrators.
- Every role grant or revocation is proposed by one active administrator and approved by a different active administrator.
- Proposals expire and cannot be replayed after execution or cancellation.
- The administrator set cannot be reduced below two members.
- Proposal identifiers include the chain, contract address, nonce, role, account, action, and proposer.

## Deployment sequence

1. Select two independently controlled administrator addresses. Production deployments should use separate multisig or hardware-backed identities.
2. Deploy `GovernedPermissioning(initialAdmin, secondAdmin)`.
3. Propose and approve the required ECB, emergency, registrar, oracle, waterfall, validator, minter, and burner roles.
4. Deploy new versions of dependent contracts configured with the governed permissioning address.
5. Verify all expected role checks before enabling minting or transfers.
6. Keep the original contracts paused during state migration and reconciliation.
7. Publish deployment addresses, bytecode hashes, role assignments, and approval transactions as release evidence.

## Compatibility

The role constants and read methods match the existing permissioning surface used by the contracts. The mutation API intentionally changes from immediate `grantRole` and `revokeRole` calls to `proposeRoleChange` followed by `approveAndExecute`.

Because the existing token stores its permissioning address as immutable, migrating a deployed instance requires a versioned token deployment and state/reconciliation process. It must not be attempted as an in-place storage change.
