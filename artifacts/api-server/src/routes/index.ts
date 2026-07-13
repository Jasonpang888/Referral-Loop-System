import { Router, type IRouter } from "express";
import healthRouter from "./health";
import authRouter from "./auth";
import referralRouter from "./referral";
import leadsRouter from "./leads";
import commissionsRouter from "./commissions";
import partnerRouter from "./partner";
import analyticsRouter from "./analytics";
import campaignsRouter from "./campaigns";
import auditExportsRouter from "./auditExports";

const router: IRouter = Router();

router.use(healthRouter);
router.use(authRouter);
router.use(referralRouter);
router.use(leadsRouter);
router.use(commissionsRouter);
router.use(partnerRouter);
router.use(analyticsRouter);
router.use(campaignsRouter);
router.use(auditExportsRouter);

export default router;
