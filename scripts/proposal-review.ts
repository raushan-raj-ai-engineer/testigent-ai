/** Generated proposal review CLI. Author: Raushan Raj */
import {
  approveProposal,
  inspectProposal,
  listProposals,
  promoteProposal,
  rejectProposal,
  reopenProposal,
  validateProposal
} from '../src/framework/intelligence/review/proposal.review.js';

interface Args { command?: string; requirementId?: string; flags: Record<string,string>; }

function parseArgs(argv: string[]): Args {
  const positional: string[] = [];
  const flags: Record<string,string> = {};
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index]!;
    if (!arg.startsWith('--')) { positional.push(arg); continue; }
    const body = arg.slice(2);
    const equals = body.indexOf('=');
    if (equals >= 0) { flags[body.slice(0, equals)] = body.slice(equals + 1); continue; }
    const next = argv[index + 1];
    if (next && !next.startsWith('--')) { flags[body] = next; index += 1; }
    else flags[body] = 'true';
  }
  return { command: positional[0], requirementId: positional[1], flags };
}

function requireId(value?: string): string {
  if (!value) throw new Error('Requirement id is required. Example: npm run proposal:show -- payment');
  return value;
}

function help(): string {
  return `Generated Proposal Review & Promotion\n\nCommands:\n  list\n  show <requirementId>\n  validate <requirementId>\n  approve <requirementId> --reviewer=\"Name\" [--note=\"...\"]\n  reject <requirementId> --reviewer=\"Name\" --reason=\"...\"\n  reopen <requirementId> --reviewer=\"Name\" [--note=\"...\"]\n  promote <requirementId>\n\nEnvironment:\n  PROPOSAL_REVIEWER=\"Name\"\n`;
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
  const root = process.cwd();
  switch (args.command) {
    case 'list':
      console.log(JSON.stringify(await listProposals(root), null, 2));
      return;
    case 'show':
      console.log(JSON.stringify(await inspectProposal(root, requireId(args.requirementId)), null, 2));
      return;
    case 'validate':
      console.log(JSON.stringify(await validateProposal(root, requireId(args.requirementId)), null, 2));
      return;
    case 'approve':
      console.log(JSON.stringify(await approveProposal(root, requireId(args.requirementId), args.flags.reviewer, args.flags.note), null, 2));
      return;
    case 'reject':
      console.log(JSON.stringify(await rejectProposal(root, requireId(args.requirementId), args.flags.reviewer, args.flags.reason), null, 2));
      return;
    case 'reopen':
      console.log(JSON.stringify(await reopenProposal(root, requireId(args.requirementId), args.flags.reviewer, args.flags.note), null, 2));
      return;
    case 'promote':
      console.log(JSON.stringify(await promoteProposal(root, requireId(args.requirementId)), null, 2));
      return;
    default:
      console.log(help());
      if (args.command) process.exitCode = 2;
  }
}

main().catch(error => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
