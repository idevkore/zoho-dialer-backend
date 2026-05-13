import { Router } from 'express';
import { tenantResolver } from '../middleware/tenantResolver.js';
import { logWidgetCallSummaryToZoho } from '../services/callLogger.js';

const router = Router();

/**
 * Client-side call summary after Twilio disconnect (see widget `call-logger.js`).
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @param {import('express').NextFunction} next
 */
async function postWidgetCallLog(req, res, next) {
  try {
    const body = req.body && typeof req.body === 'object' ? req.body : {};
    await logWidgetCallSummaryToZoho(body, req.tenant);
    return res.status(204).end();
  } catch (err) {
    return next(err);
  }
}

router.post('/log', tenantResolver, postWidgetCallLog);

export default router;
