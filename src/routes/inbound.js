import { Router } from 'express';
import twilio from 'twilio';

const router = Router();

/**
 * Inbound PSTN TwiML: bridge to browser client identity `agent`.
 * @param {import('express').Request} _req
 * @param {import('express').Response} res
 */
function postInbound(_req, res) {
  const vr = new twilio.twiml.VoiceResponse();

  /*
   * Future multi-agent: replace single <Client> with <Queue> + TaskRouter or
   * round-robin identities, e.g. <Dial><Queue>support</Queue></Dial>
   */
  const dial = vr.dial();
  dial.client('agent');

  res.type('text/xml').send(vr.toString());
}

router.post('/inbound', postInbound);

export default router;
