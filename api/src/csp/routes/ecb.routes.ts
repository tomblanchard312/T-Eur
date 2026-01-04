import { Router } from 'express';
import { EcbController } from '../controllers/ecb.controller';
import { mtlsAuth, authorize } from '../middleware/auth';
import { validate } from '../middleware/validation';
import { 
  MintSchema, 
  SanctionSchema, 
  EscrowSchema, 
  KeyActionSchema, 
  ParticipantActionSchema,
  BaseSovereignSchema
} from '../types';

const router = Router();

// All CSP routes require mTLS
router.use(mtlsAuth);

// 1. Operator session
router.get('/operator/me', EcbController.getMe);

// 2. Monetary operations (ECB_OPERATOR only)
router.post('/ecb/mint', 
  authorize(['ECB_OPERATOR']), 
  validate(MintSchema), 
  EcbController.mint.bind(EcbController)
);
router.post('/ecb/burn', 
  authorize(['ECB_OPERATOR']), 
  validate(MintSchema), // Reusing MintSchema for amount/justification
  EcbController.burn.bind(EcbController)
);
router.post('/ecb/mint-suspend', 
  authorize(['ECB_OPERATOR']), 
  validate(BaseSovereignSchema), 
  EcbController.suspendMinting.bind(EcbController)
);
router.post('/ecb/mint-resume', 
  authorize(['ECB_OPERATOR']), 
  validate(BaseSovereignSchema), 
  EcbController.resumeMinting.bind(EcbController)
);

// 3. Sanctions
router.post('/ecb/sanctions/freeze', 
  authorize(['ECB_OPERATOR']), 
  validate(SanctionSchema), 
  EcbController.freeze.bind(EcbController)
);
router.post('/ecb/sanctions/unfreeze', 
  authorize(['ECB_OPERATOR']), 
  validate(SanctionSchema), 
  EcbController.unfreeze.bind(EcbController)
);

// 4. Escrow
router.post('/ecb/escrow/place', 
  authorize(['ECB_OPERATOR']), 
  validate(EscrowSchema), 
  EcbController.placeEscrow.bind(EcbController)
);
router.post('/ecb/escrow/release', 
  authorize(['ECB_OPERATOR']), 
  validate(BaseSovereignSchema), 
  EcbController.releaseEscrow.bind(EcbController)
);

// 5. Security and Keys
router.get('/ecb/keys', authorize(['SYSTEM_ADMIN', 'AUDITOR']), EcbController.getAuditEvents); // Placeholder for list
router.post('/ecb/keys/rotate', 
  authorize(['SYSTEM_ADMIN']), 
  validate(KeyActionSchema), 
  EcbController.rotateKey.bind(EcbController)
);
router.post('/ecb/participants/isolate', 
  authorize(['ECB_OPERATOR', 'SYSTEM_ADMIN']), 
  validate(ParticipantActionSchema), 
  EcbController.isolateParticipant.bind(EcbController)
);

// 6. Audit
router.get('/ecb/audit/events', authorize(['AUDITOR', 'ECB_OPERATOR']), EcbController.getAuditEvents);

export default router;
