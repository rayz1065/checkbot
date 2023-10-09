import { Prisma, User } from '@prisma/client';
import { Middleware } from 'grammy';
import { MyContext, prisma } from '../main';
import { User as TgUser } from 'grammy/types';

/**
 * Updates the user's data, creates the user if it does not exist
 */
export async function upsertDbUser(
  from: TgUser | WebAppUser,
  startParam?: string
) {
  const include = { config: true } satisfies Prisma.UserInclude;
  const updateData = {
    first_name: from.first_name,
    last_name: from.last_name,
    username: from.username,
  } satisfies Prisma.UserUpdateInput;

  let user: MyContext['dbUser'];
  try {
    user = await prisma.user.update({
      where: { telegram_chat_id: from.id },
      data: updateData,
      include,
    });
  } catch (error) {
    // Create the user, if they were invited by someone the ref param is used
    let invitedBy: User | null = null;
    if (startParam && startParam.startsWith('ref')) {
      const invitedById = parseInt(startParam.split('_', 2)[1], 10);
      invitedBy = await prisma.user.findFirst({
        where: { id: invitedById },
      });
    }
    user = await prisma.user.create({
      data: {
        telegram_chat_id: from.id,
        ...updateData,
        language: from.language_code,
        invited_by_id: invitedBy?.id,
      },
      include,
    });
  }

  return user;
}

export const authenticate: Middleware<MyContext> = async (ctx, next) => {
  if (!ctx.from) {
    return;
  }
  const startParam = ctx.hasCommand('start') ? ctx.match : undefined;
  ctx.dbUser = await upsertDbUser(ctx.from, startParam);
  await ctx.i18n.renegotiateLocale();
  await next();
};
