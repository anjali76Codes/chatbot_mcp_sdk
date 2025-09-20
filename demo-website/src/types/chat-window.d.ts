import type { MiddlewareFn } from '../../../chat-sdk/middlewares/defaultMiddlewares';
import type { ChatWindowProps as OriginalProps } from '../../../chat-sdk/dist';

declare module '../../chat-sdk/dist' {
  interface ChatWindowProps extends OriginalProps {
    middlewares?: MiddlewareFn[];
  }
}
