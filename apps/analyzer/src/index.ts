import { logger } from './logger.js';
import { detectAndCloseStaleConversations } from './findStale.js';
import { classifyConversation } from './classify.js';
import { persistClassification } from './persist.js';

async function main() {
  const conversations = detectAndCloseStaleConversations();
  logger.info({ count: conversations.length }, 'stale conversations detected');

  let analyzed = 0;
  for (const conv of conversations) {
    try {
      const classification = await classifyConversation(conv);
      const { analysisId, reviewItemIds } = persistClassification(
        conv.conversationId,
        classification,
      );
      logger.info(
        {
          chat: conv.chatName ?? conv.chatJid,
          analysisId,
          toolCalls: classification.toolCalls.map((c) => c.name),
          reviewItemIds,
        },
        'analyzed',
      );
      analyzed += 1;
    } catch (err) {
      logger.error(
        { err, conversationId: conv.conversationId, chat: conv.chatJid },
        'classification failed',
      );
    }
  }
  logger.info({ analyzed, total: conversations.length }, 'analyzer pass complete');
}

main().catch((err) => {
  logger.error({ err }, 'fatal');
  process.exit(1);
});
