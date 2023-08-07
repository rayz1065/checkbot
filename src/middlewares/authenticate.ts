import { User } from '@prisma/client';
import { Middleware } from 'grammy';
import { MyContext, prisma } from '../main';

export const authenticate: Middleware<MyContext> = async (ctx, next) => {
  if (!ctx.from) {
    return;
  }
  let user: MyContext['dbUser'];
  const include = { config: true };
  const updateData = {
    first_name: ctx.from.first_name,
    last_name: ctx.from.last_name,
    username: ctx.from.username,
  };
  try {
    user = await prisma.user.update({
      where: { telegram_chat_id: ctx.from.id },
      data: updateData,
      include,
    });
  } catch (error) {
    let invitedBy: User | null = null;
    if (ctx.message?.text?.startsWith('/start ref')) {
      const invitedById = parseInt(ctx.message.text.split('_', 2)[1], 10);
      invitedBy = await prisma.user.findFirst({
        where: { id: invitedById },
      });
    }
    user = await prisma.user.create({
      data: {
        telegram_chat_id: ctx.from.id,
        ...updateData,
        language: ctx.from.language_code,
        invited_by_id: invitedBy?.id,
      },
      include,
    });
  }
  ctx.dbUser = user;
  await ctx.i18n.renegotiateLocale();
  await next();
};
