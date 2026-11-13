import { DurableObject } from 'cloudflare:workers';
import worker from './worker.ts';
import { handleUserStateDoRequest } from './user-do.ts';
import type { Env } from './store.ts';

export class UserStateDO extends DurableObject<Env> {
  fetch(request: Request): Promise<Response> {
    return handleUserStateDoRequest(this.ctx as any, this.env, request);
  }
}

export default worker;
