import { runLogin } from './login.js';
import { runStatus } from './status.js';

async function main() {
  const cmd = process.argv[2];
  switch (cmd) {
    case 'login':
      await runLogin();
      return;
    case 'status':
      await runStatus();
      return;
    default:
      console.error(`usage: plicit shell <login|status>\nGot: ${cmd ?? '(none)'}`);
      process.exit(2);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
