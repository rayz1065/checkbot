import express, {
  Handler,
  NextFunction,
  Request,
  Response,
  json,
} from 'express';
import crypto from 'crypto';
import querystring from 'node:querystring';
import {
  CheckBoxLine,
  checkChecklistPermissions,
  extractCheckboxes,
  getChecklistMessageText,
  parseLocationIdentifier,
  updateChecklistMessage,
} from '../modules/checklist';
import { Api } from 'grammy';
import { decodeDeepLinkParams } from '../lib/deep-linking';
import { body, validationResult } from 'express-validator';

export const server = express();
server.use(json());

const router = express.Router();

const ensureValid: Handler = (req, res, next) => {
  if (!validationResult(req).isEmpty()) {
    res.statusCode = 400;
    return res.json({ ok: false, description: 'Bad request' });
  }
  next();
};

router.get('/', (req, res) => {
  res.json({ ok: true, result: 'alive' });
});

/**
 * https://core.telegram.org/bots/webapps#validating-data-received-via-the-mini-app
 */
function isRequestSafe(initDataString: string) {
  const initData = querystring.decode(initDataString);

  const { hash } = initData;
  if (!hash) {
    return false;
  }

  const dataCheckString = Object.keys(initData)
    .filter((key) => key !== 'hash')
    .sort()
    .map((key) => `${key}=${initData[key]}`)
    .join('\n');

  const secretKey = crypto
    .createHmac('sha256', 'WebAppData')
    .update(process.env.BOT_TOKEN!)
    .digest();

  const actualHash = crypto
    .createHmac('sha256', secretKey)
    .update(dataCheckString)
    .digest('hex');

  return actualHash === hash;
}

router.use((req, res, next) => {
  if (!isRequestSafe(req.body.initData)) {
    res.statusCode = 400;
    return res.json({ ok: false });
  }

  const initData = querystring.decode(req.body.initData);

  req.body.initData = initData;
  if (initData.user) {
    initData.user = JSON.parse(initData.user as string);
  } else {
    res.statusCode = 400;
    return res.json({ ok: false, description: 'User missing' });
  }

  next();
});

router.post(
  '/message',
  body('location').notEmpty(),
  ensureValid,
  async (req, res) => {
    const body: {
      initData: WebAppInitData;
      location: string;
    } = req.body;

    const api = new Api(process.env.BOT_TOKEN!);
    const { initData } = body;
    const location = parseLocationIdentifier(
      decodeDeepLinkParams(body.location)
    );
    try {
      await checkChecklistPermissions(api, initData.user!.id, location);
    } catch (error) {
      res.statusCode = 400;
      return res.json({ ok: false });
    }
    const checklistData = extractCheckboxes(
      await getChecklistMessageText(api, initData.user!.id, location)
    );
    res.json({ ok: true, result: checklistData.lines });
  }
);

router.post(
  '/update-message',
  body('location').notEmpty(),
  body('checklistLines').notEmpty(),
  ensureValid,
  async (req, res) => {
    const body: {
      initData: WebAppInitData;
      location: string;
      checklistLines: CheckBoxLine[]; // TODO: validate lines
    } = req.body;

    const api = new Api(process.env.BOT_TOKEN!);
    const { initData } = body;
    const location = parseLocationIdentifier(
      decodeDeepLinkParams(body.location)
    );
    try {
      await checkChecklistPermissions(api, initData.user!.id, location);
    } catch (error) {
      res.statusCode = 400;
      return res.json({ ok: false });
    }

    // update the checklist
    const me = await api.getMe();
    await updateChecklistMessage(api, me, location, {
      checkedBoxStyle: '- [x]',
      uncheckedBoxStyle: '- [ ]',
      hasCheckBoxes: true,
      lines: body.checklistLines,
    });
    res.json({ ok: true });
  }
);

// eslint-disable-next-line @typescript-eslint/no-unused-vars
router.use((err: any, req: Request, res: Response, next: NextFunction) => {
  console.error('Server error', err);
  res.status(500);
  res.json({ ok: false, description: 'Internal server error' });
});

server.use(router);
