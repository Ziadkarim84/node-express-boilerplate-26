import type { Transaction } from 'sequelize';
import { sequelize } from './index.js';

/**
 * Runs `callback` inside `transaction` when one is supplied, otherwise opens
 * a new one and commits / rolls back around the callback. Lets a service
 * function be called standalone or composed into a larger unit of work:
 *
 *   export function verifyPayment(id, actor, tx?) {
 *     return createOrReturnTransaction(tx, async (t) => { ... });
 *   }
 *
 * Same helper as our other services; keep the signature unchanged.
 */
export async function createOrReturnTransaction<T>(
  transaction: Transaction | null | undefined,
  callback: (transaction: Transaction) => Promise<T>,
): Promise<T> {
  if (transaction) {
    return callback(transaction);
  }
  return sequelize.transaction((tx) => callback(tx));
}
