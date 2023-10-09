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
  ChecklistData,
  checkChecklistPermissions,
  configExtractCheckboxes,
  getChecklistMessageText,
  parseLocationIdentifier,
  sendChecklist,
  updateChecklistMessage,
} from '../modules/checklist';
import { Api } from 'grammy';
import { decodeDeepLinkParams } from '../lib/deep-linking';
import { body, validationResult } from 'express-validator';
import { upsertDbUser } from '../middlewares/authenticate';
import { i18n } from '../main';
import { TgError } from '../lib/utils';
import { getEmptyConfig } from '../modules/check-config';
import { UserConfig } from '@prisma/client';

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

router.use(async (req, res, next) => {
  if (!isRequestSafe(req.body.initData)) {
    res.statusCode = 400;
    return res.json({ ok: false });
  }

  const decodedParams = querystring.decode(req.body.initData);

  if (!decodedParams.user) {
    res.statusCode = 400;
    return res.json({ ok: false, description: 'User missing' });
  }

  const initData = {
    ...decodedParams,
    user: JSON.parse(decodedParams.user as string),
  } as WebAppInitData;

  req.body.initData = initData;
  const dbUser = await upsertDbUser(initData.user as WebAppUser);
  req.body.dbUser = dbUser;
  // TODO maybe this can use the negotiateLocale method declared in main
  req.body.t = i18n.fluent.withLocale(
    dbUser.language ??
      initData.user?.language_code ??
      process.env.DEFAULT_LOCALE ??
      'en'
  );
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

    let checklistData: ChecklistData;
    try {
      await checkChecklistPermissions(api, initData.user!.id, location);
      checklistData = configExtractCheckboxes(
        await getChecklistMessageText(api, initData.user!.id, location),
        req.body.dbUser.config
      );
    } catch (error) {
      const prettyError =
        error instanceof TgError
          ? req.body.t(error.message, error.context)
          : req.body.t('unknown-error');
      res.statusCode = 400;
      return res.json({ ok: false, description: prettyError });
    }

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
      const prettyError =
        error instanceof TgError
          ? req.body.t(error.message, error.context)
          : req.body.t('unknown-error');
      res.statusCode = 400;
      return res.json({ ok: false, description: prettyError });
    }

    // update the checklist
    const me = await api.getMe(); // TODO cache the result
    const config: UserConfig = req.body.dbUser.config ?? getEmptyConfig();
    await updateChecklistMessage(api, me, location, {
      checkedBoxStyle: config.default_checked_box,
      uncheckedBoxStyle: config.default_unchecked_box,
      hasCheckBoxes: true,
      lines: body.checklistLines,
    });

    res.json({ ok: true });
  }
);

router.post(
  '/create-message',
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
      if (location.sourceMessageId !== 0) {
        throw new TgError('error-creating-checklist');
      }
      await checkChecklistPermissions(api, initData.user!.id, location);
    } catch (error) {
      const prettyError =
        error instanceof TgError
          ? req.body.t(error.message, error.context)
          : req.body.t('unknown-error');
      res.statusCode = 400;
      return res.json({ ok: false, description: prettyError });
    }

    // create the checklist
    const me = await api.getMe(); // TODO cache the result
    const config: UserConfig = req.body.dbUser.config ?? getEmptyConfig();
    await sendChecklist(api, me, location, {
      checkedBoxStyle: config.default_checked_box,
      uncheckedBoxStyle: config.default_unchecked_box,
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
