import { EmitMessageExportCtx } from '@typings/messages';
import PlayerService from '../../players/player.service';
import MessagesService from '../messages.service';
import { messagesLogger } from '../messages.utils';
import { OnMessageExportMap } from './onMessage';
import { OrderedPromiseExecutor } from '../../utils/ordered-executor';

const exp = global.exports;
//these are needed so when we lets say send 2 messages to the targetNumber at the same time there might be 2 created conversations for the same senderNumber
//each target has its own executor, so there won't be any throttling when sending message to different numbers
const executorQueueMap = new Map<string, OrderedPromiseExecutor>();

exp('emitMessage', async ({ senderNumber, targetNumber, message, embed }: EmitMessageExportCtx) => {
  if (!executorQueueMap.has(targetNumber)) {
    executorQueueMap.set(targetNumber, new OrderedPromiseExecutor());
  }
  const executor = executorQueueMap.get(targetNumber);
  await executor
    .enqueue(() =>
      MessagesService.handleEmitMessage({
        senderNumber,
        targetNumber,
        message,
        embed: embed && JSON.stringify(embed),
      }),
    )
    .then(async () => {
      const funcRef = OnMessageExportMap.get(targetNumber);

      const senderIdentifier = await PlayerService.getIdentifierByPhoneNumber(senderNumber, false);
      const senderPlayer = PlayerService.getPlayerFromIdentifier(senderIdentifier);

      if (funcRef) {
        try {
          await funcRef({
            data: { embed, message, sourcePhoneNumber: senderNumber, tgtPhoneNumber: targetNumber },
            source: senderPlayer.source,
          });
        } catch (e) {
          messagesLogger.error(
            `Failed to find a callback reference for onMessage. Probably because the resource(s) using the export was stopped or restarted. Please restart said resource(s). Error: ${e.message}`,
          );
        }
      }
    });
});
