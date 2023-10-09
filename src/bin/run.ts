import { bot, prisma } from '../main';
import { server } from '../server/server';

const port = 3000;

async function main() {
  console.log('Bot running...');
  await Promise.all([
    bot.start(),
    server.listen(port, () => {
      console.log(`Api listening on port ${port}`);
    }),
  ]);
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
